/**
 * Vocabulary model: one Lexeme per lexicon entry (Hebrew lemma id / Greek lemma), lookups,
 * encounters, LingQ-style statuses. A printed word is never a vocabulary item by itself.
 *
 * Every read-modify-write runs inside one Dexie read-write transaction, so concurrent
 * operations on the same lexeme or chapter (rapid taps, effect replays, several tabs)
 * serialize and always recompute from the row as it is at that moment. Listeners are
 * notified only after the transaction has committed.
 */
import { db } from '../db/db.ts';
import { lexemeKey, type Lang, type Lexeme, type VocabStatus, type WordRef } from '../model/types.ts';
import { getSettings } from './settings.ts';

const changeListeners = new Set<() => void>();
export function onVocabChange(cb: () => void): () => void {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}
function notify() {
  changeListeners.forEach((l) => l());
}

export interface LexemeSeed {
  lang: Lang;
  id: string;
  lemma: string;
  gloss: string;
}

function fresh(seed: LexemeSeed, now: number): Lexeme {
  return { key: lexemeKey(seed.lang, seed.id), lang: seed.lang, id: seed.id, lemma: seed.lemma, gloss: seed.gloss, status: 'new', statusChangedAt: now, lookups: 0, encounters: 0, forms: [], chapters: [], createdAt: now, updatedAt: now };
}

/** Upsert: never resets a row another operation created a moment earlier. */
export async function getOrCreateLexeme(seed: LexemeSeed): Promise<Lexeme> {
  return db.transaction('rw', db.lexemes, async () => {
    const key = lexemeKey(seed.lang, seed.id);
    const existing = await db.lexemes.get(key);
    if (existing) return existing;
    const lx = fresh(seed, Date.now());
    await db.lexemes.add(lx);
    return lx;
  });
}

/** Record that the reader tapped this word for help: the lexeme and its history row change together. */
export async function recordLookup(seed: LexemeSeed, ref: WordRef, form: string): Promise<Lexeme> {
  const lx = await db.transaction('rw', db.lexemes, db.lookups, async () => {
    const now = Date.now();
    const key = lexemeKey(seed.lang, seed.id);
    const row = (await db.lexemes.get(key)) ?? fresh(seed, now);
    row.lookups += 1;
    row.lastLookupAt = now;
    if (form && !row.forms.includes(form) && row.forms.length < 40) row.forms.push(form);
    const ck = `${ref.book}:${ref.ch}`;
    if (!row.chapters.includes(ck)) row.chapters.push(ck);
    if (!row.firstLookup) row.firstLookup = { ...ref, at: now };
    if (!row.gloss && seed.gloss) row.gloss = seed.gloss;
    // Asking about a word is evidence you are learning it; an automatic promotion was a guess.
    if (getSettings().lookupMarksRecognized && (row.status === 'new' || row.status === 'automatic')) {
      row.status = 'recognized';
      row.statusChangedAt = now;
    }
    row.updatedAt = now;
    await db.lexemes.put(row);
    await db.lookups.add({ key, book: ref.book, ch: ref.ch, v: ref.v, i: ref.i, at: now });
    return row;
  });
  notify();
  return lx;
}

export async function setLexemeStatus(key: string, status: VocabStatus): Promise<void> {
  const changed = await db.transaction('rw', db.lexemes, async () => {
    const lx = await db.lexemes.get(key);
    if (!lx) return false;
    lx.status = status;
    lx.statusChangedAt = Date.now();
    lx.updatedAt = lx.statusChangedAt;
    await db.lexemes.put(lx);
    return true;
  });
  if (changed) notify();
}

/** Statuses for a set of keys (words not in the table are "new"). */
export async function statusMap(keys: Iterable<string>): Promise<Map<string, VocabStatus>> {
  const ks = [...new Set(keys)];
  const rows = await db.lexemes.bulkGet(ks);
  const out = new Map<string, VocabStatus>();
  rows.forEach((r, i) => {
    if (r) out.set(ks[i], r.status);
  });
  return out;
}

/**
 * Called once per chapter visit with every lexeme key in the chapter: words the reader has
 * a record for gain an encounter; a "new" word read past `autoKnownAfter` times without a
 * lookup becomes "automatic" (known without asking). Only the encounter counter and that
 * promotion are written, from the row as it is inside the transaction, so a lookup or a
 * status change that lands at the same time is never overwritten.
 */
export async function recordEncounters(keys: Iterable<string>, seedFor: (key: string) => LexemeSeed | undefined): Promise<number> {
  const after = getSettings().autoKnownAfter;
  const ks = [...new Set(keys)];
  if (!ks.length) return 0;
  const { promoted, changed } = await db.transaction('rw', db.lexemes, async () => {
    const now = Date.now();
    const rows = await db.lexemes.bulkGet(ks);
    const updates: Lexeme[] = [];
    let promoted = 0;
    ks.forEach((k, i) => {
      const r = rows[i];
      if (!r) {
        if (!after) return;
        const seed = seedFor(k);
        if (!seed) return;
        const n = fresh(seed, now);
        n.encounters = 1;
        updates.push(n);
        return;
      }
      r.encounters += 1;
      r.updatedAt = now;
      if (after && r.status === 'new' && r.lookups === 0 && r.encounters >= after) {
        r.status = 'automatic';
        r.statusChangedAt = now;
        promoted++;
      }
      updates.push(r);
    });
    if (updates.length) await db.lexemes.bulkPut(updates);
    return { promoted, changed: updates.length > 0 };
  });
  if (changed) notify();
  return promoted;
}

/** "Mark the rest of this chapter as known": every new, never-tapped word becomes automatic. */
export async function markUnlookedAsKnown(keys: Iterable<string>, seedFor: (key: string) => LexemeSeed | undefined): Promise<number> {
  const ks = [...new Set(keys)];
  if (!ks.length) return 0;
  const n = await db.transaction('rw', db.lexemes, async () => {
    const rows = await db.lexemes.bulkGet(ks);
    const now = Date.now();
    const updates: Lexeme[] = [];
    ks.forEach((k, i) => {
      const r = rows[i];
      if (r) {
        if (r.status === 'new' && r.lookups === 0) updates.push({ ...r, status: 'automatic', statusChangedAt: now, updatedAt: now });
        return;
      }
      const seed = seedFor(k);
      if (seed) {
        const x = fresh(seed, now);
        x.status = 'automatic';
        x.encounters = 1;
        updates.push(x);
      }
    });
    if (updates.length) await db.lexemes.bulkPut(updates);
    return updates.length;
  });
  if (n) notify();
  return n;
}

export async function savePosition(book: string, ch: number, v: number): Promise<void> {
  await db.positions.put({ book, ch, v, at: Date.now() });
}

/**
 * A chapter visit (`done` false) increments the visit count; reaching the end (`done` true)
 * marks it finished. `done` is monotonic and visits are never lost, whichever order the two
 * calls land in.
 */
export async function markChapterVisit(book: string, ch: number, done: boolean): Promise<void> {
  const id = `${book}:${ch}`;
  await db.transaction('rw', db.progress, async () => {
    const p = await db.progress.get(id);
    await db.progress.put({ id, book, ch, done: done || p?.done || false, visits: (p?.visits ?? 0) + (done ? 0 : 1), lastAt: Date.now() });
  });
}
