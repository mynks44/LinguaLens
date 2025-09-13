import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Auth,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  getRedirectResult,
  AuthError
} from 'firebase/auth';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private fb = inject(FirebaseService);
  private auth: Auth = this.fb.auth;

  private _user$ = new BehaviorSubject<User | null>(this.auth.currentUser ?? null);

  user$: Observable<User | null> = this._user$.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, (u) => {
      this._user$.next(u ?? null);
    });

    this.handleRedirectResult();
  }

  get currentUser(): User | null {
    return this.auth.currentUser ?? null;
  }

  displayName(user: User | null): string {
    if (!user) return 'Guest';
    if (user.isAnonymous) return 'Guest';
    return user.displayName || user.email || 'User';
  }

  async signInEmail(email: string, password: string): Promise<User> {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      return cred.user;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  async signUpEmail(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      if (displayName) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      return cred.user;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  async signInGoogle(): Promise<User> {
    try {
      const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
      return cred.user;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  async signInGuest(): Promise<User> {
    try {
      const cred = await signInAnonymously(this.auth);
      return cred.user;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  async logout(): Promise<void> {
    await this.signOut();
  }

  private handleRedirectResult() {
    getRedirectResult(this.auth).then((result) => {
      if (result) {
        const user = result.user;
        this._user$.next(user);
      }
    }).catch((error) => {
      console.error('Redirect result error: ', error);
    });
  }

  private handleAuthError(error: AuthError): string {
    if (error.code === 'auth/wrong-password') {
      return 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/user-not-found') {
      return 'No user found with this email.';
    } else {
      return 'An error occurred. Please try again later.';
    }
  }
}
