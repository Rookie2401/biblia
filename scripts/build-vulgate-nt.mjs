// Builds public/data/la/<Book>.json for the 27 books of the Vulgate New Testament.
//
// Two independent sources have to be reconciled:
//   - data/vulgate/lat-clementine.usfx.xml — the Clementine (1592) printed text, public domain,
//     via Perseus / seven1m/open-bibles. This is the text shown to the reader (real punctuation,
//     traditional spelling, traditional verse numbering).
//   - data/proiel/latin-nt.xml — the PROIEL/Syntacticus treebank (CC BY-NC-SA 4.0), which
//     supplies the lemma + morphology for as much of the text as it has annotated.
//
// Three real discrepancies between them were found by inspecting the actual files (not assumed
// from documentation) before writing this alignment, and are handled explicitly rather than
// papered over:
//   1. PROIEL's own tokens carry NO punctuation at all — the editorial note claims punctuation
//      was "added to the source text", but none of it survives into the token/presentation
//      attributes. So the Clementine text, not PROIEL, is the only source of truth for display,
//      and PROIEL tokens are matched to it by normalized spelling, not trusted for text content.
//   2. PROIEL's own citation-part verse numbers occasionally disagree with the Clementine's
//      traditional verse boundaries by a clause (e.g. Luke 1:32/33: PROIEL's "1.33" citation
//      covers what the Clementine prints as the end of verse 32 plus verse 33) — confirmed by
//      direct inspection. Aligning per CHAPTER (concatenating all of a chapter's words/tokens in
//      document order, then re-cutting the result at the Clementine's own verse boundaries)
//      sidesteps this rather than trusting PROIEL's verse label.
//   3. PROIEL's coverage is genuinely incomplete for several books — counted directly: the
//      Gospels, Acts, Romans, 1-2 Corinthians, Galatians, Ephesians, Philippians, Colossians,
//      1-2 Thessalonians, Titus, Philemon, 2 Timothy and Revelation are annotated at essentially
//      their full length, but Hebrews, James, 1-2 Peter, 1-3 John, Jude and 1 Timothy are only
//      sparsely covered (a few dozen to a few hundred tokens each, against several hundred to a
//      few thousand real words). This is NOT a bug in this script or a defect in the source
//      picked in error — it is the genuine state of that corpus, and is handled the same way
//      this app already handles every other real gap (Proverbs 25-29's missing morphology,
//      Joshua's partial LXX chapters, unaligned Hebrew words): the Clementine text is always
//      shown in full; a word with no PROIEL match simply is not tappable. Coverage is reported
//      per book in data/build/vulgate-nt-align.json and asserted by test/vulgate-nt-align.test.ts
//      so this gap stays honestly visible rather than silently shrinking or growing unnoticed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GNT, SEPTUAGINT, TANAKH, VULGATE_NT } from './canon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'data', 'la');
const buildDir = path.join(root, 'data', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

// Concordance book indices are global positions in the final CANON array; build-canon.mjs
// appends every TANAKH book, then every GNT book, then every SEPTUAGINT book, then these.
const GLOBAL_OFFSET = TANAKH.length + GNT.length + SEPTUAGINT.length;

const usfx = fs.readFileSync(path.join(root, 'data', 'vulgate', 'lat-clementine.usfx.xml'), 'utf8');
const proiel = fs.readFileSync(path.join(root, 'data', 'proiel', 'latin-nt.xml'), 'utf8');
const proielBody = proiel.slice(proiel.indexOf('<source id="latin-nt"'));

// ---- shared text normalisation (kept in sync with src/text/latin.ts's splitPrinted/latinBase —
// see the comment there) ----
const LEAD = /^[([«‹“‘]+/;
const TRAIL = /[)\]»›”’.,;:!?—–-]+$/;
function splitPrinted(text) {
  const lead = (text.match(LEAD) ?? [''])[0];
  const rest = text.slice(lead.length);
  const trail = (rest.match(TRAIL) ?? [''])[0];
  return { lead, word: rest.slice(0, rest.length - trail.length), trail };
}
const NO_LETTER = /^[^A-Za-zÀ-ſ]+$/;
function contentWords(text) {
  const raw = text.split(/\s+/).filter(Boolean);
  const out = [];
  let pendingLead = '';
  for (const tok of raw) {
    if (NO_LETTER.test(tok)) {
      if (out.length) out[out.length - 1] += tok;
      else pendingLead += tok;
    } else {
      out.push(pendingLead + tok);
      pendingLead = '';
    }
  }
  if (pendingLead) out.push(pendingLead);
  return out;
}
function normalize(word) {
  return splitPrinted(word).word.toLowerCase().replace(/j/g, 'i').replace(/v/g, 'u');
}

// ---- USFX: printed verse text per book/chapter ----
function usfxChapters(usfxId) {
  const bIdx = usfx.indexOf(`<book id="${usfxId}"`);
  if (bIdx === -1) throw new Error(`USFX: no book "${usfxId}"`);
  const rest = usfx.slice(bIdx + 20);
  const nextBookIdx = rest.indexOf('<book id="');
  const body = nextBookIdx === -1 ? rest : rest.slice(0, nextBookIdx);
  const chapters = []; // chapters[c-1] = { n, verses: [{n, t}] }
  let curC = 0;
  const re = /<c id="(\d+)"\/>|<v id="(\d+)"\/>([\s\S]*?)<ve\/>/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[1]) {
      curC = Number(m[1]);
      chapters[curC - 1] ??= { n: curC, verses: [] };
    } else {
      const v = Number(m[2]);
      const text = m[3]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      chapters[curC - 1].verses[v - 1] = { n: v, t: text };
    }
  }
  return chapters;
}

