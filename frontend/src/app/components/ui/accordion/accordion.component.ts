import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [NgIf],
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.scss']
})
export class AccordionComponent {
  /**
   * Optional title shown above all items.
   * You can also omit this and just project your own header.
   */
  @Input() title = '';

  /**
   * If true, multiple items can stay open.
   * If false, only one item is open at a time.
   */
  @Input() multi = true;

  /** index of the currently open item (for single mode) */
  openIndex: number | null = null;

  onItemToggle(index: number, isOpen: boolean) {
    if (this.multi) return; // each item manages itself
    this.openIndex = isOpen ? index : null;
  }

  isItemOpen(index: number, localOpen: boolean): boolean {
    return this.multi ? localOpen : this.openIndex === index;
  }
}

export interface AccordionItemState {
  title: string;
  open: boolean;
}
