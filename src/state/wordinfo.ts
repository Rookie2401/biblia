/**
 * Everything the cards need about one printed word: the token, its decoded morphology, the
 * lexeme it belongs to, and (loaded lazily) its lexicon entry. Short glosses for whole
 * verses come from the lexicon index (one small file per language) rather than the shards.
 */
import { type AnyBook, isHeBook } from '../data/books.ts';
import { grEntry, heEntry, heLemmaId, searchIndex, type IndexRow } from '../data/lexicon.ts';
import { lexemeKey, type GrEntry, type GrTok, type HeEntry, type HeTok, type HeVerse, type Lang, type WordRef } from '../model/types.ts';
import * as GR from '../morph/greek.ts';
import * as HE from '../morph/hebrew.ts';
import { splitPrinted, greekPlain } from '../text/greek.ts';
import { contentWords, toNiqqud } from '../text/hebrew.ts';
import type { LexemeSeed } from './vocab.ts';

export interface WordInfo {
  ref: WordRef;
  lang: Lang;
  /** the word as printed (Hebrew: pointed and accented; Greek: without its punctuation) */
  printed: string;
  /** the form recorded under "forms seen" (Hebrew: niqqud only; Greek: as printed) */
  form: string;
  /** lexicon id — Hebrew lemma id ("1254 a") or Greek lemma */
  lexId?: string;
  key?: string;
  he?: { tok: HeTok; morph: HE.HeMorph; segments: HE.HeSegment[]; lines: HE.EncodingLine[]; prefixOnly: boolean };
  gr?: { tok: GrTok; morph: GR.GrMorph; lines: GR.EncodingLine[] };
}

export function wordAt(book: AnyBook, ref: WordRef): WordInfo | null {
  const ch = book.chapters[ref.ch - 1];
  const verse = ch?.verses[ref.v - 1];
  if (!verse) return null;
  if (isHeBook(book)) {
    const hv = verse as HeVerse;
    const words = contentWords(hv.t);
    const printed = words[ref.i];
    if (printed === undefined) return null;
    const tok = hv.w[ref.i];
    const info: WordInfo = { ref, lang: 'he', printed, form: toNiqqud(printed) };
    if (tok) {
      const morph = HE.decode(tok);
      const segments = HE.segments(tok, printed, morph);
      const lines = HE.encodingLines(morph, segments);
      const id = heLemmaId(tok[0]);
      info.he = { tok, morph, segments, lines, prefixOnly: !id };
      if (id) {
        info.lexId = id;
        info.key = lexemeKey('he', id);
      }
    }
    return info;
  }
  const tok = verse.w[ref.i] as GrTok | undefined;
  if (!tok) return null;
  const { word } = splitPrinted(tok[0]);
  const morph = GR.decode(tok);
  return { ref, lang: 'gr', printed: word, form: word, lexId: tok[1], key: lexemeKey('gr', tok[1]), gr: { tok, morph, lines: GR.encodingLines(morph, word) } };
}

export async function loadEntry(info: WordInfo): Promise<HeEntry | GrEntry | undefined> {
  if (!info.lexId) return undefined;
  return info.lang === 'he' ? heEntry(info.lexId) : grEntry(info.lexId);
}

export function entryLemma(lang: Lang, e: HeEntry | GrEntry): string {
  return lang === 'he' ? (e as HeEntry).w : (e as GrEntry).l;
}

export function seedFor(info: WordInfo, e?: HeEntry | GrEntry): LexemeSeed | undefined {
  if (!info.lexId) return undefined;
  return { lang: info.lang, id: info.lexId, lemma: e ? entryLemma(info.lang, e) : glossIndex(info.lang)?.get(info.lexId)?.[1] ?? info.lexId, gloss: e?.g ?? glossIndex(info.lang)?.get(info.lexId)?.[3] ?? '' };
}

// ---- short glosses from the index
const indices: Partial<Record<Lang, Map<string, IndexRow>>> = {};
const indexLoads: Partial<Record<Lang, Promise<Map<string, IndexRow>>>> = {};

export function glossIndex(lang: Lang): Map<string, IndexRow> | undefined {
  return indices[lang];
}
export function ensureGlossIndex(lang: Lang): Promise<Map<string, IndexRow>> {
  const hit = indices[lang];
  if (hit) return Promise.resolve(hit);
  return (indexLoads[lang] ??= searchIndex(lang).then((rows) => {
    const m = new Map<string, IndexRow>();
    for (const r of rows) m.set(r[0], r);
    indices[lang] = m;
    return m;
  }));
}
/** Short gloss of a token (index must be loaded; '' otherwise). */
export function shortGloss(lang: Lang, lexId: string | undefined): string {
  if (!lexId) return '';
  const row = indices[lang]?.get(lexId) ?? (lang === 'he' ? indices.he?.get(lexId.split(' ')[0]) : undefined);
  return row?.[3] ?? '';
}
/** Pointed lemma / Greek lemma from the index. */
export function indexLemma(lang: Lang, lexId: string | undefined): string {
  if (!lexId) return '';
  return indices[lang]?.get(lexId)?.[1] ?? '';
}

/** Lexeme keys and word infos of a whole chapter (for statuses, encounters and "mark as known"). */
export function chapterWords(book: AnyBook, ch: number): WordInfo[] {
  const c = book.chapters[ch - 1];
  if (!c) return [];
  const out: WordInfo[] = [];
  c.verses.forEach((v) => {
    const n = isHeBook(book) ? contentWords((v as HeVerse).t).length : v.w.length;
    for (let i = 0; i < n; i++) {
      const w = wordAt(book, { book: book.book, ch, v: v.n, i });
      if (w) out.push(w);
    }
  });
  return out;
}

export function plainForm(info: WordInfo): string {
  return info.lang === 'he' ? info.form : greekPlain(info.form);
}
