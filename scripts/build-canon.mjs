// Writes src/data/canon.json: every book with its names, section, and verse count per chapter,
// read from the built book files so the table can never disagree with the data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GNT, TANAKH } from './canon.mjs';

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
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'canon.json'), JSON.stringify(out));
console.log(`canon.json: ${out.length} books, ${out.reduce((n, b) => n + b.verses.length, 0)} chapters`);
