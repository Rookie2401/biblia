// Contextual glosses: the Berean Standard Bible interlinear tables (public domain, bereanbible.com),
// one English rendering per Hebrew / Greek word *in its verse*. Each row of the sheet is one source
// word with the BSB words that translate it; rows are in English order, "Heb Sort" / "Greek Sort"
// give the source order.
//
// Alignment is verse-restricted: every base verse is first mapped to the English verse(s) it
// corresponds to (scripts/versification.mjs — an explicit, reviewable table, plus the Psalm title
// offsets), then its words are aligned only against the rows of those verses (exact consonantal /
// accent-free comparison, else LCS). Base verses whose English ranges overlap are aligned together
// as one cluster, so a title and its verse, or a verse split across two English verses, stay in
// order. A cluster that aligns fewer than 40% of its words is rejected outright rather than kept
// as plausible-looking matches. Diagnostics per chapter go to data/build/ctx-diagnostics.json and
// a per-book summary to public/data/ctx/COVERAGE.json; the build fails when a chapter with words
// aligns nothing, or drops below 60% without being listed as an expected exception.
//
// Output: public/data/ctx/{he,gr}/<Book>.json = { book, chapters: [[verse: [gloss|''|null …]]] }
//   ''   = the word is rendered together with a neighbouring word (BSB "-", "vvv" or ". . .")
//   null = no rendering aligned
import fs from 'node:fs';
/** BSB placeholders for a word whose sense is carried by a neighbouring word: no English of its own. */
const JOINT = new Set(['-', 'vvv', '. . .', '...', '—', '–']);
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { GNT, TANAKH, heCons, mamWords } from './canon.mjs';
import { englishRange } from './versification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outHe = path.join(root, 'public', 'data', 'ctx', 'he');
const outGr = path.join(root, 'public', 'data', 'ctx', 'gr');
const buildDir = path.join(root, 'data', 'build');
for (const d of [outHe, outGr, buildDir]) fs.mkdirSync(d, { recursive: true });

const NAMES = {
  Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut', Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', '1 Samuel': '1Sam', '2 Samuel': '2Sam', '1 Kings': '1Kgs', '2 Kings': '2Kgs', '1 Chronicles': '1Chr', '2 Chronicles': '2Chr', Ezra: 'Ezra', Nehemiah: 'Neh', Esther: 'Esth', Job: 'Job', Psalm: 'Ps', Psalms: 'Ps', Proverbs: 'Prov', Ecclesiastes: 'Eccl', 'Song of Solomon': 'Song', 'Song of Songs': 'Song', Isaiah: 'Isa', Jeremiah: 'Jer', Lamentations: 'Lam', Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad', Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph', Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal',
  Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts', Romans: 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor', Galatians: 'Gal', Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col', '1 Thessalonians': '1Thess', '2 Thessalonians': '2Thess', '1 Timothy': '1Tim', '2 Timothy': '2Tim', Titus: 'Titus', Philemon: 'Phlm', Hebrews: 'Heb', James: 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet', '1 John': '1John', '2 John': '2John', '3 John': '3John', Jude: 'Jude', Revelation: 'Rev',
};
/** Chapters allowed below the 60% floor, each with the reason (none at present). */
const EXPECTED_LOW = {};
const MIN_CLUSTER_RATIO = 0.4;
const MIN_CHAPTER_COVERAGE = 0.6;

const grBase = (s) => s.normalize('NFD').replace(/[̀-ͯ᷀-᷿]/g, '').replace(/ς/g, 'σ').toLowerCase().replace(/[^α-ω]/g, '');
const cleanGloss = (g) => String(g ?? '').replace(/\s+/g, ' ').trim();

