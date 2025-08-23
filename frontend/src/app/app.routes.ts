import { Routes } from '@angular/router';
import { ReaderComponent } from './pages/reader/reader.component';
import { KnownWordsComponent } from './pages/known-words/known-words.component';
import { StatsComponent } from './pages/stats/stats.component';

export const routes: Routes = [
  { path: '', redirectTo: 'reader', pathMatch: 'full' },
  { path: 'reader', component: ReaderComponent },
  { path: 'known-words', component: KnownWordsComponent },
  { path: 'stats', component: StatsComponent }
];
