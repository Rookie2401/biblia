// @vitest-environment jsdom
// content audit 5: WordCard's onVocabChange listener started a db.lexemes.get() lookup without
// guarding its completion. Unsubscribing (on the word changing) stops FUTURE notifications but
// not an already-in-flight lookup — if it resolves after the card has moved to a different word,
// the old word's record could be applied to the new one.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lexeme } from '../src/model/types.ts';
import type { WordInfo } from '../src/state/wordinfo.ts';

const notFound = (): Response => new Response('', { status: 404 });

const infoA: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'A', form: 'A', lexId: '1697', key: 'he:1697' };
const infoB: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'B', form: 'B', lexId: '1254 a', key: 'he:1254 a' };

let vocabListener: (() => void) | null = null;
let getCall = 0;
let resolveListenerGet!: (lx: Lexeme | undefined) => void;
const listenerGetPending = new Promise<Lexeme | undefined>((r) => (resolveListenerGet = r));

beforeEach(() => {
  vi.resetModules();
  getCall = 0;
  vocabListener = null;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound()))); // no lexicon entry needed for this test
  vi.doMock('../src/db/db.ts', () => ({
    db: {
      lexemes: {
        // call 1: WordCard A's own mount lookup (not in the "db" yet). call 2: the vocab-change
        // listener's lookup for A, held pending until the test resolves it. later calls (B's own
        // mount lookup) resolve immediately.
        get: vi.fn(() => {
          getCall++;
          if (getCall === 1) return Promise.resolve(undefined);
          if (getCall === 2) return listenerGetPending;
          return Promise.resolve(undefined);
        }),
      },
    },
  }));
  vi.doMock('../src/state/vocab.ts', async () => {
    const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
    return { ...actual, onVocabChange: (cb: () => void) => { vocabListener = cb; return () => { vocabListener = null; }; } };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WordCard ignores a vocab-change lookup that resolves after the card has moved to a different word', () => {
  it('does not apply word A\'s stale lexeme record to word B\'s card', async () => {
    const { WordCard } = await import('../src/components/WordCard.tsx');
    const noop = () => undefined;
    const { rerender } = render(
      <MemoryRouter>
        <WordCard info={infoA} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
      </MemoryRouter>,
    );
    await screen.findByText('A');
    expect(vocabListener).toBeTruthy();

    // something elsewhere changes the vocabulary; the listener starts a lookup for word A (call 2)
    vocabListener!();

    // before that lookup settles, the card moves on to word B
    rerender(
      <MemoryRouter>
        <WordCard info={infoB} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
      </MemoryRouter>,
    );
    await screen.findByText('B');

    // word A's stale lookup finally resolves with a real (but wrong-word) "known" record — B has
    // no record of its own, so the status picker should not be showing at all
    resolveListenerGet({ key: 'he:1697', lang: 'he', status: 'known' } as Lexeme);
    await new Promise((r) => setTimeout(r, 0));

    // the card must still show B, and must not have picked up A's "known" status
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByText('known')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
