// Latin lexicon: one entry per PROIEL lemma actually used in the Vulgate NT, keyed by the
// lemma. Source: Lewis & Short, A Latin Dictionary (1879, public domain; TEI transcription by
// the Perseus Digital Library, CC BY-SA 4.0). No Strong's numbering exists for Latin, so this
// is much simpler than the Hebrew/Greek builders: no cross-referencing, no shard-growth
// heuristics for two competing numbering schemes, just lemma -> entry.
// Output: public/data/lex/la-<shard>.json, la-manifest.json, la-index.json; conc/la-<shard>.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafe, sanitizeHtml } from './sanitize-html.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const concDir = path.join(root, 'public', 'data', 'conc');
const buildDir = path.join(root, 'data', 'build');
for (const d of [lexDir, concDir, buildDir]) fs.mkdirSync(d, { recursive: true });

const conc = JSON.parse(fs.readFileSync(path.join(buildDir, 'conc-la.json'), 'utf8'));
const lemmas = Object.keys(conc); // every lemma the Vulgate NT build actually produced
// each lemma's own most frequent PROIEL part-of-speech in the Vulgate NT, used below to choose
// the right Lewis & Short homograph — L&S numbers unrelated headwords that happen to be spelled
// alike (liber1 the adjective "free" vs liber2 "children" vs liber4 the noun "book"), and #1 is
// not reliably the dominant sense (confirmed directly: "Liber generationis", Matt 1:1, resolved
// to the adjective before this was added).
const lemmaPos = JSON.parse(fs.readFileSync(path.join(buildDir, 'la-lemma-pos.json'), 'utf8'));
const PROIEL_CLASS = { Nb: 'noun', Ne: 'noun', 'V-': 'verb', 'A-': 'adj', Df: 'adv', Du: 'adv', Dq: 'adv', 'R-': 'prep', 'C-': 'conj', 'G-': 'conj', Pp: 'pron', Pd: 'pron', Pr: 'pron', Pi: 'pron', Px: 'pron', Ps: 'pron', Pk: 'pron', Pt: 'pron', Pc: 'pron', Ma: 'num', Mo: 'num' };

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** TEI -> a small HTML subset the app renders as trusted content (span/b/i/em/div/p/a/br/table/sup). */
function renderTei(xml) {
  let s = xml;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<orth[^>]*>([\s\S]*?)<\/orth>/g, '<b class="la">$1</b>');
  s = s.replace(/<foreign lang="greek">([\s\S]*?)<\/foreign>/g, '<span class="gr">$1</span>');
  s = s.replace(/<foreign[^>]*>([\s\S]*?)<\/foreign>/g, '<i>$1</i>');
  s = s.replace(/<sense level="1"[^>]*>/g, '<div class="sense">').replace(/<sense[^>]*>/g, '<div>').replace(/<\/sense>/g, '</div>');
  s = s.replace(/<hi rend="ital">([\s\S]*?)<\/hi>/g, '<i>$1</i>');
  s = s.replace(/<cit>([\s\S]*?)<\/cit>/g, '<span class="note">$1</span>');
  s = s.replace(/<quote[^>]*>([\s\S]*?)<\/quote>/g, '<i>$1</i>');
  s = s.replace(/<etym>([\s\S]*?)<\/etym>/g, '<div class="etym">$1</div>');
  s = s.replace(/<(itype|gen|pos|case|usg|number|mood|tns|pers)>([\s\S]*?)<\/\1>/g, '<i>$2</i>');
  // bibliographic apparatus (author + citation) is dropped as noise, keeping only the surrounding prose
  s = s.replace(/<bibl[^>]*>[\s\S]*?<\/bibl>/g, '');
  s = s.replace(/<author>[\s\S]*?<\/author>/g, '');
  s = s.replace(/<lb\s*\/>/g, '<br>');
  s = s.replace(/<div[^>]*>/g, (m) => (m.includes('class="sense"') || m.includes('class="etym"') ? m : '<div>'));
  s = s.replace(/<p[^>]*>/g, '<p>');
  return sanitizeHtml(s.replace(/\s+/g, ' ').replace(/> </g, '><').trim());
}

