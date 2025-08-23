import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map, Observable } from 'rxjs';

export type ProgressOverview = {
  totalWords: number;
  strong: number;
  medium: number;
  weak: number;
  seenSum: number;
  knownSum: number;
  heardSum: number;
};

export type ProgressWord = {
  word: string;
  lang: string;
  confidence: number;
  timesSeen?: number;
  timesKnown?: number;
};

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private base = `${environment.apiBase}/progress`;

  constructor(private http: HttpClient) {}

  /** POST event: type in 'seen' | 'known' | 'heard' */
  recordEvent(userId: string, word: string, lang: string, type: 'seen'|'known'|'heard') {
    return this.http.post(`${this.base}/event`, { userId, word, lang, type });
  }

  /** GET overall stats for a user/lang */
  getOverview(userId: string, lang?: string): Observable<ProgressOverview> {
    let params = new HttpParams().set('userId', userId);
    if (lang) params = params.set('lang', lang);

    return this.http.get<ProgressOverview>(`${this.base}/overview`, { params }).pipe(
      map((d: any) => ({
        totalWords: Number(d?.totalWords ?? 0),
        strong: Number(d?.strong ?? 0),
        medium: Number(d?.medium ?? 0),
        weak: Number(d?.weak ?? 0),
        seenSum: Number(d?.seenSum ?? 0),
        knownSum: Number(d?.knownSum ?? 0),
        heardSum: Number(d?.heardSum ?? 0),
      }))
    );
  }

  /** GET top words by confidence */
  getTopWords(userId: string, lang: string, order: 'low'|'high', limit = 20): Observable<ProgressWord[]> {
    let params = new HttpParams()
      .set('userId', userId)
      .set('lang', lang)
      .set('order', order)
      .set('limit', limit);
    return this.http.get<any[]>(`${this.base}/top-words`, { params }).pipe(
      map(rows =>
        (rows || []).map(r => ({
          word: r.word,
          lang: r.lang,
          confidence: Number(r.confidence ?? 0),
          timesSeen: Number(r.timesSeen ?? 0),
          timesKnown: Number(r.timesKnown ?? 0),
        }))
      )
    );
  }
}
