import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { TranslateService } from '../../core/services/translate.service';
import { TtsService } from '../../core/services/tts.service';
import { tokenizePreserve, isWord } from '../../core/utils/tokenize';
import { PopupTranslationComponent } from '../../components/popup-translation/popup-translation.component';
import { firstValueFrom } from 'rxjs';
import { KnownWordsService } from '../../core/services/known-words.service';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, PopupTranslationComponent],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent {
  sourceText = '';
  fromLang = 'en';
  toLang = 'fr';
  tokens: string[] = [];

  popup = { visible: false, x: 0, y: 0, text: '', translation: '' };
  isWord = isWord;

  constructor(
    private translate: TranslateService,
    private tts: TtsService,
    private known: KnownWordsService
  ) {}

  async doTranslate() {
    try {
      const res = await firstValueFrom(
        this.translate.translate(this.sourceText, this.fromLang, this.toLang)
      );
      const translatedText = res?.translatedText || '';
      this.tokens = tokenizePreserve(translatedText);
      this.hidePopup();
    } catch (e: any) {
      alert('Translate failed. Please try again.');
      console.error(e);
    }
  }

  async clickToken(ev: MouseEvent) {
    const el = ev.target as HTMLElement;
    if (!el.classList.contains('tok')) return;
    const word = (el.textContent || '').trim();
    if (!word || !isWord(word)) return;

    try {
      const res = await firstValueFrom(
        this.translate.translate(word, this.toLang, this.fromLang)
      );
      this.popup = {
        visible: true,
        x: ev.clientX,
        y: ev.clientY,
        text: word,
        translation: res?.translatedText || ''
      };
    } catch (e: any) {
      alert('Lookup failed. Please try again.');
      console.error(e);
    }
  }

  async mouseUpSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
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
        x: rect.right,
        y: rect.top,
        text,
        translation: res?.translatedText || ''
      };
    } catch (e: any) {
      alert('Selection lookup failed. Please try again.');
      console.error(e);
    }
  }

  speak(text?: string) {
    this.tts.speak(text || this.tokens.join(' '), this.toLangToBcp47());
  }

  async markKnown() {
    if (this.popup.text) {
      try {
        await this.known.add(this.popup.text, this.toLang); 
        alert(`Saved as known: "${this.popup.text}" [${this.toLang}]`);
      } catch (e: any) {
        alert('Could not save the word. Check your internet and Firebase rules.');
        console.error(e);
      }
    }
    this.hidePopup();
  }

  hidePopup() { this.popup.visible = false; }

  toLangToBcp47() {
    const m: Record<string, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', hi: 'hi-IN' };
    return m[this.toLang] || this.toLang;
  }
}
