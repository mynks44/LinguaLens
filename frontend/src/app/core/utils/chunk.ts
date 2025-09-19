/** Split an array of strings into batches whose joined length stays under `maxChars`. */
export function chunkByCharLimit(
  items: string[],
  { sep = '\n', maxChars = 480 } = {} // keep headroom under 500
): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let curLen = 0;

  for (const s of items) {
    const addLen = (cur.length ? sep.length : 0) + s.length;
    if (cur.length && curLen + addLen > maxChars) {
      out.push(cur);
      cur = [s];
      curLen = s.length;
    } else {
      cur.push(s);
      curLen += addLen;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
