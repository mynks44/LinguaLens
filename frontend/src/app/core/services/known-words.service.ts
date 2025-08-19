import { Injectable } from '@angular/core';

export type KnownWord = {
  text: string;          
  lang: string;          
  addedAt: number;       
};

const STORAGE_KEY = 'lc_known_words_v1';

@Injectable({ providedIn: 'root' })
export class KnownWordsService {
  private cache: KnownWord[] = this.load();

  private load(): KnownWord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as KnownWord[]) : [];
    } catch {
      return [];
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
  }

  list(): KnownWord[] {
    // newest first
    return [...this.cache].sort((a, b) => b.addedAt - a.addedAt);
  }

  has(text: string, lang: string): boolean {
    const t = text.trim().toLowerCase();
    return this.cache.some(w => w.lang === lang && w.text.toLowerCase() === t);
  }

  add(text: string, lang: string) {
    const t = (text || '').trim();
    if (!t) return;
    if (!this.has(t, lang)) {
      this.cache.push({ text: t, lang, addedAt: Date.now() });
      this.save();
    }
  }

  remove(text: string, lang: string) {
    const t = text.trim().toLowerCase();
    this.cache = this.cache.filter(w => !(w.lang === lang && w.text.toLowerCase() === t));
    this.save();
  }

  clearAll() {
    this.cache = [];
    this.save();
  }

  statsByLang(): Record<string, number> {
    return this.cache.reduce<Record<string, number>>((acc, w) => {
      acc[w.lang] = (acc[w.lang] || 0) + 1;
      return acc;
    }, {});
  }

  exportJson(): string {
    return JSON.stringify(this.list(), null, 2);
  }
}
