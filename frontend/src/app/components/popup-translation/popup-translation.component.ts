import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf, NgStyle, NgFor } from '@angular/common';

export type MiniGloss = { src: string; dst: string };

@Component({
  selector: 'app-popup-translation',
  standalone: true,
  imports: [NgIf, NgStyle, NgFor],
  templateUrl: './popup-translation.component.html',
  styleUrls: ['./popup-translation.component.scss']
})
export class PopupTranslationComponent {
  /** Anchor (x,y is the arrow tip) + visibility */
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;

  /** Content */
  @Input() original = '';        // ALWAYS shown (word or sentence)
  @Input() translation = '';     // ALWAYS shown

  /** Optional chips (kept if you use them elsewhere) */
  @Input() perWord: MiniGloss[] = [];

  /** Controls actions row (only for word popup) */
  @Input() isWordPopup = false;

  /** Events */
  @Output() speak = new EventEmitter<void>();
  @Output() markKnown = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() speakWord = new EventEmitter<string>();

  /** NEW: when user selects a word inside the ORIGINAL line in this popup */
  @Output() pickWord = new EventEmitter<string>();

  onChipClick(w: string) { if (w) this.speakWord.emit(w); }

  /** Detect a single-word selection inside the original line */
  onOrigMouseUp(ev: MouseEvent) {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const host = (ev.currentTarget as HTMLElement) || null;
    if (!host) return;
    if (!host.contains(range.commonAncestorContainer)) return;

    const raw = sel.toString().trim();
    if (!raw) return;

    // normalize to a single word-ish token
    const m = raw.match(/[\p{L}\p{M}\p{N}’'’-]+/u);
    const word = m ? m[0] : '';
    if (word) this.pickWord.emit(word);
  }
}
