import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf, NgStyle } from '@angular/common';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-popup-translation',
  standalone: true,
  imports: [NgIf, NgStyle, CommonModule],
  templateUrl: './popup-translation.component.html',
  styleUrls: ['./popup-translation.component.scss']
})
export class PopupTranslationComponent {
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() text = '';
  @Input() translation = '';
  @Input() phonetic?: string | null;
  @Input() dictAudioUrl?: string | null;
  @Input() definitions: { pos?: string; def: string; example?: string }[] = [];
  @Input() synonyms: string[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() markKnown = new EventEmitter<void>();
  @Output() speak = new EventEmitter<void>();         
  @Output() playPronAudio = new EventEmitter<void>(); 
  playPron() { this.playPronAudio.emit(); }
}