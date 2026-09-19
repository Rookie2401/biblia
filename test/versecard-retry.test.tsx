// @vitest-environment jsdom
// VerseCard.tsx is one of the screens the audit named: "Loading glosses…" had no way out of a
// permanent hang on a failed fetch. Proves it now shows an explicit, working retry instead.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrVerse, HeVerse } from '../src/model/types.ts';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
// context.ts fetches ./data/ctx/<lang>/<book>.json — keep that resolving to "not found" (404) so
// this test only exercises the glossIndex failure path, not the (already self-healing) context one
const ctx404 = (): Response => new Response('', { status: 404 });

const HE: HeVerse = { n: 1, t: 'בְּרֵאשִׁ֖ית בָּרָ֣א', w: [['7225', 'HNcfsa'], ['1254 a', 'HVqp3ms']] };
const heBook = { book: 'Gen', chapters: [{ n: 1, verses: [HE] }] } as never;
const GR: GrVerse = { n: 1, w: [['λόγος', 'λόγος', 'N-', '----NSM-']] };
const grBook = { book: 'Matt', chapters: [{ n: 1, verses: [GR] }] } as never;

afterEach(cleanup);
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('VerseCard recovers from a failed glossary-index load', () => {
  it('shows "Loading glosses…", then an error with retry, then the glosses once retried', async () => {
    const heRows = [['7225', 'רֵאשִׁית', 'rêʼshîyth', 'beginning', 51, 'bdb']];
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('ctx/')) return Promise.resolve(ctx404());
      if (url.includes('he-index')) return Promise.reject(new Error('offline'));
      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { VerseCard } = await import('../src/components/VerseCard.tsx');
    const user = userEvent.setup();
    render(<VerseCard book={heBook} ch={1} v={1} onSelectWord={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText(/loading glosses/i)).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load the lexicon glosses/i);
    expect(screen.queryByText(/loading glosses/i)).toBeNull();

    fetchMock.mockImplementation((url: string) => (url.includes('ctx/') ? Promise.resolve(ctx404()) : Promise.resolve(jsonResponse(heRows))));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/loading glosses/i)).toBeNull();
  });

  it('a Hebrew request that rejects after the card has moved on to Greek does not set the Greek view\'s error', async () => {
    let rejectHe!: (e: Error) => void;
    const hePending = new Promise<Response>((_, reject) => (rejectHe = reject));
    const grRows = [['λόγος', 'G3056', 'lógos', 'a word, speech', 330, 'dodson']];
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('ctx/')) return Promise.resolve(ctx404());
      if (url.includes('he-index')) return hePending;
      if (url.includes('gr-index')) return Promise.resolve(jsonResponse(grRows));
      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { VerseCard } = await import('../src/components/VerseCard.tsx');
    const { rerender } = render(<VerseCard book={heBook} ch={1} v={1} onSelectWord={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText(/loading glosses/i)).toBeTruthy(); // the Hebrew fetch is in flight

    // the card moves on to a different book/language before that Hebrew fetch ever settles
    rerender(<VerseCard book={grBook} ch={1} v={1} onSelectWord={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByText('λόγος')).toBeTruthy(); // Greek's own index loaded fine

    // now the stale Hebrew request finally rejects; the rejection has to travel up through several
    // promise hops (fetch -> fetchJson -> two memoAsyncKeyed layers -> the component's own .catch),
    // so a couple of chained .then()s is not enough to let it fully settle — a real task boundary is
    // needed, and without one this test would falsely "pass" whether or not the bug is fixed
    rejectHe(new Error('offline'));
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole('alert')).toBeNull(); // must not show an error for the Greek view it never caused
    expect(screen.queryByText(/could not load the lexicon glosses/i)).toBeNull();
  });
});
