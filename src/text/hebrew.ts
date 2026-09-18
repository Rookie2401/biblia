/**
 * Display-mode transforms over the canonical Masoretic text (from the Psalter app). None of
 * these mutate the source string; they derive a view of it. The canonical text (consonants +
 * niqqud + te'amim + maqaf + paseq + sof pasuq) is always what is stored.
 */

export type HebrewDisplay = 'full' | 'niqqud' | 'consonants';
export const HEBREW_DISPLAYS: HebrewDisplay[] = ['full', 'niqqud', 'consonants'];
export const HEBREW_DISPLAY_LABEL: Record<HebrewDisplay, string> = { full: 'Full Masoretic', niqqud: 'Niqqud only', consonants: 'Consonants' };

/** Cantillation marks (U+0591–U+05AF), meteg (U+05BD), paseq (U+05C0). */
const CANTILLATION = /[֑-ֽ֯׀]/g;
/** Every combining mark except maqaf (U+05BE) and sof pasuq (U+05C3); includes the CGJ MAM uses. */
const POINTS = /[֑-ֽֿ-ׂׄ-ׇ͏]/g;
const collapse = (s: string) => s.replace(/ +/g, ' ').trim();

export function toNiqqud(text: string): string {
  return collapse(text.replace(CANTILLATION, ''));
}
export function toConsonants(text: string): string {
  return collapse(text.replace(POINTS, '').replace(/־/g, ' '));
}
/** Consonantal skeleton of one word (no maqaf, no punctuation). */
export function skeleton(word: string): string {
  return word.replace(POINTS, '').replace(/[׃׀־ ]/g, '');
}
export function render(text: string, mode: HebrewDisplay): string {
  return mode === 'full' ? text : mode === 'niqqud' ? toNiqqud(text) : toConsonants(text);
}

/** Space-separated tokens of a canonical string (a paseq is its own token; maqaf-joined words stay one token). */
export function tokens(text: string): string[] {
  return text.split(/[  ]+/).filter(Boolean);
}

/**
 * Maqaf-split content words of a verse, in reading order — the unit the morphology is
 * aligned to. Paseq and sof pasuq are dropped (they are rendered by the reader from the
 * original tokens, not from this list).
 */
export function contentWords(text: string): string[] {
  return text
    .replace(/׀/g, '')
    .split(/[  ]+/)
    .filter(Boolean)
    .flatMap((w) => w.split('־'))
    .map((w) => w.replace(/׃/g, ''))
    .filter(Boolean);
}

/** True for a Hebrew base letter (not a mark). */
export function isLetter(ch: string): boolean {
  return /[א-ת]/.test(ch);
}

/**
 * Split a pointed word into pieces that carry the given numbers of base letters, keeping
 * every mark with the letter it follows. Used to cut the printed word at OSHB's morpheme
 * boundaries: `splitByLetters('בְּרֵאשִׁ֖ית', [1, 5])` → ['בְּ', 'רֵאשִׁ֖ית'].
 * Returns null when the counts do not add up to the word's letters.
 */
export function splitByLetters(word: string, counts: number[]): string[] | null {
  const out: string[] = [];
  let i = 0;
  for (const n of counts) {
    let letters = 0;
    let piece = '';
    while (i < word.length && (letters < n || !isLetter(word[i]))) {
      if (isLetter(word[i])) {
        if (letters === n) break;
        letters++;
      }
      piece += word[i];
      i++;
    }
    if (letters !== n) return null;
    out.push(piece);
  }
  if (i !== word.length) return null;
  return out;
}

/** Hebrew numeral for a verse or chapter number (1–999), no gershayim. */
export function hebrewNumeral(n: number): string {
  if (n <= 0 || n >= 1000) return String(n);
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let out = '';
  let h = Math.floor(n / 100);
  while (h > 4) {
    out += 'ת';
    h -= 4;
  }
  out += hundreds[h];
  const rest = n % 100;
  if (rest === 15) return out + 'טו';
  if (rest === 16) return out + 'טז';
  out += tens[Math.floor(rest / 10)] + ones[rest % 10];
  return out;
}
