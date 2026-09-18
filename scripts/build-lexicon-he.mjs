// Hebrew (and Aramaic) lexicon: one entry per OSHB lemma id (Strong's number, with the
// letter that Open Scriptures adds where BDB splits a Strong's number: "1254 a").
//   Brown-Driver-Briggs (public domain; XML by Open Scriptures, CC BY 4.0) — the complete entry,
//     rendered to a small safe HTML subset; the BDB *section* gives the root and its family
//   LexicalIndex (Open Scriptures) — Strong's -> BDB entry, part of speech, short gloss, transliteration
//   Strong's Hebrew dictionary (public domain, JSON by Open Scriptures) — pointed lemma, definition, KJV
// Output: public/data/lex/he-<shard>.json (shard = floor(number / 300)), he-index.json;
//         conc/he-<shard>.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSefariaBdb, sefariaIndex } from './bdb-sefaria.mjs';
import { assertSafe, sanitizeHtml } from './sanitize-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const concDir = path.join(root, 'public', 'data', 'conc');
const buildDir = path.join(root, 'data', 'build');
for (const d of [lexDir, concDir]) fs.mkdirSync(d, { recursive: true });

const conc = JSON.parse(fs.readFileSync(path.join(buildDir, 'conc-he.json'), 'utf8'));
const lxxPath = path.join(buildDir, 'lxx-by-strong.json');
const lxx = fs.existsSync(lxxPath) ? JSON.parse(fs.readFileSync(lxxPath, 'utf8')) : {};

const sj = fs.readFileSync(path.join(root, 'data', 'lexicon', 'strongs-hebrew-dictionary.js'), 'utf8');
const strongs = JSON.parse(sj.slice(sj.indexOf('{'), sj.lastIndexOf('}') + 1));

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const esc = (s) => s.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
const text = (s) => unesc(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// ---- LexicalIndex: Strong's (+aug) -> bdb id, pos, gloss, xlit
const li = fs.readFileSync(path.join(root, 'data', 'lexicon', 'LexicalIndex.xml'), 'utf8');
const index = new Map(); // "1254 a" -> [{...}] (several when a multi-word name shares the number)
const bdbToIds = new Map(); // bdb id -> [lemma ids]
for (const m of li.matchAll(/<entry id="([^"]+)">([\s\S]*?)<\/entry>/g)) {
  const body = m[2];
  const xref = body.match(/<xref([^>]*)\/>/);
  if (!xref) continue;
  const attr = (n) => (xref[1].match(new RegExp(n + '="([^"]*)"')) || [])[1];
  const strong = attr('strong');
  if (!strong) continue;
  const id = strong + (attr('aug') ? ' ' + attr('aug') : '');
  const w = body.match(/<w xlit="([^"]*)">([^<]*)<\/w>/);
  const e = { bdb: attr('bdb'), pos: text((body.match(/<pos>([^<]*)<\/pos>/) || [])[1] || ''), def: text((body.match(/<def>([\s\S]*?)<\/def>/) || [])[1] || ''), xlit: w ? unesc(w[1]) : '', w: w ? unesc(w[2]) : '', root: (body.match(/<etym root="([^"]*)"/) || [])[1] };
  (index.get(id) || index.set(id, []).get(id)).push(e);
  if (e.bdb) (bdbToIds.get(e.bdb) || bdbToIds.set(e.bdb, []).get(e.bdb)).push(id);
}

// ---- the complete BDB from Sefaria (data/bdb-sefaria, see fetch-bdb.mjs and bdb-sefaria.mjs)
const sefaria = loadSefariaBdb(path.join(root, 'data', 'bdb-sefaria'), path.join(root, 'data', 'bdb-texts'));
const sefariaFor = sefariaIndex(sefaria);

