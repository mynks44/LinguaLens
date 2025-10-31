import { Injectable } from '@angular/core';
import { TranslateService } from './translate.service';
import { translateMany, translateLongText } from './translate-batch';
import { Token, isWordToken } from '../utils/tokenize';

export type CacheEntry = {
  key: string;
  type: 'word' | 'phrase';
  surfaceForms: string[];
  lemma?: string;
  abstract?: string;
  contextual?: string;
  occurrences: Array<{ sentenceIndex: number; startIndex: number; endIndex: number }>;
  updatedAt: number;
  source: 'prefetch' | 'onDemand';
};

@Injectable({ providedIn: 'root' })
export class TranslateCacheService {
  private map = new Map<string, CacheEntry>();

  constructor(private translate: TranslateService) {}

  normalizeKey(s: string) { return (s || '').trim().toLowerCase(); }

  lookup(key: string): CacheEntry | undefined {
    return this.map.get(this.normalizeKey(key));
  }

  lookupMany(keys: string[]): (CacheEntry | undefined)[] {
    return keys.map(k => this.lookup(k));
  }

  /**
   * Initialize cache for a translated text and its tokens.
   * - translatedText: the full translated text shown in reader (e.g., French)
   * - tokens: tokenized array for the translated text
   * - fromLang: original language (e.g., 'en')
   * - toLang: language of translatedText (e.g., 'fr')
   */
  async initForText(translatedText: string, tokens: Token[], fromLang: string, toLang: string) {
    try {
      // 1) collect unique word surface forms and map occurrences to sentence indices
      const sentences = (translatedText || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [translatedText];

      const words: string[] = [];
  const wordOccurrences = new Map<string, Array<{ sentenceIndex: number; startIndex: number; endIndex: number }>>();
      for (let si = 0; si < sentences.length; si++) {
        const s = sentences[si];
        // simple word extraction using token list for accuracy
        // find tokens that fall into this sentence by searching their text in the sentence
        // fallback: use regex to extract words
        const re = /[\p{L}\p{M}\p{N}’'’-]+/gu;
        const matches = Array.from(s.matchAll(re)).map(m => m[0]);
        for (const m of matches) {
          const k = this.normalizeKey(m);
          if (!wordOccurrences.has(k)) { wordOccurrences.set(k, []); words.push(m); }
          const arr = wordOccurrences.get(k)!;
          arr.push({ sentenceIndex: si, startIndex: 0, endIndex: 0 });
        }
      }

      // dedupe preserve order
      const uniqWords = Array.from(new Set(words.map(w => w)));
      if (!uniqWords.length) return;

      // 2) fetch abstracts (batch words back to fromLang)
      let abstracts: string[] = [];
      try {
        abstracts = await translateMany(this.translate, uniqWords, toLang, fromLang);
      } catch (e) {
        // fallback: do one-by-one
        abstracts = [];
        for (const w of uniqWords) {
          try {
            const r = await translateLongText(this.translate, w, toLang, fromLang);
            abstracts.push(r || '');
          } catch (ee) { abstracts.push(''); }
        }
      }

      // 3) translate sentences for contextual meanings
      const sentenceTranslations: string[] = [];
      for (const s of sentences) {
        try {
          const tr = await translateLongText(this.translate, s, toLang, fromLang);
          sentenceTranslations.push(tr || '');
        } catch (e) {
          sentenceTranslations.push('');
        }
      }

      // 4) populate map entries for words
      for (let i = 0; i < uniqWords.length; i++) {
        const surface = uniqWords[i] || '';
        const key = this.normalizeKey(surface);
        const abstract = (abstracts[i] || '').trim();
        // find a contextual sentence that contains the word
        let contextual = '';
        for (let si = 0; si < sentences.length; si++) {
          const s = sentences[si] || '';
          const re = new RegExp('\\b' + surface.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\b', 'i');
          if (re.test(s)) { contextual = (sentenceTranslations[si] || '').trim(); break; }
        }
        if (!contextual) contextual = abstract;

        const occurrences = wordOccurrences.get(key) || [];
        this.map.set(key, {
          key,
          type: 'word',
          surfaceForms: [surface],
          abstract,
          contextual,
          occurrences,
          updatedAt: Date.now(),
          source: 'prefetch'
        });
      }

      // 5) build simple phrase candidates (contiguous 2-3 grams within each sentence)
      const maxN = 3;
      const phraseSet = new Set<string>();
      for (const s of sentences) {
        const tokensInS = Array.from(s.matchAll(/[\p{L}\p{M}\p{N}’'’-]+|[^\s]+/gu)).map(m => m[0]).filter(x => /[\p{L}\p{M}\p{N}’'’-]+/u.test(x));
        for (let i = 0; i < tokensInS.length; i++) {
          for (let n = 2; n <= Math.min(maxN, tokensInS.length - i); n++) {
            const cand = tokensInS.slice(i, i + n).join(' ');
            phraseSet.add(cand);
          }
        }
      }

      const phrases = Array.from(phraseSet).slice(0, 200); // limit to 200 candidates for POC
      if (phrases.length) {
        // batch translate phrase abstracts
        let phraseAbstracts: string[] = [];
        try {
          phraseAbstracts = await translateMany(this.translate, phrases, toLang, fromLang);
        } catch (e) {
          phraseAbstracts = [];
          for (const p of phrases) {
            try { const r = await translateLongText(this.translate, p, toLang, fromLang); phraseAbstracts.push(r || ''); }
            catch (ee) { phraseAbstracts.push(''); }
          }
        }

        for (let i = 0; i < phrases.length; i++) {
          const p = phrases[i];
          const key = this.normalizeKey(p);
          const abstract = (phraseAbstracts[i] || '').trim();
          // find a sentence containing phrase
          let contextual = '';
          for (let si = 0; si < sentences.length; si++) {
            if ((sentences[si] || '').toLowerCase().includes(p.toLowerCase())) { contextual = (sentenceTranslations[si] || '').trim(); break; }
          }
          if (!contextual) contextual = abstract;
          this.map.set(key, {
            key,
            type: 'phrase',
            surfaceForms: [p],
            abstract,
            contextual,
            occurrences: [],
            updatedAt: Date.now(),
            source: 'prefetch'
          });
        }
      }
    } catch (e) {
      console.error('TranslateCacheService.initForText failed', e);
    }
  }

  /** Greedy lookup: try to match the longest phrase for the given normalized selection text. */
  lookupBestForSelection(selectionText: string): CacheEntry | undefined {
    const key = this.normalizeKey(selectionText);
    if (this.map.has(key)) return this.map.get(key);
    // fallback: try to split into words and return concatenated entry if words exist
    return undefined;
  }
}
