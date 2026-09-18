// Explicit versification map: where our base texts (MAM = Masoretic numbering; SBLGNT) number
// verses differently from the English tradition the Berean Standard Bible follows.
// Every rule is reviewable here; the BSB build aligns each base verse only against the English
// verse(s) it maps to. Sources: the standard MT/English concordance tables (e.g. the appendix
// to BHS-based study Bibles), checked against the verse counts of both editions in the build.
//
// Rule shapes (base = our text, en = BSB numbering):
//   { book, base: [ch, from, to], en: [ch, from] }   base ch:from..to ↔ en ch:from.. (one to one, in order)
//   { book, base: [ch, v], en: [ch, v] }             a single verse mapped onto one English verse (shared)
//   { book, base: [ch, v], enRange: [[ch, v], [ch, v]] }  a single verse spread over an English range
export const RULES = [
  { book: 'Gen', base: [32, 1], en: [31, 55] },
  { book: 'Gen', base: [32, 2, 33], en: [32, 1] },
  { book: 'Exod', base: [7, 26, 29], en: [8, 1] },
  { book: 'Exod', base: [8, 1, 28], en: [8, 5] },
  { book: 'Exod', base: [21, 37], en: [22, 1] },
  { book: 'Exod', base: [22, 1, 30], en: [22, 2] },
  { book: 'Lev', base: [5, 20, 26], en: [6, 1] },
  { book: 'Lev', base: [6, 1, 23], en: [6, 8] },
  { book: 'Num', base: [17, 1, 15], en: [16, 36] },
  { book: 'Num', base: [17, 16, 28], en: [17, 1] },
  { book: 'Num', base: [25, 19], en: [26, 1] },
  { book: 'Num', base: [30, 1], en: [29, 40] },
  { book: 'Num', base: [30, 2, 17], en: [30, 1] },
  { book: 'Deut', base: [13, 1], en: [12, 32] },
  { book: 'Deut', base: [13, 2, 19], en: [13, 1] },
  { book: 'Deut', base: [23, 1], en: [22, 30] },
  { book: 'Deut', base: [23, 2, 26], en: [23, 1] },
  { book: 'Deut', base: [28, 69], en: [29, 1] },
  { book: 'Deut', base: [29, 1, 28], en: [29, 2] },
  { book: '1Sam', base: [21, 1], en: [20, 42] },
  { book: '1Sam', base: [21, 2, 16], en: [21, 1] },
  { book: '1Sam', base: [24, 1], en: [23, 29] },
  { book: '1Sam', base: [24, 2, 23], en: [24, 1] },
  { book: '2Sam', base: [19, 1], en: [18, 33] },
  { book: '2Sam', base: [19, 2, 44], en: [19, 1] },
  { book: '1Kgs', base: [5, 1, 14], en: [4, 21] },
  { book: '1Kgs', base: [5, 15, 32], en: [5, 1] },
  { book: '1Kgs', base: [22, 44], en: [22, 43] },
  { book: '1Kgs', base: [22, 45, 54], en: [22, 44] },
  { book: '2Kgs', base: [12, 1], en: [11, 21] },
  { book: '2Kgs', base: [12, 2, 22], en: [12, 1] },
  { book: '1Chr', base: [5, 27, 41], en: [6, 1] },
  { book: '1Chr', base: [6, 1, 66], en: [6, 16] },
  { book: '1Chr', base: [12, 5], en: [12, 4] },
  { book: '1Chr', base: [12, 6, 41], en: [12, 5] },
  { book: '2Chr', base: [1, 18], en: [2, 1] },
  { book: '2Chr', base: [2, 1, 17], en: [2, 2] },
  { book: '2Chr', base: [13, 23], en: [14, 1] },
  { book: '2Chr', base: [14, 1, 14], en: [14, 2] },
  // the Decalogue: MAM (Aleppo) divides Exod 20 and Deut 5 by the upper accentuation (23 / 30 verses)
  // where the English tradition has 26 / 33; the whole chapter is one passage in both
  { book: 'Exod', chapter: 20, en: 20 },
  { book: 'Deut', chapter: 5, en: 5 },
  { book: 'Neh', base: [3, 33, 38], en: [4, 1] },
  { book: 'Neh', base: [10, 1], en: [9, 38] },
  { book: 'Neh', base: [10, 2, 40], en: [10, 1] },
  { book: 'Neh', base: [4, 1, 17], en: [4, 7] },
  { book: 'Neh', base: [7, 68, 72], en: [7, 69] },
  { book: 'Job', base: [40, 25, 32], en: [41, 1] },
  { book: 'Job', base: [41, 1, 26], en: [41, 9] },
  // Psalm 13: title offset of one and the last Masoretic verse split into English 5–6 (equal verse counts, so the title rule cannot see it)
  { book: 'Ps', base: [13, 1], en: [13, 1] },
  { book: 'Ps', base: [13, 2, 5], en: [13, 1] },
  { book: 'Ps', base: [13, 6], enRange: [[13, 5], [13, 6]] },
  { book: 'Eccl', base: [4, 17], en: [5, 1] },
  { book: 'Eccl', base: [5, 1, 19], en: [5, 2] },
  { book: 'Song', base: [7, 1], en: [6, 13] },
  { book: 'Song', base: [7, 2, 14], en: [7, 1] },
  { book: 'Isa', base: [8, 23], en: [9, 1] },
  { book: 'Isa', base: [9, 1, 20], en: [9, 2] },
  { book: 'Isa', base: [63, 19], enRange: [[63, 19], [64, 1]] },
  { book: 'Isa', base: [64, 1, 11], en: [64, 2] },
  { book: 'Jer', base: [8, 23], en: [9, 1] },
  { book: 'Jer', base: [9, 1, 25], en: [9, 2] },
  { book: 'Ezek', base: [21, 1, 5], en: [20, 45] },
  { book: 'Ezek', base: [21, 6, 37], en: [21, 1] },
  { book: 'Dan', base: [3, 31, 33], en: [4, 1] },
  { book: 'Dan', base: [4, 1, 34], en: [4, 4] },
  { book: 'Dan', base: [6, 1], en: [5, 31] },
  { book: 'Dan', base: [6, 2, 29], en: [6, 1] },
  { book: 'Hos', base: [2, 1, 2], en: [1, 10] },
  { book: 'Hos', base: [2, 3, 25], en: [2, 1] },
  { book: 'Hos', base: [12, 1], en: [11, 12] },
  { book: 'Hos', base: [12, 2, 15], en: [12, 1] },
  { book: 'Hos', base: [14, 1], en: [13, 16] },
  { book: 'Hos', base: [14, 2, 10], en: [14, 1] },
  { book: 'Joel', base: [3, 1, 5], en: [2, 28] },
  { book: 'Joel', base: [4, 1, 21], en: [3, 1] },
  { book: 'Jonah', base: [2, 1], en: [1, 17] },
  { book: 'Jonah', base: [2, 2, 11], en: [2, 1] },
  { book: 'Mic', base: [4, 14], en: [5, 1] },
  { book: 'Mic', base: [5, 1, 14], en: [5, 2] },
  { book: 'Nah', base: [2, 1], en: [1, 15] },
  { book: 'Nah', base: [2, 2, 14], en: [2, 1] },
  { book: 'Zech', base: [2, 1, 4], en: [1, 18] },
  { book: 'Zech', base: [2, 5, 17], en: [2, 1] },
  { book: 'Mal', base: [3, 19, 24], en: [4, 1] },
  // Greek: SBLGNT vs the English tradition
  { book: 'Acts', base: [19, 40], enRange: [[19, 40], [19, 41]] },
  { book: '2Cor', base: [13, 12], enRange: [[13, 12], [13, 13]] },
  { book: '2Cor', base: [13, 13], en: [13, 14] },
  { book: '3John', base: [1, 15], en: [1, 14] },
  { book: 'Rev', base: [12, 18], enRange: [[12, 17], [13, 1]] },
];

