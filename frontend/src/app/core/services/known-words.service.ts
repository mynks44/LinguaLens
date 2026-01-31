import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export type KnownWord = {
  text: string;
  lang: string;
  addedAt: any; // Firestore Timestamp
};

@Injectable({ providedIn: 'root' })
export class KnownWordsService {
  constructor(private fb: FirebaseService) {}

  private async uidOrThrow(): Promise<string> {
    await this.fb.ready;
    const uid = this.fb.uid();
    if (!uid) throw new Error('Not signed in');
    return uid;
  }

  /** users/{uid}/knownWords */
  private async colRef() {
    const uid = await this.uidOrThrow();
    return collection(this.fb.db, `users/${uid}/knownWords`);
  }

  /** Add/Upsert a known word */
  async add(text: string, lang: string) {
    const uid = await this.uidOrThrow();
    const clean = (text || '').trim().toLowerCase();
    if (!clean) return;

    const id = `${lang}__${clean}`; // stable doc id
    const ref = doc(this.fb.db, `users/${uid}/knownWords/${id}`);

    await setDoc(ref, {
      text: clean,
      lang,
      addedAt: serverTimestamp(),
    }, { merge: true });
  }

  /** Remove a known word */
  async remove(text: string, lang: string) {
    const uid = await this.uidOrThrow();
    const clean = (text || '').trim().toLowerCase();
    if (!clean) return;

    const id = `${lang}__${clean}`;
    const ref = doc(this.fb.db, `users/${uid}/knownWords/${id}`);
    await deleteDoc(ref);
  }

  /** ✅ REQUIRED by your components */
  async listAll(): Promise<KnownWord[]> {
    const col = await this.colRef();
    const q = query(col, orderBy('addedAt', 'desc'));
    const snap = await getDocs(q);

    return snap.docs.map(d => d.data() as KnownWord);
  }

  /** Clear all known words for this user */
  async clearAll() {
    const col = await this.colRef();
    const snap = await getDocs(col);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }

  /** Helper */
  normalize(text: string) {
    return (text || '').trim().toLowerCase();
  }
}