console.log('reading the tables…');
const wb = XLSX.readFile(path.join(root, 'data', 'bsb', 'bsb_tables.xlsx'), { sheets: ['biblosinterlinear96'], dense: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.biblosinterlinear96, { header: 1, raw: true, defval: null });
console.log(`${rows.length} rows`);
const H = rows[0];
const col = (name) => H.findIndex((h) => String(h ?? '').trim() === name);
const C = { heSort: col('Heb Sort'), grSort: col('Greek Sort'), lang: col('Language'), word: col('WLC / Nestle Base TR RP WH NE NA SBL'), verse: col('VerseId'), gloss: col('BSB version') };
if (Object.values(C).some((i) => i < 0)) throw new Error('columns: ' + JSON.stringify(C));

// rows grouped by English verse ("Gen|1|1"), and the English verse list per book in order
const verses = new Map();
const enVerses = new Map(); // book -> [[ch, v], …] sorted
let cur = null;
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const vid = r[C.verse];
  if (vid) {
    const m = String(vid).match(/^(.+?) (\d+):(\d+)$/);
    if (!m) throw new Error('verse id ' + vid);
    const id = NAMES[m[1]];
    if (!id) throw new Error('book ' + m[1]);
    cur = `${id}|${m[2]}|${m[3]}`;
    (enVerses.get(id) || enVerses.set(id, []).get(id)).push([Number(m[2]), Number(m[3])]);
  }
  if (!cur) continue;
  const word = r[C.word];
  if (!word) continue;
  const sort = r[C.lang] === 'Greek' ? r[C.grSort] : r[C.heSort];
  if (!sort) continue;
  (verses.get(cur) || verses.set(cur, []).get(cur)).push({ sort: Number(sort), word: String(word), gloss: cleanGloss(r[C.gloss]) });
}
for (const list of enVerses.values()) list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
console.log(`${verses.size} verses in the tables`);
const enChapterCount = (book, ch) => (enVerses.get(book) || []).filter(([c]) => c === ch).reduce((m, [, v]) => Math.max(m, v), 0);

function lcsAlign(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = Array(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out[i] = j;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
/** BSB rows of the English verses from `from` to `to` inclusive, in book order, split into words. */
function englishWords(book, from, to) {
  const list = enVerses.get(book) || [];
  const out = [];
  for (const [c, v] of list) {
    if (cmp([c, v], from) < 0 || cmp([c, v], to) > 0) continue;
    const rowsOf = (verses.get(`${book}|${c}|${v}`) || []).slice().sort((a, b) => a.sort - b.sort);
    // Berean writes a paragraph mark after the sof pasuq without a space (אֶחָֽד׃פ)
    for (const t of rowsOf) for (const w of t.word.replace(/׃\s*[פס]\s*$/, '׃').split(/[\s־]+/).filter(Boolean)) out.push({ w, gloss: t.gloss, verse: `${c}:${v}` });
  }
  return out;
}

const diagnostics = { he: {}, gr: {} };
const problems = [];
const lowClusters = [];

function build(lang, books, dir, wordsOf, normalize) {
  for (const [, id] of books) {
    const book = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', lang, id + '.json'), 'utf8'));
    const chapters = book.chapters.map((ch) => {
      const psalmOffset = id === 'Ps' ? ch.verses.length - enChapterCount(id, ch.n) : 0;
      if (id === 'Ps' && (psalmOffset < 0 || psalmOffset > 2)) throw new Error(`Psalm ${ch.n}: unexpected title offset ${psalmOffset}`);
      // 1. map every base verse to its English range
      const mapped = ch.verses.map((v) => {
        const r = englishRange(id, ch.n, v.n, { psalmOffset }) ?? { from: [ch.n, v.n], to: [ch.n, v.n], rule: null };
        return { v, words: wordsOf(v), from: r.from, to: r.to, rule: r.rule };
      });
      // 2. cluster consecutive verses whose English ranges overlap
      const clusters = [];
      for (const m of mapped) {
        const last = clusters[clusters.length - 1];
        if (last && cmp(m.from, last.to) <= 0) {
          last.items.push(m);
          if (cmp(m.to, last.to) > 0) last.to = m.to;
        } else clusters.push({ items: [m], from: m.from, to: m.to });
      }
      // 3. align each cluster against exactly its English rows
      const out = ch.verses.map(() => []);
      const stat = { words: 0, nonempty: 0, joint: 0, nulls: 0 };
      for (const cl of clusters) {
        const ours = cl.items.flatMap((m) => m.words.map((w) => ({ w, vi: m.v.n - 1 })));
        const theirs = englishWords(id, cl.from, cl.to);
        const a = ours.map((o) => normalize(o.w));
        const b = theirs.map((t) => normalize(t.w));
        let map = a.length === b.length && a.every((x, i) => x === b[i]) ? a.map((_, i) => i) : lcsAlign(a, b);
        const matched = map.filter((j) => j >= 0).length;
        // reject a cluster that explains little of the base text — unless it consumed nearly all of
        // the English side (a base passage longer than the BSB's, e.g. Mark 16:8 with the shorter ending)
        if (ours.length >= 4 && matched / ours.length < MIN_CLUSTER_RATIO && !(theirs.length && matched / theirs.length >= 0.8)) {
          lowClusters.push({ lang, book: id, base: cl.items.map((m) => `${ch.n}:${m.v.n}`).join(','), english: `${cl.from.join(':')}–${cl.to.join(':')}`, words: ours.length, matched, theirs: theirs.length });
          map = map.map(() => -1);
        }
        map.forEach((j, i) => {
          stat.words++;
          let g = null;
          if (j >= 0) {
            const x = theirs[j].gloss;
            g = x && !JOINT.has(x) ? x : '';
            if (g) stat.nonempty++;
            else stat.joint++;
          } else stat.nulls++;
          out[ours[i].vi].push(g);
        });
      }
      const coverage = stat.words ? (stat.nonempty + stat.joint) / stat.words : 1;
      diagnostics[lang][`${id} ${ch.n}`] = { ...stat, coverage: Math.round(coverage * 1000) / 1000, rules: [...new Set(mapped.map((m) => (typeof m.rule === 'string' ? m.rule : m.rule ? 'versification' : '')).filter(Boolean))] };
      if (stat.words && stat.nonempty + stat.joint === 0) problems.push(`${id} ${ch.n}: nothing aligned (${stat.words} words)`);
      else if (stat.words >= 20 && coverage < MIN_CHAPTER_COVERAGE && !EXPECTED_LOW[`${id} ${ch.n}`]) problems.push(`${id} ${ch.n}: coverage ${(coverage * 100).toFixed(1)}% (${stat.nulls} of ${stat.words} unaligned)`);
      // every context array must match the base word count exactly
      out.forEach((arr, vi) => {
        if (arr.length !== mapped[vi].words.length) throw new Error(`${id} ${ch.n}:${vi + 1}: ${arr.length} glosses for ${mapped[vi].words.length} words`);
      });
      return out;
    });
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ book: id, chapters }));
    process.stdout.write(id + ' ');
  }
  console.log();
}
build('he', TANAKH, outHe, (v) => mamWords(v.t), heCons);
build('gr', GNT, outGr, (v) => v.w.map((t) => t[0]), grBase);

