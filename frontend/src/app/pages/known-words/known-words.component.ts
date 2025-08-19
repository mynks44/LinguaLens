import { Component } from '@angular/core';
import { KnownWord, KnownWordsService } from '../../core/services/known-words.service';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, DatePipe } from '@angular/common';

@Component({
  selector: 'app-known-words',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe],
  templateUrl: './known-words.component.html',
  styleUrls: ['./known-words.component.scss']
})
export class KnownWordsComponent {
  words: KnownWord[] = [];
  filtered: KnownWord[] = [];
  q = '';
  filterLang = '';
  langs: string[] = [];
  statEntries: [string, number][] = [];

  constructor(private known: KnownWordsService) {}

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.words = this.known.list();
    this.langs = Array.from(new Set(this.words.map(w => w.lang))).sort();
    const stats = this.known.statsByLang();
    this.statEntries = Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]));
    this.applyFilters();
  }

  applyFilters() {
    const q = this.q.trim().toLowerCase();
    this.filtered = this.words.filter(w =>
      (!q || w.text.toLowerCase().includes(q)) &&
      (!this.filterLang || w.lang === this.filterLang)
    );
  }

  remove(w: KnownWord) {
    if (confirm(`Remove "${w.text}" [${w.lang}] from known words?`)) {
      this.known.remove(w.text, w.lang);
      this.refresh();
    }
  }

  clearAll() {
    if (confirm('Clear ALL known words?')) {
      this.known.clearAll();
      this.refresh();
    }
  }

  exportFile() {
    const blob = new Blob([this.known.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'known-words.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
