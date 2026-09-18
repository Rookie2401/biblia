/**
 * Contextual renderings: for each word of each verse, the English the Berean Standard Bible
 * (public domain) uses for that word *in that verse*, aligned at build time
 * (scripts/build-bsb.mjs → ./data/ctx/<lang>/<Book>.json). This is the only layer that is a
 * translation of the verse; the lexicon glosses are lemma meanings.
 *
 *   ''    → the word is rendered together with a neighbour (no separate English)
 *   null  → the word could not be aligned to the BSB (different base text)
 */
import type { Lang } from '../model/types.ts';

interface CtxBook {
  book: string;
  chapters: (string | null)[][][];
}

const cache = new Map<string, CtxBook>();
const pending = new Map<string, Promise<CtxBook | null>>();
const MAX = 6;

export function loadContext(lang: Lang, book: string): Promise<CtxBook | null> {
  const key = `${lang}:${book}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  const req = fetch(`./data/ctx/${lang}/${book}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CtxBook>) : null))
    .then((b) => {
      if (b) {
        if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
        cache.set(key, b);
      }
      pending.delete(key);
      return b;
    })
    .catch(() => {
      pending.delete(key);
      return null;
    });
  pending.set(key, req);
  return req;
}

export function cachedContext(lang: Lang, book: string): CtxBook | undefined {
  return cache.get(`${lang}:${book}`);
}

/** The BSB rendering of one word, when the book is loaded. */
export function contextGloss(lang: Lang, book: string, ch: number, v: number, i: number): string | null | undefined {
  return cache.get(`${lang}:${book}`)?.chapters[ch - 1]?.[v - 1]?.[i];
}
