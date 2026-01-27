import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [NgIf],
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.scss']
})
export class AlertDialogComponent {
  @Input() open = false;

  @Input() title = '';
  @Input() description = '';

  @Input() confirmText = 'OK';
  @Input() cancelText = 'Cancel';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() openChange = new EventEmitter<boolean>();

  onConfirm() {
    this.confirm.emit();
    this.setOpen(false);
  }

  onCancel() {
    this.cancel.emit();
    this.setOpen(false);
  }

  setOpen(v: boolean) {
    this.open = v;
    this.openChange.emit(v);
  }
}
