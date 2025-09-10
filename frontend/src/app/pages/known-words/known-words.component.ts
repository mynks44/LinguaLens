import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from '../auth/auth.service';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, DatePipe } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class KnownWordsService {
  private db = inject(Firestore);
  private auth = inject(AuthService);

  private pathFor(uid: string) { return `users/${uid}/knownWords`; }

  async add(word: string, lang: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not signed in');
    const id = `${lang}:${word.toLowerCase()}`;
    await setDoc(doc(this.db, this.pathFor(uid), id), {
      word, lang, createdAt: Date.now()
    }, { merge: true });
  }

  async list({ lang, q }: { lang?: string, q?: string }) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not signed in');
    const snap = await getDocs(collection(this.db, this.pathFor(uid)));
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return items.filter(w =>
      (!q || (w.word || '').toLowerCase().includes(q.toLowerCase())) &&
      (!lang || w.lang === lang)
    );
  }

  async removeById(id: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not signed in');
    await deleteDoc(doc(this.db, this.pathFor(uid), id));
  }

  async clearAll() {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not signed in');
    const snap = await getDocs(collection(this.db, this.pathFor(uid)));
    const batch = writeBatch(this.db);
    snap.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
}

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

  words: any[] = [];
  filtered: any[] = [];
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
      (!qlc || (w.word || '').toLowerCase().includes(qlc)) &&
      (!this.filterLang || w.lang === this.filterLang)
    );
  }

  async remove(w: any) {
    if (!w.id) return;
    if (confirm(`Remove "${w.word}" [${w.lang}]?`)) {
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
