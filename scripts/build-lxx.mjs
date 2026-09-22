// Septuagint occurrence counts for the Greek lexicon — and only that. The Septuagint's TEXT is
// read in Vetus (../vetus-v0), the sibling app it was split into; what stays in Biblia is the
// knowledge that a New Testament word also occurs in the Septuagint, and how often, so its card
// can say so (WordCard: "N× in the New Testament · M× in the Septuagint").
//
// Source: OpenScriptorium's lxx-morph dataset (CC BY 4.0; https://github.com/OpenScriptorium/
// lxx-morph). Every token's lemma is reconciled against the New Testament's own lemma set
// (scripts/greek-lemma-match.mjs; data/curated/lxx-lemma-blocklist.json holds the reviewed
// exceptions) — the same reconciliation Vetus runs, against a copy of the same NT lemma list, so
// both apps agree on which Septuagint word is which New Testament word. A Septuagint lemma with no
// NT match is Vetus's business, not Biblia's: it is counted here only for the summary.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEPTUAGINT } from './canon.mjs';
import { buildNtIndex, matchNtLemma } from './greek-lemma-match.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'data', 'lxx');
const buildDir = path.join(root, 'data', 'build');
fs.mkdirSync(buildDir, { recursive: true });

// the NT-only lemma set build-gnt.mjs writes separately (never touched by this script's own
// output) — see the comment there for why conc-gr.json itself isn't a safe reference here.
const ntLemmas = new Set(JSON.parse(fs.readFileSync(path.join(buildDir, 'nt-lemmas.json'), 'utf8')));
const ntIndex = buildNtIndex([...ntLemmas]);
const blocklist = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'lxx-lemma-blocklist.json'), 'utf8')).blocked));

const counts = {}; // NT lemma -> occurrences in the Septuagint
const bridge = new Map(); // "lxxLemma|ntLemma-or-" -> occurrences, for review (distinct pairs, not every token)
let words = 0;
let matchedExact = 0;
let matchedFuzzy = 0;
let unmatched = 0;
const unmatchedLemmas = new Set();

for (const [file, id] of SEPTUAGINT) {
  const raw = JSON.parse(fs.readFileSync(path.join(srcDir, file + '.json'), 'utf8'));
  for (const entry of raw) {
    for (const w of entry.words) {
      const lemma = w.lemma.normalize('NFC');
      let matched = matchNtLemma(lemma, ntIndex);
      if (matched && blocklist.has(`${lemma}|${matched}`)) matched = undefined;
      words++;
      const key = `${lemma}|${matched ?? ''}`;
      bridge.set(key, (bridge.get(key) ?? 0) + 1);
      if (matched) {
        counts[matched] = (counts[matched] ?? 0) + 1;
        if (matched === lemma) matchedExact++;
        else matchedFuzzy++;
      } else {
        unmatched++;
        unmatchedLemmas.add(lemma);
      }
    }
  }
  process.stdout.write(id + ' ');
}
console.log();

fs.writeFileSync(path.join(buildDir, 'lxx-counts.json'), JSON.stringify(counts));
fs.writeFileSync(
  path.join(buildDir, 'lxx-nt-lemma-bridge.json'),
  JSON.stringify(
    [...bridge].map(([k, n]) => {
      const [lxxLemma, ntLemma] = k.split('|');
      return { lxxLemma, ntLemma: ntLemma || null, n };
    }),
  ),
);
console.log(`Septuagint: ${SEPTUAGINT.length} books, ${words} words; ${Object.keys(counts).length} of ${ntLemmas.size} NT lemmas also occur in the Septuagint`);
console.log(`  merged onto an NT lemma: ${matchedExact} exact-spelling occurrences, ${matchedFuzzy} fuzzy-matched occurrences`);
console.log(`  Septuagint-only (no NT lemma; read in Vetus, not here): ${unmatched} occurrences, ${unmatchedLemmas.size} distinct lemmas`);
