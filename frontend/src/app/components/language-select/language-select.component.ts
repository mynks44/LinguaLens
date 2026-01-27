import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-language-select',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './language-select.component.html',
  styleUrls: ['./language-select.component.scss']
})
export class LanguageSelectComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() excludeValue?: string;
  @Output() valueChange = new EventEmitter<string>();

  languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'hi', name: 'Hindi',  flag: '🇮🇳' },
  ];

  get filtered() {
    return this.excludeValue
      ? this.languages.filter(l => l.code !== this.excludeValue)
      : this.languages;
  }

  onChange(val: string) {
    this.valueChange.emit(val);
  }
}
