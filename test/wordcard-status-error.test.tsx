// @vitest-environment jsdom
// content audit 7: the StatusPicker's onChange called setLexemeStatus() without awaiting or
// catching it. A failed status write (IndexedDB quota, permission, private mode, corruption)
// became an unhandled rejection with no indication to the user that their tap didn't take.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lexeme } from '../src/model/types.ts';
import type { WordInfo } from '../src/state/wordinfo.ts';

const notFound = (): Response => new Response('', { status: 404 });
const noop = () => undefined;

const info: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang: 'he', printed: 'A', form: 'A', lexId: '1697', key: 'he:1697' };
const lx: Lexeme = { key: 'he:1697', lang: 'he', status: 'new' } as Lexeme;

let WordCardComp: typeof import('../src/components/WordCard.tsx')['WordCard'];
let setLexemeStatus: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound())));
  setLexemeStatus = vi.fn(() => Promise.reject(new Error('offline')));
  vi.doMock('../src/state/vocab.ts', async () => {
    const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
    return { ...actual, setLexemeStatus };
  });
  vi.doMock('../src/db/db.ts', () => ({ db: { lexemes: { get: vi.fn(() => Promise.resolve(lx)) } } }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WordCard reports a failed status write instead of letting it become an unhandled rejection', () => {
  it('shows a storage-failure message when setLexemeStatus() rejects', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      WordCardComp = (await import('../src/components/WordCard.tsx')).WordCard;
      render(
        <MemoryRouter>
          <WordCardComp info={info} standalone onOpenVerse={noop} onClose={noop} onOpenLexeme={noop} onGoTo={noop} />
        </MemoryRouter>,
      );
      const group = await screen.findByRole('radiogroup');
      const buttons = group.querySelectorAll('button');
      fireEvent.click(buttons[2]); // pick a different status than the current one

      expect(setLexemeStatus).toHaveBeenCalledTimes(1);
      await new Promise((r) => setTimeout(r, 0)); // let the rejection settle

      expect(unhandled).toEqual([]);
      expect(await screen.findByRole('alert')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
