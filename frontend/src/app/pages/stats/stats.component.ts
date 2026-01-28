import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { KnownWordsService, KnownWord } from '../../core/services/known-words.service';

type StatsByLang = Record<string, number>;

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  hi: 'Hindi'
};

const LANG_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
  de: '🇩🇪',
  hi: '🇮🇳'
};

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {
  words: KnownWord[] = [];
  stats: StatsByLang = {};
  totalWords = 0;
  recentWords: KnownWord[] = [];
  loading = false;
  error = '';

  maxCount = 1;

  async ngOnInit() {
    this.loading = true;
    this.error = '';

    try {
      // Inject service manually to avoid constructor signature confusion:
      // Better pattern is normal DI; assuming you add constructor like:
      // constructor(private known: KnownWordsService) {}
      // I'll use that below.
    } catch (e) {
      // NO-OP
    }
  }

  constructor(private known: KnownWordsService) {}

  async load() {
    try {
      const all = await this.known.listAll();
      this.words = all;
      this.totalWords = all.length;

      this.buildStats();
      this.buildRecent();
    } catch (e) {
      console.error('[Stats] load failed', e);
      this.error = 'Failed to load stats. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async ngAfterViewInit() {
    // Actually load words once the view is ready
    await this.load();
  }

  private buildStats() {
    const stats: StatsByLang = {};
    for (const w of this.words) {
      stats[w.lang] = (stats[w.lang] || 0) + 1;
    }
    this.stats = stats;
    const vals = Object.values(stats);
    this.maxCount = vals.length ? Math.max(...vals, 1) : 1;
  }

  private buildRecent() {
    this.recentWords = [...this.words]
      .sort(
        (a, b) =>
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      )
      .slice(0, 5);
  }

  langName(lang: string) {
    return LANG_NAMES[lang] || lang.toUpperCase();
  }

  langFlag(lang: string) {
    return LANG_FLAGS[lang] || '🌐';
  }

  barWidth(count: number): string {
    if (!this.maxCount) return '0%';
    return `${(count / this.maxCount) * 100}%`;
  }
}