// ---- PROIEL: tokens per book, in document order, each carrying its own (approximate) chapter/verse ----
function proielTokens(code) {
  const tokenRe = /<token\s+([^>]*?)(?:\/>|>[\s\S]*?<\/token>)/g;
  const out = []; // { form, lemma, pos, morph, ch, v }
  let tm;
  while ((tm = tokenRe.exec(proielBody))) {
    const attrs = tm[1];
    const cp = (attrs.match(/citation-part="([^"]*)"/) ?? [])[1];
    if (!cp || !cp.startsWith(code + ' ')) continue;
    if (/empty-token-sort=/.test(attrs)) continue; // elliptical token, no printed word
    const form = (attrs.match(/form="([^"]*)"/) ?? [])[1];
    const lemma = (attrs.match(/lemma="([^"]*)"/) ?? [])[1];
    const pos = (attrs.match(/part-of-speech="([^"]*)"/) ?? [])[1];
    const morph = (attrs.match(/morphology="([^"]*)"/) ?? [])[1];
    if (!form || !lemma || !pos) continue; // a token PROIEL itself left incomplete
    const rest = cp.slice(code.length + 1); // "1.32" or "1.32a"
    const [chS, vS] = rest.split('.');
    out.push({ form, lemma: lemma.normalize('NFC'), pos, morph: (morph ?? '----------').normalize('NFC'), ch: Number(chS), v: Number(vS) });
  }
  return out;
}

/**
 * Greedy nearest-resync alignment of one chapter's printed words against PROIEL's tokens for
 * that chapter, both already in document (reading) order. Advances through both sequences in
 * lock step while they agree; on a mismatch, searches up to WINDOW tokens ahead for the next
 * point where they agree again, under three hypotheses — a run of one or more SUBSTITUTED words
 * (both sides advance together: real textual variants like "eis"/"his" between the two
 * independent editions, confirmed by inspecting actual mismatches this way), an INSERTION only
 * on the usfx side (advance usfx only — untranscribed-by-PROIEL material), or an INSERTION only
 * on the proiel side (advance proiel only). Every candidate MUST be confirmed by the following
 * token also agreeing (a 2-in-a-row match) — a single coincidentally-matching common word (et,
 * in, est, qui…) is never enough by itself. This matters especially across a real, multi-verse
 * gap in PROIEL's coverage (whole unannotated verses are common — see the module comment above):
 * a lone-match fallback was tried first and measured directly against this data, and it
 * regularly locked onto a coincidental common word inside the gap and then stayed wrong for the
 * rest of the chapter, which is worse than leaving the gap unaligned — so there is no 1-token
 * fallback. Among 2-gram candidates at the same distance, substitution is preferred (it re-syncs
 * both sides at once). A usfx word that cannot be resynced within the window is left unaligned
 * (null) and the scan continues from the next word.
 */
function alignChapter(usfxWords, proielToks) {
  const un = usfxWords.map(normalize);
  const pn = proielToks.map((t) => normalize(t.form));
  const result = new Array(usfxWords.length).fill(null);
  const WINDOW = 40;
  let i = 0;
  let j = 0;
  const agrees = (a, b) => a < un.length && b < pn.length && un[a] === pn[b];
  while (i < usfxWords.length && j < proielToks.length) {
    if (agrees(i, j)) {
      result[i] = proielToks[j];
      i++;
      j++;
      continue;
    }
    let found = null;
    for (let d = 1; d <= WINDOW && !found; d++) {
      if (agrees(i + d, j + d) && agrees(i + d + 1, j + d + 1)) found = [i + d, j + d]; // substitution
      else if (agrees(i + d, j) && agrees(i + d + 1, j + 1)) found = [i + d, j]; // usfx-only insertion
      else if (agrees(i, j + d) && agrees(i + 1, j + d + 1)) found = [i, j + d]; // proiel-only insertion
    }
    if (!found) {
      i++; // no resync point nearby: this word is genuinely unannotated territory
      continue;
    }
    [i, j] = found;
  }
  return result;
}

// PROIEL citation-part code -> USFX (SFM) 3-letter book code. A fixed, well-known 1:1 mapping,
// confirmed directly against both files' own book lists (27 codes each).
const USFX_ID = {
  MATT: 'MAT', MARK: 'MRK', LUKE: 'LUK', JOHN: 'JHN', ACTS: 'ACT', ROM: 'ROM',
  '1COR': '1CO', '2COR': '2CO', GAL: 'GAL', EPH: 'EPH', PHIL: 'PHP', COL: 'COL',
  '1THESS': '1TH', '2THESS': '2TH', '1TIM': '1TI', '2TIM': '2TI', TIT: 'TIT', PHILEM: 'PHM',
  HEB: 'HEB', JAS: 'JAS', '1PET': '1PE', '2PET': '2PE', '1JOHN': '1JN', '2JOHN': '2JN',
  '3JOHN': '3JN', JUDE: 'JUD', REV: 'REV',
};

