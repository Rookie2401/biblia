// Builds public/data/he/<Book>.json for every book of the Tanakh:
//   text  — Miqra according to the Masorah (Sefaria export, data/mam-raw), markup resolved,
//           nothing normalised, corrected or respelled (same rules as the Psalter app);
//   words — OSHB lemma + morphology (data/oshb) aligned to the maqaf-split content words
//           of each verse by consonantal comparison (exact, else LCS).
// Also writes data/build/conc-he.json (lemma id -> occurrences) for the lexicon build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TANAKH, heCons, mamWords, HE_MARKS } from './canon.mjs';
import { fillGaps } from './align-fallback.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'data', 'he');
const buildDir = path.join(root, 'data', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

const decode = (s) => s.replace(/&thinsp;/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ''));

/** Resolve MAM's reader markup in one verse. Throws on anything unexpected so a new construct is never silently dropped. */
export function parseVerse(html, where) {
  const verse = { t: '' };
  let s = html;
  const kq = [];
  s = s.replace(/<span class="mam-kq">([\s\S]*?)<\/span><\/span>/g, (_, inner) => {
    const k = inner.match(/<span class="mam-kq-k">\(([^)]*)\)/);
    const q = inner.match(/<span class="mam-kq-q">\[([^\]]*)\]/);
    if (!k || !q) throw new Error(where + ': unhandled ketiv/qere markup: ' + html);
    kq.push({ k: k[1], q: q[1] });
    return q[1];
  });
  // qere wela ketiv (read but not written): the word is read; ketiv wela qere (written but not read): the word is dropped from the reading
  s = s.replace(/<span class="mam-kq-q">\[([^\]]*)\]<\/span>/g, (_, q) => (kq.push({ k: '', q }), q));
  s = s.replace(/<span class="mam-kq-k">\(([^)]*)\)[־ ]?<\/span>/g, (_, k) => (kq.push({ k, q: '' }), ''));
  if (/mam-kq-k|mam-kq-q/.test(s)) throw new Error(where + ': unhandled ketiv/qere markup: ' + html);
  s = s.replace(/<span class="mam-kq-trivial">([\s\S]*?)<\/span>/g, '$1');
  s = s.replace(/<span class="mam-implicit-maqaf">־<\/span>/g, '־');
  // editorial footnotes (Yemenite large/small letters etc.): kept as a note, removed from the text
  const notes = [];
  s = s.replace(/<sup class="footnote-marker">[^<]*<\/sup><i class="footnote">([\s\S]*?)<\/i>/g, (_, n) => {
    notes.push(stripTags(n).trim());
    return '';
  });
  if (/footnote/.test(s)) throw new Error(where + ': unhandled footnote markup: ' + html);
  if (/<span class="mam-spi-pe">\{פ\}<\/span>/.test(s)) verse.pe = 1;
  s = s.replace(/<span class="mam-spi-pe">\{פ\}<\/span>/g, '');
  if (/<span class="mam-spi-samekh">\{ס\}<\/span>/.test(s)) verse.s = 1;
  s = s.replace(/<span class="mam-spi-samekh">\{ס\}<\/span>/g, '');
  if (/<span class="mam-spi-invnun">׆<\/span>/.test(s)) verse.nun = 1;
  s = s.replace(/<span class="mam-spi-invnun">׆<\/span>/g, '');
  s = s.replace(/<b>׀<\/b>/g, ' ׀ ').replace(/<small>׀<\/small>/g, ' ׀ ');
  s = s.replace(/<\/?(small|big|sup)>/g, ''); // letter-size annotations: text kept
  s = s.replace(/<br>/g, ' ');
  if (/<[^>]+>/.test(s)) throw new Error(where + ': unhandled markup: ' + s.match(/<[^>]+>/)[0] + ' in ' + html);
  s = decode(s).replace(/[  ]+/g, ' ').trim();
  // verses absent from the Masoretic text proper (Josh 21:36-37 in some manuscripts): MAM prints a dash
  if (s === '—' || s === '') return { t: '', absent: 1 };
  const bad = s.replace(/ /g, '').match(/[^֑-׿͏]/g);
  if (bad) throw new Error(where + ': non-Hebrew characters ' + JSON.stringify(bad) + ' in ' + s);
  verse.t = s;
  if (kq.length) verse.kq = kq;
  if (notes.length) verse.note = notes.join(' ');
  return verse;
}

// ---- OSHB
function parseOshb(xml) {
  const verses = new Map();
  for (const m of xml.matchAll(/<verse osisID="([^"]+)">([\s\S]*?)<\/verse>/g)) {
    const [, id, body] = m;
    const toks = [];
    for (const w of body.matchAll(/<w([^>]*)>([^<]*)<\/w>/g)) {
      const attrs = w[1];
      if (/type="x-ketiv"/.test(attrs)) continue;
      const lemma = (attrs.match(/lemma="([^"]*)"/) || [])[1] || '';
      const morph = (attrs.match(/morph="([^"]*)"/) || [])[1] || '';
      toks.push({ text: w[2], lemma, morph });
    }
    verses.set(id, toks);
  }
  return verses;
}

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

const stemOf = (lemma) => lemma.split('/').pop().replace(/\+$/, '');

const conc = {}; // lemma id -> flat [bookIdx, ch, v, wordIdx, ...]
const posCounts = {}; // lemma id -> { morphPos: count } from the corpus (the authoritative part of speech)
const stats = { books: 0, chapters: 0, verses: 0, words: 0, exact: 0, lcs: 0, unmatched: 0, filled: 0, verseMismatch: [] };
const oddLemmas = new Set();

