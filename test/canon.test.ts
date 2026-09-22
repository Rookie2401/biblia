import { describe, expect, it } from 'vitest';
import { CANON, adjacentChapter, book, parseRef, refLabel, validRef } from '../src/text/canon.ts';

describe('canon', () => {
  it('has 66 books (39 Tanakh + 27 NT) with verse counts from the data — the Septuagint and Vulgate live in Vetus, not here', () => {
    expect(CANON.length).toBe(66);
    expect(book('Gen')?.verses.length).toBe(50);
    expect(book('Gen')?.verses[0]).toBe(31);
    expect(book('Ps')?.verses.length).toBe(150);
    expect(book('Rev')?.verses.length).toBe(22);
    expect(book('Matt')?.lang).toBe('gr');
    expect(book('GenLxx')).toBeUndefined();
    expect(book('MattVulg')).toBeUndefined();
    expect(CANON.every((b) => b.lang === 'he' || b.lang === 'gr')).toBe(true);
  });
  it('walks chapters across books within a testament only', () => {
    expect(adjacentChapter('Gen', 50, 1)).toEqual({ book: 'Exod', ch: 1 });
    expect(adjacentChapter('Exod', 1, -1)).toEqual({ book: 'Gen', ch: 50 });
    expect(adjacentChapter('2Chr', 36, 1)).toBeNull();
    expect(adjacentChapter('Matt', 1, -1)).toBeNull();
    expect(adjacentChapter('Jude', 1, 1)).toEqual({ book: 'Rev', ch: 1 });
    expect(adjacentChapter('Rev', 22, 1)).toBeNull();
  });
  it('refuses to step from an invalid chapter', () => {
    expect(adjacentChapter('Gen', 999, 1)).toBeNull();
    expect(adjacentChapter('Gen', 0, -1)).toBeNull();
    expect(adjacentChapter('Gen', 1.5, 1)).toBeNull();
    expect(adjacentChapter('Nope', 1, 1)).toBeNull();
    expect(adjacentChapter('Gen', 50, 1)).toEqual({ book: 'Exod', ch: 1 });
    expect(adjacentChapter('Exod', 1, -1)).toEqual({ book: 'Gen', ch: 50 });
  });
  it('validates references', () => {
    expect(validRef('Gen', 1, 31)).toBe(true);
    expect(validRef('Gen', 1, 32)).toBe(false);
    expect(validRef('Gen', 999)).toBe(false);
    expect(validRef('Gen', 1)).toBe(true);
    expect(validRef('Nope', 1)).toBe(false);
  });
  it('parses references', () => {
    expect(parseRef('Gen 1:1')).toEqual({ book: 'Gen', ch: 1, v: 1 });
    expect(parseRef('1 Kings 3')).toEqual({ book: '1Kgs', ch: 3, v: undefined });
    expect(parseRef('john 3.16')).toEqual({ book: 'John', ch: 3, v: 16 });
    expect(parseRef('Song of Songs 2:1')).toEqual({ book: 'Song', ch: 2, v: 1 });
    expect(parseRef('Ps 151')).toBeNull();
    expect(parseRef('λόγος')).toBeNull();
    expect(refLabel('1Sam', 3, 4)).toBe('1 Samuel 3:4');
  });
});
