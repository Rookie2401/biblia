// The complete Brown-Driver-Briggs (1906, public domain) as served by Sefaria, from two crawls:
//   data/bdb-sefaria/<rid>.json  — lexicon API entries (nested senses + Strong's numbers; fetch-bdb*.mjs)
//   data/bdb-texts/<index>/*.json — text-index entries (flat HTML, every headword; fetch-bdb3.mjs)
// Renders entries to the app's small HTML subset and picks the best entry for an OSHB lemma id:
// by Strong's number first (lexicon API), then by consonantal headword (text index).
import fs from 'node:fs';
import path from 'node:path';

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
  return senses(content.senses || []).replace(/\s+/g, ' ');
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
        out.push({ rid: e.ref, hw: stripSup(e.hw), cons: cons(e.hw), strongs: new Set(), aramaic, html: '<div class="sense">' + inline(e.html).replace(/\s+/g, ' ') + '</div>', root: false, source: 'texts' });
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
  return function sefariaFor(num, lemma, aramaic) {
    const lc = cons(lemma);
    const c = byStrong.get(String(num)) || [];
    if (c.length) {
      const ranked = c.map((e) => ({ e, score: (e.cons === lc ? 4 : 0) + (e.aramaic === aramaic ? 2 : 0) + (e.strongs.size <= 2 ? 1 : 0) })).sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (best.score >= 4 || best.e.strongs.size <= 3) return best.e;
    }
    if (!lc) return undefined;
    // exact consonants, else the same skeleton with the vowel letters ו/י removed (אַהֲרוֹן / אַהֲרֹן)
    let h = byCons.get(lc) || [];
    if (!h.length) h = byBare.get(bare(lc)) || [];
    if (!h.length) return undefined;
    // prefer the words-API entry (structured), then language, then the entry without a homograph number
    const ranked = h.map((e) => ({ e, score: (e.aramaic === aramaic ? 4 : 0) + (e.source === 'words' ? 2 : 0) + (e.strongs.size === 0 ? 1 : 0) })).sort((a, b) => b.score - a.score);
    return ranked[0].e;
  };
}
