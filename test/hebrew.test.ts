import { describe, expect, it } from 'vitest';
import { decode, encodingLines, segments } from '../src/morph/hebrew.ts';
import { contentWords, hebrewNumeral, skeleton, splitByLetters, toConsonants, toNiqqud } from '../src/text/hebrew.ts';
import type { HeTok } from '../src/model/types.ts';

// Gen 1:1 as MAM prints it (copied from the built data, never hand-typed)
const GEN11 = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';

describe('Hebrew text helpers', () => {
  it('splits a verse into maqaf-split content words', () => {
    expect(contentWords(GEN11).length).toBe(7);
    expect(contentWords('אַ֥שְֽׁרֵי־הָאִ֗ישׁ אֲשֶׁ֤ר ׀ לֹ֥א').length).toBe(4);
  });
  it('derives views without touching the source', () => {
    const c = toConsonants(GEN11);
    expect(c).toBe('בראשית ברא אלהים את השמים ואת הארץ׃');
    expect(toNiqqud(GEN11)).not.toContain('֖');
    expect(skeleton('הָאָֽרֶץ׃')).toBe('הארץ');
  });
  it('cuts a pointed word at letter counts, keeping marks with their letters', () => {
    const w = contentWords(GEN11)[0];
    const parts = splitByLetters(w, [1, 5]);
    expect(parts).not.toBeNull();
    expect(parts!.join('')).toBe(w);
    expect(skeleton(parts![0])).toBe('ב');
    expect(splitByLetters(w, [2, 2])).toBeNull();
  });
  it('writes Hebrew numerals', () => {
    expect(hebrewNumeral(1)).toBe('א');
    expect(hebrewNumeral(15)).toBe('טו');
    expect(hebrewNumeral(119)).toBe('קיט');
    expect(hebrewNumeral(150)).toBe('קנ');
  });
});

describe('OSHB morphology', () => {
  it('decodes a verb', () => {
    const m = decode(['1254 a', 'HVqp3ms']);
    expect(m.pos).toBe('verb');
    expect(m.stem).toBe('Qal');
    expect(m.vtype).toBe('perfect');
    expect(m.pgn).toBe('3ms');
    expect(m.features).toBe('Qal · perfect · 3ms');
  });
  it('decodes prefixes, a noun and a suffix', () => {
    const tok: HeTok = ['c/b/1870', 'HC/R/Ncbsc/Sp3ms', 'ו/ב/דרכ/ו'];
    const m = decode(tok);
    expect(m.prefixes.map((p) => p.code)).toEqual(['c', 'b']);
    expect(m.pos).toBe('noun');
    expect(m.state).toBe('construct');
    expect(m.suffix?.pgn).toBe('3ms');
    const segs = segments(tok, 'וּבְדַרְכּוֹ', m);
    expect(segs.map((s) => s.kind)).toEqual(['conjunction', 'preposition', 'stem', 'suffix-pronoun']);
    expect(segs.map((s) => s.form).join('')).toBe('וּבְדַרְכּוֹ');
    const lines = encodingLines(m, segs);
    expect(lines.map((l) => l.title)).toEqual(['Prefixes', 'Stem', 'Ending']);
  });
  it('decodes the article fused with a preposition and Aramaic', () => {
    const m = decode(['b/8064', 'HRd/Ncmpa', 'ב/שמים']);
    expect(m.featureList).toContain('with the article');
    const a = decode(['1934', 'AVqp3ms']);
    expect(a.lang).toBe('Aramaic');
    expect(a.stem).toBe('Peʿal');
  });
  it('explains wayyiqtol', () => {
    const tok: HeTok = ['c/559', 'HC/Vqw3ms', 'ו/יאמר'];
    const m = decode(tok);
    expect(m.vtype).toBe('sequential imperfect');
    const segs = segments(tok, 'וַיֹּ֥אמֶר', m);
    const lines = encodingLines(m, segs);
    expect(lines.find((l) => l.title === 'Stem')?.text).toContain('Wayyiqtol');
  });
});