// A short English gloss has to be heuristically pulled out of Lewis & Short's free prose (unlike
// Abbott-Smith, it has no dedicated <gloss> tag): the italicised (<hi rend="ital">) phrases in
// the entry's first sense are usually the plain-English meaning, but the very first one or two
// are often a grammatical note instead ("gen. plur.", "absol.") — filtered out by a blocklist of
// the abbreviations Lewis & Short actually uses for that, found by sampling real entries.
const GRAMMAR_NOTE = /^\(?(gen|dat|abl|acc|nom|voc|plur|sing|absol|trop|poet|lit|meton|prop|[123](st|d|rd)?\s*pers)\.?\b/i;
function shortGloss(firstSenseHtml) {
  const phrases = [...firstSenseHtml.matchAll(/<hi rend="ital">([\s\S]*?)<\/hi>/g)]
    .map((m) => unesc(m[1].replace(/<[^>]+>/g, '')).trim())
    .filter((p) => p && !GRAMMAR_NOTE.test(p) && p.length < 80);
  if (!phrases.length) return '';
  // the first phrase is sometimes one run of italics covering both the plain gloss and a
  // trailing usage note after a semicolon ("a word; plur.", i.e. "a word; [also used in the]
  // plur[al]") — real text found by inspection, not a hypothetical; only the part before the
  // semicolon is the gloss itself.
  // a leading comma is a real, if odd, feature of some entries' own TEI markup (the italic run
  // starts mid-sentence, right after a dropped <pos>/<gen> tag — e.g. "decerto": "v. n. and a.,
  // to go through…" splits its punctuation from its part-of-speech note that way in the source).
  const out = phrases[0].split(';')[0].replace(/^[,.\s]+/, '').replace(/[,.]$/, '').trim();
  return out.length > 3 && !GRAMMAR_NOTE.test(out) ? out : '';
}

// ---- Lewis & Short (TEI)
const tei = fs.readFileSync(path.join(root, 'data', 'lewis-short', 'lat.ls.perseus-eng2.xml'), 'utf8');
const byKey = new Map(); // exact key -> entry text (prefers type="main")
const byKeyLower = new Map(); // case-insensitive fallback
// entryFree's attributes are not in a fixed order — some homograph entries (sum2, sum3, …) carry
// an extra n="N" attribute BEFORE key, confirmed by direct inspection — so each is read by name,
// not by position, unlike Abbott-Smith's simpler <entry n="lemma|strong"> which build-lexicon-gr
// can parse positionally.
for (const m of tei.matchAll(/<entryFree\s+([^>]*)>([\s\S]*?)<\/entryFree>/g)) {
  const attrs = m[1];
  const keyRaw = (attrs.match(/key="([^"]*)"/) ?? [])[1];
  if (!keyRaw) continue;
  const key = unesc(keyRaw).normalize('NFC');
  const type = (attrs.match(/type="([^"]*)"/) ?? [])[1] ?? '';
  const body = m[2];
  const existing = byKey.get(key);
  if (!existing || (type === 'main' && existing.type !== 'main')) byKey.set(key, { type, body });
  const lk = key.toLowerCase();
  const existingLower = byKeyLower.get(lk);
  if (!existingLower || (type === 'main' && existingLower.type !== 'main')) byKeyLower.set(lk, { type, body });
}

/**
 * Lewis & Short disambiguates homograph headwords with a bare number suffixed directly onto the
 * key — "sum1" (the verb "to be"), "sum2" (an archaic form of eum) — rather than plain "sum",
 * confirmed by direct inspection: there is no key="sum" at all in the file. #1 is not always the
 * dominant sense (e.g. "de1" is a rare adverb and "de2" is the everyday preposition), but it is
 * L&S's own first-listed entry for the headword, which is the best default available without
 * hand-curating every homograph; PROIEL's own "#1"/"#2" lemma suffixes (its OWN homograph
 * disambiguation, e.g. "volo#1" the verb "to want" vs "volo#2" "to fly") are stripped first
 * since they are a different scheme with no relation to Lewis & Short's numbering.
 */
// L&S spells CONSONANTAL i as j (iudico/judico, iam/jam, ieiuno/jejuno — confirmed by
// inspection) wherever PROIEL spells it i; a plain global i->j replace over-fires on the
// ordinary vowel i's most Latin words also contain (iudico has one of each: the initial
// consonantal i and the vowel i of its "dico" root), so only an i adjacent to another vowel —
// at the start of the word before a vowel, or between two vowels — is folded, approximating the
// real rule closely enough to be useful without a full phonological analysis.
const CONSONANTAL_I = /(^|[aeiouAEIOU])([iI])(?=[aeiouAEIOU])/g;

/** A rough word class from the entry's own opening markup, for matching against PROIEL's pos. */
function classify(body) {
  const head = body.slice(0, 200);
  const pos = (head.match(/<pos>\s*([a-z.]+)/) ?? [])[1] ?? '';
  if (/^v\b/.test(pos)) return 'verb';
  if (/^adj/.test(pos)) return 'adj';
  if (/^adv/.test(pos)) return 'adv';
  if (/^prep/.test(pos)) return 'prep';
  if (/^conj/.test(pos)) return 'conj';
  if (/^pron/.test(pos)) return 'pron';
  if (/^num/.test(pos)) return 'num';
  if (/<gen>/.test(head)) return 'noun'; // nouns are marked by gender, not a <pos> tag
  return '';
}

/** Every numbered variant of a bare key that actually exists (liber -> liber1, liber2, liber4…). */
function variantsOf(bare) {
  const out = [];
  const plain = byKey.get(bare) ?? byKeyLower.get(bare.toLowerCase());
  if (plain) out.push(plain);
  for (let n = 1; n <= 9; n++) {
    const hit = byKey.get(bare + n) ?? byKeyLower.get(bare.toLowerCase() + n);
    if (hit) out.push(hit);
  }
  return out;
}

function lookup(lemma) {
  const bare = lemma.split('#')[0];
  const jForm = bare.replace(CONSONANTAL_I, (_, pre, i) => pre + (i === 'I' ? 'J' : 'j'));
  const wantClass = PROIEL_CLASS[lemmaPos[lemma]];
  for (const k of [bare, jForm]) {
    const variants = variantsOf(k);
    if (!variants.length) continue;
    if (wantClass) {
      const byClass = variants.find((v) => classify(v.body) === wantClass);
      if (byClass) return byClass;
    }
    return variants[0]; // no class match (or no PROIEL pos to match against): L&S's own first-listed sense
  }
  return undefined;
}

let matched = 0;
const entries = {};
for (const lemma of lemmas) {
  const hit = lookup(lemma);
  if (hit) matched++;
  const firstSense = hit ? (hit.body.match(/<sense level="1"[^>]*>[\s\S]*?(?=<sense level="1"|$)/) ?? [hit.body])[0] : '';
  const gloss = hit ? shortGloss(firstSense) : '';
  entries[lemma] = {
    l: lemma,
    g: gloss,
    gs: gloss ? 'ls' : undefined,
    ls: hit ? renderTei(hit.body) : undefined,
    n: (conc[lemma]?.length ?? 0) / 4,
  };
}
for (const e of Object.values(entries)) if (e.ls) assertSafe(e.ls, 'Lewis & Short ' + e.l);

// ---- shards by first letter (23 real ones for classical Latin — no need for Greek's
// split-by-second-letter growth, since this lexicon is bounded by the Vulgate NT's own vocabulary)
const shardOf = (lemma) => lemma.normalize('NFC').toLowerCase().replace(/[^a-z]/g, '')[0] || 'x';
const shards = {};
const concShards = {};
for (const [l, e] of Object.entries(entries)) {
  const k = shardOf(l);
  (shards[k] ??= {})[l] = e;
  (concShards[k] ??= {})[l] = conc[l];
}
for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(lexDir, `la-${k}.json`), JSON.stringify(v));
for (const [k, v] of Object.entries(concShards)) fs.writeFileSync(path.join(concDir, `la-${k}.json`), JSON.stringify(v));
fs.writeFileSync(path.join(lexDir, 'la-manifest.json'), JSON.stringify({ shards: Object.keys(shards).sort() }));
fs.writeFileSync(path.join(lexDir, 'la-index.json'), JSON.stringify(Object.values(entries).map((e) => [e.l, '', '', e.g, e.n, e.gs || ''])));
fs.writeFileSync(
  path.join(lexDir, 'la-SOURCES.json'),
  JSON.stringify(
    {
      lewisShort: { title: 'C.T. Lewis & C. Short, A Latin Dictionary (Oxford, 1879)', license: 'public domain; TEI transcription CC BY-SA 4.0', url: 'https://github.com/PerseusDL/lexica' },
    },
    null,
    2,
  ),
);
console.log(`Latin lexicon: ${lemmas.length} lemmas; Lewis & Short matched ${matched} (${((100 * matched) / lemmas.length).toFixed(1)}%); ${Object.keys(shards).length} shards`);
const missing = Object.values(entries).filter((e) => !e.ls).sort((a, b) => b.n - a.n).slice(0, 20);
console.log('most frequent lemmas without a Lewis & Short entry: ' + missing.map((e) => `${e.l}(${e.n})`).join(' '));