/**
 * Psalm titles: MAM counts the superscription as verse 1 (or 1–2), the BSB prints it inside
 * verse 1. `offset` = MAM verses − BSB verses for that psalm (0, 1 or 2), supplied by the build.
 */
export function psalmMap(ch, v, offset) {
  if (offset <= 0) return null;
  if (v <= offset) return { from: [ch, 1], to: [ch, 1] };
  const en = v - offset;
  return { from: [ch, en], to: [ch, en] };
}

/** The English range [from, to] (inclusive, [ch, v] pairs) for a base verse, or null for identity. */
export function englishRange(book, ch, v, opts = {}) {
  for (const r of RULES) {
    if (r.book !== book) continue;
    // a whole chapter treated as one passage (verse divisions differ inside it)
    if (r.chapter !== undefined) {
      if (r.chapter === ch) return { from: [r.en, 1], to: [r.en, 999], rule: r };
      continue;
    }
    if (r.base[0] !== ch) continue;
    if (r.base.length === 3) {
      const [, from, to] = r.base;
      if (v >= from && v <= to) {
        const e = [r.en[0], r.en[1] + (v - from)];
        return { from: e, to: e, rule: r };
      }
    } else if (r.base[1] === v) {
      if (r.enRange) return { from: r.enRange[0], to: r.enRange[1], rule: r };
      return { from: r.en, to: r.en, rule: r };
    }
  }
  if (book === 'Ps' && opts.psalmOffset) {
    const m = psalmMap(ch, v, opts.psalmOffset);
    if (m) return { ...m, rule: 'psalm-title' };
  }
  return null;
}