// ---- BDB
const bdbXml = fs.readFileSync(path.join(root, 'data', 'lexicon', 'BrownDriverBriggs.xml'), 'utf8');
function renderBdb(xml) {
  let s = xml;
  s = s.replace(/<status[^>]*>[^<]*<\/status>/g, '').replace(/<page[^>]*\/>/g, '').replace(/<page[^>]*>[^<]*<\/page>/g, '');
  s = s.replace(/<w src="([^"]+)"[^>]*>([\s\S]*?)<\/w>/g, '<a class="he-inline" data-bdb="$1">$2</a>');
  s = s.replace(/<w[^>]*>([\s\S]*?)<\/w>/g, '<span class="he-inline">$1</span>');
  s = s.replace(/<def>([\s\S]*?)<\/def>/g, '<b>$1</b>');
  s = s.replace(/<pos>([\s\S]*?)<\/pos>/g, '<i class="pos">$1</i>');
  s = s.replace(/<stem>([\s\S]*?)<\/stem>/g, '<span class="stem">$1</span>');
  s = s.replace(/<asp>([\s\S]*?)<\/asp>/g, '<i>$1</i>');
  s = s.replace(/<ref r="([^"]+)"[^>]*>([\s\S]*?)<\/ref>/g, '<a data-ref="$1">$2</a>');
  s = s.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/g, '$1');
  s = s.replace(/<sense n="([^"]*)">/g, '<div class="sense"><span class="n">$1</span> ').replace(/<sense>/g, '<div class="sense">').replace(/<\/sense>/g, '</div>');
  s = s.replace(/<foreign[^>]*>([\s\S]*?)<\/foreign>/g, '<i>$1</i>');
  s = s.replace(/<em>([\s\S]*?)<\/em>/g, '<em>$1</em>');
  return sanitizeHtml(s.replace(/\s+/g, ' ').replace(/> </g, '><').trim());
}
const bdb = new Map(); // entry id -> { html, w, section, root: boolean, first def }
const sections = new Map(); // section id -> { root: entry id, entries: [ids] }
for (const sec of bdbXml.matchAll(/<section id="([^"]+)">([\s\S]*?)<\/section>/g)) {
  const secId = sec[1];
  const info = { root: undefined, entries: [] };
  for (const m of sec[2].matchAll(/<entry id="([^"]+)"([^>]*)>([\s\S]*?)<\/entry>/g)) {
    const [, id, attrs, body] = m;
    const w = (body.match(/<w[^>]*>([\s\S]*?)<\/w>/) || [])[1];
    const isRoot = /type="root"/.test(attrs);
    const defs = [...body.matchAll(/<def>([\s\S]*?)<\/def>/g)].map((d) => text(d[1]));
    const e = { html: renderBdb(body), w: w ? text(w) : '', section: secId, isRoot, def: defs[0] || '', defs };
    bdb.set(id, e);
    info.entries.push(id);
    if (isRoot && !info.root) info.root = id;
  }
  sections.set(secId, info);
}

const curated = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'he-glosses.json'), 'utf8'));
const posCounts = fs.existsSync(path.join(buildDir, 'pos-he.json')) ? JSON.parse(fs.readFileSync(path.join(buildDir, 'pos-he.json'), 'utf8')) : {};
const consOf = (w) => (w || '').normalize('NFC').replace(/[֑-ׇ͏]/g, '').replace(/[^א-ת]/g, '');
const ARCHAIC = /\b(thou|thee|thy|thine|ye|hath|shalt|art|wilt|doth|begat|forgattest|didst|saith|unto|whoso|shew|receiveth|maketh|floodest|longeth|dost|hast|wouldest|shutteth|strengtheneth|hurleth)\b/i;
const clean = (x) => x.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (x) => x.trim().split(/\s+/).length;
/** A candidate is usable as a lexical gloss when it is short, modern and not a cross reference. */
const usable = (g, max = 6) => !!g && words(g) <= max && !ARCHAIC.test(g) && !/\bcompare\b|\bsee\b|^and |^the .* (which|that) |[!?]/i.test(g) && !/\.\s*\S/.test(g);
/** Choose the LexicalIndex entry for a lemma id: exact augmented id first, then the one whose headword matches Strong's. */
function pickIndex(id, num, strongLemma) {
  const exact = index.get(id) || [];
  const pool = exact.length ? exact : index.get(num) || [];
  if (!pool.length) return undefined;
  const c = consOf(strongLemma);
  return pool.find((e) => consOf(e.w) === c) || pool.find((e) => e.pos !== 'Np') || pool[0];
}
/**
 * The short gloss, in order of trust: curated → BDB outline definitions → LexicalIndex definition
 * (when it is a real definition, not a KJV phrase) → first clause of Strong's → a short KJV rendering.
 * Returns [gloss, source].
 */
