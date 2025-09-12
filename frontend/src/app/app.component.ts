import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf, AsyncPipe } from '@angular/common';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgIf, AsyncPipe],
  template: `
    <header class="topbar" *ngIf="(auth.user$ | async) as user">
      <nav class="nav">
        <a routerLink="/reader">Reader</a>
        <a routerLink="/known-words">Known Words</a>
        <a routerLink="/stats">Stats</a>
      </nav>

      <div class="right">
        <span class="who">
          {{ user?.isAnonymous ? 'Guest' : (user?.displayName || user?.email || 'User') }}
        </span>
        <button (click)="auth.logout()">Logout</button>
      </div>
    </header>

    <router-outlet></router-outlet>
  `,
  styles: [`
    .topbar{display:flex;align-items:center;gap:16px;padding:10px 14px;background:#2f3e4e;color:#fff}
    .nav a{color:#fff;margin-right:14px;text-decoration:none}
    .right{margin-left:auto;display:flex;align-items:center;gap:10px}
    button{background:#fff;border:1px solid #cbd5e1;border-radius:4px;padding:6px 10px;cursor:pointer}
  `]
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}
