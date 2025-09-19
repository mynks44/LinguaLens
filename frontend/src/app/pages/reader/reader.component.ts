import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { translateLongText, translateMany } from '../../core/services/translate-batch';

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
  text: string;
  translation: string;
  perWord?: { src: string; dst: string }[];
};

const WORD_RE = /[\p{L}\p{M}\p{N}’'’-]+/gu; // letters/marks/numbers/apostrophes/hyphens
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
    visible: false,
    x: 0,
    y: 0,
    text: '',
    translation: '',
    perWord: []
  };

  private selectionTimer: any = null;
  private wordCache = new Map<string, string>(); 
  tss: any;

  constructor(
    private translate: TranslateService,
    private tts: TtsService,
    private known: KnownWordsService,
    private progress: ProgressService,
    private fb: FirebaseService,
    private elRef: ElementRef
  ) {}

  isWord(t: Token) { return t.kind === 'word'; }

  private sanitizeText(s: string): string {
    const SPEAKER = /[\u{1F50A}\u{1F509}\u{1F508}]/gu; // 🔊 🔉 🔈
    return (s || '')
      .replace(SPEAKER, '')
      .replace(/\s+/g, ' ')
      .replace(/ ?' ?/g, "'")
      .trim();
  }

  toLangToBcp47() {
    const m: Record<string, string> = {
      en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', hi: 'hi-IN'
    };
    return m[this.toLang] || this.toLang;
  }

  hidePopup() { this.popup.visible = false; }

  async doTranslate() {
    try {
      const translatedText = await translateLongText(
        this.translate,
        this.sourceText,
        this.fromLang,
        this.toLang
      );
      this.tokens = tokenizeToArray(translatedText);
      this.hidePopup();

      const uid = this.fb.uid() || 'anon';
      const words = Array.from(new Set(this.tokens.filter(t => this.isWord(t)).map(t => t.text)));
      for (const w of words.slice(0, 50)) {
        this.progress.recordEvent(uid, w, this.toLang, 'seen').subscribe({ next: () => {}, error: () => {} });
      }
    } catch (e) {
      alert('Translate failed. Please try again.');
      console.error(e);
    }
  }

  async clickToken(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    const tok = target.closest('.tok') as HTMLElement | null;
    if (!tok) return;

    const word = (tok.querySelector('.w')?.textContent || '').trim();
    if (!word || !isWordToken(word)) return;

    try {
      const backText = await translateLongText(this.translate, word, this.toLang, this.fromLang);

      this.popup = {
        visible: true,
        x: ev.clientX,
        y: ev.clientY,
        text: this.sanitizeText(word),
        translation: this.sanitizeText(backText),
        perWord: [{ src: word, dst: this.sanitizeText(backText) }]
      };
    } catch (e) {
      alert('Lookup failed. Please try again.');
      console.error(e);
    }
  }

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

      const rect = range.getBoundingClientRect();
      const anchorX = Math.min(Math.max(rect.right, 8), window.innerWidth - 380);
      const anchorY = Math.min(Math.max(rect.top, 8), window.innerHeight - 220);

      try {
        const sentenceTr = await translateLongText(this.translate, text, this.toLang, this.fromLang);

        const words = extractWordsOrdered(text);

        let perWord: { src: string; dst: string }[];
        if (words.length > 1) {
          const uniques = uniqPreserveFirstLower(words);

          const misses: string[] = [];
          const got = new Map<string, string>();
          for (const w of uniques) {
            const key = `${this.toLang}->${this.fromLang}:${w.toLowerCase()}`;
            if (this.wordCache.has(key)) {
              got.set(w.toLowerCase(), this.wordCache.get(key)!);
            } else {
              misses.push(w);
            }
          }

          if (misses.length) {
            const translated = await translateMany(this.translate, misses, this.toLang, this.fromLang);
            misses.forEach((w, i) => {
              const key = `${this.toLang}->${this.fromLang}:${w.toLowerCase()}`;
              const val = (translated[i] || '').trim();
              this.wordCache.set(key, val);
              got.set(w.toLowerCase(), val);
            });
          }

          perWord = words.map(w => ({ src: w, dst: got.get(w.toLowerCase()) || '' }));
        } else {
          perWord = [{ src: text, dst: sentenceTr }];
        }

        this.popup = {
          visible: true,
          x: anchorX,
          y: anchorY,
          text,
          translation: this.sanitizeText(sentenceTr || ''),
          perWord
        };

        const uid = this.fb.uid() || 'anon';
        const uniqueSeen = uniqPreserveFirstLower(words).slice(0, 50);
        for (const w of uniqueSeen) {
          this.progress.recordEvent(uid, w, this.toLang, 'seen')
            .subscribe({ next: () => {}, error: () => {} });
        }
      } catch (e) {
        console.error('Selection translate failed:', e);
      }
    }, 10);
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

  ngOnInit() {
    window.addEventListener('speak-word', ((e: any) => {
      this.speakWord(e.detail);
    }) as EventListener);
  }

  pause()  { this.tts.pause(); }
  resume() { this.tss?.resume?.(); this.tts.resume(); }
  stop()   { this.tts.stop(); }

  async markKnown() {
    if (!this.popup.text) return;
    try {
      await this.known.add(this.popup.text, this.toLang);
      const uid = this.fb.uid() || 'anon';
      this.progress.recordEvent(uid, this.popup.text, this.toLang, 'known')
        .subscribe({ next: () => {}, error: () => {} });
      alert(`Saved as known: "${this.popup.text}" [${this.toLang}]`);
    } catch (e) {
      alert('Could not save the word. Check your internet and Firebase rules.');
      console.error(e);
    }
    this.hidePopup();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.popup.visible) return;
    const target = ev.target as HTMLElement;
    const insidePopup = !!target.closest('.popup');
    const onToken = !!target.closest('.tok');
    if (!insidePopup && !onToken) this.hidePopup();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc() { this.hidePopup(); }
}
