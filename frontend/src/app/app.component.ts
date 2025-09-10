import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, RouterLink } from '@angular/router';
import { NgIf, AsyncPipe } from '@angular/common';  // <-- Import AsyncPipe
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, AsyncPipe],  // <-- Add AsyncPipe here
  template: `
  <header class="topbar" *ngIf="(auth.user$ | async) as user">
    <nav>
      <a routerLink="/reader">Reader</a>
      <a routerLink="/known-words">Known Words</a>
      <a routerLink="/stats">Stats</a>
    </nav>
    <div class="user">
      <span>{{ user.displayName || user.email || 'Guest' }}</span>
      <button (click)="logout()">Logout</button>
    </div>
  </header>
  <router-outlet></router-outlet>
  `,
  styles: [`
    .topbar{display:flex;justify-content:space-between;align-items:center;
      padding:10px 14px;background:#334155;color:white}
    nav a{color:white;margin-right:12px;text-decoration:none}
    .user button{margin-left:8px}
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  async logout(){ await this.auth.logout(); this.router.navigateByUrl('/auth'); }
}
