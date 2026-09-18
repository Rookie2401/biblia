import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db.ts';
import { getOrCreateLexeme, markChapterVisit, recordEncounters, recordLookup, setLexemeStatus, type LexemeSeed } from '../src/state/vocab.ts';

const seed: LexemeSeed = { lang: 'he', id: '1697', lemma: 'דָּבָר', gloss: 'word' };
const ref = { book: 'Gen', ch: 1, v: 1, i: 0 };

beforeEach(async () => {
  await db.lexemes.clear();
  await db.lookups.clear();
  await db.progress.clear();
});

describe('vocabulary writes are atomic', () => {
  it('creates a lexeme once under concurrent upserts', async () => {
    const [a, b] = await Promise.all([getOrCreateLexeme(seed), getOrCreateLexeme(seed)]);
    expect(a.key).toBe(b.key);
    expect(await db.lexemes.count()).toBe(1);
  });
  it('counts two simultaneous lookups and keeps two history rows', async () => {
    await Promise.all([recordLookup(seed, ref, 'דָּבָר'), recordLookup(seed, { ...ref, v: 2 }, 'דְּבַר')]);
    const lx = (await db.lexemes.get('he:1697'))!;
    expect(lx.lookups).toBe(2);
    expect(lx.forms.sort()).toEqual(['דְּבַר', 'דָּבָר'].sort());
    expect(await db.lookups.where('key').equals('he:1697').count()).toBe(2);
    expect(lx.status).toBe('recognized');
  });
  it('preserves both a lookup and an encounter that land together', async () => {
    await getOrCreateLexeme(seed);
    await Promise.all([recordLookup(seed, ref, 'דָּבָר'), recordEncounters(['he:1697'], () => seed)]);
    const lx = (await db.lexemes.get('he:1697'))!;
    expect(lx.lookups).toBe(1);
    expect(lx.encounters).toBe(1);
    expect(lx.chapters).toEqual(['Gen:1']);
  });
  it('never lets a stale encounter write undo a status change', async () => {
    await getOrCreateLexeme(seed);
    await Promise.all([setLexemeStatus('he:1697', 'known'), recordEncounters(['he:1697'], () => seed), recordEncounters(['he:1697'], () => seed)]);
    const lx = (await db.lexemes.get('he:1697'))!;
    expect(lx.status).toBe('known');
    expect(lx.encounters).toBe(2);
  });
  it('keeps chapter completion monotonic and never loses a visit', async () => {
    await Promise.all([markChapterVisit('Gen', 1, false), markChapterVisit('Gen', 1, true), markChapterVisit('Gen', 1, false)]);
    const p = (await db.progress.get('Gen:1'))!;
    expect(p.done).toBe(true);
    expect(p.visits).toBe(2);
    await markChapterVisit('Gen', 1, false);
    expect((await db.progress.get('Gen:1'))!.done).toBe(true);
    expect((await db.progress.get('Gen:1'))!.visits).toBe(3);
  });
});
