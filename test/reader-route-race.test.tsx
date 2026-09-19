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
