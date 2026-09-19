/**
 * Lexicon and concordance access. Entries live in shards under ./data/lex and ./data/conc
 * (built by scripts/build-lexicon-*.mjs); a shard is fetched once and kept.
 *   Hebrew: key = OSHB lemma id ("1254 a"), shard = floor(number / 300)
 *   Greek:  key = MorphGNT lemma, shard = first letter (large letters split by second letter)
 */
import type { GrEntry, HeEntry, Lang } from '../model/types.ts';
import { greekBase } from '../text/greek.ts';
import { memoAsync, memoAsyncKeyed } from './asyncCache.ts';

const shards = new Map<string, Promise<Record<string, unknown>>>();
const grManifestBox: { current: Promise<{ split: string[]; shards?: string[] }> | null } = { current: null };
function loadGrManifest(): Promise<{ split: string[]; shards?: string[] }> {
  return memoAsync(grManifestBox, () => fetchJson<{ split: string[]; shards?: string[] }>('./data/lex/gr-manifest.json'));
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

function shard(path: string): Promise<Record<string, unknown>> {
  let p = shards.get(path);
  if (!p) {
    p = fetchJson<Record<string, unknown>>(path).catch((e) => {
      shards.delete(path);
      throw e;
    });
    shards.set(path, p);
  }
  return p;
}

export function heShard(id: string): string {
  return String(Math.floor(Number(id.split(' ')[0]) / 300));
}
export async function grShard(lemma: string): Promise<string> {
  const { split } = await loadGrManifest();
  const b = greekBase(lemma).replace(/[^α-ω]/g, '');
  const one = b[0] || 'x';
  return split.includes(one) ? one + (b[1] || '') : one;
}

/** Numeric Strong's id from an OSHB lemma ("c/d/1254 a" → "1254 a"; "1008+" → "1008"). */
export function heLemmaId(lemma: string): string | null {
  const stem = lemma.split('/').pop()!.replace(/\+$/, '');
  return /^\d+( [a-z])?$/.test(stem) ? stem : null;
}

export async function heEntry(id: string): Promise<HeEntry | undefined> {
  const s = await shard(`./data/lex/he-${heShard(id)}.json`);
  return (s[id] as HeEntry | undefined) ?? (s[id.split(' ')[0]] as HeEntry | undefined);
}
export async function grEntry(lemma: string): Promise<GrEntry | undefined> {
  const s = await shard(`./data/lex/gr-${await grShard(lemma)}.json`);
  return s[lemma] as GrEntry | undefined;
}

/** Every entry of a Hebrew shard (for the root-family and LXX cross references). */
export async function heEntries(ids: string[]): Promise<Map<string, HeEntry>> {
  const out = new Map<string, HeEntry>();
  await Promise.all(
    ids.map(async (id) => {
      const e = await heEntry(id).catch(() => undefined);
      if (e) out.set(id, e);
    }),
  );
  return out;
}

/** Occurrences of a lexeme as [bookIndex, chapter, verse, wordIndex] tuples. */
export async function concordance(lang: Lang, id: string): Promise<number[][]> {
  const path = lang === 'he' ? `./data/conc/he-${heShard(id)}.json` : `./data/conc/gr-${await grShard(id)}.json`;
  const s = await shard(path);
  const flat = (s[id] as number[] | undefined) ?? [];
  const out: number[][] = [];
  for (let i = 0; i + 3 < flat.length; i += 4) out.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]);
  return out;
}

/** Search indices: [id, lemma, transliteration, gloss, count, gloss source]. */
export type IndexRow = [string, string, string, string, number, string?];
const indexBoxes: Partial<Record<Lang, Promise<IndexRow[]>>> = {};
export function searchIndex(lang: Lang): Promise<IndexRow[]> {
  return memoAsyncKeyed(indexBoxes, lang, () => fetchJson<IndexRow[]>(`./data/lex/${lang}-index.json`));
}

/** Every data file, for "download everything for offline use". */
export async function allDataUrls(bookIds: string[], langOfBook: (id: string) => Lang): Promise<string[]> {
  const man = await loadGrManifest();
  const urls = bookIds.map((id) => `./data/${langOfBook(id)}/${id}.json`);
  for (let i = 0; i <= 29; i++) urls.push(`./data/lex/he-${i}.json`, `./data/conc/he-${i}.json`);
  for (const s of man.shards ?? []) urls.push(`./data/lex/gr-${s}.json`, `./data/conc/gr-${s}.json`);
  urls.push('./data/lex/he-index.json', './data/lex/gr-index.json', './data/lex/gr-manifest.json', './data/lex/he-bdb-index.json');
  for (const id of bookIds) urls.push(`./data/ctx/${langOfBook(id)}/${id}.json`);
  return urls;
}
