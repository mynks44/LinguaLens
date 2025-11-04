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
  // SVG tail geometry
  svgLeft = 0;
  svgTop = 0;
  svgWidth = 0;
  svgHeight = 0;
  tailPath = '';
  // mask circle coords inside SVG (for blending stroke into bubble)
  startMaskX = 0;
  startMaskY = 0;

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
  // extra vertical gap to give arrows space and keep clouds visually separated from text
  const verticalExtra = 12; // px
  const preferAboveTop = this.anchorY - bh - (margin + verticalExtra);
  const belowTop = this.anchorY + (margin + verticalExtra);
      const above = preferAboveTop >= 8;

      // compute left such that bubble is centered on anchorX, but clamped to viewport
      const left = Math.round(this.anchorX - bw / 2);
      const clampedLeft = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
      const top = Math.round(above ? preferAboveTop : belowTop);

      // if parent supplied absolute coordinates, use them instead
      this.computedLeft = (this.absoluteLeft !== null && this.absoluteLeft !== undefined) ? this.absoluteLeft : clampedLeft;
      this.computedTop = (this.absoluteTop !== null && this.absoluteTop !== undefined) ? this.absoluteTop : top;

      // If the parent provided an explicit absoluteTop, nudge it further away from the text
      // so arrows have breathing room. If parent did not provide absoluteTop, 'top' already
      // includes the verticalExtra gap above/below.
      if (this.absoluteTop !== null && this.absoluteTop !== undefined) {
        const bubbleBottomProbe = this.computedTop + bh;
        if (bubbleBottomProbe < this.anchorY) {
          // bubble is above anchor -> move further up
          this.computedTop = Math.max(8, this.computedTop - verticalExtra);
        } else {
          // bubble is below anchor -> move further down
          this.computedTop = Math.min(window.innerHeight - bh - 8, this.computedTop + verticalExtra);
        }
      }

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

      // compute SVG tail geometry that connects the bubble edge to the anchor point
      // we'll render an SVG that covers the rectangle between bubble and anchor (with padding)
      const pad = 24;
      const absBubbleLeft = this.computedLeft;
      const absBubbleTop = this.computedTop;
      const absAnchorX = this.anchorX;
      const absAnchorY = this.anchorY;

      const minLeft = Math.min(absBubbleLeft, absAnchorX) - pad;
      const minTop = Math.min(absBubbleTop, absAnchorY) - pad;
      const maxRight = Math.max(absBubbleLeft + bw, absAnchorX) + pad;
      const maxBottom = Math.max(absBubbleTop + bh, absAnchorY) + pad;

      this.svgLeft = Math.round(minLeft);
      this.svgTop = Math.round(minTop);
      this.svgWidth = Math.max(0, Math.round(maxRight - minLeft));
      this.svgHeight = Math.max(0, Math.round(maxBottom - minTop));

      // coordinates relative to svg
  const startCX = absBubbleLeft + bw / 2 - this.svgLeft;
  const startCY = absBubbleTop + bh / 2 - this.svgTop;
    // angle from bubble center to anchor
    const dx = absAnchorX - (absBubbleLeft + bw / 2);
    const dy = absAnchorY - (absBubbleTop + bh / 2);
    const theta = Math.atan2(dy, dx);
    const nx = Math.cos(theta), ny = Math.sin(theta);
    // compute intersection of ray from bubble center with the rounded rect boundary (approx by rect)
  const halfW = bw / 2;
  const halfH = bh / 2;
  const tx = halfW / Math.max(1e-6, Math.abs(nx));
  const ty = halfH / Math.max(1e-6, Math.abs(ny));
  const t = Math.min(tx, ty);
  const startX = startCX + nx * t;
  const startY = startCY + ny * t;

  const anchorRelX = absAnchorX - this.svgLeft;
  const anchorRelY = absAnchorY - this.svgTop;

  // Ensure the pointer tip doesn't intrude into the text: nudge the final anchor
  // point slightly outside the text surface depending on whether the bubble is
  // above or below the anchor. This makes the triangle tip rest on the upper
  // or lower surface of the highlighted text rather than penetrating it.
  const touchOffset = 10; // px - how far to push the tip outside the text
  const bubbleIsAbove = bubbleBottom < absAnchorY;
  const finalAnchorRelX = anchorRelX;
  const finalAnchorRelY = clamp(anchorRelY + (bubbleIsAbove ? -touchOffset : touchOffset), 0, this.svgHeight);

    // tail base width (not actively used for the thin stroke but kept for potential future use)
    const halfBase = Math.min(10, Math.max(6, bw * 0.06));

    // For a thin connector we use a single cubic curve from the computed start point to the anchor
    const dist = Math.hypot(dx, dy);
    const cpDist1 = Math.max(12, Math.min(Math.max(24, dist * 0.25), 120));
    const cpDist2 = Math.max(8, Math.min(Math.max(20, dist * 0.35), 140));
    // add a small perpendicular offset to ensure curvature (avoid collinear control points)
    const perpScale = Math.max(6, Math.min(24, bw * 0.08));
    const px = -ny, py = nx; // perpendicular
    const cp1x = startX + nx * cpDist1 + px * perpScale;
    const cp1y = startY + ny * cpDist1 + py * perpScale;
    const cp2x = finalAnchorRelX - nx * cpDist2 + px * (perpScale * 0.3);
    const cp2y = finalAnchorRelY - ny * cpDist2 + py * (perpScale * 0.3);

  this.tailPath = `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${finalAnchorRelX},${finalAnchorRelY}`;

  // set small mask circle position (relative to svg) to blend stroke into the bubble
  this.startMaskX = Math.round(startX);
  this.startMaskY = Math.round(startY);
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
