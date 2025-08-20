import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { KnownWord, KnownWordsService } from '../../core/services/known-words.service';

@Component({
  selector: 'app-known-words',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe],
  templateUrl: './known-words.component.html',
  styleUrls: ['./known-words.component.scss']
})
export class KnownWordsComponent {
  q = '';
  filterLang = '';

  words: KnownWord[] = [];
  filtered: KnownWord[] = [];
  langs: string[] = [];
  statEntries: [string, number][] = [];

  constructor(private known: KnownWordsService) {}

  async ngOnInit() {
    await this.refresh();
  }

  async refresh() {
    const items = await this.known.list({
      lang: this.filterLang || undefined,
      q: this.q || undefined
    });

    this.words = items;

    this.langs = Array.from(new Set(items.map(w => w.lang))).sort();

    const stats = items.reduce<Record<string, number>>((acc, w) => {
      acc[w.lang] = (acc[w.lang] || 0) + 1;
      return acc;
    }, {});
    this.statEntries = Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0])) as [string, number][];

    this.applyFilters();
  }

  applyFilters() {
    const qlc = this.q.trim().toLowerCase();
    this.filtered = this.words.filter(w =>
      (!qlc || (w.text || '').toLowerCase().includes(qlc)) &&
      (!this.filterLang || w.lang === this.filterLang)
    );
  }

  async remove(w: KnownWord) {
    if (!w.id) return;
    if (confirm(`Remove "${w.text}" [${w.lang}]?`)) {
      await this.known.removeById(w.id);
      await this.refresh();
    }
  }

  async clearAll() {
    if (confirm('Clear ALL known words?')) {
      await this.known.clearAll();
      await this.refresh();
    }
  }

  async exportFile() {
    const json = JSON.stringify(this.words, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'known-words.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
