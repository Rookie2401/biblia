// Greek lexicon: one entry per MorphGNT lemma, keyed by the lemma.
//   Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922, public domain; TEI by
//     translatable-exegetical-tools) — the complete definition, rendered to a small safe HTML subset
//   Dodson Greek lexicon (public domain) — brief and longer glosses, by Strong's number
//   Strong's Greek dictionary (public domain, JSON by Open Scriptures) — lemma, transliteration,
//     definition, KJV renderings, derivation
//   Septuagint occurrence counts per lemma (data/build/lxx-counts.json, from build-lxx.mjs) — the
//     one trace of the Septuagint kept in Biblia now that the text itself is read in Vetus.
// Output: public/data/lex/gr-<shard>.json, gr-manifest.json, gr-index.json; conc/gr-<shard>.json;
//         data/build/lxx-by-strong.json (Hebrew Strong's -> Greek lemmas that render it in the LXX,
//         from Abbott-Smith's Septuagint notes, consumed by build-lexicon-he.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafe, sanitizeHtml } from './sanitize-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const concDir = path.join(root, 'public', 'data', 'conc');
const buildDir = path.join(root, 'data', 'build');
for (const d of [lexDir, concDir, buildDir]) fs.mkdirSync(d, { recursive: true });

const conc = JSON.parse(fs.readFileSync(path.join(buildDir, 'conc-gr.json'), 'utf8'));
// NT lemma -> how often that same word (same spelling, after build-lxx.mjs's reconciliation)
// occurs in the Septuagint; absent when the word never does
const lxxCounts = JSON.parse(fs.readFileSync(path.join(buildDir, 'lxx-counts.json'), 'utf8'));

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
  // the sanitizer drops anything outside the allowlist (tags kept, text kept) and rebalances nesting
  return sanitizeHtml(s.replace(/\s+/g, ' ').replace(/> </g, '><').trim());
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

