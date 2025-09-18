import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf, NgStyle, NgFor } from '@angular/common';
import { WithSpeakersPipe } from '../../shared/pipes/with-speakers.pipe';

export type MiniGloss = { src: string; dst: string };

@Component({
  selector: 'app-popup-translation',
  standalone: true,
  imports: [NgIf, NgStyle, NgFor, WithSpeakersPipe],
  templateUrl: './popup-translation.component.html',
  styleUrls: ['./popup-translation.component.scss']
})
export class PopupTranslationComponent {
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() text = '';
  @Input() translation = '';

  @Input() perWord: MiniGloss[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() markKnown = new EventEmitter<void>();
  @Output() speak = new EventEmitter<void>();
  @Output() speakWord = new EventEmitter<string>();

  onBubbleClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement | null;
    const btn = t?.closest('.speak-icon') as HTMLElement | null;
    if (btn) {
      const w = btn.getAttribute('data-word') || '';
      if (w) this.speakWord.emit(w);
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
}
