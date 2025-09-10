import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode: 'login' | 'signup' = 'login';
  email = '';
  password = '';
  displayName = '';

  loading = false;
  error: string | null = null;

  toggleMode() { this.mode = this.mode === 'login' ? 'signup' : 'login'; }

  async doEmail() {
    this.loading = true; this.error = null;
    try {
      if (this.mode === 'login') await this.auth.signInEmail(this.email, this.password);
      else await this.auth.signUpEmail(this.email, this.password, this.displayName);
      this.router.navigateByUrl('/reader');
    } catch (e: any) { this.error = e?.message || 'Failed'; }
    finally { this.loading = false; }
  }

  async doGoogle() {
    this.loading = true; this.error = null;
    try {
      await this.auth.signInGoogle();
      this.router.navigateByUrl('/reader');
    } catch (e: any) { this.error = e?.message || 'Failed'; }
    finally { this.loading = false; }
  }

  async doGuest() {
    this.loading = true; this.error = null;
    try {
      await this.auth.signInGuest();
      this.router.navigateByUrl('/reader');
    } catch (e: any) { this.error = e?.message || 'Failed'; }
    finally { this.loading = false; }
  }
}
