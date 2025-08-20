import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  app = initializeApp(environment.firebase);
  auth = getAuth(this.app);
  db = getFirestore(this.app);
  user: User | null = null;

  ready: Promise<void>;

  constructor() {
    this.ready = (async () => {
      try {
        await signInAnonymously(this.auth);
      } catch (e) {
        console.error('Anon sign-in failed:', e);
      }

      await new Promise<void>((resolve) => {
        onAuthStateChanged(this.auth, (u) => {
          this.user = u;
          if (u) {
            console.log('[Firebase] Signed in as:', u.uid);
            resolve();
          }
        });
      });

      try {
        if (typeof window !== 'undefined') {
          import('firebase/analytics')
            .then(({ getAnalytics }) => {
              try { getAnalytics(this.app); } catch {  }
            })
            .catch(() => {  });
        }
      } catch {
      }
    })();
  }

  uid() { return this.user?.uid || null; }
}
