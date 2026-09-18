/**
 * Helpers for the printed Greek text. MorphGNT's text column is the word as printed, with
 * its punctuation attached; the word itself is what the reader taps.
 */

/** Leading and trailing punctuation / brackets around a printed token. */
const LEAD = /^[⟦(\[«‹“‘]+/;
const TRAIL = /[⟧)\]»›”’.,;·:!?—–-]+$/;

export function splitPrinted(text: string): { lead: string; word: string; trail: string } {
  const lead = (text.match(LEAD) ?? [''])[0];
  const rest = text.slice(lead.length);
  const trail = (rest.match(TRAIL) ?? [''])[0];
  return { lead, word: rest.slice(0, rest.length - trail.length), trail };
}

/** Lower-case, accent-free form for comparison and search. */
export function greekBase(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ᷀-᷿]/g, '')
    .replace(/ς/g, 'σ')
    .toLowerCase();
}

/** Strip accents/breathings but keep case (for "forms seen"). */
export function greekPlain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ᷀-᷿]/g, '').normalize('NFC');
}

/** Greek numeral (Milesian) for chapter numbers 1–999: αʹ βʹ … */
export function greekNumeral(n: number): string {
  if (n <= 0 || n >= 1000) return String(n);
  const ones = ['', 'α', 'β', 'γ', 'δ', 'ε', 'ϛ', 'ζ', 'η', 'θ'];
  const tens = ['', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ϟ'];
  const hundreds = ['', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'ϡ'];
  return hundreds[Math.floor(n / 100)] + tens[Math.floor((n % 100) / 10)] + ones[n % 10] + 'ʹ';
}
