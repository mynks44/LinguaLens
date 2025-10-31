export type Token = { text: string; kind: 'word' | 'space' | 'punct' };


export function tokenizeToArray(text: string): Token[] {
  const tokens: Token[] = [];
  // Match:
  // 1) words starting with a Unicode letter, followed by letters, marks (combining accents), numbers or common intra-word punctuation
  // 2) any single non-letter/non-number/non-space (punctuation)
  // 3) runs of whitespace
  const re = /(\p{L}[\p{L}\p{M}\p{N}'’\-]*|[^\p{L}\p{N}\s]|\s+)/gu;
  const matches = text.matchAll(re);
  for (const m of matches) {
    const tok = m[0];
    if (/^\s+$/u.test(tok)) tokens.push({ text: tok, kind: 'space' });
    else if (/^\p{L}[\p{L}\p{M}\p{N}'’\-]*$/u.test(tok)) tokens.push({ text: tok, kind: 'word' });
    else tokens.push({ text: tok, kind: 'punct' });
  }
  return tokens;
}

export function isWordToken(t: Token | string): boolean {
  return typeof t === 'string'
    ? /^\p{L}[\p{L}\p{M}\p{N}'’\-]*$/u.test(t)
    : t.kind === 'word';
}
