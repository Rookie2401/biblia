// The complete Brown-Driver-Briggs (1906, public domain) as served by Sefaria, from two crawls:
//   data/bdb-sefaria/<rid>.json  — lexicon API entries (nested senses + Strong's numbers; fetch-bdb*.mjs)
//   data/bdb-texts/<index>/*.json — text-index entries (flat HTML, every headword; fetch-bdb3.mjs)
// Renders entries to the app's small HTML subset and picks the best entry for an OSHB lemma id:
// by Strong's number first (lexicon API), then by consonantal headword (text index).
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeHtml } from './sanitize-html.mjs';

const SEFARIA_BOOKS = { Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut', Joshua: 'Josh', Judges: 'Judg', 'I Samuel': '1Sam', 'II Samuel': '2Sam', 'I Kings': '1Kgs', 'II Kings': '2Kgs', Isaiah: 'Isa', Jeremiah: 'Jer', Ezekiel: 'Ezek', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad', Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph', Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal', Psalms: 'Ps', Proverbs: 'Prov', Job: 'Job', 'Song of Songs': 'Song', Ruth: 'Ruth', Lamentations: 'Lam', Ecclesiastes: 'Eccl', Esther: 'Esth', Daniel: 'Dan', Ezra: 'Ezra', Nehemiah: 'Neh', 'I Chronicles': '1Chr', 'II Chronicles': '2Chr' };

export const cons = (w) => w.normalize('NFC').replace(/[֑-ׇ͏]/g, '').replace(/[^א-ת]/g, '');
const stripSup = (hw) => hw.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '').trim();

/** Sefaria's inline HTML -> ours: scripture links become data-ref (OSIS), other links plain spans. */
export function inline(def) {
  let s = def;
  s = s.replace(/<a data-ref="([^"]+)" href="[^"]*">([\s\S]*?)<\/a>/g, (m, ref, txt) => {
    const mm = ref.match(/^(.+?) (\d+)(?::(\d+))?(?:-\d+)?$/);
    const id = mm && SEFARIA_BOOKS[mm[1]];
    return id ? `<a data-ref="${id}.${mm[2]}${mm[3] ? '.' + mm[3] : ''}">${txt}</a>` : `<span>${txt}</span>`;
  });
  s = s.replace(/<a [^>]*>([\s\S]*?)<\/a>/g, '<span>$1</span>');
  s = s.replace(/<big><big><span dir="rtl">([\s\S]*?)<\/span><\/big><\/big>/g, '<b class="he-inline">$1</b>');
  s = s.replace(/<span dir="rtl">/g, '<span class="he-inline">');
  s = s.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
  s = s.replace(/<\/?(?!(b|i|em|span|div|a|br|sup|sub)\b)[a-zA-Z][^>]*>/g, '');
  return s;
}

export function renderSefaria(content) {
  const senses = (sn) => sn.map((s) => `<div class="sense">${s.number ? `<span class="n">${s.number}</span> ` : ''}${inline(s.definition || '')}${s.senses ? senses(s.senses) : ''}</div>`).join('');
  return sanitizeHtml(senses(content.senses || []).replace(/\s+/g, ' '));
}

/** Load every crawled entry from both crawls. */
export function loadSefariaBdb(dir, textsDir) {
  const out = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!e.content?.senses?.length) continue;
      out.push({ rid: e.rid, hw: stripSup(e.headword), cons: cons(e.headword), strongs: new Set((e.strong_numbers || []).map(String)), aramaic: e.parent_lexicon === 'BDB Aramaic Dictionary', html: renderSefaria(e.content), root: !!e.root, source: 'words' });
    }
  }
  if (textsDir && fs.existsSync(textsDir)) {
    for (const index of fs.readdirSync(textsDir)) {
      const d = path.join(textsDir, index);
      if (!fs.statSync(d).isDirectory()) continue;
      const aramaic = /Aramaic/.test(index);
      for (const f of fs.readdirSync(d)) {
        if (!f.endsWith('.json')) continue;
        const e = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
        if (!e.html) continue;
        out.push({ rid: e.ref, hw: stripSup(e.hw), cons: cons(e.hw), strongs: new Set(), aramaic, html: sanitizeHtml('<div class="sense">' + inline(e.html).replace(/\s+/g, ' ') + '</div>'), root: false, source: 'texts' });
      }
    }
  }
  return out;
}

