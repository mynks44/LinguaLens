import { firstValueFrom } from 'rxjs';
import { TranslateService } from './translate.service';
import { chunkByCharLimit } from '../utils/chunk';

/** Translate a LONG text by chunking to stay under the API's ~500 char limit. */
export async function translateLongText(
  translate: TranslateService,
  text: string,
  from: string,
  to: string,
  chunkSize = 480
): Promise<string> {
  if ((text || '').length <= chunkSize) {
    const r = await firstValueFrom(translate.translate(text, from, to));
    return (r?.translatedText || '').trim();
  }
  const parts = smartParagraphChunks(text, chunkSize);
  const outs: string[] = [];
  for (const p of parts) {
    const r = await firstValueFrom(translate.translate(p, from, to));
    outs.push((r?.translatedText || '').trim());
  }
  return outs.join(' ');
}

/** Translate MANY small strings (e.g., per-word) using minimal requests under char cap. */
export async function translateMany(
  translate: TranslateService,
  items: string[],
  from: string,
  to: string,
  sep = '\n',
  maxChars = 480
): Promise<string[]> {
  const batches = chunkByCharLimit(items, { sep, maxChars });
  const results: string[] = [];
  for (const batch of batches) {
    const joined = batch.join(sep);
    const r = await firstValueFrom(translate.translate(joined, from, to));
    const txt = (r?.translatedText || '').trim();
    // Split back — assume the service preserves newlines
    const parts = txt.split(/\r?\n/);
    // If the API collapsed whitespace, fallback to a naive split by space count
    if (parts.length !== batch.length) {
      // fallback: do one-by-one (rare)
      const singles = await Promise.all(
        batch.map(async (s) => {
          const rr = await firstValueFrom(translate.translate(s, from, to));
          return (rr?.translatedText || '').trim();
        })
      );
      results.push(...singles);
    } else {
      results.push(...parts.map(s => s.trim()));
    }
  }
  return results;
}

/** Split long paragraph into near-sentence chunks staying under char cap. */
function smartParagraphChunks(text: string, max = 480): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) || [text];
  const out: string[] = [];
  let cur = '';

  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if (!cur) { cur = piece; continue; }
    if ((cur + ' ' + piece).length <= max) {
      cur = cur + ' ' + piece;
    } else {
      out.push(cur);
      cur = piece.length > max ? piece.slice(0, max) : piece; // hard-split if a single sentence is too big
    }
  }
  if (cur) out.push(cur);
  return out;
}
