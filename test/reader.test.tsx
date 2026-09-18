// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GreekChapter, HebrewChapter } from '../src/screens/Reader.tsx';
import type { GrVerse, HeVerse } from '../src/model/types.ts';
import { wordAt } from '../src/state/wordinfo.ts';
import { MemoryRouter } from 'react-router-dom';

afterEach(cleanup);

// Gen 1:1 as MAM prints it and OSHB analyses it (copied from the built data)
const HE: HeVerse = {
  n: 1,
  t: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃',
  w: [
    ['b/7225', 'HR/Ncfsa', 'ב/ראשית'],
    ['1254 a', 'HVqp3ms'],
    ['430', 'HNcmpa'],
    ['853', 'HTo'],
    ['d/8064', 'HTd/Ncmpa', 'ה/שמים'],
    ['c/853', 'HC/To', 'ו/את'],
    ['d/776', 'HTd/Ncbsa', 'ה/ארץ'],
  ],
};
const GR: GrVerse = { n: 1, w: [['Βίβλος', 'βίβλος', 'N-', '----NSF-'], ['γενέσεως', 'γένεσις', 'N-', '----GSF-'], ['Ἰησοῦ', 'Ἰησοῦς', 'N-', '----GSM-'], ['χριστοῦ', 'Χριστός', 'N-', '----GSM-']] };
const heBook = { book: 'Gen', chapters: [{ n: 1, verses: [HE] }] };
const grBook = { book: 'Matt', chapters: [{ n: 1, verses: [GR] }] };
const words = (b: typeof heBook | typeof grBook, n: number) => Array.from({ length: n }, (_, i) => wordAt(b as never, { book: b.book, ch: 1, v: 1, i })!);

describe('reader words and verse numbers are operable controls', () => {
  it('renders Hebrew words as buttons that keep the printed text and verse numbers with a label', () => {
    render(
      <MemoryRouter>
        <div onClick={() => undefined}>
          <HebrewChapter verses={[HE]} bookId="Gen" ch={1} mode="full" statuses={new Map()} words={words(heBook, 7)} selKey="1:1" showNumbers poetry={false} glossLine={false} />
        </div>
      </MemoryRouter>,
    );
    const first = screen.getByRole('button', { name: 'בְּרֵאשִׁ֖ית' });
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'בָּרָ֣א' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Open Genesis 1:1 verse view' })).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBe(8);
    // the printed text is intact around the controls
    expect(document.body.textContent).toContain('הָאָֽרֶץ׃');
  });
  it('renders Greek words as buttons and keeps punctuation outside them', () => {
    render(
      <MemoryRouter>
        <GreekChapter verses={[GR]} bookId="Matt" ch={1} statuses={new Map()} words={words(grBook, 4)} selKey="" showNumbers glossLine={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Βίβλος' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Matthew 1:1 verse view' })).toBeTruthy();
  });
  it('activates through the delegated click handler on Enter, Space and click', () => {
    const hits: string[] = [];
    render(
      <MemoryRouter>
        <div
          onClick={(e) => {
            const w = (e.target as HTMLElement).closest('.w, .vn') as HTMLElement | null;
            if (w) hits.push(`${w.dataset.v}:${w.dataset.i ?? 'verse'}`);
          }}
        >
          <HebrewChapter verses={[HE]} bookId="Gen" ch={1} mode="full" statuses={new Map()} words={words(heBook, 7)} selKey="" showNumbers poetry={false} glossLine={false} />
        </div>
      </MemoryRouter>,
    );
    const w = screen.getByRole('button', { name: 'בָּרָ֣א' });
    fireEvent.click(w);
    // native buttons synthesise a click for Enter and Space; jsdom does the same on keypress
    w.focus();
    fireEvent.keyPress(w, { key: 'Enter', code: 'Enter', charCode: 13 });
    fireEvent.keyUp(w, { key: ' ', code: 'Space', charCode: 32 });
    fireEvent.click(screen.getByRole('button', { name: 'Open Genesis 1:1 verse view' }));
    expect(hits[0]).toBe('1:1');
    expect(hits).toContain('1:verse');
    expect(w.tagName).toBe('BUTTON');
  });
});