const conc = {};
const posCounts = {}; // lemma -> { posCode: occurrences } — for build-lexicon-la.mjs's homograph disambiguation
const align = {}; // per-book diagnostics: { verses, words, aligned, chapters: [{n, words, aligned}] }
let totalWords = 0;
let totalAligned = 0;

for (const [proielCode, id] of VULGATE_NT) {
  const usfxId = USFX_ID[proielCode];
  const usfxCh = usfxChapters(usfxId);
  const ptoks = proielTokens(proielCode);
  const byChapter = new Map();
  for (const t of ptoks) (byChapter.get(t.ch) ?? byChapter.set(t.ch, []).get(t.ch)).push(t);

  const bookIdx = GLOBAL_OFFSET + VULGATE_NT.findIndex((r) => r[1] === id);
  const chapters = [];
  const bookAlign = { verses: 0, words: 0, aligned: 0, chapters: [] };
  usfxCh.forEach((uc, ci) => {
    const cn = ci + 1;
    const verses = [];
    const chWords = []; // flattened, in order
    const wordVerse = []; // chWords[k]'s verse number
    const wordIdxInVerse = []; // chWords[k]'s index within that verse
    uc.verses.forEach((uv, vi) => {
      const vn = vi + 1;
      const t = uv?.t ?? '';
      const words = contentWords(t);
      verses[vi] = { n: vn, t, w: new Array(words.length).fill(null) };
      words.forEach((_, wi) => {
        chWords.push(words[wi]);
        wordVerse.push(vi);
        wordIdxInVerse.push(wi);
      });
    });
    // a chapter absent from USFX (shouldn't happen for the NT) keeps its number, empty
    for (let vi = 0; vi < verses.length; vi++) if (!verses[vi]) verses[vi] = { n: vi + 1, t: '', w: [] };

    const chToks = (byChapter.get(cn) ?? []).slice().sort((a, b) => a.v - b.v);
    const aligned = alignChapter(chWords, chToks);
    let chAligned = 0;
    for (let k = 0; k < chWords.length; k++) {
      const tok = aligned[k];
      if (!tok) continue;
      const vi = wordVerse[k];
      const idxInVerse = wordIdxInVerse[k];
      verses[vi].w[idxInVerse] = [tok.lemma, tok.pos, tok.morph === '----------' ? undefined : tok.morph];
      chAligned++;
      (conc[tok.lemma] ??= []).push(bookIdx, cn, verses[vi].n, idxInVerse);
      const p = (posCounts[tok.lemma] ??= {});
      p[tok.pos] = (p[tok.pos] ?? 0) + 1;
    }
    chapters.push({ n: cn, verses });
    bookAlign.words += chWords.length;
    bookAlign.aligned += chAligned;
    bookAlign.verses += verses.length;
    bookAlign.chapters.push({ n: cn, words: chWords.length, aligned: chAligned });
  });

  fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify({ book: id, chapters }));
  align[id] = bookAlign;
  totalWords += bookAlign.words;
  totalAligned += bookAlign.aligned;
  process.stdout.write(id + ' ');
}
console.log();

fs.writeFileSync(path.join(buildDir, 'conc-la.json'), JSON.stringify(conc));
// each lemma's most frequent PROIEL part-of-speech code, for build-lexicon-la.mjs to pick the
// right Lewis & Short homograph (e.g. "liber2" the noun "book" vs "liber1" the adjective "free")
fs.writeFileSync(path.join(buildDir, 'la-lemma-pos.json'), JSON.stringify(Object.fromEntries(Object.entries(posCounts).map(([l, counts]) => [l, Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]]))));
fs.writeFileSync(path.join(buildDir, 'vulgate-nt-align.json'), JSON.stringify(align, null, 1));
// a small, shipped summary (not the full per-chapter breakdown above) for the Settings page to
// quote an honest, up-to-date figure from, the same way coverage.mjs does for Hebrew
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src', 'data', 'vulgate-coverage.json'),
  JSON.stringify({ words: totalWords, aligned: totalAligned, coveragePercent: Math.round((10000 * totalAligned) / totalWords) / 100 }, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(outDir, 'SOURCES.json'),
  JSON.stringify(
    {
      text: { title: 'Biblia Sacra Vulgata (Clementine, 1592)', via: 'Perseus Digital Library / seven1m/open-bibles', license: 'Public domain' },
      morphology: { title: 'PROIEL / Syntacticus Latin New Testament treebank', license: 'CC BY-NC-SA 4.0', url: 'https://syntacticus.org' },
    },
    null,
    2,
  ),
);
console.log(`Vulgate NT: 27 books, ${totalWords} words, ${totalAligned} aligned (${((100 * totalAligned) / totalWords).toFixed(1)}%), ${Object.keys(conc).length} lemmas`);