TANAKH.forEach(([sefaria, id], bookIdx) => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'mam-raw', id + '.json'), 'utf8'));
  const v = raw.versions[0];
  if (!/Miqra according to the Masorah/.test(v.versionTitle)) throw new Error(id + ': unexpected version ' + v.versionTitle);
  const oshb = parseOshb(fs.readFileSync(path.join(root, 'data', 'oshb', id + '.xml'), 'utf8'));
  const chapters = v.text.map((ch, ci) => {
    const parsed = ch.map((html, vi) => parseVerse(html, `${id} ${ci + 1}:${vi + 1}`));
    const oshbVerseCount = [...oshb.keys()].filter((k) => k.startsWith(`${id}.${ci + 1}.`)).length;
    // When the editions divide a chapter into verses differently, align the whole chapter at once.
    let chapterMap = null;
    let chapterToks = null;
    if (oshbVerseCount !== parsed.length) {
      stats.verseMismatch.push(`${id} ${ci + 1} (MAM ${parsed.length} verses, OSHB ${oshbVerseCount})`);
      chapterToks = [];
      for (let vv = 1; vv <= oshbVerseCount; vv++) chapterToks.push(...(oshb.get(`${id}.${ci + 1}.${vv}`) || []));
      const allMam = parsed.flatMap((p) => mamWords(p.t).map(heCons));
      const allOc = chapterToks.map((t) => heCons(t.text));
      chapterMap = lcsAlign(allMam, allOc);
      stats.filled += fillGaps(chapterMap, allMam, allOc);
    }
    let chapterOffset = 0;
    const verses = parsed.map((verse, vi) => {
      const mam = mamWords(verse.t);
      let otoks = oshb.get(`${id}.${ci + 1}.${vi + 1}`) || [];
      const mc = mam.map(heCons);
      let map;
      if (chapterMap) {
        map = chapterMap.slice(chapterOffset, chapterOffset + mam.length);
        chapterOffset += mam.length;
        otoks = chapterToks;
        stats.lcs++;
      } else {
        const oc = otoks.map((t) => heCons(t.text));
        if (mc.length === oc.length && mc.every((w, i) => w === oc[i])) {
          map = mc.map((_, i) => i);
          stats.exact++;
        } else {
          map = lcsAlign(mc, oc);
          stats.filled += fillGaps(map, mc, oc);
          stats.lcs++;
        }
      }
      const w = map.map((j, i) => {
        stats.words++;
        if (j < 0) {
          stats.unmatched++;
          return null;
        }
        const t = otoks[j];
        const stem = stemOf(t.lemma);
        if (!/^\d+( [a-z])?$/.test(stem)) oddLemmas.add(t.lemma);
        else {
          (conc[stem] ??= []).push(bookIdx, ci + 1, vi + 1, i);
          // the main segment's code: skip the prefix segments (C/R/Td …) that precede it
          const segs = t.morph.slice(1).split('/');
          const nPre = t.lemma.split('/').length - 1;
          const main = segs[Math.min(nPre, segs.length - 1)] || '';
          const key = main.startsWith('V') ? 'verb' : main.startsWith('Np') ? 'proper noun' : main.startsWith('Ng') ? 'gentilic' : main.startsWith('N') ? 'noun' : main.startsWith('Ac') ? 'number' : main.startsWith('Ao') ? 'ordinal' : main.startsWith('A') ? 'adjective' : main.startsWith('P') ? 'pronoun' : main.startsWith('R') ? 'preposition' : main.startsWith('C') ? 'conjunction' : main.startsWith('D') ? 'adverb' : main.startsWith('T') ? 'particle' : 'other';
          (posCounts[stem] ??= {})[key] = (posCounts[stem][key] || 0) + 1;
        }
        const seg = t.text.includes('/') ? t.text.replace(HE_MARKS, '').replace(/[׃׀]/g, '') : undefined;
        return seg ? [t.lemma, t.morph, seg] : [t.lemma, t.morph];
      });
      return { n: vi + 1, ...verse, w };
    });
    stats.verses += verses.length;
    return { n: ci + 1, verses };
  });
  stats.chapters += chapters.length;
  stats.books++;
  fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify({ book: id, chapters }));
  process.stdout.write(id + ' ');
});
console.log();
fs.writeFileSync(path.join(buildDir, 'conc-he.json'), JSON.stringify(conc));
fs.writeFileSync(path.join(buildDir, 'pos-he.json'), JSON.stringify(posCounts));
fs.writeFileSync(
  path.join(outDir, 'SOURCES.json'),
  JSON.stringify(
    {
      text: { title: 'Miqra according to the Masorah', edition: 'Digital edition of the Tanakh based on the Aleppo Codex and related manuscripts', via: 'Sefaria API', license: 'CC BY-SA 4.0', url: 'https://he.wikisource.org/wiki/משתמש:Dovi/מקרא_על_פי_המסורה', fetched: new Date().toISOString().slice(0, 10) },
      morphology: { title: 'Open Scriptures Hebrew Bible morphology', license: 'CC BY 4.0', url: 'https://github.com/openscriptures/morphhb' },
    },
    null,
    2,
  ),
);
console.log(`Tanakh: ${stats.books} books, ${stats.chapters} chapters, ${stats.verses} verses, ${stats.words} words; ${stats.exact} verses exact, ${stats.lcs} via LCS, ${stats.unmatched} words unmatched (${((100 * stats.unmatched) / stats.words).toFixed(2)}%)`);
if (stats.verseMismatch.length) console.log('verse mismatches (' + stats.verseMismatch.length + '): ' + stats.verseMismatch.slice(0, 40).join(', '));
if (oddLemmas.size) console.log('odd lemma values: ' + [...oddLemmas].slice(0, 20).join(' | '));
