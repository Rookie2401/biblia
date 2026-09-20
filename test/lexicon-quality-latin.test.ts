// Guards the shipped Latin lexicon (public/data/lex/la-*.json), built from Lewis & Short by
// scripts/build-lexicon-la.mjs — the same kind of regression guard test/lexicon-quality.test.ts
// keeps for Hebrew/Greek, sized to Latin's much smaller, single-source lexicon.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LaEntry } from '../src/model/types.ts';

const root = path.resolve(__dirname, '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const have = fs.existsSync(path.join(lexDir, 'la-index.json'));
const load = (): LaEntry[] => {
  const out: LaEntry[] = [];
  for (const f of fs.readdirSync(lexDir)) if (f.startsWith('la-') && /^la-[^-]+\.json$/.test(f) && !/index|manifest|SOURCES/.test(f)) out.push(...(Object.values(JSON.parse(fs.readFileSync(path.join(lexDir, f), 'utf8'))) as LaEntry[]));
  return out;
};
const plain = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe.skipIf(!have)('shipped Latin lexicon quality', () => {
  const la = load();
  const byLemma = new Map(la.map((e) => [e.l, e]));

  it('covers every lemma the Vulgate NT build actually produced, with a Lewis & Short match for a strong majority', () => {
    expect(la.length).toBeGreaterThan(3000); // sanity: this is the real NT-wide vocabulary, not a stub
    // documented floor: Lewis & Short is a CLASSICAL Latin dictionary, not an ecclesiastical one —
    // biblical proper names (Petrus, Nazarenus, Barnabas…) are a real, expected, disclosed gap
    const coverage = la.filter((e) => e.ls).length / la.length;
    expect(coverage).toBeGreaterThan(0.85);
  });
  it('every entry with a Lewis & Short match has a short gloss with a named source, for a strong majority', () => {
    // documented floor, not "near total": unlike Abbott-Smith's dedicated <gloss> tag, Lewis &
    // Short has no equivalent — the short gloss is pulled from its free prose by a heuristic
    // (first usable italicised phrase in the first sense), which finds nothing safely usable for
    // some entries (irregular, heavily-annotated headwords like "video" open with several
    // grammatical notes before any plain-English phrase) — currently ~81% have one.
    const withEntry = la.filter((e) => e.ls);
    expect(withEntry.filter((e) => !e.g).length / withEntry.length).toBeLessThan(0.25);
    expect(la.filter((e) => e.g && !e.gs)).toEqual([]);
  });
  it('no gloss is a malformed fragment (braces, cross references, dangling punctuation)', () => {
    const MALFORMED = [/[{}[\]]/, /\bv\.\s*$/, /^[\s,;:.]/, /[,;:]$/];
    const bad = la.filter((e) => e.g && MALFORMED.some((re) => re.test(e.g))).map((e) => `${e.l}: ${e.g}`);
    expect(bad).toEqual([]);
  });
  it('resolves well-known words to a sensible entry, not a neighbour', () => {
    expect(byLemma.get('verbum')?.g?.toLowerCase()).toMatch(/word/);
    // PROIEL lemmatizes "Deus" as lowercase "deus" (a common-noun-style lemma, its own
    // convention, confirmed by inspecting data/build/conc-la.json directly)
    expect(byLemma.get('deus')?.ls).toBeTruthy();
    expect(plain(byLemma.get('deus')?.ls)).toMatch(/god/i);
    // homograph disambiguation (sum1 "to be" vs sum2/sum3): the common verb, not a rare archaic form
    expect(plain(byLemma.get('sum')?.ls)).toMatch(/\bbe\b/i);
  });
  it('a word PROIEL spells with a consonantal i resolves to Lewis & Short\'s j-spelling entry', () => {
    // confirmed directly: L&S keys these under j (judico, jam, jejuno…), never the bare i-form
    for (const l of ['iudico', 'iustus', 'iuxta']) expect(byLemma.get(l)?.ls, l).toBeTruthy();
  });
  it('the search index rows carry the gloss source and match the entry count', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(lexDir, 'la-index.json'), 'utf8')) as unknown[][];
    expect(idx.length).toBe(la.length);
    expect(idx.every((r) => r.length === 6)).toBe(true);
    expect(idx.find((r) => r[0] === 'verbum')?.[3]).toMatch(/word/i);
  });
  it('the manifest lists every shard the lexicon actually wrote', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(lexDir, 'la-manifest.json'), 'utf8')) as { shards: string[] };
    const shardFiles = fs.readdirSync(lexDir).filter((f) => /^la-[^-]+\.json$/.test(f) && !/index|manifest|SOURCES/.test(f)).map((f) => f.slice(3, -5));
    expect(manifest.shards.sort()).toEqual(shardFiles.sort());
  });
});
