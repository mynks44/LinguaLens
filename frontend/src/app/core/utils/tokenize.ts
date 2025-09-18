export type Token = { text: string; kind: 'word' | 'space' | 'punct' };


export function tokenizeToArray(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\w+|[^\w\s]|\s+)/g;
  const matches = text.matchAll(re);
  for (const m of matches) {
    const tok = m[0];
    if (/^\s+$/.test(tok)) tokens.push({ text: tok, kind: 'space' });
    else if (/^\w+$/.test(tok)) tokens.push({ text: tok, kind: 'word' });
    else tokens.push({ text: tok, kind: 'punct' });
  }
  return tokens;
}

export function isWordToken(t: Token | string): boolean {
  return typeof t === 'string' ? /^\w+$/.test(t) : t.kind === 'word';
}
