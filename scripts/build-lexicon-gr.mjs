// Greek lexicon: one entry per MorphGNT lemma, keyed by the lemma.
//   Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922, public domain; TEI by
//     translatable-exegetical-tools) — the complete definition, rendered to a small safe HTML subset
//   Dodson Greek lexicon (public domain) — brief and longer glosses, by Strong's number
//   Strong's Greek dictionary (public domain, JSON by Open Scriptures) — lemma, transliteration,
//     definition, KJV renderings, derivation
// Output: public/data/lex/gr-<shard>.json, gr-manifest.json, gr-index.json; conc/gr-<shard>.json;
//         data/build/lxx-by-strong.json (Hebrew Strong's -> Greek lemmas that render it in the LXX,
//         from Abbott-Smith's Septuagint notes, consumed by build-lexicon-he.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const concDir = path.join(root, 'public', 'data', 'conc');
const buildDir = path.join(root, 'data', 'build');
for (const d of [lexDir, concDir, buildDir]) fs.mkdirSync(d, { recursive: true });

const conc = JSON.parse(fs.readFileSync(path.join(buildDir, 'conc-gr.json'), 'utf8'));

// ---- Strong's
const sj = fs.readFileSync(path.join(root, 'data', 'lexicon', 'strongs-greek-dictionary.js'), 'utf8');
const strongs = JSON.parse(sj.slice(sj.indexOf('{'), sj.lastIndexOf('}') + 1));
const strongsByLemma = new Map();
for (const [id, e] of Object.entries(strongs)) {
  const l = (e.lemma || '').normalize('NFC');
  if (l && !strongsByLemma.has(l)) strongsByLemma.set(l, id);
  const b = base(l);
  if (b && !strongsByLemma.has('~' + b)) strongsByLemma.set('~' + b, id);
}

// ---- Dodson (tab separated, quoted)
const dodson = new Map();
for (const line of fs.readFileSync(path.join(root, 'data', 'lexicon', 'dodson.csv'), 'utf8').split('\n').slice(1)) {
  if (!line.trim()) continue;
  const cells = line.split('\t').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
  const id = 'G' + String(Number(cells[0]));
  if (!Number.isFinite(Number(cells[0]))) continue;
  dodson.set(id, { brief: cells[3] || '', long: cells[4] || '' });
}

// ---- Abbott-Smith (TEI)
const tei = fs.readFileSync(path.join(root, 'data', 'lexicon', 'abbott-smith.tei.xml'), 'utf8');
const esc = (s) => s.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;');
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** TEI -> a small HTML subset the app renders as trusted content (span/b/i/em/div/p/a/br/table/sup). */
function renderTei(xml) {
  let s = xml;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<pb[^>]*\/>/g, '').replace(/<pb[^>]*>[\s\S]*?<\/pb>/g, '');
  s = s.replace(/<note type="occurrencesNT">[^<]*<\/note>/g, '');
  s = s.replace(/<orth>([\s\S]*?)<\/orth>/g, '<b class="gr">$1</b>');
  s = s.replace(/<foreign xml:lang="heb" n="H(\d+)">([\s\S]*?)<\/foreign>/g, '<a class="he-inline" data-he="$1">$2</a>');
  s = s.replace(/<foreign xml:lang="heb"[^>]*>([\s\S]*?)<\/foreign>/g, '<span class="he-inline">$1</span>');
  s = s.replace(/<foreign xml:lang="grc"[^>]*>([\s\S]*?)<\/foreign>/g, '<span class="gr">$1</span>');
  s = s.replace(/<foreign[^>]*>([\s\S]*?)<\/foreign>/g, '<i>$1</i>');
  s = s.replace(/<gloss>([\s\S]*?)<\/gloss>/g, '<b>$1</b>');
  s = s.replace(/<ref osisRef="([^"]+)"[^>]*>([\s\S]*?)<\/ref>/g, '<a data-ref="$1">$2</a>');
  s = s.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/g, '$1');
  s = s.replace(/<sense n="([^"]*)">/g, '<div class="sense"><span class="n">$1</span> ').replace(/<sense>/g, '<div class="sense">').replace(/<\/sense>/g, '</div>');
  s = s.replace(/<seg type="septuagint">([\s\S]*?)<\/seg>/g, '<span class="lxx">$1</span>');
  s = s.replace(/<seg[^>]*>([\s\S]*?)<\/seg>/g, '$1');
  s = s.replace(/<form>([\s\S]*?)<\/form>/g, '<div class="form">$1</div>');
  s = s.replace(/<etym>([\s\S]*?)<\/etym>/g, '<div class="etym">$1</div>');
  s = s.replace(/<(emph|hi|tns|gram|gramGrp|pos|mood|per|number|usg|re|head)[^>]*>([\s\S]*?)<\/\1>/g, '<i>$2</i>');
  s = s.replace(/<(emph|hi|tns|gram|gramGrp|pos|mood|per|number|usg|re|head)[^>]*>([\s\S]*?)<\/\1>/g, '<i>$2</i>'); // nested once more
  s = s.replace(/<note[^>]*>([\s\S]*?)<\/note>/g, '<span class="note">$1</span>');
  s = s.replace(/<lb\s*\/>/g, '<br>');
  s = s.replace(/<table[^>]*>/g, '<table>').replace(/<row[^>]*>/g, '<tr>').replace(/<\/row>/g, '</tr>').replace(/<cell[^>]*>/g, '<td>').replace(/<\/cell>/g, '</td>');
  s = s.replace(/<div[^>]*>/g, '<div>');
  s = s.replace(/<p[^>]*>/g, '<p>');
  // anything left that is not in the allow-list is stripped, its text kept
  s = s.replace(/<\/?(?!(b|i|em|span|div|p|a|br|table|tr|td|sup)\b)[a-zA-Z][^>]*>/g, '');
  return esc(s.replace(/\s+/g, ' ').replace(/> </g, '><').trim());
}

