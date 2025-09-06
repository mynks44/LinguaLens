import { Component, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { TranslateService } from '../../core/services/translate.service';
import { TtsService } from '../../core/services/tts.service';
import { KnownWordsService } from '../../core/services/known-words.service';
import { ProgressService } from '../../core/services/progress.service';
import { FirebaseService } from '../../core/services/firebase.service';

import { tokenizePreserve, isWord } from '../../core/utils/tokenize';
import { PopupTranslationComponent } from '../../components/popup-translation/popup-translation.component';

type PopupState = {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  translation: string;
};

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, NgStyle, PopupTranslationComponent],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent {
  sourceText = '';
  fromLang = 'en';
  toLang = 'fr';
  tokens: string[] = [];

  popup: PopupState = { visible: false, x: 0, y: 0, text: '', translation: '' };

  isWord = isWord;
  private selectionTimer: any = null;
  tss: any;

  constructor(
    private translate: TranslateService,
    private tts: TtsService,
    private known: KnownWordsService,
    private progress: ProgressService,
    private fb: FirebaseService,
    private elRef: ElementRef
  ) {}


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
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
    de: 'de-DE',
    hi: 'hi-IN'
  };
  return m[this.toLang] || this.toLang;
}


  hidePopup() { this.popup.visible = false; }


  async doTranslate() {
    try {
      const res = await firstValueFrom(
        this.translate.translate(this.sourceText, this.fromLang, this.toLang)
      );
      const translatedText = res?.translatedText || '';
      this.tokens = tokenizePreserve(translatedText);
      this.hidePopup();

      const uid = this.fb.uid() || 'anon';
      const words = Array.from(new Set(this.tokens.filter(t => isWord(t))));
      for (const w of words.slice(0, 50)) {
        this.progress
          .recordEvent(uid, w, this.toLang, 'seen')
          .subscribe({ next: () => {}, error: () => {} });
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
    if (!word || !isWord(word)) return;

    try {
      const back = await firstValueFrom(
        this.translate.translate(word, this.toLang, this.fromLang)
      );

      this.popup = {
        visible: true,
        x: ev.clientX,
        y: ev.clientY,
        text: this.sanitizeText(word),
        translation: this.sanitizeText(back?.translatedText || '')
      };
    } catch (e) {
      alert('Lookup failed. Please try again.');
      console.error(e);
    }
  }

  async mouseUpSelection() {
    clearTimeout(this.selectionTimer);
    this.selectionTimer = setTimeout(async () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = this.sanitizeText(sel.toString());
      if (!text) return;

      const range = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!range) return;
      const rect = range.getBoundingClientRect();

      try {
        const res = await firstValueFrom(
          this.translate.translate(text, this.toLang, this.fromLang)
        );

        this.popup = {
          visible: true,
          x: Math.min(Math.max(rect.right, 8), window.innerWidth - 380),
          y: Math.min(Math.max(rect.top, 8), window.innerHeight - 220),
          text,
          translation: this.sanitizeText(res?.translatedText || '')
        };
      } catch (e) {
        console.error(e);
      }
    }, 10);
  }


  speakAll() {
    const joined = this.tokens.join(' ');
    if (!joined.trim()) return;
    this.tts.speak(joined, this.toLangToBcp47());
  }


speakWord(word: string) {
  if (!word) return;
  this.tts.speak(word, this.toLangToBcp47());
}

formatWithSpeakers(text: string, isTranslation = false): string {
  const words = text.split(/\s+/);
  return words
    .map(w => {
      if (!w.trim()) return '';
      return `<span class="word-with-speaker">
                <span class="word">${w}</span>
                <button class="icon" onclick="window.dispatchEvent(new CustomEvent('speak-word',{detail:'${w}'}))">🔊</button>
              </span>`;
    })
    .join(' ');
}

ngOnInit() {
  window.addEventListener('speak-word', ((e: any) => {
    this.speakWord(e.detail);
  }) as EventListener);
}


  pause() { this.tts.pause(); }
  resume() { this.tss?.resume?.(); this.tts.resume(); }
  stop() { this.tts.stop(); }


  async markKnown() {
    if (!this.popup.text) return;
    try {
      await this.known.add(this.popup.text, this.toLang);
      const uid = this.fb.uid() || 'anon';
      this.progress
        .recordEvent(uid, this.popup.text, this.toLang, 'known')
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
