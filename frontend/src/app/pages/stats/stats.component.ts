import { Component } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../core/services/firebase.service';
import { ProgressService, ProgressOverview, ProgressWord } from '../../core/services/progress.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, NgStyle],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent {
  lang = 'fr';
  loading = false;

  data: ProgressOverview | null = null;
  topLow:  ProgressWord[] = [];
  topHigh: ProgressWord[] = [];

  constructor(private fb: FirebaseService, private progress: ProgressService) {}

  ngOnInit() { this.refresh(); }

  refresh() {
    const userId = this.fb.uid() || 'anon';
    this.loading = true;

    this.progress.getOverview(userId, this.lang).subscribe({
      next: d => this.data = d,
      error: () => this.data = {
        totalWords: 0, strong: 0, medium: 0, weak: 0,
        seenSum: 0, knownSum: 0, heardSum: 0
      }
    });

    this.progress.getTopWords(userId, this.lang, 'low', 10).subscribe({
      next: rows => this.topLow = rows || [],
      error: () => this.topLow = []
    });

    this.progress.getTopWords(userId, this.lang, 'high', 10).subscribe({
      next: rows => this.topHigh = rows || [],
      error: () => this.topHigh = []
    });

    this.loading = false;
  }

  confBarStyle(conf: number) {
    const pct = Math.max(0, Math.min(1, conf || 0)) * 100;
    return { width: pct + '%', height: '8px', display: 'inline-block' };
  }
}
