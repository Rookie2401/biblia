/**
 * Lexicon search over the two index files, as a pure function so it can be tested without React.
 *
 * Query rules:
 *   Hebrew letters            → Hebrew lemmas whose consonantal skeleton contains the query
 *   Greek letters             → Greek lemmas whose accent-free form contains the query
 *   "H1697" / "G3056"         → that Strong's entry in that language
 *   bare number "1697"        → that Strong's number in both languages (Hebrew first)
 *   Latin letters             → glosses containing the word, or transliterations starting with it
 * The scope filter keeps only one language; results are capped at `limit`.
 */
import type { IndexRow } from '../data/lexicon.ts';
import type { Lang } from '../model/types.ts';
import { greekBase } from '../text/greek.ts';
import { skeleton } from '../text/hebrew.ts';
import { latinBase } from '../text/latin.ts';

export interface SearchRow {
  lang: Lang;
  /** lexicon id: OSHB lemma id ("1254 a") or Greek lemma */
  id: string;
  lemma: string;
  transliteration: string;
  gloss: string;
  count: number;
  /** Strong's label: "H1254" / "G3056" ('' when unknown) */
  strong: string;
  /** where the gloss comes from (curated | bdb | index | strongs | kjv | dodson | abbott) */
  source: string;
}

export type SearchScope = 'all' | 'he' | 'gr' | 'la';

/** Greek index rows are [lemma, Strong's id, transliteration, gloss, count]. */
export function toGreekSearchRows(rows: IndexRow[]): SearchRow[] {
  return rows.map(([lemma, strong, transliteration, gloss, count, source]) => ({ lang: 'gr', id: lemma, lemma, transliteration: transliteration || '', gloss: gloss || '', count, strong: strong || '', source: source || '' }));
}
export function toHebrewSearchRows(rows: IndexRow[]): SearchRow[] {
  return rows.map(([id, lemma, transliteration, gloss, count, source]) => ({ lang: 'he', id, lemma: lemma || id, transliteration: transliteration || '', gloss: gloss || '', count, strong: `H${id.split(' ')[0]}`, source: source || '' }));
}
/** Latin index rows are [lemma, '' (no Strong's number), transliteration, gloss, count, source]. */
export function toLatinSearchRows(rows: IndexRow[]): SearchRow[] {
  return rows.map(([lemma, , transliteration, gloss, count, source]) => ({ lang: 'la', id: lemma, lemma, transliteration: transliteration || '', gloss: gloss || '', count, strong: '', source: source || '' }));
}

export function wordUrl(row: Pick<SearchRow, 'lang' | 'id'>): string {
  return `/word/${row.lang}/${encodeURIComponent(row.id)}`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function searchLexicon(rows: SearchRow[], query: string, scope: SearchScope = 'all', limit = 80): SearchRow[] {
  const s = query.trim();
  if (!s) return [];
  const isHe = /[א-ת]/.test(s);
  const isGr = /[Ͱ-Ͽἀ-῿]/.test(s);
  const num = s.match(/^([HG])?\s*(\d+)$/i);
  let out: SearchRow[];
  if (num) {
    const n = num[2];
    const want = num[1]?.toUpperCase();
    out = rows.filter((r) => {
      if (r.lang === 'he') return want !== 'G' && r.id.split(' ')[0] === n;
      return want !== 'H' && r.strong === 'G' + n;
    });
    out.sort((a, b) => (a.lang === b.lang ? b.count - a.count : a.lang === 'he' ? -1 : 1));
  } else if (isHe) {
    // the query may be a printed form with proclitics (בראשית): retry with prefix letters removed
    let sk = skeleton(s);
    out = [];
    for (let tries = 0; tries < 3 && sk.length >= 2; tries++) {
      const q = sk;
      out = rows.filter((r) => r.lang === 'he' && skeleton(r.lemma).includes(q));
      if (out.length) break;
      if (!/^[ובכלמהש]/.test(sk)) break;
      sk = sk.slice(1);
    }
    const q = sk;
    out.sort((a, b) => Number(skeleton(b.lemma) === q) - Number(skeleton(a.lemma) === q) || b.count - a.count);
  } else if (isGr) {
    const b = greekBase(s);
    out = rows.filter((r) => r.lang === 'gr' && greekBase(r.lemma).includes(b));
    out.sort((x, y) => Number(greekBase(y.lemma) === b) - Number(greekBase(x.lemma) === b) || y.count - x.count);
  } else {
    const l = s.toLowerCase();
    const word = new RegExp(`\\b${escapeRe(l)}`, 'i');
    const lb = latinBase(s);
    // exact gloss first, then a Latin lemma match, then a gloss that opens with the word, then the rest; ties by frequency
    const score = (r: SearchRow) => (r.gloss.toLowerCase() === l || r.transliteration.toLowerCase() === l ? 3 : r.lang === 'la' && latinBase(r.lemma) === lb ? 2 : new RegExp('^' + escapeRe(l) + '\b', 'i').test(r.gloss) ? 1 : 0);
    out = rows.filter((r) => word.test(r.gloss) || r.transliteration.toLowerCase().startsWith(l) || (r.lang === 'la' && latinBase(r.lemma).includes(lb)));
    out.sort((a, b) => score(b) - score(a) || b.count - a.count);
  }
  if (scope !== 'all') out = out.filter((r) => r.lang === scope);
  return out.slice(0, limit);
}
