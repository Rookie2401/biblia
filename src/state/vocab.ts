/**
 * Vocabulary model: one Lexeme per lexicon entry (Hebrew lemma id / Greek lemma), lookups,
 * encounters, LingQ-style statuses. A printed word is never a vocabulary item by itself.
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

export async function getOrCreateLexeme(seed: LexemeSeed): Promise<Lexeme> {
  const key = lexemeKey(seed.lang, seed.id);
  const existing = await db.lexemes.get(key);
  if (existing) return existing;
  const now = Date.now();
  const lx: Lexeme = { key, lang: seed.lang, id: seed.id, lemma: seed.lemma, gloss: seed.gloss, status: 'new', statusChangedAt: now, lookups: 0, encounters: 0, forms: [], chapters: [], createdAt: now, updatedAt: now };
  await db.lexemes.put(lx);
  return lx;
}

/** Record that the reader tapped this word for help. */
export async function recordLookup(seed: LexemeSeed, ref: WordRef, form: string): Promise<Lexeme> {
  const now = Date.now();
  const lx = await getOrCreateLexeme(seed);
  lx.lookups += 1;
  lx.lastLookupAt = now;
  if (form && !lx.forms.includes(form) && lx.forms.length < 40) lx.forms.push(form);
  const ck = `${ref.book}:${ref.ch}`;
  if (!lx.chapters.includes(ck)) lx.chapters.push(ck);
  if (!lx.firstLookup) lx.firstLookup = { ...ref, at: now };
  if (!lx.gloss && seed.gloss) lx.gloss = seed.gloss;
  // Asking about a word is evidence you are learning it; an automatic promotion was a guess.
  if (getSettings().lookupMarksRecognized && (lx.status === 'new' || lx.status === 'automatic')) {
    lx.status = 'recognized';
    lx.statusChangedAt = now;
  }
  lx.updatedAt = now;
  await db.lexemes.put(lx);
  await db.lookups.add({ key: lx.key, book: ref.book, ch: ref.ch, v: ref.v, i: ref.i, at: now });
  notify();
  return lx;
}

export async function setLexemeStatus(key: string, status: VocabStatus): Promise<void> {
  const lx = await db.lexemes.get(key);
  if (!lx) return;
  lx.status = status;
  lx.statusChangedAt = Date.now();
  lx.updatedAt = lx.statusChangedAt;
  await db.lexemes.put(lx);
  notify();
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
 * lookup becomes "automatic" (known without asking). Words never tapped have no record and
 * are left alone — the table only ever holds words the reader has interacted with, plus
 * the ones promoted here.
 */
export async function recordEncounters(keys: Iterable<string>, seedFor: (key: string) => LexemeSeed | undefined): Promise<number> {
  const after = getSettings().autoKnownAfter;
  const ks = [...new Set(keys)];
  const rows = await db.lexemes.bulkGet(ks);
  const now = Date.now();
  const updates: Lexeme[] = [];
  let promoted = 0;
  ks.forEach((k, i) => {
    const r = rows[i];
    if (!r) {
      if (!after) return;
      const seed = seedFor(k);
      if (!seed) return;
      updates.push({ key: k, lang: seed.lang, id: seed.id, lemma: seed.lemma, gloss: seed.gloss, status: 'new', statusChangedAt: now, lookups: 0, encounters: 1, forms: [], chapters: [], createdAt: now, updatedAt: now });
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
  if (updates.length) notify();
  return promoted;
}

/** "Mark the rest of this chapter as known": every new, never-tapped word becomes automatic. */
export async function markUnlookedAsKnown(keys: Iterable<string>, seedFor: (key: string) => LexemeSeed | undefined): Promise<number> {
  const ks = [...new Set(keys)];
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
    if (seed) updates.push({ key: k, lang: seed.lang, id: seed.id, lemma: seed.lemma, gloss: seed.gloss, status: 'automatic', statusChangedAt: now, lookups: 0, encounters: 1, forms: [], chapters: [], createdAt: now, updatedAt: now });
  });
  if (updates.length) {
    await db.lexemes.bulkPut(updates);
    notify();
  }
  return updates.length;
}

export async function savePosition(book: string, ch: number, v: number): Promise<void> {
  await db.positions.put({ book, ch, v, at: Date.now() });
}
export async function markChapterVisit(book: string, ch: number, done: boolean): Promise<void> {
  const id = `${book}:${ch}`;
  const p = await db.progress.get(id);
  await db.progress.put({ id, book, ch, done: done || p?.done || false, visits: (p?.visits ?? 0) + (done ? 0 : 1), lastAt: Date.now() });
}
