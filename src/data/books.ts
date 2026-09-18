/**
 * Loads book files lazily from ./data/he/<id>.json and ./data/gr/<id>.json (built by
 * scripts/build-*.mjs). A handful of books are kept in memory; the service worker keeps
 * every file that was ever fetched, so a book read once is available offline.
 */
import type { GrBook, HeBook } from '../model/types.ts';
import { langOf } from '../text/canon.ts';

export type AnyBook = HeBook | GrBook;

const cache = new Map<string, AnyBook>();
const pending = new Map<string, Promise<AnyBook>>();
const MAX = 6;

export function bookUrl(id: string): string {
  return `./data/${langOf(id)}/${id}.json`;
}

export function loadBook(id: string): Promise<AnyBook> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(id);
  if (p) return p;
  const req = fetch(bookUrl(id))
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load ${id} (${r.status})`);
      return r.json() as Promise<AnyBook>;
    })
    .then((b) => {
      if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
      cache.set(id, b);
      pending.delete(id);
      return b;
    })
    .catch((e) => {
      pending.delete(id);
      throw e;
    });
  pending.set(id, req);
  return req;
}

export function cachedBook(id: string): AnyBook | undefined {
  return cache.get(id);
}

export function isHeBook(b: AnyBook): b is HeBook {
  return langOf(b.book) === 'he';
}
