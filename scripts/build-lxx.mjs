// Builds public/data/gr/<Book>.json for the Septuagint (Rahlfs, 1935) from OpenScriptorium's
// lxx-morph dataset (CC BY 4.0; https://github.com/OpenScriptorium/lxx-morph), reusing the
// exact GrBook/GrTok shape build-gnt.mjs produces for the New Testament — a Septuagint chapter
// is read, tapped, and looked up exactly like an NT one; nothing downstream needs to know the
// difference. Every token's lemma is reconciled against the New Testament's own lemma set
// (scripts/greek-lemma-match.mjs) so a word that is genuinely the same in both corpora shares
// one lexicon entry and one vocabulary record; a lemma with no NT match is real LXX-only
// vocabulary and gets its own new entry once build-lexicon-gr.mjs runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEPTUAGINT, TANAKH, GNT } from './canon.mjs';
import { buildNtIndex, matchNtLemma } from './greek-lemma-match.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'data', 'lxx');
const outDir = path.join(root, 'public', 'data', 'gr');
const buildDir = path.join(root, 'data', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

// Concordance book indices are positions in the final CANON array: every TANAKH book, then
// every GNT book, then the Septuagint books in the order below (build-canon.mjs must append
// them in this same order).
const GLOBAL_OFFSET = TANAKH.length + GNT.length;

// the NT-only lemma set build-gnt.mjs writes separately (never touched by this script's own
// output) — see the comment there for why conc-gr.json itself isn't a safe reference here.
const ntLemmas = JSON.parse(fs.readFileSync(path.join(buildDir, 'nt-lemmas.json'), 'utf8'));
const ntIndex = buildNtIndex(ntLemmas);
// pairs that pass the base-normalized match but are genuinely different words (accent
// position or breathing mark is meaningful in Greek, not just decorative) — found by manually
// reviewing every distinct match this script produced; see the file for the reasoning per pair.
const blocklist = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'lxx-lemma-blocklist.json'), 'utf8')).blocked));

// ---- lxx-morph's English-prose pos/parsing -> MorphGNT's 2-char pos + 8-column positional code
// (src/morph/greek.ts decodes this exact scheme; reusing it means zero runtime changes for LXX words)
const POS_CODE = { noun: 'N-', 'proper noun': 'N-', verb: 'V-', participle: 'V-', article: 'RA', conjunction: 'C-', preposition: 'P-', adjective: 'A-', numeral: 'A-', adverb: 'D-', particle: 'X-', interjection: 'I-' };
// pronoun sub-type by lemma (MorphGNT distinguishes personal/demonstrative/relative/interrogative; default personal)
const PRONOUN_CODE = { οὗτος: 'RD', ἐκεῖνος: 'RD', ὅδε: 'RD', ὅς: 'RR', ἥ: 'RR', τίς: 'RI', τις: 'RI' };
const TENSE_MAP = { pres: 'P', impf: 'I', fut: 'F', aor: 'A', perf: 'X', plup: 'Y' };
const MOOD_MAP = { ind: 'I', imperat: 'D', subj: 'S', opt: 'O', inf: 'N', ptc: 'P' };
const VOICE_MAP = { act: 'A', mid: 'M', pass: 'P' };
const CASE_MAP = { nom: 'N', gen: 'G', dat: 'D', acc: 'A', voc: 'V' };
const NUMBER_MAP = { sg: 'S', pl: 'P' };
const GENDER_MAP = { masc: 'M', fem: 'F', neut: 'N' };
const PERSON_MAP = { '1st': '1', '2nd': '2', '3rd': '3' };
const DEGREE_MAP = { comp: 'C', superl: 'S' };

let posFallbacks = 0;
function posCodeFor(lxxPos, lemma) {
  if (POS_CODE[lxxPos]) return POS_CODE[lxxPos];
  if (lxxPos === 'pronoun') return PRONOUN_CODE[lemma] ?? 'RP';
  posFallbacks++; // e.g. a token whose "pos" field was itself mistakenly filled with a parsing string
  return 'A-';
}

/** "aor ind act 3rd sg" / "masc/neut gen sg" -> the 8-char positional code decode() expects.
 * A syncretic slot ("mid/pass", "nom/voc/acc") keeps only its first alternative — the display
 * was never built to show more than one value per slot, for any language. */
