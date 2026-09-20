// Guards the Vulgate NT text/morphology alignment (scripts/build-vulgate-nt.mjs): the Clementine
// printed text and the PROIEL treebank are two independent editions reconciled by matching
// normalized spelling at build time (see that script's own module comment for the three real
// discrepancies it has to handle). These tests catch a regression in that reconciliation, not
// just in the shipped data's shape.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LaBook } from '../src/model/types.ts';
import { contentWords } from '../src/text/latin.ts';

const root = path.resolve(__dirname, '..');
const laDir = path.join(root, 'public', 'data', 'la');
const have = fs.existsSync(path.join(laDir, 'MattVulg.json'));
const loadBook = (id: string): LaBook => JSON.parse(fs.readFileSync(path.join(laDir, id + '.json'), 'utf8'));

describe.skipIf(!have)('Vulgate NT text/morphology alignment', () => {
  const BOOK_IDS = [
    'MattVulg', 'MarkVulg', 'LukeVulg', 'JohnVulg', 'ActsVulg', 'RomVulg', '1CorVulg', '2CorVulg',
    'GalVulg', 'EphVulg', 'PhilVulg', 'ColVulg', '1ThessVulg', '2ThessVulg', '1TimVulg', '2TimVulg',
    'TitusVulg', 'PhlmVulg', 'HebVulg', 'JasVulg', '1PetVulg', '2PetVulg', '1JohnVulg', '2JohnVulg',
    '3JohnVulg', 'JudeVulg', 'RevVulg',
  ];

  it('has all 27 Vulgate NT books, each with a non-empty printed text', () => {
    for (const id of BOOK_IDS) {
      const b = loadBook(id);
      expect(b.book, id).toBe(id);
      expect(b.chapters.length, id).toBeGreaterThan(0);
      const totalChars = b.chapters.reduce((n, c) => n + c.verses.reduce((m, v) => m + v.t.length, 0), 0);
      expect(totalChars, id).toBeGreaterThan(0);
    }
  });

  it('every verse\'s word-array length matches its own printed text, in every book (never desynced)', () => {
    for (const id of BOOK_IDS) {
      const b = loadBook(id);
      for (const c of b.chapters) {
        for (const v of c.verses) {
          expect(v.w.length, `${id} ${c.n}:${v.n}`).toBe(contentWords(v.t).length);
        }
      }
    }
  });

  it('Matthew 1:1 aligns completely, with the correct lemmas, in the canonical reading order', () => {
    const b = loadBook('MattVulg');
    const v = b.chapters[0].verses[0];
    expect(v.t).toBe('Liber generationis Jesu Christi filii David, filii Abraham.');
    const lemmas = v.w.map((t) => t?.[0]);
    expect(lemmas).toEqual(['liber', 'generatio', 'Iesus', 'Christus', 'filius', 'David', 'filius', 'Abraham']);
  });

  it('John 3:16 aligns its well-known clauses correctly (a handful of words may be genuinely unaligned)', () => {
    const b = loadBook('JohnVulg');
    const v = b.chapters[2].verses[15];
    expect(v.t).toMatch(/^Sic enim Deus dilexit mundum/);
    const lemmas = v.w.map((t) => t?.[0]).filter(Boolean);
    for (const l of ['mundus', 'filius', 'do', 'credo', 'habeo', 'vita']) expect(lemmas, v.t).toContain(l);
  });

  it('reads real alignment stats from the build\'s own diagnostic file (not just re-deriving them)', () => {
    const p = path.join(root, 'data', 'build', 'vulgate-nt-align.json');
    if (!fs.existsSync(p)) return;
    const align = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, { words: number; aligned: number }>;
    // PROIEL's own coverage is genuinely uneven (see build-vulgate-nt.mjs's module comment,
    // confirmed by directly counting its raw tokens per book) — these floors distinguish "the
    // alignment algorithm is working" from "PROIEL never annotated this book", not the same thing.
    const WELL_COVERED = ['MattVulg', 'MarkVulg', 'LukeVulg', 'JohnVulg', 'ActsVulg', 'RomVulg', '1CorVulg', 'RevVulg'];
    for (const id of WELL_COVERED) {
      const b = align[id];
      expect(b, id).toBeTruthy();
      expect(b.aligned / b.words, id).toBeGreaterThan(0.75);
    }
    // Hebrews and 1 John are two of the sparsest books in PROIEL's real coverage (documented in
    // Settings' Vulgate attribution) — this is a ceiling, not a floor: it fails loudly if a future
    // PROIEL release (or a build regression the other direction) changes that materially, so this
    // assertion — and the Settings copy that quotes the same number — gets revisited deliberately.
    expect(align.HebVulg.aligned / align.HebVulg.words).toBeLessThan(0.15);
    expect(align['1JohnVulg'].aligned / align['1JohnVulg'].words).toBeLessThan(0.15);
  });

  it('the shipped coverage summary (src/data/vulgate-coverage.json) matches the diagnostic totals', () => {
    const p = path.join(root, 'data', 'build', 'vulgate-nt-align.json');
    const sp = path.join(root, 'src', 'data', 'vulgate-coverage.json');
    if (!fs.existsSync(p) || !fs.existsSync(sp)) return;
    const align = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, { words: number; aligned: number }>;
    const summary = JSON.parse(fs.readFileSync(sp, 'utf8')) as { words: number; aligned: number; coveragePercent: number };
    const words = Object.values(align).reduce((n, b) => n + b.words, 0);
    const aligned = Object.values(align).reduce((n, b) => n + b.aligned, 0);
    expect(summary.words).toBe(words);
    expect(summary.aligned).toBe(aligned);
    expect(summary.coveragePercent).toBeGreaterThan(0);
    expect(summary.coveragePercent).toBeLessThan(100);
  });
});
