/**
 * Excerpt from Truthbeam (server/src/lens/link/rules.ts).
 * Shown for illustration only. The full source code is available at https://store.mikodes.com/p/truthbeam/
 *
 * How a link check notices a fake bank or courier address: names are folded so look-alike letters
 * (Cyrillic "а", the digit "0" for "o", "rn" for "m") read the same, then compared with a banded edit distance
 * that gives up early once it is clearly different. Ordinary words are not flagged, only near-copies.
 */

/** Letters of other alphabets and digits that read like Latin letters, mapped to the letter they imitate. */
// prettier-ignore
const CONFUSABLE: Readonly<Record<string, string>> = {
  // Cyrillic
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'һ': 'h', 'і': 'i', 'ї': 'i', 'ј': 'j', 'к': 'k', 'ӏ': 'l', 'м': 'm',
  'о': 'o', 'р': 'p', 'ԛ': 'q', 'с': 'c', 'ѕ': 's', 'т': 't', 'у': 'y', 'ԝ': 'w', 'х': 'x', 'ь': 'b', 'ԁ': 'd',
  // Greek
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  // Latin letters without a decomposition, and look-alike digits
  'ı': 'i', 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ɡ': 'g', '1': 'l', '0': 'o', '3': 'e', '5': 's',
};

/**
 * One form for names that read alike: compatibility forms and case unified, accents dropped, look-alike letters of
 * other alphabets and look-alike digits mapped, hyphens removed, and "rn" read as "m", "vv" as "w". Both sides of a
 * comparison are folded.
 */
export function fold(name: string): string {
  const plain = name
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\p{M}-]+/gu, '');
  let out = '';
  for (const c of plain) out += CONFUSABLE[c] ?? c;
  return out.replaceAll('rn', 'm').replaceAll('vv', 'w');
}

/**
 * The optimal string alignment distance (insertions, deletions, substitutions, and a swap of neighbours as one
 * edit), computed only in a band of `max` around the diagonal: any answer above `max` is `max + 1`.
 */
export function distance(a: string, b: string, max: number): number {
  const over = max + 1;
  if (Math.abs(a.length - b.length) > max) return over;
  if (a === b) return 0;
  const m = b.length;
  let prev2 = new Int32Array(m + 1).fill(over);
  let prev = new Int32Array(m + 1).fill(over);
  let cur = new Int32Array(m + 1).fill(over);
  for (let j = 0; j <= Math.min(m, max); j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    const lo = Math.max(1, i - max);
    const hi = Math.min(m, i + max);
    const ai = a.charCodeAt(i - 1);
    const aPrev = i > 1 ? a.charCodeAt(i - 2) : -1;
    cur[lo - 1] = lo === 1 ? Math.min(i, over) : over;
    if (hi + 1 <= m) cur[hi + 1] = over;
    let rowMin = cur[lo - 1]!;
    for (let j = lo; j <= hi; j += 1) {
      const bj = b.charCodeAt(j - 1);
      let v = prev[j - 1]! + (ai === bj ? 0 : 1);
      const up = prev[j]! + 1;
      const left = cur[j - 1]! + 1;
      if (up < v) v = up;
      if (left < v) v = left;
      if (j > 1 && ai === b.charCodeAt(j - 2) && aPrev === bj) {
        const swap = prev2[j - 2]! + 1;
        if (swap < v) v = swap;
      }
      if (v > over) v = over;
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return over;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return Math.min(prev[m]!, over);
}
