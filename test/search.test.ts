import { describe, expect, it } from 'vitest';
import type { IndexRow } from '../src/data/lexicon.ts';
import { searchLexicon, toGreekSearchRows, toHebrewSearchRows, wordUrl } from '../src/state/search.ts';

const HE: IndexRow[] = [
  ['1697', 'דָּבָר', 'dâbâr', 'word', 1440],
  ['1696', 'דָּבַר', 'dâbar', 'to speak', 1140],
  ['7225', 'רֵאשִׁית', 'rêʼshîyth', 'beginning', 51],
  ['1254 a', 'בָּרָא', 'bârâʼ', 'shape', 48],
];
const GR: IndexRow[] = [
  ['λόγος', 'G3056', 'lógos', 'a word, speech', 330],
  ['λέγω', 'G3004', 'légō', 'I say, speak', 2350],
  ['βίβλος', 'G976', 'bíblos', 'a written book', 10],
  ['ὁ', 'G3588', 'ho', 'the', 19770],
];
const rows = [...toHebrewSearchRows(HE), ...toGreekSearchRows(GR)];

describe('lexicon search', () => {
  it('models the language explicitly', () => {
    expect(rows.every((r) => r.lang === 'he' || r.lang === 'gr')).toBe(true);
    expect(rows.find((r) => r.id === 'λόγος')?.strong).toBe('G3056');
    expect(rows.find((r) => r.id === '1254 a')?.strong).toBe('H1254');
  });
  it('matches Hebrew lemmas by consonants', () => {
    const r = searchLexicon(rows, 'דבר');
    expect(r.map((x) => x.id)).toEqual(['1697', '1696']);
    expect(r.every((x) => x.lang === 'he')).toBe(true);
    expect(searchLexicon(rows, 'בראשית')[0]?.lemma).toBe('רֵאשִׁית');
  });
  it('matches Greek lemmas ignoring accents', () => {
    const r = searchLexicon(rows, 'λόγος');
    expect(r[0].id).toBe('λόγος');
    expect(r.every((x) => x.lang === 'gr')).toBe(true);
    expect(searchLexicon(rows, 'λογ').map((x) => x.id)).toEqual(['λόγος']);
  });
  it("matches Strong's numbers in one language, or both for a bare number", () => {
    expect(searchLexicon(rows, 'H1697').map((x) => x.id)).toEqual(['1697']);
    expect(searchLexicon(rows, 'G3056').map((x) => x.id)).toEqual(['λόγος']);
    expect(searchLexicon(rows, 'H3056')).toEqual([]);
    expect(searchLexicon(rows, 'G1697')).toEqual([]);
    const both = searchLexicon(rows, '976');
    expect(both.map((x) => `${x.lang}:${x.id}`)).toEqual(['gr:βίβλος']);
    const h = searchLexicon(rows, '1254');
    expect(h.map((x) => x.id)).toEqual(['1254 a']);
  });
  it('matches English glosses and transliterations across both languages', () => {
    const r = searchLexicon(rows, 'word');
    expect(r.map((x) => x.id)).toEqual(['1697', 'λόγος']);
    expect(searchLexicon(rows, 'lóg').map((x) => x.id)).toEqual(['λόγος']);
  });
  it('filters by language without collapsing valid results', () => {
    expect(searchLexicon(rows, 'word', 'he').map((x) => x.id)).toEqual(['1697']);
    expect(searchLexicon(rows, 'word', 'gr').map((x) => x.id)).toEqual(['λόγος']);
    expect(searchLexicon(rows, 'speak', 'gr').map((x) => x.id)).toEqual(['λέγω']);
    expect(searchLexicon(rows, 'speak', 'he').map((x) => x.id)).toEqual(['1696']);
  });
  it('builds word links with the language segment', () => {
    expect(wordUrl(rows[0])).toBe('/word/he/1697');
    expect(wordUrl(rows.find((r) => r.id === '1254 a')!)).toBe('/word/he/1254%20a');
    expect(wordUrl(rows.find((r) => r.id === 'λόγος')!)).toBe('/word/gr/%CE%BB%CF%8C%CE%B3%CE%BF%CF%82');
    for (const r of rows) expect(wordUrl(r)).toMatch(/^\/word\/(he|gr)\//);
  });
});

describe('English ranking', () => {
  it('puts the frequent lemma whose gloss opens with the word above rare exact matches', () => {
    const list = toHebrewSearchRows([['3983', 'מֵאמַר', 'mêʼmar', 'word', 2], ['1697', 'דָּבָר', 'dâbâr', 'word, speech, thing, matter', 1440], ['1703', 'דַּבָּרָה', 'dabbârâh', 'word', 1], ['4405', 'מִלָּה', 'millâh', 'a word, speech', 38]]);
    const r = searchLexicon(list, 'word', 'he').map((x) => x.id);
    expect(r).toEqual(['3983', '1703', '1697', '4405']); // exact glosses (by frequency), then a gloss opening with the word, then the rest
  });
});