const abbott = new Map(); // lemma -> entry
const abbottByStrong = new Map();
const lxxByStrong = {};
for (const m of tei.matchAll(/<entry n="([^"]+)">([\s\S]*?)<\/entry>/g)) {
  const [lemmaRaw, gRaw] = m[1].split('|');
  const lemma = unesc(lemmaRaw).normalize('NFC');
  const body = m[2];
  const occ = Number((body.match(/<note type="occurrencesNT">(\d+)<\/note>/) || [])[1] || 0);
  const glosses = [...body.matchAll(/<gloss>([^<]*)<\/gloss>/g)].map((g) => unesc(g[1]).trim());
  const hebs = [...body.matchAll(/<foreign xml:lang="heb" n="H(\d+)">([^<]*)<\/foreign>/g)].map((h) => [Number(h[1]), unesc(h[2]).trim()]);
  const e = { lemma, g: gRaw, occ, glosses, hebs, html: renderTei(body) };
  if (!abbott.has(lemma)) abbott.set(lemma, e);
  if (gRaw && !abbottByStrong.has(gRaw)) abbottByStrong.set(gRaw, e);
  for (const [h] of hebs) (lxxByStrong[h] ??= new Set()).add(lemma);
}
fs.writeFileSync(path.join(buildDir, 'lxx-by-strong.json'), JSON.stringify(Object.fromEntries(Object.entries(lxxByStrong).map(([k, v]) => [k, [...v]]))));

