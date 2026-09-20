// Writes src/data/canon.json: every book with its names, section, and verse count per chapter,
// read from the built book files so the table can never disagree with the data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GNT, SEPTUAGINT, TANAKH, VULGATE_NT } from './canon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
for (const [, id, en, native, section] of TANAKH) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'he', id + '.json'), 'utf8'));
  out.push({ id, lang: 'he', en, native, section, verses: b.chapters.map((c) => c.verses.length) });
}
for (const [, id, en, native, section] of GNT) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'gr', id + '.json'), 'utf8'));
  out.push({ id, lang: 'gr', en, native, section, verses: b.chapters.map((c) => c.verses.length) });
}
// Septuagint books are `lang: 'gr'` too (they ARE Greek) and come last — build-lxx.mjs's
// concordance book indices assume exactly this order (every TANAKH book, then every GNT book,
// then these, in the SEPTUAGINT array's own order).
for (const [, id, en, native, section] of SEPTUAGINT) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'gr', id + '.json'), 'utf8'));
  out.push({ id, lang: 'gr', en, native, section, verses: b.chapters.map((c) => c.verses.length) });
}
// Vulgate books are their own `lang: 'la'` — a different language from the Septuagint's, so
// (unlike the Septuagint) they need no merge-preserving ordering constraint of their own.
for (const [, id, en, native, section] of VULGATE_NT) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'la', id + '.json'), 'utf8'));
  out.push({ id, lang: 'la', en, native, section, verses: b.chapters.map((c) => c.verses.length) });
}
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'canon.json'), JSON.stringify(out));
console.log(`canon.json: ${out.length} books, ${out.reduce((n, b) => n + b.verses.length, 0)} chapters`);
