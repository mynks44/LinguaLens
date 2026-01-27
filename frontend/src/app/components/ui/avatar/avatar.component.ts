import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [NgIf],
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent {
  @Input() src: string | null = null;
  @Input() alt = '';
  /** e.g. "MS" for Mayank Surani */
  @Input() initials = '??';
  @Input() size = 40; // px
}
