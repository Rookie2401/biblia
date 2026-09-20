// @vitest-environment jsdom
// content audit 4 asked for a rendered Reader test that leaves an old book request pending,
// navigates away, then settles the old request — and a cached-destination test for the same
// glossIndex-error bug proven in VerseCard. Mounts the real, routed Reader screen.
//
// Navigation is driven through react-router's own useNavigate (not by remounting MemoryRouter
// with a new initialEntries — MemoryRouter only reads that prop once, and remounting the whole
// router would unmount and recreate Reader's Chapter instance, which trivially avoids the exact
// same-instance race this test exists to catch).
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no IntersectionObserver; Reader uses one to track reading position and chapter end.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const notFound = (): Response => new Response('', { status: 404 });

const GEN = {
  book: 'Gen',
  chapters: [{ n: 1, verses: [{ n: 1, t: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃', w: [['7225', 'HNcfsa'], ['1254 a', 'HVqp3ms'], ['430', 'HNcmpa'], ['853', 'HTo'], ['8064', 'HNcmpa'], ['853', 'HTo'], ['776', 'HNcbsa']] }] }],
};
const MATT = { book: 'Matt', chapters: [{ n: 1, verses: [{ n: 1, w: [['λόγος', 'λόγος', 'N-', '----NSM-']] }] }] };

function fetchRouter(overrides: Record<string, () => Promise<Response>>) {
  return vi.fn((url: string) => {
    for (const [pattern, handler] of Object.entries(overrides)) if (url.includes(pattern)) return handler();
    if (url.includes('ctx/')) return Promise.resolve(notFound());
    if (url.includes('he-index') || url.includes('gr-index')) return Promise.resolve(jsonResponse([]));
    if (url.includes('data/he/Gen')) return Promise.resolve(jsonResponse(GEN));
    if (url.includes('data/gr/Matt')) return Promise.resolve(jsonResponse(MATT));
    return Promise.resolve(notFound());
  });
}

let navigateTo: ((to: string) => void) | null = null;
function NavigatorBridge() {
  navigateTo = useNavigate();
  return null;
}

async function renderReaderAt(ReaderComp: ComponentType, initial: string) {
  render(
    <MemoryRouter initialEntries={[initial]}>
      <NavigatorBridge />
      <Routes>
        <Route path="/read/:book/:ch" element={<ReaderComp />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  // jsdom does not implement matchMedia; Reader uses it (via useMediaQuery) to pick the modal vs
  // side-panel layout. A fixed "no match" is fine — this test doesn't exercise responsive layout.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })),
  );
  vi.resetModules();
  navigateTo = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Reader does not apply a stale book-load result to the current route', () => {
  it('a pending Genesis request that resolves after navigating to Matthew is ignored', async () => {
    let resolveGen!: (r: Response) => void;
    const genPending = new Promise<Response>((r) => (resolveGen = r));
    vi.stubGlobal('fetch', fetchRouter({ 'data/he/Gen': () => genPending }));

    const { default: Reader } = await import('../src/screens/Reader.tsx');
    await renderReaderAt(Reader, '/read/Gen/1');
    expect(await screen.findByText(/loading genesis/i)).toBeTruthy();

    act(() => navigateTo!('/read/Matt/1'));
    expect(await screen.findByText('λόγος')).toBeTruthy(); // Matthew loaded fine

    // the stale Genesis request finally resolves
    resolveGen(jsonResponse(GEN));
    await new Promise((r) => setTimeout(r, 0));

    // the Greek chapter must still be what's shown — Genesis never overwrote it
    expect(screen.queryByText('λόγος')).toBeTruthy();
    expect(screen.queryByText(/בְּרֵאשִׁית/)).toBeNull();
  });
});

describe('Reader does not apply a stale retry completion to a route the reader has since left', () => {
  it('a retry started for Genesis, then superseded by navigating to Matthew, cannot resurrect Genesis when it resolves', async () => {
    let resolveRetry!: (r: Response) => void;
    const retryPending = new Promise<Response>((r) => (resolveRetry = r));
    let genCalls = 0;
    vi.stubGlobal(
      'fetch',
      fetchRouter({
        'data/he/Gen': () => {
          genCalls++;
          return genCalls === 1 ? Promise.reject(new Error('offline')) : retryPending;
        },
      }),
    );

    const { default: Reader } = await import('../src/screens/Reader.tsx');
    await renderReaderAt(Reader, '/read/Gen/1');
    await screen.findByText(/offline/i); // the first load failed and shows the error + retry

    await act(async () => {
      screen.getByRole('button', { name: /try again/i }).click();
    });
    expect(genCalls).toBe(2); // the retry started a second request, now held pending

    // the reader moves on to Matthew before that retry ever settles
    act(() => navigateTo!('/read/Matt/1'));
    expect(await screen.findByText('λόγος')).toBeTruthy();

    // the superseded retry finally resolves
    resolveRetry(jsonResponse(GEN));
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('λόγος')).toBeTruthy(); // still Matthew
    expect(screen.queryByText(/בְּרֵאשִׁית/)).toBeNull(); // Genesis never appeared
    expect(screen.queryByText(/offline/i)).toBeNull(); // no leaked error either
  });
});

describe('Reader does not let an older vocabulary-status lookup overwrite a newer chapter\'s map', () => {
  it('a chapter 1 statusMap() result that resolves after moving to chapter 2 does not apply to chapter 2\'s shared word', async () => {
    // both chapters print the same single word, so it has the identical lexeme key in each —
    // exactly the realistic case (a common word repeated across chapters) where a stale map
    // silently overwriting the current one would be visible in the rendered status class.
    const SHARED_VERSE = { n: 1, t: 'בָּרָא', w: [['1254 a', 'HVqp3ms']] };
    const GEN2 = { book: 'Gen', chapters: [{ n: 1, verses: [SHARED_VERSE] }, { n: 2, verses: [SHARED_VERSE] }] };
    vi.stubGlobal('fetch', fetchRouter({ 'data/he/Gen': () => Promise.resolve(jsonResponse(GEN2)) }));

    let resolveCh1Status!: (m: Map<string, string>) => void;
    const ch1StatusPending = new Promise<Map<string, string>>((r) => (resolveCh1Status = r));
    let call = 0;
    vi.doMock('../src/state/vocab.ts', async () => {
      const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
      return { ...actual, statusMap: vi.fn(() => (++call === 1 ? ch1StatusPending : actual.statusMap([]))) };
    });

    const { default: Reader } = await import('../src/screens/Reader.tsx');
    await renderReaderAt(Reader, '/read/Gen/1');
    await screen.findByText('בָּרָא');

    act(() => navigateTo!('/read/Gen/2'));
    await screen.findByText('בָּרָא');
    const word = () => document.querySelector('.reader__prose button.w');
    expect(word()?.className).toContain('st-new'); // chapter 2's own (empty) status map applied: not known

    // chapter 1's stale lookup finally resolves, marking the shared word "known"
    resolveCh1Status(new Map([['he:1254 a', 'known']]));
    await new Promise((r) => setTimeout(r, 0));

    expect(word()?.className).toContain('st-new'); // must still read as chapter 2's own (unknown) status
  });
});

describe('Reader clears the previous chapter\'s status map when the new chapter\'s own lookup fails', () => {
  // content audit 7: a failed statusMap() read for the new chapter deliberately left the displayed
  // map unchanged (to avoid an unhandled rejection) — but on chapter navigation, "unchanged" means
  // the previous chapter's map. Confirmed with a real, un-act()-wrapped navigation (both chapters
  // share one word, so the same DOM node is reused and its class briefly still says "recognized"
  // from chapter 1, for exactly the render before React's own effects would otherwise clean it up).
  it('a rejected statusMap() for chapter 2 does not paint chapter 1\'s "recognized" styling onto it', async () => {
    const SHARED_VERSE = { n: 1, t: 'בָּרָא', w: [['1254 a', 'HVqp3ms']] };
    const GEN2 = { book: 'Gen', chapters: [{ n: 1, verses: [SHARED_VERSE] }, { n: 2, verses: [SHARED_VERSE] }] };
    vi.stubGlobal('fetch', fetchRouter({ 'data/he/Gen': () => Promise.resolve(jsonResponse(GEN2)) }));

    let call = 0;
    vi.doMock('../src/state/vocab.ts', async () => {
      const actual = await vi.importActual<typeof import('../src/state/vocab.ts')>('../src/state/vocab.ts');
      return {
        ...actual,
        statusMap: vi.fn(() => {
          call++;
          return call === 1 ? Promise.resolve(new Map([['he:1254 a', 'recognized']])) : Promise.reject(new Error('offline'));
        }),
      };
    });

    const { default: Reader } = await import('../src/screens/Reader.tsx');
    await renderReaderAt(Reader, '/read/Gen/1');
    await screen.findByText('בָּרָא');
    const word = () => document.querySelector('.reader__prose button.w');
    const title = () => document.querySelector('.reader__title')?.textContent;
    await new Promise((r) => setTimeout(r, 0));
    expect(word()?.className).toContain('st-recognized'); // chapter 1's real status shows

    // deliberately NOT wrapped in act(): the point is to see the DOM as it actually commits,
    // the same way a real browser would, rather than have React's test helper fast-forward
    // straight past the moment the bug would be visible
    navigateTo!('/read/Gen/2');
    await screen.findByText('בָּרָא'); // resolves once chapter 2's own render has committed
    expect(title()).toBe('Genesis 2'); // sanity: this is genuinely chapter 2, not stale chapter 1 DOM
    expect(word()?.className).not.toContain('st-recognized'); // must not carry chapter 1's status
    expect(word()?.className).toContain('st-new');
  });
});

describe('Reader does not retain a gloss-index error across a route whose index is already cached', () => {
  it('a Hebrew index failure does not appear on a Greek chapter loaded after the Greek index is already cached', async () => {
    vi.stubGlobal(
      'fetch',
      fetchRouter({
        'he-index': () => Promise.reject(new Error('offline')),
        'gr-index': () => Promise.resolve(jsonResponse([])),
      }),
    );
    const { ensureGlossIndex } = await import('../src/state/wordinfo.ts');
    await ensureGlossIndex('gr'); // Greek's index is already cached before Reader ever mounts

    const { default: Reader } = await import('../src/screens/Reader.tsx');
    await renderReaderAt(Reader, '/read/Gen/1');
    // the Hebrew gloss-index failure commits its notice inside the chapter view
    expect(await screen.findByText(/could not load the lexicon glosses/i)).toBeTruthy();

    act(() => navigateTo!('/read/Matt/1'));
    expect(await screen.findByText('λόγος')).toBeTruthy();
    expect(screen.queryByText(/could not load the lexicon glosses/i)).toBeNull();
  });
});