// ---- report
const summary = {};
for (const lang of ['he', 'gr']) {
  const perBook = {};
  for (const [key, s] of Object.entries(diagnostics[lang])) {
    const book = key.split(' ')[0];
    const b = (perBook[book] ??= { words: 0, nonempty: 0, joint: 0, nulls: 0 });
    b.words += s.words;
    b.nonempty += s.nonempty;
    b.joint += s.joint;
    b.nulls += s.nulls;
  }
  const total = { words: 0, nonempty: 0, joint: 0, nulls: 0 };
  for (const b of Object.values(perBook)) {
    b.coverage = Math.round(((b.nonempty + b.joint) / b.words) * 1000) / 1000;
    for (const k of ['words', 'nonempty', 'joint', 'nulls']) total[k] += b[k];
  }
  total.coverage = Math.round(((total.nonempty + total.joint) / total.words) * 1000) / 1000;
  summary[lang] = { total, books: perBook };
  console.log(`${lang}: ${total.words} words — ${total.nonempty} rendered (${((100 * total.nonempty) / total.words).toFixed(2)}%), ${total.joint} rendered with a neighbour (${((100 * total.joint) / total.words).toFixed(2)}%), ${total.nulls} unaligned (${((100 * total.nulls) / total.words).toFixed(2)}%)`);
}
fs.writeFileSync(path.join(buildDir, 'ctx-diagnostics.json'), JSON.stringify({ chapters: diagnostics, lowConfidenceClusters: lowClusters, problems }, null, 1));
fs.writeFileSync(path.join(root, 'public', 'data', 'ctx', 'COVERAGE.json'), JSON.stringify(summary));
fs.writeFileSync(
  path.join(root, 'public', 'data', 'ctx', 'SOURCES.json'),
  JSON.stringify({ title: 'Berean Standard Bible interlinear tables', publisher: 'Bible Hub / Berean Bible Translation Committee', license: 'public domain (dedicated 30 April 2023)', url: 'https://berean.bible/downloads.htm', note: 'per-word English renderings of the BSB, aligned verse by verse to the MAM and SBLGNT texts at build time through an explicit versification map; the BSB translates the WLC and the NA/SBL Greek, so a few words in our base texts carry no rendering' }, null, 2),
);
if (lowClusters.length) console.log(`${lowClusters.length} low-confidence clusters rejected (see data/build/ctx-diagnostics.json)`);
if (problems.length) {
  console.error('BUILD FAILED — chapters with missing or collapsed alignment:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('every chapter aligned above the floor');