function shortGloss(id, num, liE, bdbE, st, isName) {
  if (curated[id]) return [curated[id], 'curated'];
  if (curated[num] && !id.includes(' ')) return [curated[num], 'curated'];
  // a name: the index gives the conventional English form; BDB's definition is its etymology
  if (isName && liE?.def && /^[A-Z]/.test(liE.def) && usable(liE.def, 4)) return [liE.def, 'index'];
  const bdbDefs = (bdbE?.defs || []).map((d) => d.trim()).filter((d) => usable(d, 5) && !(isName && /hath|^Yah/.test(d)));
  if (bdbDefs.length) return [[...new Set(bdbDefs)].slice(0, 3).join(', '), 'bdb'];
  if (liE?.def && usable(liE.def, 4) && !(isName && /^[a-z]/.test(liE.def))) return [liE.def, 'index'];
  if (st) {
    const skip = /^(properly|probably|apparently|perhaps|a primitive root|from|the same as|denominative|of uncertain derivation|feminine of|masculine of|plural of|or|i\.e\.|by implication|by extension|figuratively|specifically|literally|in the sense of|contracted|patrial|patronymic|a variation|of foreign origin|of egyptian|of persian|of uncertain)/i;
    const clauses = clean(st.strongs_def || '').split(/[;:.]/).map((c) => c.trim()).filter((c) => c && !skip.test(c));
    const d = (clauses[0] ?? '').split(',').slice(0, isName ? 1 : 2).join(',').trim();
    if (d && d.length <= 48 && usable(d, 8)) return [d, 'strongs'];
    const k = clean(st.kjv_def || '').split(/[;,]/).map((c) => c.replace(/^[×x+]\s*/, '').trim()).filter((c) => c && usable(c, 3))[0];
    if (k) return [k, 'kjv'];
    if (d) return [d.slice(0, 48), 'strongs'];
  }
  if (liE?.def) return [liE.def, 'index'];
  return ['', ''];
}
/** Part of speech: what the corpus morphology says (dominant code), else the LexicalIndex. */
function partOfSpeech(id, liE) {
  const pc = posCounts[id];
  if (pc) {
    const best = Object.entries(pc).sort((a, b) => b[1] - a[1])[0];
    if (best && best[0] !== 'other') return best[0];
  }
  return liE?.pos ? POS[liE.pos] ?? liE.pos : undefined;
}

const POS = { N: 'noun', Np: 'proper noun', V: 'verb', A: 'adjective', D: 'adverb', P: 'pronoun', R: 'preposition', C: 'conjunction', T: 'particle', I: 'interjection', X: '', Ng: 'gentilic', Nc: 'noun', Ac: 'number', Ao: 'ordinal', Ag: 'gentilic adjective' };

