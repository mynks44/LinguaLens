import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  speak(text: string, lang: string = 'en-US') {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }
}
