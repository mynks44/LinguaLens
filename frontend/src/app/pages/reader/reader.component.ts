import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { translateLongText, translateMany } from '../../core/services/translate-batch';

import { TranslateService } from '../../core/services/translate.service';
import { TranslateCacheService } from '../../core/services/translate-cache.service';
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

  /** Cache of meanings keyed by lower-case token text */
  wordMeanings: Map<string, { abstract: string; contextual: string }> = new Map();

  popup: PopupState = {
    visible: false, x: 0, y: 0, original: '', translation: '', isWordPopup: false
  };

  /** NEW: tiny popup that shows only translation + speaker */
  miniPopup: MiniPopupState = {
    visible: false, x: 0, y: 0, translation: ''
  };

  /** Multiple small popups for each selected token/segment */
  selectionPopups: Array<{ index: number; word: string; x: number; y: number; translation: string; visible: boolean }> = [];
  private lastSelectionRange: Range | null = null;

  /** Store last sentence selection range so we can anchor words inside it */
  private lastSentenceRange: Range | null = null;
  private selectionTimer: any = null;

  constructor(
    private translate: TranslateService,
    private translateCache: TranslateCacheService,
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
      // eagerly prefetch per-word and short-phrase meanings into the cache
      this.translateCache.initForText(translatedText, this.tokens, this.fromLang, this.toLang)
        .catch(err => console.warn('TranslateCache prefetch failed', err));
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
      const key = word.trim();
      const cached = this.translateCache.lookup(key);
      const backText = cached ? (cached.contextual || cached.abstract) :
        await translateLongText(this.translate, word, this.toLang, this.fromLang);
      const rect = tok.getBoundingClientRect();

      this.hideMiniPopup();
      this.popup = {
        visible: true,
        x: Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8),
        y: Math.max(rect.top - 6, 8),
        original: this.sanitizeText(word),
  translation: this.sanitizeText(backText || ''),
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

      // clear any previous selection highlights/popups
      this.clearSelectionHighlights();
      this.selectionPopups = [];

      // try to map selected words to token spans (contiguous sequence if possible)
      const WORD_RE_LOCAL = /[\p{L}\p{M}\p{N}’'’-]+/gu;
      const selWords = Array.from((raw || '').matchAll(WORD_RE_LOCAL)).map(m => (m[0] || '').trim()).filter(Boolean);
      const spans = Array.from(rightPane.querySelectorAll<HTMLElement>('.tok.word .w'));

      let matchedIndexes: number[] = [];
      if (selWords.length) {
        // try to find contiguous sequence of spans matching selection words
        const lowerSel = selWords.map(s => s.toLowerCase());
        for (let i = 0; i <= spans.length - lowerSel.length; i++) {
          let ok = true;
          for (let j = 0; j < lowerSel.length; j++) {
            if ((spans[i + j].textContent || '').trim().toLowerCase() !== lowerSel[j]) { ok = false; break; }
          }
          if (ok) {
            matchedIndexes = Array.from({ length: lowerSel.length }, (_, k) => i + k);
            break;
          }
        }
        // fallback: match each selected word to first unused span occurrence
        if (!matchedIndexes.length) {
          const used = new Set<number>();
          for (const w of lowerSel) {
            const idx = spans.findIndex((sp, ii) => !used.has(ii) && (sp.textContent || '').trim().toLowerCase() === w);
            if (idx >= 0) { used.add(idx); matchedIndexes.push(idx); }
          }
        }
      }

      // create small popups for each matched span — translate per-word in batch for selected area
      try {
        let perWordTranslations: string[] = [];
        if (selWords.length) {
          try {
            perWordTranslations = await translateMany(this.translate, selWords, this.toLang, this.fromLang);
          } catch (e) {
            // fallback: leave array empty and resolve per-word individually later
            perWordTranslations = [];
          }
        }

        // simple layout: group by visual row to avoid overlap
        const rowCounts = new Map<number, number>();
        const rowTolerance = 10; // px

        for (let idx = 0; idx < matchedIndexes.length; idx++) {
          const si = matchedIndexes[idx];
          const spEl = spans[si];
          if (!spEl) continue;
          const tokEl = spEl.closest('.tok') as HTMLElement | null;
          if (tokEl) tokEl.classList.add('selected');
          const rect = spEl.getBoundingClientRect();
          const word = (spEl.textContent || '').trim();

          // decide translation: prefer per-word translation within selection, else cached, else individual translate
          let translation = '';
          if (perWordTranslations && perWordTranslations[idx]) translation = perWordTranslations[idx];
          else {
            const cached = this.translateCache.lookup(word);
            if (cached) translation = cached.contextual || cached.abstract || '';
            else {
              try { translation = (await translateLongText(this.translate, word, this.toLang, this.fromLang)) || ''; }
              catch (e) { translation = ''; }
            }
          }

          // compute non-overlapping Y by grouping nearby rect.top values
          const rowKey = Math.round(rect.top / rowTolerance);
          const stackIndex = (rowCounts.get(rowKey) || 0);
          rowCounts.set(rowKey, stackIndex + 1);
          const baseY = Math.max(rect.top - 6, 8);
          const y = baseY - stackIndex * 56; // 56px per stacked popup
          const x = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8);

          this.selectionPopups.push({ index: si, word, x, y, translation: this.sanitizeText(translation || ''), visible: true });
        }
        // save selection for consolidation (key 'a')
        this.lastSelectionRange = range.cloneRange();
        this.lastSentenceRange = range.cloneRange();
      } catch (e) {
        console.error('mouseUpSelection popups error', e);
      }

      // record seen words as before
      const uid = this.fb.uid() || 'anon';
      const uniqueSeen = uniqPreserveFirstLower(extractWordsOrdered(text)).slice(0, 50);
      for (const w of uniqueSeen) {
        this.progress.recordEvent(uid, w, this.toLang, 'seen')
          .subscribe({ next: () => {}, error: () => {} });
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
      const key = w;
      const cached = this.translateCache.lookup(key);
      const back = cached ? (cached.contextual || cached.abstract) :
        await translateLongText(this.translate, w, this.toLang, this.fromLang);
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

  // prefetching is now handled by TranslateCacheService

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
      this.clearSelectionHighlights();
      this.selectionPopups = [];
      this.lastSelectionRange = null;
      this.lastSentenceRange = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc() {
    this.hidePopup();
    this.hideMiniPopup();
    this.clearSelectionHighlights();
    this.selectionPopups = [];
    this.lastSelectionRange = null;
    this.lastSentenceRange = null;
  }

  @HostListener('document:keydown', ['$event'])
  async onAnyKey(ev: KeyboardEvent) {
    if (!ev || ev.key.toLowerCase() !== 'a') return;
    // consolidate individual cloud popups into single full-phrase translation
    if (!this.selectionPopups || !this.selectionPopups.length) return;
    const selRange = this.lastSelectionRange;
    if (!selRange) return;
    const raw = selRange.toString();
    const text = this.sanitizeText(raw);
    if (!text) return;

    try {
      // remove individual clouds/highlights
      this.clearSelectionHighlights();
      this.selectionPopups = [];

      const sentenceTr = await translateLongText(this.translate, text, this.toLang, this.fromLang);
      const rect = selRange.getBoundingClientRect();
      const anchorX = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8);
      const anchorY = Math.max(rect.top - 6, 8);

      this.popup = {
        visible: true,
        x: anchorX,
        y: anchorY,
        original: text,
        translation: this.sanitizeText(sentenceTr || ''),
        isWordPopup: false
      };
      this.hideMiniPopup();
      this.lastSentenceRange = selRange.cloneRange();
    } catch (e) {
      this.handleTranslateError(e, 'consolidateSelection');
    }
  }

  private clearSelectionHighlights() {
    try {
      const rightPane: HTMLElement = (this.elRef.nativeElement as HTMLElement).querySelector('.right')!;
      const sels = Array.from(rightPane.querySelectorAll<HTMLElement>('.tok.selected'));
      for (const s of sels) s.classList.remove('selected');
    } catch (e) { /* ignore */ }
  }
}
