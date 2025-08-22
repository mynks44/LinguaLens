import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { TranslateService } from '../../core/services/translate.service';
import { TtsService } from '../../core/services/tts.service';
import { tokenizePreserve, isWord } from '../../core/utils/tokenize';
import { PopupTranslationComponent } from '../../components/popup-translation/popup-translation.component';
import { firstValueFrom } from 'rxjs';
import { KnownWordsService } from '../../core/services/known-words.service';
import { MeaningService } from '../../core/services/meaning.service';
import { AudioPlayerComponent } from '../../components/audio-player/audio-player.component';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, NgStyle, PopupTranslationComponent, AudioPlayerComponent],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent {
  sourceText = '';
  fromLang = 'en';
  toLang = 'fr';
  tokens: string[] = [];

  popup = {
    visible: false, x: 0, y: 0,
    text: '', translation: '',
    phonetic: null as string | null,
    dictAudioUrl: null as string | null,
    definitions: [] as { pos?: string; def: string; example?: string }[],
    synonyms: [] as string[]
  };

  isWord = isWord;

  constructor(
    private translate: TranslateService,
    private tts: TtsService,
    private known: KnownWordsService,
    private meaning: MeaningService
  ) {}

  async doTranslate() {
    try {
      const res = await firstValueFrom(
        this.translate.translate(this.sourceText, this.fromLang, this.toLang)
      );
      const translatedText = res?.translatedText || '';
      this.tokens = tokenizePreserve(translatedText);
      this.hidePopup();
    } catch (e) {
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
      // back translation for clarity
      const back = await firstValueFrom(
        this.translate.translate(word, this.toLang, this.fromLang)
      );
      const backText = back?.translatedText || '';

      // dictionary lookup in EN
      let dictLookupWord = word;
      if (this.toLang !== 'en') {
        const toEn = await firstValueFrom(this.translate.translate(word, this.toLang, 'en'));
        dictLookupWord = toEn?.translatedText || word;
      }

      let phonetic: string | null = null, dictAudioUrl: string | null = null;
      let defs: { pos?: string; def: string; example?: string }[] = [];
      let syns: string[] = [];

      try {
        const entries = await firstValueFrom(this.meaning.getDictionaryEN(dictLookupWord));
        phonetic = this.meaning.firstPhoneticText(entries);
        dictAudioUrl = this.meaning.firstPronunciationAudio(entries);
        defs = this.meaning.flattenDefinitions(entries).slice(0, 6);
      } catch {}

      try {
        const synList = await firstValueFrom(this.meaning.getSynonymsEN(dictLookupWord));
        syns = (synList || []).map(x => x.word).slice(0, 10);
      } catch {}

      this.popup = {
        visible: true, x: ev.clientX, y: ev.clientY,
        text: word, translation: backText,
        phonetic, dictAudioUrl, definitions: defs, synonyms: syns
      };
    } catch (e) {
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
        translation: res?.translatedText || '',
        phonetic: null,
        dictAudioUrl: null,
        definitions: [],
        synonyms: []
      };
    } catch (e) {
      alert('Selection lookup failed. Please try again.');
      console.error(e);
    }
  }

  speak(text?: string) {
    this.tts.speak(text || this.tokens.join(' '), this.toLangToBcp47());
  }

  playPronAudio() {
    if (!this.popup.dictAudioUrl) return;
    const a = new Audio(this.popup.dictAudioUrl);
    a.play().catch(() => {});
  }

  async markKnown() {
    if (this.popup.text) {
      try {
        await this.known.add(this.popup.text, this.toLang);
        alert(`Saved as known: "${this.popup.text}" [${this.toLang}]`);
      } catch (e) {
        alert('Could not save the word. Check your internet and Firebase/local storage config.');
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
