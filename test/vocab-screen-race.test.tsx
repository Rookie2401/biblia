// @vitest-environment jsdom
// content audit 6: Vocab.tsx's load() had no ordering guard and no rejection handling. A burst of
// vocabulary notifications can start a second load before the first (IndexedDB has no ordering
// guarantee), and an older snapshot resolving after a newer one would overwrite it.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lexeme } from '../src/model/types.ts';

let vocabListener: (() => void) | null = null;
const lexeme = (key: string, lemma: string): Lexeme => ({ key, lang: 'he', lemma, gloss: 'word', status: 'new', lookups: 1, encounters: 1, chapters: [], forms: [] } as unknown as Lexeme);

beforeEach(() => {
  vi.resetModules();
  vocabListener = null;
  vi.doMock('../src/state/vocab.ts', async () => {
    const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
    return { ...actual, onVocabChange: (cb: () => void) => { vocabListener = cb; return () => { vocabListener = null; }; } };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Vocab screen does not let an older load overwrite a newer one', () => {
  it('a stale first load that resolves after a newer second load does not overwrite it', async () => {
    let resolveFirst!: (rows: Lexeme[]) => void;
    const firstPending = new Promise<Lexeme[]>((r) => (resolveFirst = r));
    let call = 0;
    vi.doMock('../src/db/db.ts', () => ({
      db: {
        lexemes: {
          orderBy: () => ({
            reverse: () => ({
              toArray: () => {
                call++;
                return call === 1 ? firstPending : Promise.resolve([lexeme('he:1697', 'דָּבָר')]);
              },
            }),
          }),
        },
      },
    }));

    const { default: Vocab } = await import('../src/screens/Vocab.tsx');
    render(<MemoryRouter><Vocab /></MemoryRouter>);
    expect(await screen.findByText(/words you tap while reading collect here/i)).toBeTruthy(); // first load still pending, list empty

    // a vocabulary change starts a second, independent load, which resolves right away
    vocabListener!();
    await screen.findByText('דָּבָר');

    // now the stale first load finally resolves with an older (empty) snapshot
    resolveFirst([]);
    await new Promise((r) => setTimeout(r, 0));

    // the newer row must still be showing — the stale empty snapshot must not have won
    expect(screen.queryByText('דָּבָר')).toBeTruthy();
  });

  it('never throws when the IndexedDB read rejects, and keeps whatever was already loaded', async () => {
    let calls = 0;
    vi.doMock('../src/db/db.ts', () => ({
      db: {
        lexemes: {
          orderBy: () => ({
            reverse: () => ({
              toArray: () => {
                calls++;
                return calls === 1 ? Promise.resolve([lexeme('he:1697', 'דָּבָר')]) : Promise.reject(new Error('offline'));
              },
            }),
          }),
        },
      },
    }));

    // capture unhandled rejections directly: keeping the previous row on screen is necessary but
    // not sufficient — the pre-fix code also left the row in place (it just never handled the
    // rejection at all), so this is the assertion that actually distinguishes the two
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { default: Vocab } = await import('../src/screens/Vocab.tsx');
      render(<MemoryRouter><Vocab /></MemoryRouter>);
      await screen.findByText('דָּבָר');

      vocabListener!(); // triggers the second, rejecting load
      await new Promise((r) => setTimeout(r, 0));

      expect(unhandled).toEqual([]);
      // the earlier successful row is still shown; the rejection did not clear or crash the screen
      expect(screen.queryByText('דָּבָר')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
