import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NgIf, AsyncPipe  } from '@angular/common';
import { filter } from 'rxjs/operators';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [NgIf, AsyncPipe, RouterLink, RouterLinkActive],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  auth = inject(AuthService);
  router = inject(Router);

  showToolbar = true;

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.showToolbar = !event.url.includes('/auth');
      });
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
