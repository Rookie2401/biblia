/**
 * Shared types. The canonical texts (MAM, SBLGNT) are immutable data files; everything the
 * reader records (lookups, statuses, positions) lives in IndexedDB and points at the text
 * by reference (book · chapter · verse · word index), never by copying it.
 */

export type Lang = 'he' | 'gr';

/** Where a word is: OSIS book id, chapter, verse, maqaf-split word index (Hebrew) / token index (Greek). */
export interface WordRef {
  book: string;
  ch: number;
  v: number;
  i: number;
}

/** OSHB analysis of one Hebrew word: [lemma, morph, segmented consonantal form?]. */
export type HeTok = [string, string, string?];
/** MorphGNT analysis of one Greek word: [text as printed, lemma, part of speech, parse?]. */
export type GrTok = [string, string, string, string?];

export interface HeVerse {
  n: number;
  /** the verse exactly as MAM prints it (points, accents, maqaf, paseq, sof pasuq) */
  t: string;
  /** ketiv/qere pairs (the text reads the qere) */
  kq?: { k: string; q: string }[];
  /** open (פ) / closed (ס) paragraph after this verse; inverted nun */
  pe?: 1;
  s?: 1;
  nun?: 1;
  /** editorial note from the edition (never part of the text) */
  note?: string;
  /** verse absent from this edition (Josh 21:36–37) */
  absent?: 1;
  /** one entry per maqaf-split content word; null when the morphology could not be aligned */
  w: (HeTok | null)[];
}
export interface GrVerse {
  n: number;
  w: GrTok[];
}
export interface Chapter<V> {
  n: number;
  verses: V[];
}
export interface HeBook {
  book: string;
  chapters: Chapter<HeVerse>[];
}
export interface GrBook {
  book: string;
  chapters: Chapter<GrVerse>[];
}

/** Hebrew lexicon entry (BDB + Strong's + Open Scriptures index), keyed by OSHB lemma id ("1254 a"). */
export interface HeEntry {
  id: string;
  /** pointed lemma */
  w: string;
  x?: string; // transliteration
  pron?: string;
  pos?: string;
  /** short gloss */
  g: string;
  sd?: string; // Strong's definition
  kj?: string; // KJV renderings
  der?: string; // Strong's derivation note
  /** BDB entry as trusted HTML (built at data-build time from the Open Scriptures XML) */
  bdb?: string;
  bdbId?: string;
  /** root (the BDB section head) */
  root?: string;
  rootDef?: string;
  /** other lemmas under the same root: [id, lemma, gloss] */
  fam?: [string, string, string][];
  /** Greek lemmas that render this word in the Septuagint (from Abbott-Smith) */
  lxx?: string[];
  /** occurrences in the Tanakh */
  n: number;
}

/** Greek lexicon entry (Abbott-Smith + Dodson + Strong's), keyed by MorphGNT lemma. */
export interface GrEntry {
  l: string;
  id?: string; // Strong's G-number
  x?: string; // transliteration
  g: string; // short gloss (Dodson)
  long?: string; // Dodson's longer definition
  sd?: string;
  kj?: string;
  der?: string;
  /** Abbott-Smith entry as trusted HTML */
  as?: string;
  /** Hebrew words this Greek word renders in the LXX: [Strong's number, Hebrew] */
  heb?: [number, string][];
  n: number;
}

export const VOCAB_STATUSES = ['new', 'recognized', 'familiar', 'known', 'automatic'] as const;
export type VocabStatus = (typeof VOCAB_STATUSES)[number];

/** A vocabulary item = one lexicon entry (Hebrew lemma id or Greek lemma). Key: "he:1254 a" / "gr:λόγος". */
export interface Lexeme {
  key: string;
  lang: Lang;
  /** lexicon id: the OSHB lemma id or the Greek lemma */
  id: string;
  lemma: string;
  gloss: string;
  status: VocabStatus;
  statusChangedAt: number;
  lookups: number;
  /** verses read past while the word was unlooked-up, counted once per chapter visit */
  encounters: number;
  /** surface forms met (as printed, without accents) */
  forms: string[];
  /** "Gen:1" chapter keys where it was looked up */
  chapters: string[];
  firstLookup?: WordRef & { at: number };
  lastLookupAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Lookup {
  id?: number;
  key: string;
  book: string;
  ch: number;
  v: number;
  i: number;
  at: number;
}

export interface Position {
  book: string;
  ch: number;
  /** first visible verse */
  v: number;
  at: number;
}

export interface Progress {
  /** "Gen:1" */
  id: string;
  book: string;
  ch: number;
  /** finished reading (scrolled to the end) */
  done: boolean;
  visits: number;
  lastAt: number;
}

export interface UserNote {
  key: string;
  text: string;
  updatedAt: number;
}

export function lexemeKey(lang: Lang, id: string): string {
  return `${lang}:${id}`;
}
export function refKey(r: WordRef): string {
  return `${r.book}:${r.ch}:${r.v}:${r.i}`;
}
export function chapterKey(book: string, ch: number): string {
  return `${book}:${ch}`;
}