function base(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ᷀-᷿]/g, '')
    .replace(/ς/g, 'σ')
    .toLowerCase();
}
function shortStrongs(e) {
  const d = (e.strongs_def || '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  const first = d.split(/[;:]/)[0].split(',')[0].trim();
  if (first && first.length <= 40 && !/^(from|of|a primary|prob|perhaps|apparently|the same|a prol|a form|comparative|neuter|feminine|plural|including)/i.test(first)) return first;
  const k = (e.kjv_def || '').split(/[;,]/).map((c) => c.replace(/^[×x+]\s*/, '').trim()).filter(Boolean)[0];
  return k || first.slice(0, 40);
}

const abbottBase = new Map();
for (const [l, e] of abbott) if (!abbottBase.has(base(l))) abbottBase.set(base(l), e);

const entries = {};
let matchedAS = 0;
let matchedStrongs = 0;
for (const lemma of Object.keys(conc)) {
  const occ = conc[lemma].length / 4;
  // candidates: the lemma itself; without a parenthesised movable letter (οὕτω(ς)); the active
  // form of a deponent (φοβέομαι -> φοβέω, ἀφίσταμαι -> ἀφίστημι); Abbott-Smith's spelling Δαυείδ.
  const cands = [lemma, lemma.replace(/\(([^)]*)\)/g, '$1'), lemma.replace(/\([^)]*\)/g, ''), lemma.replace(/ομαι$/, 'ω'), lemma.replace(/αμαι$/, 'ημι'), lemma.replace(/υί/g, 'υεί')];
  let as;
  let gid;
  for (const c of cands) {
    as = abbott.get(c) || abbottBase.get(base(c));
    if (as) break;
  }
  for (const c of cands) {
    gid = as?.g || strongsByLemma.get(c) || strongsByLemma.get('~' + base(c));
    if (gid) break;
  }
  if (!as && gid) as = abbottByStrong.get(gid);
  if (as) matchedAS++;
  const st = gid ? strongs[gid] : undefined;
  if (st) matchedStrongs++;
  const dd = gid ? dodson.get(gid) : undefined;
  const gloss = dd?.brief || as?.glosses[0] || (st ? shortStrongs(st) : '');
  entries[lemma] = {
    l: lemma,
    id: gid || undefined,
    x: st?.translit || undefined,
    g: gloss,
    long: dd?.long && dd.long !== gloss ? dd.long : undefined,
    sd: st?.strongs_def?.trim() || undefined,
    kj: st?.kjv_def?.trim() || undefined,
    der: st?.derivation?.trim() || undefined,
    as: as?.html || undefined,
    heb: as?.hebs.length ? as.hebs : undefined,
    n: occ,
  };
}

// ---- shards by first letter (large letters split by their second letter)
const shardOf = (lemma, split) => {
  const b = base(lemma).replace(/[^α-ω]/g, '');
  const one = b[0] || 'x';
  return split.has(one) ? one + (b[1] || '') : one;
};
const counts = {};
for (const l of Object.keys(entries)) counts[base(l).replace(/[^α-ω]/g, '')[0] || 'x'] = (counts[base(l).replace(/[^α-ω]/g, '')[0] || 'x'] || 0) + 1;
const split = new Set(Object.entries(counts).filter(([, n]) => n > 320).map(([k]) => k));
const shards = {};
const concShards = {};
for (const [l, e] of Object.entries(entries)) {
  const k = shardOf(l, split);
  (shards[k] ??= {})[l] = e;
  (concShards[k] ??= {})[l] = conc[l];
}
for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(lexDir, `gr-${k}.json`), JSON.stringify(v));
for (const [k, v] of Object.entries(concShards)) fs.writeFileSync(path.join(concDir, `gr-${k}.json`), JSON.stringify(v));
fs.writeFileSync(path.join(lexDir, 'gr-manifest.json'), JSON.stringify({ split: [...split], shards: Object.keys(shards).sort() }));
fs.writeFileSync(path.join(lexDir, 'gr-index.json'), JSON.stringify(Object.values(entries).map((e) => [e.l, e.id || '', e.x || '', e.g, e.n])));
fs.writeFileSync(
  path.join(lexDir, 'gr-SOURCES.json'),
  JSON.stringify(
    {
      abbottSmith: { title: 'G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (T&T Clark, 1922)', license: 'public domain; TEI transcription CC BY-SA 4.0', url: 'https://github.com/translatable-exegetical-tools/Abbott-Smith' },
      dodson: { title: 'Dodson Greek Lexicon (John Jeffrey Dodson, 2010)', license: 'public domain', url: 'https://github.com/biblicalhumanities/Dodson-Greek-Lexicon' },
      strongs: { title: "Strong's Greek Dictionary (1890)", license: 'public domain; JSON CC BY-SA', url: 'https://github.com/openscriptures/strongs' },
    },
    null,
    2,
  ),
);
console.log(`Greek lexicon: ${Object.keys(entries).length} lemmas; Abbott-Smith matched ${matchedAS}, Strong's matched ${matchedStrongs}; ${Object.keys(shards).length} shards (split: ${[...split].join(' ')}); LXX map for ${Object.keys(lxxByStrong).length} Hebrew words`);
const missing = Object.values(entries).filter((e) => !e.as).sort((a, b) => b.n - a.n).slice(0, 25);
console.log('most frequent lemmas without an Abbott-Smith entry: ' + missing.map((e) => `${e.l}(${e.n})`).join(' '));
