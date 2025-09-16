import { Injectable } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
  auth: Auth = getAuth(this.app);
  db: Firestore = getFirestore(this.app);
  user: User | null = null;

  ready: Promise<void>;

  constructor() {
    console.log('[Firebase] projectId:', this.app.options.projectId); 

    this.ready = (async () => {
      try { await signInAnonymously(this.auth); } catch (e) { console.error('Anon sign-in failed:', e); }
      await new Promise<void>((resolve) => {
        onAuthStateChanged(this.auth, (u) => { this.user = u; if (u) { console.log('[Firebase] Signed in as:', u.uid); resolve(); } });
      });
    })();
  }

  uid() { return this.user?.uid || null; }
}
