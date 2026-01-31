import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { KnownWordsService, KnownWord } from '../../core/services/known-words.service';
import { TtsService } from '../../core/services/tts.service';

type LangOption = { code: string; name: string; flag?: string };

@Component({
  selector: 'app-known-words',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './known-words.component.html',
  styleUrls: ['./known-words.component.scss']
})
export class KnownWordsComponent implements OnInit {
  // all words from Firestore
  allWords: KnownWord[] = [];
  // filtered + sorted view
  filteredWords: KnownWord[] = [];

  filterLang = 'all';
  loading = false;
  error = '';

  languages: LangOption[] = [
    { code: 'all', name: 'All languages' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French',  flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'de', name: 'German',  flag: '🇩🇪' },
    { code: 'hi', name: 'Hindi',   flag: '🇮🇳' }
  ];

  langFlags: Record<string, string> = {
    en: '🇺🇸',
    fr: '🇫🇷',
    es: '🇪🇸',
    de: '🇩🇪',
    hi: '🇮🇳'
  };

  constructor(
    private known: KnownWordsService,
    private tts: TtsService
  ) {}

  async ngOnInit() {
    await this.loadWords();
  }

  private async loadWords() {
    this.loading = true;
    this.error = '';
    try {
      const all = await this.known.listAll();
      this.allWords = all;
      this.applyFilter();
    } catch (e) {
      console.error('[KnownWords] load failed', e);
      this.error = 'Failed to load known words. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  onChangeFilter(lang: string) {
    this.filterLang = lang;
    this.applyFilter();
  }

  private applyFilter() {
    const list =
      this.filterLang === 'all'
        ? [...this.allWords]
        : this.allWords.filter(w => w.lang === this.filterLang);

    // sort newest first
    this.filteredWords = list.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
  }

  trackByWord(idx: number, w: KnownWord) {
    // stable id per word/lang
    return `${w.lang}_${w.text}`;
  }

  speak(word: KnownWord) {
    if (!word.text) return;
    this.tts.speak(word.text, this.langToBcp47(word.lang));
  }

  private langToBcp47(lang: string) {
    const map: Record<string, string> = {
      en: 'en-US',
      fr: 'fr-FR',
      es: 'es-ES',
      de: 'de-DE',
      hi: 'hi-IN'
    };
    return map[lang] || lang;
  }

  async clearAll() {
    if (!this.allWords.length) return;
    if (!confirm(`Clear all ${this.allWords.length} known word(s)?`)) return;

    try {
      await this.known.clearAll();
      this.allWords = [];
      this.applyFilter();
    } catch (e) {
      console.error('[KnownWords] clearAll failed', e);
      alert('Failed to clear known words. Please try again.');
    }
  }

  async removeWord(w: KnownWord) {
    if (!confirm(`Remove "${w.text}" (${w.lang.toUpperCase()})?`)) return;

    try {
      await this.known.remove(w.text, w.lang);
      this.allWords = this.allWords.filter(
        item => !(item.text === w.text && item.lang === w.lang)
      );
      this.applyFilter();
    } catch (e) {
      console.error('[KnownWords] removeWord failed', e);
      alert('Failed to remove word. Please try again.');
    }
  }
}
