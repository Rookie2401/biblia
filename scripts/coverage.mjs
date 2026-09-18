// Computes the morphology coverage from the shipped Tanakh files (the single authoritative
// figure used by README, docs and the Settings page) and writes src/data/coverage.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TANAKH, mamWords } from './canon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let words = 0;
let aligned = 0;
let verses = 0;
for (const [, id] of TANAKH) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'he', id + '.json'), 'utf8'));
  for (const ch of b.chapters)
    for (const v of ch.verses) {
      verses++;
      const n = mamWords(v.t).length;
      if (n !== v.w.length) throw new Error(`${id} ${ch.n}:${v.n}: ${n} words but ${v.w.length} morphology slots`);
      words += n;
      aligned += v.w.filter(Boolean).length;
    }
}
const out = { hebrewWords: words, hebrewVerses: verses, hebrewWordsWithMorphology: aligned, hebrewUnmatched: words - aligned, hebrewCoveragePercent: Math.round((10000 * aligned) / words) / 100, computed: new Date().toISOString().slice(0, 10), definition: 'maqaf-split content words of the MAM text that have an OSHB analysis aligned to them' };
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'coverage.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`coverage.json: ${aligned} of ${words} words aligned (${out.hebrewCoveragePercent}%), ${words - aligned} unmatched`);
