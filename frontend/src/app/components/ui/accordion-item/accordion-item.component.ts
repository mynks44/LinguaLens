import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-accordion-item',
  standalone: true,
  imports: [NgIf],
  templateUrl: './accordion-item.component.html',
  styleUrls: ['./accordion-item.component.scss']
})
export class AccordionItemComponent {
  @Input() title = '';
  @Input() open = false;

  /** Used by parent <app-accordion> if it wants to know about state */
  @Output() openChange = new EventEmitter<boolean>();

  toggle() {
    this.open = !this.open;
    this.openChange.emit(this.open);
  }
}