function parseCodeFor(parsing) {
  const slots = { person: '-', tense: '-', voice: '-', mood: '-', case: '-', number: '-', gender: '-', degree: '-' };
  for (const tokRaw of parsing.split(/\s+/).filter(Boolean)) {
    const tok = tokRaw.split('/')[0];
    if (TENSE_MAP[tok]) slots.tense = TENSE_MAP[tok];
    else if (MOOD_MAP[tok]) slots.mood = MOOD_MAP[tok];
    else if (VOICE_MAP[tok]) slots.voice = VOICE_MAP[tok];
    else if (CASE_MAP[tok]) slots.case = CASE_MAP[tok];
    else if (NUMBER_MAP[tok]) slots.number = NUMBER_MAP[tok];
    else if (GENDER_MAP[tok]) slots.gender = GENDER_MAP[tok];
    else if (DEGREE_MAP[tok]) slots.degree = DEGREE_MAP[tok];
    else if (PERSON_MAP[tokRaw]) slots.person = PERSON_MAP[tokRaw];
  }
  return [slots.person, slots.tense, slots.voice, slots.mood, slots.case, slots.number, slots.gender, slots.degree].join('');
}

const REF_RE = /(\d+):(\d+)([a-z]?)$/;

const conc = JSON.parse(fs.readFileSync(path.join(buildDir, 'conc-gr.json'), 'utf8')); // extended in place
const bridge = []; // every LXX lemma's merge outcome, for review
let words = 0;
let matchedExact = 0;
let matchedFuzzy = 0;
let newLemmas = 0;

SEPTUAGINT.forEach(([file, id], bookIdxInLxx) => {
  const bookIdx = GLOBAL_OFFSET + bookIdxInLxx;
  const raw = JSON.parse(fs.readFileSync(path.join(srcDir, file + '.json'), 'utf8'));
  const chapters = [];
  for (const entry of raw) {
    const m = REF_RE.exec(entry.ref);
    if (!m) throw new Error(`${id}: unparsable ref "${entry.ref}"`);
    const c = Number(m[1]);
    const v = Number(m[2]);
    const ch = (chapters[c - 1] ??= { n: c, verses: [] });
    const vs = (ch.verses[v - 1] ??= { n: v, w: [] });
    for (const w of entry.words) {
      const posCode = posCodeFor(w.pos, w.lemma);
      const parse = parseCodeFor(w.parsing || '');
      const lemma = w.lemma.normalize('NFC');
      let matched = matchNtLemma(lemma, ntIndex);
      if (matched && blocklist.has(`${lemma}|${matched}`)) matched = undefined;
      const finalLemma = matched ?? lemma;
      if (matched === lemma) matchedExact++;
      else if (matched) matchedFuzzy++;
      else newLemmas++;
      bridge.push({ lxxLemma: lemma, ntLemma: matched ?? null, surface: w.surface, ref: entry.ref });
      const i = vs.w.length;
      vs.w.push(parse === '--------' ? [w.surface, finalLemma, posCode] : [w.surface, finalLemma, posCode, parse]);
      (conc[finalLemma] ??= []).push(bookIdx, c, v, i);
      words++;
    }
  }
  const gapChapters = [];
  for (let c = 1; c <= chapters.length; c++) {
    if (!chapters[c - 1]) {
      // a chapter genuinely absent from the source (not a lettered-subverse or alignment
      // gap): kept as a real, navigable, empty chapter rather than breaking the book's
      // chapter count — Reader shows it with no verses, same as any other empty chapter.
      chapters[c - 1] = { n: c, verses: [] };
      gapChapters.push(c);
      continue;
    }
    const ch = chapters[c - 1];
    for (let i = 0; i < ch.verses.length; i++) if (!ch.verses[i]) ch.verses[i] = { n: i + 1, w: [] };
  }
  if (gapChapters.length) console.log(`\n  ${id}: chapter(s) ${gapChapters.join(', ')} absent from lxx-morph's source file, left empty`);
  fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify({ book: id, chapters }));
  process.stdout.write(id + ' ');
});
console.log();

fs.writeFileSync(path.join(buildDir, 'conc-gr.json'), JSON.stringify(conc));
fs.writeFileSync(path.join(buildDir, 'lxx-nt-lemma-bridge.json'), JSON.stringify(bridge));
fs.writeFileSync(
  path.join(outDir, 'LXX-SOURCES.json'),
  JSON.stringify(
    {
      text: { title: 'Septuagint (Rahlfs, 1935)', license: 'public domain' },
      morphology: { title: 'lxx-morph (Perseus Morpheus + reviewed disambiguation)', author: 'Seth Kushniryk', license: 'CC BY 4.0', url: 'https://github.com/OpenScriptorium/lxx-morph' },
    },
    null,
    2,
  ),
);
const uniqueLxxLemmas = new Set(bridge.map((b) => b.lxxLemma)).size;
console.log(`Septuagint: ${SEPTUAGINT.length} books, ${words} words, ${uniqueLxxLemmas} distinct lemmas`);
console.log(`  merged onto an existing NT lemma: ${matchedExact} exact-spelling occurrences, ${matchedFuzzy} fuzzy-matched occurrences`);
console.log(`  genuinely new (LXX-only) lemma occurrences: ${newLemmas}`);
if (posFallbacks) console.log(`  ${posFallbacks} token(s) had an unrecognized "pos" value in the source data (defaulted to adjective) — see console output above for which`);
