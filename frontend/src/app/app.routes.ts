import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

import { AuthComponent } from './pages/auth/auth.component';
import { ReaderComponent } from './pages/reader/reader.component';
import { KnownWordsComponent } from './pages/known-words/known-words.component';
import { StatsComponent } from './pages/stats/stats.component';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'reader', component: ReaderComponent, canActivate: [authGuard] },
  { path: 'known-words', component: KnownWordsComponent, canActivate: [authGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'auth' },
  { path: '**', redirectTo: 'auth' }
];