export function sefariaIndex(entries) {
  const byStrong = new Map();
  const byCons = new Map();
  const byBare = new Map();
  const bare = (c) => c.replace(/[וי]/g, '');
  for (const e of entries) {
    for (const n of e.strongs) (byStrong.get(n) || byStrong.set(n, []).get(n)).push(e);
    (byCons.get(e.cons) || byCons.set(e.cons, []).get(e.cons)).push(e);
    if (e.cons.length >= 3) (byBare.get(bare(e.cons)) || byBare.set(bare(e.cons), []).get(bare(e.cons))).push(e);
  }
  /**
   * Best full entry for a lemma id: same Strong's number, preferring a matching headword and the
   * right language; otherwise the text-index entry with the same consonantal headword.
   */
  /** Does the entry's opening (BDB's part-of-speech abbreviation) agree with the corpus part of speech? +1 / −1 / 0 when unknown. */
  const posFit = (e, pos) => {
    if (!pos) return 0;
    const head = e.html.replace(/<[^>]+>/g, ' ').slice(0, 120);
    const isVerb = /\bvb\b/.test(head);
    const isName = /\bn\.pr\b/.test(head);
    const isNoun = /\bn\.(?!pr)|\bsubst\b/.test(head) && !isName;
    const isAdj = /\badj\b/.test(head);
    if (pos === 'verb') return isVerb ? 1 : isName || isNoun || isAdj ? -1 : 0;
    if (pos === 'proper noun' || pos === 'gentilic') return isName ? 1 : isVerb ? -1 : 0;
    if (pos === 'noun') return isNoun ? 1 : isVerb || isName ? -1 : 0;
    if (pos === 'adjective') return isAdj ? 1 : isVerb || isName ? -1 : 0;
    return isVerb ? -1 : 0;
  };
  /** +1 per distinctive word of the short gloss found in the entry's opening (separates homographs under one number). */
  const hintFit = (e, hint) => {
    if (!hint) return 0;
    const head = e.html.replace(/<[^>]+>/g, ' ').slice(0, 200).toLowerCase();
    const STOP = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'into', 'upon', 'over', 'make', 'thing', 'one', 'who', 'which', 'for', 'self', 'yourself', 'himself', 'not', 'off', 'out', 'act', 'being']);
    const keys = hint.toLowerCase().split(/[^a-z]+/).filter((k) => k.length >= 3 && !STOP.has(k));
    return keys.filter((k) => new RegExp(`\\b${k}`).test(head)).length;
  };
  return function sefariaFor(num, lemma, aramaic, { strict = false, pos = '', hint = '' } = {}) {
    const lc = cons(lemma);
    const c = byStrong.get(String(num)) || [];
    if (c.length) {
      const ranked = c.map((e) => ({ e, score: (e.cons === lc ? 4 : 0) + (e.aramaic === aramaic ? 2 : 0) + (e.strongs.size <= 2 ? 1 : 0) + 2 * posFit(e, pos) + hintFit(e, hint) })).sort((a, b) => b.score - a.score);
      const best = ranked[0];
      // strict: the headword itself must match (an augmented id naming a different word than the number's headword)
      if (best.score >= 4 && posFit(best.e, pos) >= 0 && (!strict || best.e.cons === lc)) return best.e;
      if (!strict && best.e.strongs.size <= 3 && posFit(best.e, pos) >= 0) return best.e;
    }
    if (!lc) return undefined;
    // exact consonants, else the same skeleton with the vowel letters ו/י removed (אַהֲרוֹן / אַהֲרֹן)
    let h = byCons.get(lc) || [];
    if (!h.length && !strict) h = byBare.get(bare(lc)) || [];
    // strict: never an entry that belongs to another Strong's number (אתִּי is not Ittai)
    if (strict) h = h.filter((e) => e.strongs.size === 0 || e.strongs.has(String(num)));
    h = h.filter((e) => posFit(e, pos) >= 0);
    if (!h.length) return undefined;
    // prefer an entry linked to this number, then the right kind of word, then the words-API entry (structured), then language
    const ranked = h.map((e) => ({ e, score: (e.strongs.has(String(num)) ? 6 : 0) + 3 * posFit(e, pos) + (e.aramaic === aramaic ? 4 : 0) + (e.source === 'words' ? 2 : 0) + (e.strongs.size === 0 ? 1 : 0) })).sort((a, b) => b.score - a.score);
    return ranked[0].e;
  };
}
