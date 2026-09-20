// build-gnt.mjs recorded each Greek word's concordance occurrences with a book index LOCAL to
// its own 27-book list (0 = Matthew), but CANON places all 39 Hebrew books first — so every
// Greek concordance entry pointed 39 books too early (e.g. λόγος's first occurrence, really
// Matthew 5:32, resolved to CANON[0] = Genesis). Every occurrence's book index must land on a
// Greek book, and its (book, chapter, verse) must actually contain that lemma.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { langOf } from '../src/text/canon.ts';

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const have = fs.existsSync(dataDir);

describe.skipIf(!have)('Greek concordance book indices resolve to the correct (Greek) book', () => {
  it('λόγος\'s occurrences all point at Greek books, and the first one is a real occurrence', () => {
    const canon = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'canon.json'), 'utf8')) as { id: string; lang: string }[];
    const conc = JSON.parse(fs.readFileSync(path.join(dataDir, 'conc', 'gr-λ.json'), 'utf8')) as Record<string, number[]>;
    const flat = conc['λόγος'];
    expect(flat?.length).toBeGreaterThan(0);

    const occurrences: [number, number, number, number][] = [];
    for (let i = 0; i + 3 < flat.length; i += 4) occurrences.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]);
    for (const [b] of occurrences) expect(langOf(canon[b]?.id)).toBe('gr');

    // the very first occurrence must be a real word in that verse, not an out-of-range Hebrew book
    const [b, c, v, i] = occurrences[0];
    const book = JSON.parse(fs.readFileSync(path.join(dataDir, 'gr', canon[b].id + '.json'), 'utf8'));
    const word = book.chapters[c - 1].verses[v - 1].w[i];
    expect(word[1]).toBe('λόγος'); // token's own lemma field matches
  });
});
