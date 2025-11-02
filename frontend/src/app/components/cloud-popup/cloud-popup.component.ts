import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit, NgZone, OnDestroy } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-cloud-popup',
  standalone: true,
  imports: [NgIf],
  templateUrl: './cloud-popup.component.html',
  styleUrls: ['./cloud-popup.component.scss']
})
export class CloudPopupComponent implements OnChanges, AfterViewInit {
  @Input() visible = false;
  @Input() x = 0; // desired popup center X (px)
  @Input() y = 0; // desired popup top Y (px)
  @Input() anchorX = 0; // point to which tail should point
  @Input() anchorY = 0;
  // Optional explicit absolute position supplied by parent (px). If provided, parent controls placement
  @Input() absoluteLeft?: number | null = null;
  @Input() absoluteTop?: number | null = null;
  // prefer explicit inputs for original (foreign) and translation strings
  @Input() original?: string | null = null;
  @Input() translation?: string | null = null;
  // backwards-compatible single text input (treated as translation)
  @Input() text = '';
  @Input() maxWidth = 280;
  @Input() id?: string | number;

  @Output() close = new EventEmitter<void>();
  // emit the text to speak (usually the original foreign word)
  @Output() speak = new EventEmitter<string>();
  // notify parent of measured bubble size so it can resolve collisions
  @Output() measured = new EventEmitter<{ id?: string | number; width: number; height: number }>();

  @ViewChild('bubble', { static: true }) bubbleRef!: ElementRef<HTMLElement>;

  // computed tail horizontal offset relative to bubble left
  tailLeft = 0;
  tailTop = 0;
  tailVisible = true;
  computedLeft = 0;
  computedTop = 0;

  private ro: ResizeObserver | null = null;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    // recalc when inputs change
    // schedule update on next frame so DOM reflects new content
    requestAnimationFrame(() => this.updateTail());
  }

  ngAfterViewInit() {
    // measure and update after render
    this.updateTail();
    // watch for size changes so we can reflow tail and position when content changes
    try {
      this.ro = new ResizeObserver(() => {
        // run in zone to trigger change detection
        this.updateTail();
        // emit measured size to parent for collision layout
        const bubble = (this.el.nativeElement as HTMLElement).querySelector('.bubble') as HTMLElement | null;
        if (bubble) {
          this.measured.emit({ id: this.id, width: bubble.offsetWidth || bubble.getBoundingClientRect().width, height: bubble.offsetHeight || bubble.getBoundingClientRect().height });
        }
      });
      const bubble = (this.el.nativeElement as HTMLElement).querySelector('.bubble') as HTMLElement | null;
      if (bubble && this.ro) this.ro.observe(bubble);
    } catch (e) {
      // ResizeObserver may not be available on all platforms; ignore
    }
  }

  ngOnDestroy() {
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
  }

  private updateTail() {
    try {
      const host = this.el.nativeElement as HTMLElement;
      const bubble = host.querySelector('.bubble') as HTMLElement | null;
      if (!bubble) return;
      const bw = bubble.offsetWidth || bubble.getBoundingClientRect().width;
      const bh = bubble.offsetHeight || bubble.getBoundingClientRect().height;

      // prefer placing above; if not enough space, place below
      const margin = 8;
      const preferAboveTop = this.anchorY - bh - margin;
      const belowTop = this.anchorY + margin;
      const above = preferAboveTop >= 8;

      // compute left such that bubble is centered on anchorX, but clamped to viewport
      const left = Math.round(this.anchorX - bw / 2);
      const clampedLeft = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
      const top = Math.round(above ? preferAboveTop : belowTop);

      // if parent supplied absolute coordinates, use them instead
      this.computedLeft = (this.absoluteLeft !== null && this.absoluteLeft !== undefined) ? this.absoluteLeft : clampedLeft;
      this.computedTop = (this.absoluteTop !== null && this.absoluteTop !== undefined) ? this.absoluteTop : top;

      // compute tail position relative to bubble left
      const relX = this.anchorX - this.computedLeft;
      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      this.tailLeft = clamp(relX, 12, Math.max(12, bw - 12));
  // tail: if bubble is above the anchor (bubbleBottom < anchorY) we want the tail at the bottom of the bubble
  const bubbleBottom = this.computedTop + bh;
  this.tailTop = bubbleBottom < this.anchorY ? 0 : 1;
      this.tailVisible = true;

      // also emit measured size for parent in case parent wants to run collision layout
      this.measured.emit({ id: this.id, width: bw, height: bh });
    } catch (e) {
      // ignore
    }
  }

  onClose() { this.close.emit(); }
  onSpeak() { 
    const toEmit = (this.original && String(this.original).trim()) ? String(this.original) : (this.translation || this.text || '');
    this.speak.emit(toEmit);
  }
}
