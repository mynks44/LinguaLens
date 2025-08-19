export function tokenizePreserve(text: string): string[] {
  return (text || '')
    .split(/(\s+|[.,!?;:"'()\-])/)
    .filter(t => t !== '');
}
export function isWord(tok: string): boolean {
  return /\p{L}/u.test(tok);
}
