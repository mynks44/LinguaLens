import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  private utterance: SpeechSynthesisUtterance | null = null;
  private currentLang = 'en-US';
  private gotVoices = false;

  constructor(private zone: NgZone) {
   
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this.gotVoices = true;
      });
      
      void window.speechSynthesis.getVoices();
    }
  }

  
  speak(text: string, bcp47 = 'en-US', rate = 1.0, pitch = 1.0) {
    if (!text?.trim()) return;
    if (!this.hasTTS()) {
      console.warn('[TTS] Web Speech API not available');
      return;
    }

    
    window.speechSynthesis.cancel();

    this.currentLang = bcp47;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    u.rate = rate;
    u.pitch = pitch;

    const voice = this.pickVoice(bcp47);
    if (voice) u.voice = voice;

    this.utterance = u;
    
    this.zone.runOutsideAngular(() => {
      window.speechSynthesis.speak(u);
    });
  }

  pause() {
    if (this.hasTTS() && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (this.hasTTS() && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  stop() {
    if (this.hasTTS()) {
      window.speechSynthesis.cancel();
      this.utterance = null;
    }
  }

  
  private pickVoice(bcp47: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length && !this.gotVoices) {
     
      setTimeout(() => void window.speechSynthesis.getVoices(), 0);
    }
    
    let v = voices.find(v => v.lang?.toLowerCase() === bcp47.toLowerCase());
    if (v) return v;

    
    const prefix = bcp47.split('-')[0].toLowerCase();
    v = voices.find(v => v.lang?.toLowerCase().startsWith(prefix));
    if (v) return v;

    return voices.find(v => (v as any).default) || voices[0] || null;
  }

  private hasTTS(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}