const entries = {};
let withBdb = 0;
let withFull = 0;
for (const id of Object.keys(conc)) {
  const num = id.split(' ')[0];
  const st = strongs['H' + num];
  const liE = pickIndex(id, num, st?.lemma);
  const bdbId = liE?.bdb;
  const b = bdbId ? bdb.get(bdbId) : undefined;
  if (b) withBdb++;
  const sec = b ? sections.get(b.section) : undefined;
  const rootEntry = sec?.root ? bdb.get(sec.root) : undefined;
  const fam = sec
    ? sec.entries
        .filter((eid) => eid !== bdbId)
        .flatMap((eid) => (bdbToIds.get(eid) || []).map((lid) => [lid, entries[lid]?.w || bdb.get(eid)?.w || '', entries[lid]?.g || bdb.get(eid)?.def || '']))
        .filter(([lid]) => conc[lid])
    : [];
  const aramaic = /Aramaic|Chaldee/i.test(st?.strongs_def || '') || /^(Aramaic)/.test(st?.derivation || '');
  const full = sefariaFor(num, st?.lemma || liE?.w || '', aramaic);
  const pos = partOfSpeech(id, liE);
  const [gloss, gsrc] = shortGloss(id, num, liE, b, st, pos === 'proper noun');
  if (full) withFull++;
  entries[id] = {
    id,
    // the headword: the index entry when it names something else than Strong's lemma (a multi-word name sharing the number)
    w: liE && consOf(liE.w) !== consOf(st?.lemma) && (id.includes(' ') || liE.pos === 'Np' || liE.w.includes(' ') || liE.w.includes('־')) ? liE.w : st?.lemma || liE?.w || b?.w || '',
    x: st?.xlit || liE?.xlit || undefined,
    pron: st?.pron || undefined,
    pos,
    g: gloss,
    gs: gsrc || undefined,
    sd: st?.strongs_def?.trim() || undefined,
    kj: st?.kjv_def?.trim() || undefined,
    der: st?.derivation?.trim() || undefined,
    bdb: full ? full.html : b?.html || undefined,
    bdbFull: full ? 1 : undefined,
    bdbId: bdbId || undefined,
    root: rootEntry ? rootEntry.w : liE?.root || undefined,
    rootDef: rootEntry?.def || undefined,
    fam: fam.length ? fam : undefined,
    lxx: lxx[num] || undefined,
    n: conc[id].length / 4,
  };
}

const shardOf = (id) => String(Math.floor(Number(id.split(' ')[0]) / 300));
const shards = {};
const concShards = {};
for (const [id, e] of Object.entries(entries)) {
  const k = shardOf(id);
  (shards[k] ??= {})[id] = e;
  (concShards[k] ??= {})[id] = conc[id];
}
for (const e of Object.values(entries)) if (e.bdb) assertSafe(e.bdb, 'BDB ' + e.id);
for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(lexDir, `he-${k}.json`), JSON.stringify(v));
// BDB entry id -> [lemma id, lemma, gloss], for the cross references inside entries
const bdbIndexOut = {};
for (const [bid, ids] of bdbToIds) {
  const rows = ids.filter((lid) => entries[lid]).map((lid) => [lid, entries[lid].w, entries[lid].g]);
  if (rows.length) bdbIndexOut[bid] = rows;
}
fs.writeFileSync(path.join(lexDir, 'he-bdb-index.json'), JSON.stringify(bdbIndexOut));
for (const [k, v] of Object.entries(concShards)) fs.writeFileSync(path.join(concDir, `he-${k}.json`), JSON.stringify(v));
fs.writeFileSync(path.join(lexDir, 'he-index.json'), JSON.stringify(Object.values(entries).map((e) => [e.id, e.w, e.x || '', e.g, e.n, e.gs || ''])));
fs.writeFileSync(
  path.join(lexDir, 'he-SOURCES.json'),
  JSON.stringify(
    {
      bdb: { title: 'Brown, Driver & Briggs, A Hebrew and English Lexicon of the Old Testament (1906)', license: 'public domain; XML by Open Scriptures CC BY 4.0', url: 'https://github.com/openscriptures/HebrewLexicon' },
      lexicalIndex: { title: 'Open Scriptures Hebrew Lexical Index', license: 'CC BY 4.0', url: 'https://github.com/openscriptures/HebrewLexicon' },
      strongs: { title: "Strong's Hebrew Dictionary (1890)", license: 'public domain; JSON CC BY-SA', url: 'https://github.com/openscriptures/strongs' },
    },
    null,
    2,
  ),
);
console.log(`Hebrew lexicon: ${Object.keys(entries).length} lemma ids, ${withBdb} with an Open Scriptures BDB entry, ${withFull} with the full BDB text (Sefaria, ${sefaria.length} entries on disk), ${Object.keys(shards).length} shards`);
const missing = Object.values(entries).filter((e) => !e.bdb).sort((a, b) => b.n - a.n).slice(0, 20);
console.log('most frequent without BDB: ' + missing.map((e) => `${e.id}:${e.w}(${e.n})`).join(' '));
