import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'withSpeakers', standalone: true })
export class WithSpeakersPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  private escapeAttr(s: string): string {
    return this.escapeHtml(s).replace(/"/g, '&quot;');
  }

  transform(text: string): SafeHtml {
    if (!text) return '';
    const html = text
      .split(/\s+/)
      .filter(Boolean)
      .map(w => {
        const safeW = this.escapeHtml(w);
        const safeAttr = this.escapeAttr(w);
        return `
          <span class="word-with-speaker">
            <span class="word">${safeW}</span>
            <button type="button"
                    class="icon speak-icon"
                    data-word="${safeAttr}"
                    aria-label="Speak ${safeAttr}">🔊</button>
          </span>`;
      })
      .join(' ');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
