import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { translateLongText } from '../../core/services/translate-batch';

import { TranslateService } from '../../core/services/translate.service';
import { TtsService } from '../../core/services/tts.service';
import { KnownWordsService } from '../../core/services/known-words.service';
import { ProgressService } from '../../core/services/progress.service';
import { FirebaseService } from '../../core/services/firebase.service';

import { Token, tokenizeToArray, isWordToken } from '../../core/utils/tokenize';
import { PopupTranslationComponent } from '../../components/popup-translation/popup-translation.component';

type PopupState = {
  visible: boolean;
  x: number;
  y: number;
  original: string;     // word or sentence
  translation: string;  // translation
  isWordPopup: boolean; // show actions if true
};

type MiniPopupState = {
  visible: boolean;
  x: number;
  y: number;
  translation: string;
};

const WORD_RE = /[\p{L}\p{M}\p{N}’'’-]+/gu;
function extractWordsOrdered(s: string): string[] {
  return Array.from(s.matchAll(WORD_RE)).map(m => m[0]);
}
function uniqPreserveFirstLower(words: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const w of words) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
  return out;
}

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, NgStyle, PopupTranslationComponent],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent {
  @ViewChild('readerContainer', { static: true }) readerContainer!: ElementRef<HTMLElement>;

  sourceText = '';
  fromLang = 'en';
  toLang   = 'fr';

  tokens: Token[] = [];

  popup: PopupState = {
    visible: false, x: 0, y: 0, original: '', translation: '', isWordPopup: false
  };

  /** NEW: tiny popup that shows only translation + speaker */
  miniPopup: MiniPopupState = {
    visible: false, x: 0, y: 0, translation: ''
  };

  /** Store last sentence selection range so we can anchor words inside it */
  private lastSentenceRange: Range | null = null;
  private selectionTimer: any = null;

  constructor(
    private translate: TranslateService,
    private tts: TtsService,
    private known: KnownWordsService,
    private progress: ProgressService,
    private fb: FirebaseService,
    private elRef: ElementRef
  ) {}

  // --- helpers ---------------------------------------------------------------

  isWord(t: Token) { return t.kind === 'word'; }

  private sanitizeText(s: string): string {
    const SPEAKER = /[\u{1F50A}\u{1F509}\u{1F508}]/gu; // 🔊 🔉 🔈
    return (s || '').replace(SPEAKER, '').replace(/\s+/g, ' ').replace(/ ?' ?/g, "'").trim();
  }

  toLangToBcp47() {
    const m: Record<string, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', hi: 'hi-IN' };
    return m[this.toLang] || this.toLang;
  }
  fromLangToBcp47() {
    const m: Record<string, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', hi: 'hi-IN' };
    return m[this.fromLang] || this.fromLang;
  }

  private handleTranslateError(e: any, context: string) {
    const body = e?.error || e;
    const status = body?.providerStatus ?? e?.status ?? body?.status ?? 0;
    const message = body?.detail ?? body?.error?.detail ?? e?.message ?? '';
    const isQuota = status === 429 || (typeof message === 'string' && /quota|rate.?limit|too\s*many\s*requests/i.test(message));
    alert(isQuota ? 'Free translation quota exceeded. Please try again later or configure a translation key.'
                  : 'Translate failed. Please try again.');
    console.error(`[Translate failed @ ${context}]`, { status, message, raw: e });
  }

  hidePopup()    { this.popup.visible = false; }
  hideMiniPopup(){ this.miniPopup.visible = false; }

  // --- main actions ----------------------------------------------------------

  async doTranslate() {
    try {
      const translatedText = await translateLongText(this.translate, this.sourceText, this.fromLang, this.toLang);
      this.tokens = tokenizeToArray(translatedText);
      this.hidePopup();
      this.hideMiniPopup();

      // record seen
      const uid = this.fb.uid() || 'anon';
      const words = Array.from(new Set(this.tokens.filter(t => this.isWord(t)).map(t => t.text)));
      for (const w of words.slice(0, 50)) {
        this.progress.recordEvent(uid, w, this.toLang, 'seen').subscribe({ next: () => {}, error: () => {} });
      }
    } catch (e) {
      this.handleTranslateError(e, 'doTranslate');
    }
  }

  // Single-word click → big popup with actions
  async clickToken(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    const tok = target.closest('.tok.word') as HTMLElement | null;
    if (!tok) return;

    const word = (tok.querySelector('.w')?.textContent || '').trim();
    if (!word || !isWordToken(word)) return;

    try {
      const backText = await translateLongText(this.translate, word, this.toLang, this.fromLang);
      const rect = tok.getBoundingClientRect();

      this.hideMiniPopup();
      this.popup = {
        visible: true,
        x: Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8),
        y: Math.max(rect.top - 6, 8),
        original: this.sanitizeText(word),
        translation: this.sanitizeText(backText),
        isWordPopup: true
      };
    } catch (e) {
      this.handleTranslateError(e, 'clickToken');
    }
  }

  // Multi-word selection → big popup (no actions) + remember range to anchor words
  async mouseUpSelection() {
    clearTimeout(this.selectionTimer);

    this.selectionTimer = setTimeout(async () => {
      const rightPane: HTMLElement =
        (this.elRef.nativeElement as HTMLElement).querySelector('.right')!;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      if (!rightPane.contains(range.commonAncestorContainer)) return;

      const raw = sel.toString();
      const text = this.sanitizeText(raw);
      if (!text) return;

      try {
        const sentenceTr = await translateLongText(this.translate, text, this.toLang, this.fromLang);

        const rect = range.getBoundingClientRect();
        const anchorX = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8);
        const anchorY = Math.max(rect.top - 6, 8);

        this.popup = {
          visible: true,
          x: anchorX,
          y: anchorY,
          original: text,                                   // show original sentence
          translation: this.sanitizeText(sentenceTr || ''), // show translation
          isWordPopup: false
        };
        this.hideMiniPopup();
        this.lastSentenceRange = range.cloneRange();

        // record seen
        const words = extractWordsOrdered(text);
        const uid = this.fb.uid() || 'anon';
        const uniqueSeen = uniqPreserveFirstLower(words).slice(0, 50);
        for (const w of uniqueSeen) {
          this.progress.recordEvent(uid, w, this.toLang, 'seen')
            .subscribe({ next: () => {}, error: () => {} });
        }
      } catch (e) {
        this.handleTranslateError(e, 'mouseUpSelection');
      }
    }, 10);
  }

  /** NEW: user picked a word inside the big popup → show mini popup at the word location */
  async onPopupPickWord(word: string) {
    const w = (word || '').trim();
    if (!w) return;

    // Find target word span in right pane; prefer within last selected sentence if available
    const rightPane: HTMLElement =
      (this.elRef.nativeElement as HTMLElement).querySelector('.right')!;

    const spans = Array.from(rightPane.querySelectorAll<HTMLElement>('.tok.word .w'))
      .filter(el => (el.textContent || '').trim().toLowerCase() === w.toLowerCase());

    if (!spans.length) return;

    let targetEl: HTMLElement | null = null;
    if (this.lastSentenceRange) {
      const rangeRect = this.lastSentenceRange.getBoundingClientRect();
      targetEl = spans.find(el => {
        const r = el.getBoundingClientRect();
        // a loose check: horizontally overlapping and vertically near the sentence rect
        const horiz = r.right >= rangeRect.left && r.left <= rangeRect.right;
        const vertNear = r.top >= rangeRect.top - 40 && r.bottom <= rangeRect.bottom + 40;
        return horiz && vertNear;
      }) || spans[0];
    } else {
      targetEl = spans[0];
    }

    const rect = targetEl.getBoundingClientRect();

    try {
      const back = await translateLongText(this.translate, w, this.toLang, this.fromLang);
      this.miniPopup = {
        visible: true,
        x: Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8),
        y: Math.max(rect.top - 6, 8),
        translation: this.sanitizeText(back || '')
      };
    } catch (e) {
      this.handleTranslateError(e, 'onPopupPickWord');
    }
  }

  // --- TTS -------------------------------------------------------------------

  speakTranslation() {
    const txt = (this.popup.translation || '').trim();
    if (!txt) return;
    this.tts.speak(txt, this.fromLangToBcp47());
  }

  speakMini() {
    const txt = (this.miniPopup.translation || '').trim();
    if (!txt) return;
    this.tts.speak(txt, this.fromLangToBcp47());
  }

  speakAll() {
    const joined = this.tokens.map(t => t.text).join('');
    if (!joined.trim()) return;
    this.tts.speak(joined, this.toLangToBcp47());
  }

  speakWord(word: string) {
    if (!word) return;
    this.tts.speak(word, this.toLangToBcp47());
  }

  // --- listeners -------------------------------------------------------------

  ngOnInit() {
    window.addEventListener('speak-word', ((e: any) => {
      const w = (e.detail || '').trim();
      if (w) this.tts.speak(w, this.toLangToBcp47());
    }) as EventListener);
  }

  pause()  { this.tts.pause(); }
  resume() { this.tts.resume(); }
  stop()   { this.tts.stop(); }

  async markKnown() {
    const w = (this.popup.original || '').trim();
    if (!w) return;
    try {
      await this.known.add(w, this.toLang);
      const uid = this.fb.uid() || 'anon';
      this.progress.recordEvent(uid, w, this.toLang, 'known')
        .subscribe({ next: () => {}, error: () => {} });
      alert(`Saved as known: "${w}" [${this.toLang}]`);
    } catch (e) {
      alert('Could not save the word. Check your internet and Firebase rules.');
      console.error(e);
    }
    this.hidePopup();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    const insidePopup = !!target.closest('.popup');
    const onToken = !!target.closest('.tok');
    if (!insidePopup && !onToken) {
      this.hidePopup();
      this.hideMiniPopup();
      this.lastSentenceRange = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc() {
    this.hidePopup();
    this.hideMiniPopup();
    this.lastSentenceRange = null;
  }
}
