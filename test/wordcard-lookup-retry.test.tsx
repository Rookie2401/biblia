// @vitest-environment jsdom
// content audit 7: WordCard added `refId` to the module-level `lookedUp` set BEFORE recordLookup()
// resolved, and the catch that swallowed a rejection never removed it. Reopening the same word
// later (a fresh mount — the card unmounts when the panel closes) then took the "already looked
// up" path and only read the (still-missing) row, permanently losing that word's vocabulary write
// for the rest of the browser session.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lexeme } from '../src/model/types.ts';
import type { WordInfo } from '../src/state/wordinfo.ts';

const notFound = (): Response => new Response('', { status: 404 });
const noop = () => undefined;

const info: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'A', form: 'A', lexId: '1697', key: 'he:1697' };
const lx: Lexeme = { key: 'he:1697', lang: 'he', status: 'recognized' } as Lexeme;

let WordCardComp: typeof import('../src/components/WordCard.tsx')['WordCard'];
let recordLookup: ReturnType<typeof vi.fn>;

function renderCard() {
  return render(
    <MemoryRouter>
      <WordCardComp info={info} onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound()))); // no lexicon entry needed
  recordLookup = vi.fn();
  vi.doMock('../src/state/vocab.ts', async () => {
    const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
    return { ...actual, recordLookup };
  });
  vi.doMock('../src/db/db.ts', () => ({ db: { lexemes: { get: vi.fn(() => Promise.resolve(undefined)) } } }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WordCard retries recordLookup on a later visit if the first write failed', () => {
  it('reopening the same word after a failed write calls recordLookup again instead of only reading', async () => {
    recordLookup.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(lx);
    WordCardComp = (await import('../src/components/WordCard.tsx')).WordCard;

    const first = renderCard();
    await screen.findByText('A');
    await new Promise((r) => setTimeout(r, 0)); // let the rejection settle
    expect(recordLookup).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('radiogroup')).toBeNull(); // the failed write shows no status

    first.unmount(); // closing the panel — a real "reopen" is a fresh mount, not a rerender

    renderCard();
    await screen.findByText('recognized'); // the retried write succeeded and its status is shown
    expect(recordLookup).toHaveBeenCalledTimes(2); // retried, not skipped via the stale marker
  });
});
