/**
 * Helpers for the printed Vulgate text. The Clementine (USFX) verse string is the printed
 * text with real punctuation; PROIEL's own tokens carry no punctuation at all (confirmed by
 * inspecting data/proiel/latin-nt.xml directly — its editorial note describes punctuation as
 * added to the *source* text, but none survives into the token/presentation attributes), so a
 * Vulgate word's analysis is looked up by matching its printed form (after stripping
 * punctuation and normalising spelling) against the PROIEL token at the same position — see
 * scripts/build-vulgate-nt.mjs. This module supplies that same normalisation at read time
 * (for "forms seen" and for the word page's plain form), so it must stay in sync with the
 * build script's own copy of it.
 */

/** Leading and trailing punctuation / brackets around a printed token. */
const LEAD = /^[(\[«‹“‘]+/;
const TRAIL = /[)\]»›”’.,;:!?—–-]+$/;

export function splitPrinted(text: string): { lead: string; word: string; trail: string } {
  const lead = (text.match(LEAD) ?? [''])[0];
  const rest = text.slice(lead.length);
  const trail = (rest.match(TRAIL) ?? [''])[0];
  return { lead, word: rest.slice(0, rest.length - trail.length), trail };
}

/** No Latin letter at all — a free-floating punctuation mark, not a word. */
const NO_LETTER = /^[^A-Za-zÀ-ſ]+$/;

/**
 * Printed words of a verse, in order — the unit the PROIEL alignment indexes into. This
 * Clementine/USFX transcription sometimes prints a mid-sentence colon or question mark as its
 * own space-separated token ("Babylonis : Jechonias", "Judæorum ?" — a real, if archaic,
 * typographic convention of the source, confirmed by inspecting data/vulgate directly), which
 * a plain whitespace split would turn into a spurious empty "word". Any such letterless token
 * is glued onto the previous real word instead (or the next one, if it opens the verse).
 */
export function contentWords(text: string): string[] {
  const raw = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let pendingLead = '';
  for (const tok of raw) {
    if (NO_LETTER.test(tok)) {
      if (out.length) out[out.length - 1] += tok;
      else pendingLead += tok;
    } else {
      out.push(pendingLead + tok);
      pendingLead = '';
    }
  }
  if (pendingLead) out.push(pendingLead); // the whole verse was punctuation (never happens in practice)
  return out;
}

/**
 * Lower-case comparison form: strips punctuation, and folds the two spelling conventions the
 * Clementine print text and the PROIEL treebank each use for the same classical letters — J/j
 * for consonantal I (Iesus/Jesus) and V/v for consonantal U (Vulgate spells both ways) — so
 * the same underlying word compares equal regardless of which edition wrote it.
 */
export function latinBase(s: string): string {
  const { word } = splitPrinted(s);
  return word
    .toLowerCase()
    .replace(/j/g, 'i')
    .replace(/v/g, 'u');
}

/** Strip surrounding punctuation but keep spelling and case (for "forms seen"). */
export function latinPlain(s: string): string {
  return splitPrinted(s).word;
}

/** Roman numeral for chapter numbers 1–999 (no zero, no negatives — Roman numerals have none). */
export function romanNumeral(n: number): string {
  if (n <= 0 || n >= 1000) return String(n);
  const table: [number, string][] = [
    [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
    [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'],
    [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rem = n;
  for (const [v, sym] of table) {
    while (rem >= v) {
      out += sym;
      rem -= v;
    }
  }
  return out;
}
