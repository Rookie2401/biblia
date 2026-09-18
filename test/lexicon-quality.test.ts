// Guards over the shipped lexicon files (public/data/lex): the classes of defect the
// content audit found must not come back when the data is rebuilt.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GrEntry, HeEntry } from '../src/model/types.ts';

const lexDir = path.resolve(__dirname, '..', 'public', 'data', 'lex');
const have = fs.existsSync(path.join(lexDir, 'he-index.json')) && fs.existsSync(path.join(lexDir, 'gr-index.json'));
const load = <T>(prefix: string): T[] => {
  const out: T[] = [];
  for (const f of fs.readdirSync(lexDir)) if (f.startsWith(prefix) && /^\w+-[^-]+\.json$/.test(f) && !/index|manifest|SOURCES/.test(f)) out.push(...(Object.values(JSON.parse(fs.readFileSync(path.join(lexDir, f), 'utf8'))) as T[]));
  return out;
};
const ARCHAIC = /\b(thou|thee|thy|thine|ye|hath|shalt|art|wilt|doth|begat|didst|saith|unto)\b/i;

describe.skipIf(!have)('shipped lexicon quality', () => {
  const he = load<HeEntry>('he-');
  const gr = load<GrEntry>('gr-');

  it('every Hebrew lemma has a short gloss with a named source and no archaic KJV phrasing', () => {
    expect(he.length).toBeGreaterThan(9000);
    expect(he.filter((e) => !e.g)).toEqual([]);
    expect(he.filter((e) => !e.gs).map((e) => e.id)).toEqual([]);
    expect(he.filter((e) => ARCHAIC.test(e.g)).map((e) => `${e.id}: ${e.g}`)).toEqual([]);
    expect(he.filter((e) => /\bcompare\b/i.test(e.g)).map((e) => `${e.id}: ${e.g}`)).toEqual([]);
  });
  it('the audited Hebrew entries read correctly', () => {
    const by = new Map(he.map((e) => [e.id, e]));
    expect(by.get('2894')?.g).toBe('to sweep away');
    expect(by.get('859 a')?.g).toMatch(/^you/);
    expect(by.get('842')?.g).toMatch(/Asherah/);
    expect(by.get('1408')?.g).toMatch(/Fortune/);
    expect(by.get('528')?.g).toMatch(/Amon/);
    expect(by.get('4136')?.pos).toBe('preposition');
    expect(by.get('7462 b')?.pos).toBe('verb');
    expect(by.get('7462 a')?.w.replace(/[֑-ׇ]/g, '')).toMatch(/^בית/); // the multi-word place name that shares the number
    expect(by.get('859 d')?.w.replace(/[֑-ׇ]/g, '')).toBe('אתם'); // consonants only: mark order differs from hand-typed text
  });
  it('every Greek lemma has a gloss, a transliteration and a named source; no "descendent"', () => {
    expect(gr.length).toBeGreaterThan(5400);
    expect(gr.filter((e) => !e.g).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => !e.x).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => !e.gs).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => /descendent/.test(e.g + (e.long ?? ''))).map((e) => e.l)).toEqual([]);
    const by = new Map(gr.map((e) => [e.l, e]));
    expect(by.get('ἐλεάω')?.g).toMatch(/mercy/);
    expect(by.get('ἕνεκεν')?.g).toMatch(/because of/);
    expect(by.get('χρυσοῦς')?.g).toMatch(/gold/);
    expect(by.get('υἱός')?.g).toBe('a son, descendant');
    // aliased lemmas carry the nearest full entry
    expect(by.get('ἐλεάω')?.as).toBeTruthy();
    expect(by.get('Μαριάμ')?.id).toBe('G3137');
  });
  it('the search index rows carry the gloss source', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(lexDir, 'he-index.json'), 'utf8')) as unknown[][];
    expect(idx.every((r) => r.length === 6 && typeof r[5] === 'string')).toBe(true);
  });
});
