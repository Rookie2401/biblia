// @vitest-environment jsdom
// content audit 5: Word.tsx reset indexError on route change but left known/lemma from the
// previous word on screen while the new word's index lookup was pending, or indefinitely if it
// failed. Both must reset the moment the route (lang/id) changes.
//
// The destination word is a different language (Hebrew -> Greek) so its index lookup is a
// genuinely independent, separately controllable request (ensureGlossIndex caches per language;
// re-requesting the SAME language the first word already loaded would just reuse that cache and
// never actually exercise a pending or failing second request).
//
// Navigation is driven through react-router's own useNavigate, not by remounting MemoryRouter
// with a new initialEntries (that prop is only read on first mount; remounting the whole router
// creates a fresh history the component never actually navigates through).
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const notFound = (): Response => new Response('', { status: 404 });

const HE_INDEX = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];

let navigateTo: ((to: string) => void) | null = null;
function NavigatorBridge() {
  navigateTo = useNavigate();
  return null;
}

async function renderWordAt(initial: string) {
  const { default: WordScreen } = await import('../src/screens/Word.tsx');
  render(
    <MemoryRouter initialEntries={[initial]}>
      <NavigatorBridge />
      <Routes>
        <Route path="/word/:lang/:id" element={<WordScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetModules();
  navigateTo = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Word screen does not keep the previous word on screen after the route changes', () => {
  it('a pending lookup for the new word (Greek) does not still show the previous (Hebrew) lemma', async () => {
    const grPending = new Promise(() => {}); // never settles for the duration of this test
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('he-index')) return Promise.resolve(jsonResponse(HE_INDEX));
        if (url.includes('gr-index')) return grPending;
        return Promise.resolve(notFound());
      }),
    );

    await renderWordAt('/word/he/1697');
    await screen.findByText('דָּבָר'); // Hebrew word's real lemma loaded

    act(() => navigateTo!('/word/gr/λόγος'));

    // while the Greek lookup is still pending, the Hebrew lemma must already be gone
    expect(screen.queryByText('דָּבָר')).toBeNull();
  });

  it('a failed lookup for the new word (Greek) leaves no trace of the previous (Hebrew) lemma or "not found" state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('he-index')) return Promise.resolve(jsonResponse(HE_INDEX));
        if (url.includes('gr-index')) return Promise.reject(new Error('offline'));
        return Promise.resolve(notFound());
      }),
    );

    await renderWordAt('/word/he/1697');
    await screen.findByText('דָּבָר');

    act(() => navigateTo!('/word/gr/λόγος'));
    await screen.findByText(/could not confirm this lexicon entry/i);

    // the failure must not leave the Hebrew lemma displayed, and must not claim the Greek word is
    // "not found" (known === false) using data that was actually loaded for Hebrew
    expect(screen.queryByText('דָּבָר')).toBeNull();
    expect(screen.queryByText(/no greek entry/i)).toBeNull();
  });
});
