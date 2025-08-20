import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, where, orderBy, writeBatch
} from 'firebase/firestore';

export type KnownWord = { id?: string; text: string; lang: string; addedAt: number; userId?: string };

const LOCAL_STORAGE_KEY = 'lc_known_words_v1';
const MIGRATION_FLAG = 'lc_known_words_migrated_v1';

@Injectable({ providedIn: 'root' })
export class KnownWordsService {
  constructor(private fb: FirebaseService) {}

  private col() { return collection(this.fb.db, 'knownWords'); }

  private async migrateIfNeeded() {
    await this.fb.ready;
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) { localStorage.setItem(MIGRATION_FLAG, '1'); return; }

    try {
      const items: Array<{ text: string; lang: string; addedAt: number }> = JSON.parse(raw) || [];
      if (!items.length) { localStorage.setItem(MIGRATION_FLAG, '1'); return; }

      const uid = this.fb.uid();
      if (!uid) throw new Error('No UID after anon auth');

      let batch = writeBatch(this.fb.db);
      let count = 0;

      for (const w of items) {
        const ref = doc(this.col());
        batch.set(ref, {
          userId: uid,
          text: String(w.text || '').trim(),
          lang: String(w.lang || '').trim(),
          addedAt: Number(w.addedAt || Date.now())
        });
        if (++count % 450 === 0) { await batch.commit(); batch = writeBatch(this.fb.db); }
      }
      await batch.commit();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.setItem(MIGRATION_FLAG, '1');
      console.info(`[KnownWords] Migrated ${count} legacy items`);
    } catch (e: any) {
      console.warn('[KnownWords] migration failed:', e?.message || e);
    }
  }

async list(filter?: { lang?: string; q?: string }): Promise<KnownWord[]> {
  await this.fb.ready;
  await this.migrateIfNeeded();

  const uid = this.fb.uid();
  if (!uid) throw new Error('No UID');

  const clauses = [where('userId', '==', uid)];
  if (filter?.lang) clauses.push(where('lang', '==', filter.lang));

  const qref = query(this.col(), ...clauses);

  const snap = await getDocs(qref);
  let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as KnownWord);

  if (filter?.q) {
    const qlc = filter.q.toLowerCase();
    items = items.filter(x => x.text?.toLowerCase().includes(qlc));
  }

  items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  return items;
}


  async has(text: string, lang: string) {
    const t = (text || '').trim().toLowerCase();
    if (!t || !lang) return false;
    const items = await this.list({ lang });
    return items.some(w => w.text?.toLowerCase() === t);
  }

  async add(text: string, lang: string) {
    await this.fb.ready;
    await this.migrateIfNeeded();

    const t = (text || '').trim();
    if (!t) return;

    const uid = this.fb.uid();
    if (!uid) throw new Error('No UID');

    if (await this.has(t, lang)) return;

    try {
      await addDoc(this.col(), { userId: uid, text: t, lang, addedAt: Date.now() });
    } catch (e: any) {
      console.error('[KnownWords] add failed:', e?.code, e?.message || e);
      throw e;
    }
  }

  async removeById(id: string) {
    await this.fb.ready;
    await deleteDoc(doc(this.fb.db, 'knownWords', id));
  }

  async clearAll() {
    const items = await this.list();
    for (const w of items) if (w.id) await this.removeById(w.id);
  }

  async statsByLang() {
    const items = await this.list();
    return items.reduce<Record<string, number>>((acc, w) => ((acc[w.lang] = (acc[w.lang] || 0) + 1), acc), {});
  }

  async exportJson() {
    const items = await this.list();
    return JSON.stringify(items, null, 2);
  }
}
