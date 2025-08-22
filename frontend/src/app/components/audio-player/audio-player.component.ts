import { Component, Input, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-audio-player',
  standalone: true,
  template: `
  <div class="player">
    <button (click)="play()" [disabled]="isSpeaking">▶ Play</button>
    <button (click)="pause()" [disabled]="!isSpeaking || isPaused">⏸ Pause</button>
    <button (click)="resume()" [disabled]="!isPaused">⏵ Resume</button>
    <button (click)="stop()" [disabled]="!isSpeaking && !isPaused">⏹ Stop</button>
    <span class="lang">{{lang}}</span>
  </div>
  `,
  styles: [`
    .player { display:flex; gap:8px; align-items:center; }
    .lang { opacity: .7; margin-left: 8px; font-size: 12px; }
    button { padding: 6px 10px; }
  `]
})
export class AudioPlayerComponent implements OnDestroy {
  @Input() text = '';
  @Input() lang = 'en-US';

  private utterance?: SpeechSynthesisUtterance;
  isSpeaking = false;
  isPaused = false;

  private makeUtterance() {
    const u = new SpeechSynthesisUtterance(this.text || '');
    u.lang = this.lang;
    u.onend = () => { this.isSpeaking = false; this.isPaused = false; };
    u.onerror = () => { this.isSpeaking = false; this.isPaused = false; };
    this.utterance = u;
  }

  play() {
    if (!this.text) return;
    this.stop();
    this.makeUtterance();
    this.isSpeaking = true;
    this.isPaused = false;
    window.speechSynthesis.speak(this.utterance!);
  }

  pause() {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  resume() {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  stop() {
    if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
  }

  ngOnDestroy() { this.stop(); }
}
