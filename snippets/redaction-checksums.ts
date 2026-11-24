/**
 * Excerpt from Truthbeam (server/src/privacy/redact.ts).
 * Shown for illustration only. The full source code is available at https://store.mikodes.com/p/truthbeam/
 *
 * Before any text reaches a model or provider, card numbers, IBANs, bank accounts and birth numbers are removed.
 * A rule only fires when the number passes its checksum (mod 97 for IBANs, mod 11 for accounts and birth numbers,
 * Luhn for cards, not shown), so ordinary numbers stay readable. The pass repeats until nothing changes.
 */

export function redact(text: string): Redaction {
  const totals = new Map<RedactedKind, number>();
  let current = text;
  for (let n = 0; n < MAX_PASSES; n++) {
    const pass = redactOnce(current);
    if (pass.spans.length === 0 || pass.text === current) break;
    for (const span of pass.spans) totals.set(span.kind, (totals.get(span.kind) ?? 0) + 1);
    current = pass.text;
  }
  const removed = KIND_ORDER.filter((kind) => totals.has(kind)).map((kind) => ({
    kind,
    count: totals.get(kind) ?? 0,
  }));
  return { text: current, removed };
}

// …

function weightedMod11(digits: string, weights: readonly number[]): boolean {
  const padded = digits.padStart(weights.length, '0');
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += Number(padded[i]) * (weights[i] ?? 0);
  return sum % 11 === 0;
}

// …

function birthNumberValid(digits: string): boolean {
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const monthOk =
    (month >= 1 && month <= 12) ||
    (month >= 51 && month <= 62) ||
    (month >= 21 && month <= 32) ||
    (month >= 71 && month <= 82);
  if (!monthOk || day < 1 || day > 31) return false;
  let remainder = 0;
  for (const d of digits) remainder = (remainder * 10 + Number(d)) % 11;
  if (remainder === 0) return true;
  let head = 0;
  for (const d of digits.slice(0, 9)) head = (head * 10 + Number(d)) % 11;
  return head === 10 && digits[9] === '0';
}

const id = (start: number, end: number): Span => ({ start, end, kind: 'id', replacement: '[id]' });

// …

function ibanChecksumValid(compact: string): boolean {
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = Number.parseInt(ch, 36);
    if (Number.isNaN(value)) return false;
    for (const digit of String(value)) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
