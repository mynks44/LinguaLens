import { Injectable, inject } from '@angular/core';
import {
  Auth, authState,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously, signOut,
  GoogleAuthProvider, signInWithPopup,
  updateProfile, User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private db = inject(Firestore);

  readonly user$: Observable<User | null> = authState(this.auth);

  uid(): string | null { return this.auth.currentUser?.uid ?? null; }

  async signUpEmail(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    await this.ensureUserDoc(cred.user);
    return cred.user;
  }

  async signInEmail(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    await this.ensureUserDoc(cred.user);
    return cred.user;
  }

  async signInGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    await this.ensureUserDoc(cred.user);
    return cred.user;
  }

  async signInGuest() {
    const cred = await signInAnonymously(this.auth);
    await this.ensureUserDoc(cred.user);
    return cred.user;
  }

  async logout() { await signOut(this.auth); }

  private async ensureUserDoc(user: User) {
    const ref = doc(this.db, `users/${user.uid}`);
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      isAnonymous: user.isAnonymous ?? false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}
