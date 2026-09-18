import { describe, expect, it } from 'vitest';
import { decode, encodingLines, morphLine } from '../src/morph/greek.ts';
import { greekBase, greekNumeral, splitPrinted } from '../src/text/greek.ts';

describe('Greek text helpers', () => {
  it('separates punctuation from the printed word', () => {
    expect(splitPrinted('θεός.')).toEqual({ lead: '', word: 'θεός', trail: '.' });
    expect(splitPrinted('⟦Ὁ')).toEqual({ lead: '⟦', word: 'Ὁ', trail: '' });
    expect(splitPrinted('λόγος,')).toEqual({ lead: '', word: 'λόγος', trail: ',' });
    expect(splitPrinted('αὐτοῦ·')).toEqual({ lead: '', word: 'αὐτοῦ', trail: '·' });
  });
  it('normalises for comparison', () => {
    expect(greekBase('Λόγος')).toBe('λογοσ');
    expect(greekBase('ἀγάπη')).toBe('αγαπη');
  });
  it('writes Greek numerals', () => {
    expect(greekNumeral(1)).toBe('αʹ');
    expect(greekNumeral(16)).toBe('ιϛʹ');
    expect(greekNumeral(28)).toBe('κηʹ');
    expect(greekNumeral(150)).toBe('ρνʹ');
  });
});

describe('MorphGNT parsing', () => {
  it('decodes a finite verb', () => {
    const m = decode(['ἐγέννησεν', 'γεννάω', 'V-', '3AAI-S--']);
    expect(m.pos).toBe('verb');
    expect(morphLine(m)).toBe('verb · aorist · active · indicative · 3rd singular');
    expect(encodingLines(m, 'ἐγέννησεν').map((l) => l.title)).toEqual(['Stem', 'Mood', 'Ending']);
  });
  it('decodes a participle and a noun', () => {
    const p = decode(['λέγων', 'λέγω', 'V-', '-PAPNSM-']);
    expect(p.features).toBe('present · active · participle · nominative singular masculine');
    const n = decode(['Βίβλος', 'βίβλος', 'N-', '----NSF-']);
    expect(morphLine(n)).toBe('noun · nominative singular feminine');
    const a = decode(['καί', 'καί', 'C-']);
    expect(morphLine(a)).toBe('conjunction');
  });
});
