import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type DictPhonetic = { text?: string; audio?: string };
export type DictMeaning = { partOfSpeech?: string; definitions?: { definition: string; example?: string }[] };
export type DictEntry = {
  word: string;
  phonetic?: string;
  phonetics?: DictPhonetic[];
  meanings?: DictMeaning[];
};

@Injectable({ providedIn: 'root' })
export class MeaningService {
  constructor(private http: HttpClient) {}

  getDictionaryEN(word: string) {
    const safe = encodeURIComponent(word.trim());
    return this.http.get<DictEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${safe}`
    );
  }

  getSynonymsEN(word: string) {
    const safe = encodeURIComponent(word.trim());
    return this.http.get<{ word: string }[]>(`https://api.datamuse.com/words?rel_syn=${safe}`);
  }

  firstPronunciationAudio(entries: DictEntry[]): string | null {
    for (const e of entries || []) {
      for (const p of e.phonetics || []) {
        if (p.audio) return p.audio;
      }
    }
    return null;
  }

  firstPhoneticText(entries: DictEntry[]): string | null {
    for (const e of entries || []) {
      if (e.phonetic) return e.phonetic;
      for (const p of e.phonetics || []) if (p.text) return p.text;
    }
    return null;
  }

  flattenDefinitions(entries: DictEntry[]): { pos?: string; def: string; example?: string }[] {
    const out: { pos?: string; def: string; example?: string }[] = [];
    for (const e of entries || []) {
      for (const m of e.meanings || []) {
        for (const d of m.definitions || []) {
          out.push({ pos: m.partOfSpeech, def: d.definition, example: d.example });
        }
      }
    }
    return out;
  }
}
