// @vitest-environment jsdom
// content audit 6: WordCard's main word-change effect reset entry/context/history/concordance but
// never reset `lex`. Moving from word A (with a real vocabulary record) to word B left A's status
// — and, since the status picker writes by lex.key, A's key — attached to B's card while B's own
// lookup was pending, or indefinitely if it failed or B has no vocabulary key at all.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lexeme } from '../src/model/types.ts';
import type { WordInfo } from '../src/state/wordinfo.ts';

const notFound = (): Response => new Response('', { status: 404 });
const noop = () => undefined;

const infoA: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'A', form: 'A', lexId: '1697', key: 'he:1697' };
const infoB: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'B', form: 'B', lexId: '1254 a', key: 'he:1254 a' };
const infoNoKey: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'C', form: 'C' }; // no lexId/key at all

const lexA: Lexeme = { key: 'he:1697', lang: 'he', status: 'known' } as Lexeme;

function renderCard() {
  return render(
    <MemoryRouter>
      <WordCardComp info={infoA} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
    </MemoryRouter>,
  );
}
let WordCardComp: typeof import('../src/components/WordCard.tsx')['WordCard'];

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound()))); // no lexicon entry needed
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WordCard resets the previous word\'s vocabulary record when the word changes', () => {
  it('does not show word A\'s "known" status on word B while B\'s own lookup is still pending', async () => {
    let resolveB!: (lx: Lexeme | undefined) => void;
    const bPending = new Promise<Lexeme | undefined>((r) => (resolveB = r));
    vi.doMock('../src/db/db.ts', () => ({
      db: { lexemes: { get: vi.fn((key: string) => (key === 'he:1697' ? Promise.resolve(lexA) : bPending)) } },
    }));
    WordCardComp = (await import('../src/components/WordCard.tsx')).WordCard;
    const { rerender } = renderCard();
    await screen.findByText('known'); // A's real status shows

    rerender(
      <MemoryRouter>
        <WordCardComp info={infoB} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
      </MemoryRouter>,
    );
    await screen.findByText('B');

    // while B's own lookup is still pending, A's status must already be gone
    expect(screen.queryByText('known')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    resolveB(undefined);
  });

  it('does not keep word A\'s status if word B\'s own lookup fails', async () => {
    vi.doMock('../src/db/db.ts', () => ({
      db: { lexemes: { get: vi.fn((key: string) => (key === 'he:1697' ? Promise.resolve(lexA) : Promise.reject(new Error('offline')))) } },
    }));
    WordCardComp = (await import('../src/components/WordCard.tsx')).WordCard;
    const { rerender } = renderCard();
    await screen.findByText('known');

    rerender(
      <MemoryRouter>
        <WordCardComp info={infoB} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
      </MemoryRouter>,
    );
    await screen.findByText('B');
    await new Promise((r) => setTimeout(r, 0)); // let the rejection settle

    expect(screen.queryByText('known')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('does not show word A\'s status on a destination word that has no vocabulary key at all', async () => {
    // this case is already covered by a second, independent guard (the History button and its
    // panel both also check info.key), so it stays green whether or not `lex` itself is reset —
    // kept anyway as a named regression guard for that second check, per the audit's request to
    // cover a keyless destination explicitly
    vi.doMock('../src/db/db.ts', () => ({
      db: { lexemes: { get: vi.fn((key: string) => (key === 'he:1697' ? Promise.resolve(lexA) : Promise.resolve(undefined))) } },
    }));
    WordCardComp = (await import('../src/components/WordCard.tsx')).WordCard;
    const { rerender } = renderCard();
    await screen.findByText('known');

    rerender(
      <MemoryRouter>
        <WordCardComp info={infoNoKey} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
      </MemoryRouter>,
    );
    await screen.findByText('C');
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('known')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
