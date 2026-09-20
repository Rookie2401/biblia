// Builds public/data/gr/<Book>.json for the 27 books of the Greek New Testament from the
// MorphGNT analysis of the SBL Greek New Testament (data/gnt/NN-Xx-morphgnt.txt).
// Line format: bbccvv pos parse text word normalized lemma
//   text = the word as printed (with punctuation and SBLGNT sigla), lemma = dictionary form.
// The text column is kept as printed except for the apparatus sigla ⸀⸁⸂⸃⸄⸅⸆⸇ which mark
// variation units against other editions; ⟦ ⟧ (passages of doubtful authenticity) stay.
// Also writes data/build/conc-gr.json (lemma -> occurrences) for the lexicon build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GNT, TANAKH } from './canon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'data', 'gr');
const buildDir = path.join(root, 'data', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

// Concordance book indices are global positions in the final CANON array (build-canon.mjs
// places every TANAKH book first, then GNT), not local positions within this file's own
// book list — otherwise a Greek word's concordance would resolve against a Hebrew book.
const GLOBAL_OFFSET = TANAKH.length;

const SIGLA = /[⸀⸁⸂⸃⸄⸅⸆⸇]/g;
const conc = {};
let words = 0;
let verses = 0;
let chaptersN = 0;

GNT.forEach(([file, id], bookIdx) => {
  const lines = fs.readFileSync(path.join(root, 'data', 'gnt', file + '-morphgnt.txt'), 'utf8').split('\n').filter(Boolean);
  const chapters = [];
  for (const line of lines) {
    const [bcv, pos, parse, text, , , lemma] = line.split(' ');
    const c = Number(bcv.slice(2, 4));
    const v = Number(bcv.slice(4, 6));
    const ch = (chapters[c - 1] ??= { n: c, verses: [] });
    const vs = (ch.verses[v - 1] ??= { n: v, w: [] });
    const printed = text.normalize('NFC').replace(SIGLA, '');
    const lem = lemma.normalize('NFC');
    const i = vs.w.length;
    vs.w.push(parse === '--------' ? [printed, lem, pos] : [printed, lem, pos, parse]);
    (conc[lem] ??= []).push(GLOBAL_OFFSET + bookIdx, c, v, i);
    words++;
  }
  for (const ch of chapters) {
    if (!ch) throw new Error(id + ': missing chapter');
    for (let i = 0; i < ch.verses.length; i++) if (!ch.verses[i]) ch.verses[i] = { n: i + 1, w: [] }; // a verse absent from SBLGNT (e.g. Matt 17:21) keeps its number, empty
    verses += ch.verses.length;
  }
  chaptersN += chapters.length;
  fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify({ book: id, chapters }));
  process.stdout.write(id + ' ');
});
console.log();
fs.writeFileSync(path.join(buildDir, 'conc-gr.json'), JSON.stringify(conc));
// the pure NT lemma set, kept separate from conc-gr.json because build-lxx.mjs extends that
// file in place with Septuagint occurrences — reading it back as "the NT vocabulary" on a
// second run would let the Septuagint match against its own prior output instead of the NT.
fs.writeFileSync(path.join(buildDir, 'nt-lemmas.json'), JSON.stringify(Object.keys(conc)));
fs.writeFileSync(
  path.join(outDir, 'SOURCES.json'),
  JSON.stringify(
    {
      text: { title: 'The Greek New Testament: SBL Edition', editor: 'Michael W. Holmes', publisher: 'Society of Biblical Literature / Logos Bible Software, 2010', license: 'CC BY 4.0', url: 'https://sblgnt.com' },
      morphology: { title: 'MorphGNT: SBLGNT Edition', license: 'CC BY-SA 3.0', url: 'https://github.com/morphgnt/sblgnt' },
    },
    null,
    2,
  ),
);
console.log(`GNT: 27 books, ${chaptersN} chapters, ${verses} verses, ${words} words, ${Object.keys(conc).length} lemmas`);