const curated = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'gr-glosses.json'), 'utf8'));
const alias = curated._alias || {};
// Greek -> Latin transliteration (SBL general style) for lemmas Strong's does not cover
const XLIT = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'ē', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'ō' };
function translit(lemma) {
  const d = lemma.normalize('NFD');
  let out = '';
  let prevGreek = '';
  for (let i = 0; i < d.length; i++) {
    const ch = d[i];
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower;
    const marks = [];
    while (i + 1 < d.length && /[̀-ͯ]/.test(d[i + 1])) marks.push(d[++i]);
    let t = XLIT[lower] ?? (/[a-z]/i.test(ch) ? ch : '');
    if (marks.includes('̔')) t = (lower === 'ρ' ? 'rh' : 'h' + t);
    if (lower === 'γ' && /[γκξχ]/.test(d[i + 1]?.toLowerCase() || '')) t = 'n';
    if (lower === 'υ' && /[αεηο]/.test(prevGreek) && !marks.includes('̈')) t = 'u';
    prevGreek = lower;
    if (isUpper) t = t[0].toUpperCase() + t.slice(1);
    out += t;
  }
  return out;
}
const fixTypos = (x) => (x || '').replace(/descendent/g, 'descendant');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Reviewed Strong's assignments for homographs and source irregularities (data/curated/gr-overrides.json). */
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'gr-overrides.json'), 'utf8')).overrides;
const conflicts = [];
const entries = {};
let matchedAS = 0;
let matchedStrongs = 0;
for (const lemma of Object.keys(conc)) {
  const occ = conc[lemma].length / 4;
  // candidates: the lemma itself; without a parenthesised movable letter (οὕτω(ς)); the active
  // form of a deponent (φοβέομαι -> φοβέω, ἀφίσταμαι -> ἀφίστημι); Abbott-Smith's spelling Δαυείδ.
  const cands = [lemma, alias[lemma], lemma.replace(/\(([^)]*)\)/g, '$1'), lemma.replace(/\([^)]*\)/g, ''), lemma.replace(/ομαι$/, 'ω'), lemma.replace(/αμαι$/, 'ημι'), lemma.replace(/υί/g, 'υεί'), lemma.replace(/άω$/, 'έω'), lemma.replace(/οῦς$/, 'εος'), lemma.replace(/οῦν$/, 'εον'), lemma.replace(/εν$/, 'α'), lemma.replace(/ει$/, 'ω'), lemma.replace(/ίτης$/, 'είτης'), lemma.replace(/ῖτις$/, 'εῖτις')].filter(Boolean);
  let as;
  let gid;
  for (const c of cands) {
    as = abbott.get(c) || abbottBase.get(base(c));
    if (as) break;
  }
  // Strong's number, in order of trust: a reviewed override; an exact canonical Strong's lemma
  // for the lemma or a reviewed alias; an accent-free canonical match; Abbott-Smith's number only
  // when Strong's lemma for it is the same word (its annotations are sometimes off by one entry).
  const asId = as?.g && /^G\d+$/.test(as.g) ? as.g : undefined;
  // the same word when the accent-free forms agree, or differ only by a spelling variant
  // (Δαβίδ/Δαυίδ, δεικνύω/δείκνυμι, Μωσεύς/Μωϋσῆς): a small edit distance from the same initial
  const sameWord = (id) => {
    const sl = strongs[id]?.lemma;
    if (!sl) return false;
    const a = base(sl.normalize('NFC'));
    const b = base(lemma);
    if (a === b) return true;
    return a[0] === b[0] && lev(a, b) <= (Math.min(a.length, b.length) <= 5 ? 1 : 3);
  };
  if (overrides[lemma]) gid = overrides[lemma].strong;
  else {
    for (const c of [lemma, alias[lemma]].filter(Boolean)) {
      gid = strongsByLemma.get(c);
      if (gid) break;
    }
    if (!gid) for (const c of cands) {
      gid = strongsByLemma.get('~' + base(c));
      if (gid) break;
    }
    if (!gid && asId && sameWord(asId)) gid = asId;
    if (!gid && asId) conflicts.push({ lemma, abbott: asId, abbottLemma: strongs[asId]?.lemma, canonical: null, used: null, note: 'Abbott-Smith number names another word; no canonical match' });
  }
  if (asId && gid && asId !== gid) conflicts.push({ lemma, abbott: asId, abbottLemma: strongs[asId]?.lemma, canonical: gid, canonicalLemma: strongs[gid]?.lemma, used: gid, note: overrides[lemma] ? 'reviewed override' : 'canonical Strong lemma preferred' });
  if (!as && gid) as = abbottByStrong.get(gid);
  if (as) matchedAS++;
  const st = gid ? strongs[gid] : undefined;
  if (st) matchedStrongs++;
  const dd = gid ? dodson.get(gid) : undefined;
  const cur = curated[lemma];
  const gloss = cur || fixTypos(dd?.brief) || as?.glosses[0] || (st ? shortStrongs(st) : '') || '';
  const gs = cur ? 'curated' : dd?.brief ? 'dodson' : as?.glosses[0] ? 'abbott' : st ? 'strongs' : '';
  entries[lemma] = {
    l: lemma,
    id: gid || undefined,
    // Strong's transliteration only when it is this very lemma; an aliased or unmatched lemma is transliterated itself
    x: st?.translit && st.lemma && base(st.lemma.normalize('NFC')) === base(lemma) ? st.translit : translit(lemma),
    g: gloss,
    gs: gs || undefined,
    long: dd?.long && fixTypos(dd.long) !== gloss ? fixTypos(dd.long) : undefined,
    sd: st?.strongs_def?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() || undefined,
    kj: st?.kjv_def?.trim() || undefined,
    der: st?.derivation?.trim() || undefined,
    as: as?.html || undefined,
    heb: as?.hebs.length ? as.hebs : undefined,
    n: occ,
    lxxN: lxxCounts[lemma] || undefined,
  };
}
const withLxx = Object.values(entries).filter((e) => e.lxxN).length;

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
for (const e of Object.values(entries)) if (e.as) assertSafe(e.as, 'Abbott-Smith ' + e.l);
for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(lexDir, `gr-${k}.json`), JSON.stringify(v));
for (const [k, v] of Object.entries(concShards)) fs.writeFileSync(path.join(concDir, `gr-${k}.json`), JSON.stringify(v));
fs.writeFileSync(path.join(lexDir, 'gr-manifest.json'), JSON.stringify({ split: [...split], shards: Object.keys(shards).sort() }));
// every disagreement between Abbott-Smith's number and the canonical Strong's lemma, for review
fs.writeFileSync(path.join(buildDir, 'gr-strong-conflicts.json'), JSON.stringify(conflicts, null, 1));
console.log(`Strong's conflicts (Abbott-Smith number ≠ canonical lemma): ${conflicts.length}, listed in data/build/gr-strong-conflicts.json`);
// "strong": null means "deliberately no Strong's number" (a word Strong's never headed on its
// own); entries[lemma].id is undefined in that case (`gid || undefined`), so compare loosely.
for (const [lemma, o] of Object.entries(overrides)) if (entries[lemma] && (entries[lemma].id || null) !== (o.strong || null)) throw new Error(`override not applied for ${lemma}`);
fs.writeFileSync(path.join(lexDir, 'gr-index.json'), JSON.stringify(Object.values(entries).map((e) => [e.l, e.id || '', e.x || '', e.g, e.n, e.gs || ''])));
fs.writeFileSync(
  path.join(lexDir, 'gr-SOURCES.json'),
  JSON.stringify(
    {
      abbottSmith: { title: 'G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (T&T Clark, 1922)', license: 'public domain; TEI transcription CC BY-SA 4.0', url: 'https://github.com/translatable-exegetical-tools/Abbott-Smith' },
      dodson: { title: 'Dodson Greek Lexicon (John Jeffrey Dodson, 2010)', license: 'public domain', url: 'https://github.com/biblicalhumanities/Dodson-Greek-Lexicon' },
      strongs: { title: "Strong's Greek Dictionary (1890)", license: 'public domain; JSON CC BY-SA', url: 'https://github.com/openscriptures/strongs' },
      septuagintCounts: { title: 'Septuagint occurrence counts per lemma, from lxx-morph (Rahlfs 1935)', license: 'CC BY 4.0', url: 'https://github.com/OpenScriptorium/lxx-morph' },
    },
    null,
    2,
  ),
);
console.log(`Greek lexicon: ${Object.keys(entries).length} lemmas; Abbott-Smith matched ${matchedAS}, Strong's matched ${matchedStrongs}; ${withLxx} also occur in the Septuagint; ${Object.keys(shards).length} shards (split: ${[...split].join(' ')}); LXX map for ${Object.keys(lxxByStrong).length} Hebrew words`);
const missing = Object.values(entries).filter((e) => !e.as).sort((a, b) => b.n - a.n).slice(0, 25);
console.log('most frequent lemmas without an Abbott-Smith entry: ' + missing.map((e) => `${e.l}(${e.n})`).join(' '));
