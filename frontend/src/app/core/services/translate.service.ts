import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TranslateService {
  constructor(private http: HttpClient) {}
  translate(text: string, from: string, to: string) {
    return this.http.post<{ translatedText: string }>(`${environment.apiBase}/translate`, { text, from, to });
  }
}
