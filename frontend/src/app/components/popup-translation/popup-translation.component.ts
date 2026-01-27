import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf, NgFor, NgStyle } from '@angular/common';

@Component({
  selector: 'app-popup-translation',
  standalone: true,
  imports: [NgIf, NgFor, NgStyle],
  templateUrl: './popup-translation.component.html',
  styleUrls: ['./popup-translation.component.scss']
})
export class PopupTranslationComponent {
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;

  /** Original text: single word OR full sentence */
  @Input() original = '';

  /** Translation of the word / sentence */
  @Input() translation = '';

  /** true = word popup (with Mark known / Close buttons) */
  @Input() isWordPopup = false;

  @Output() close = new EventEmitter<void>();
  @Output() speak = new EventEmitter<void>();
  @Output() markKnown = new EventEmitter<void>();

  /** Emits the clicked word (string) when user clicks inside sentence popup */
  @Output() pickWord = new EventEmitter<string>();

  get originalWords(): string[] {
    return (this.original || '').split(/\s+/).filter(Boolean);
  }

  onSentenceWordClick(w: string, ev: MouseEvent) {
    ev.stopPropagation();
    this.pickWord.emit(w);
  }
}
