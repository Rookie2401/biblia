// Contextual glosses: the Berean Standard Bible interlinear tables (public domain, bereanbible.com),
// one English rendering per Hebrew / Greek word *in its verse*. Each row of the sheet is one source
// word with the BSB words that translate it; rows are in English order, "Heb Sort" / "Greek Sort"
// give the source order. Per verse the rows are put back in source order and aligned to our MAM /
// SBLGNT words by consonantal (Hebrew) or accent-free (Greek) comparison, exact then LCS.
// Output: public/data/ctx/{he,gr}/<Book>.json = { book, chapters: [[verse: [gloss|null …]]] }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { GNT, TANAKH, heCons, mamWords } from './canon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outHe = path.join(root, 'public', 'data', 'ctx', 'he');
const outGr = path.join(root, 'public', 'data', 'ctx', 'gr');
fs.mkdirSync(outHe, { recursive: true });
fs.mkdirSync(outGr, { recursive: true });

const NAMES = {
  Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut', Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', '1 Samuel': '1Sam', '2 Samuel': '2Sam', '1 Kings': '1Kgs', '2 Kings': '2Kgs', '1 Chronicles': '1Chr', '2 Chronicles': '2Chr', Ezra: 'Ezra', Nehemiah: 'Neh', Esther: 'Esth', Job: 'Job', Psalm: 'Ps', Psalms: 'Ps', Proverbs: 'Prov', Ecclesiastes: 'Eccl', 'Song of Solomon': 'Song', 'Song of Songs': 'Song', Isaiah: 'Isa', Jeremiah: 'Jer', Lamentations: 'Lam', Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad', Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph', Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal',
  Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts', Romans: 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor', Galatians: 'Gal', Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col', '1 Thessalonians': '1Thess', '2 Thessalonians': '2Thess', '1 Timothy': '1Tim', '2 Timothy': '2Tim', Titus: 'Titus', Philemon: 'Phlm', Hebrews: 'Heb', James: 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet', '1 John': '1John', '2 John': '2John', '3 John': '3John', Jude: 'Jude', Revelation: 'Rev',
};
const grBase = (s) => s.normalize('NFD').replace(/[̀-ͯ᷀-᷿]/g, '').replace(/ς/g, 'σ').toLowerCase().replace(/[^α-ω]/g, '');
const cleanGloss = (g) => String(g ?? '').replace(/\s+/g, ' ').trim();

console.log('reading the tables…');
const wb = XLSX.readFile(path.join(root, 'data', 'bsb', 'bsb_tables.xlsx'), { sheets: ['biblosinterlinear96'], dense: true });
const ws = wb.Sheets.biblosinterlinear96;
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
console.log(`${rows.length} rows`);
const H = rows[0];
const col = (name) => H.findIndex((h) => String(h ?? '').trim() === name);
const C = { heSort: col('Heb Sort'), grSort: col('Greek Sort'), lang: col('Language'), word: col('WLC / Nestle Base TR RP WH NE NA SBL'), verse: col('VerseId'), gloss: H.findIndex((h) => String(h ?? '').trim() === 'BSB version'), strH: col('Str Heb'), strG: col('Str Grk') };
if (Object.values(C).some((i) => i < 0)) throw new Error('columns: ' + JSON.stringify(C));

// group rows by verse (VerseId is only on the first row of each verse)
const verses = new Map(); // "Gen|1|1" -> [{sort, word, gloss}]
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
  }
  if (!cur) continue;
  const lang = r[C.lang];
  const word = r[C.word];
  if (!word) continue;
  const sort = lang === 'Greek' ? r[C.grSort] : r[C.heSort];
  if (!sort) continue;
  (verses.get(cur) || verses.set(cur, []).get(cur)).push({ sort: Number(sort), word: String(word), gloss: cleanGloss(r[C.gloss]) });
}
console.log(`${verses.size} verses in the tables`);

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

const stats = { he: { words: 0, matched: 0, verses: 0, missingVerses: 0 }, gr: { words: 0, matched: 0, verses: 0, missingVerses: 0 } };
function build(lang, books, dir, wordsOf, normalize) {
  for (const [, id] of books) {
    const book = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', lang, id + '.json'), 'utf8'));
    const st = stats[lang];
    const chapters = book.chapters.map((ch) => {
      // Whole-chapter alignment: verse numbering differs between the Hebrew and English
      // traditions (Psalm titles, Joel 3, Malachi 4 …), so verses are not matched one to one.
      const ours = [];
      ch.verses.forEach((v, vi) => {
        for (const w of wordsOf(v)) ours.push({ vi, w });
        st.verses++;
      });
      st.words += ours.length;
      const theirs = [];
      for (const [key, list] of verses) {
        const [bid, c] = key.split('|');
        if (bid !== id || Number(c) !== ch.n) continue;
        theirs.push(...list);
      }
      if (!theirs.length) st.missingVerses += ch.verses.length;
      theirs.sort((a, b) => a.sort - b.sort);
      // Berean writes a paragraph mark after the sof pasuq without a space (אֶחָֽד׃פ)
      const theirWords = theirs.flatMap((t) => t.word.replace(/׃\s*[פס]\s*$/, '׃').split(/[\s־]+/).filter(Boolean).map((w) => ({ w, gloss: t.gloss })));
      const a = ours.map((o) => normalize(o.w));
      const b = theirWords.map((t) => normalize(t.w));
      const map = a.length === b.length && a.every((x, i) => x === b[i]) ? a.map((_, i) => i) : lcsAlign(a, b);
      const out = ch.verses.map(() => []);
      map.forEach((j, i) => {
        let g = null;
        if (j >= 0) {
          st.matched++;
          const x = theirWords[j].gloss;
          // "-" = not rendered separately; "vvv" = rendered together with a neighbouring word
          g = x && x !== '-' && x !== 'vvv' ? x : '';
        }
        out[ours[i].vi].push(g);
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
for (const l of ['he', 'gr']) {
  const s = stats[l];
  console.log(`${l}: ${s.matched} of ${s.words} words aligned (${((100 * s.matched) / s.words).toFixed(2)}%), ${s.missingVerses} of ${s.verses} verses absent from the tables`);
}
fs.writeFileSync(
  path.join(root, 'public', 'data', 'ctx', 'SOURCES.json'),
  JSON.stringify({ title: 'Berean Standard Bible interlinear tables', publisher: 'Bible Hub / Berean Bible Translation Committee', license: 'public domain (dedicated 30 April 2023)', url: 'https://berean.bible/downloads.htm', note: 'per-word English renderings of the BSB, aligned to the MAM and SBLGNT texts at build time; the BSB translates the WLC and the NA/SBL Greek, so a few words differ from our base texts and carry no rendering' }, null, 2),
);
