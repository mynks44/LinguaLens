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
  constructor(private translate: TranslateService, private tts: TtsService,   private known: KnownWordsService) {}

  async doTranslate() {
    const res = await firstValueFrom(this.translate.translate(this.sourceText, this.fromLang, this.toLang));
    const translatedText = res?.translatedText || '';
    this.tokens = tokenizePreserve(translatedText);
    this.hidePopup();
  }

  async clickToken(ev: MouseEvent) {
    const el = ev.target as HTMLElement;
    if (!el.classList.contains('tok')) return;
    const word = (el.textContent || '').trim();
    if (!word || !isWord(word)) return;

    const res = await firstValueFrom(this.translate.translate(word, this.toLang, this.fromLang));
    this.popup = { visible: true, x: ev.clientX, y: ev.clientY, text: word, translation: res?.translatedText || '' };
  }

  async mouseUpSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const res = await firstValueFrom(this.translate.translate(text, this.toLang, this.fromLang));
    this.popup = { visible: true, x: rect.right, y: rect.top, text, translation: res?.translatedText || '' };
  }

  speak(text?: string) {
    this.tts.speak(text || this.tokens.join(' '), this.toLangToBcp47());
  }
  // markKnown() { this.hidePopup(); } 
  
  markKnown() {
  if (this.popup.text) {
    // save the selected word/phrase in the TARGET language (the one you’re learning)
    this.known.add(this.popup.text, this.toLang);
    alert(`Saved as known: "${this.popup.text}" [${this.toLang}]`);
  }
  this.hidePopup();
}

  hidePopup() { this.popup.visible = false; }

  toLangToBcp47() {
    const m: any = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', hi: 'hi-IN' };
    return m[this.toLang] || this.toLang;
  }
}
