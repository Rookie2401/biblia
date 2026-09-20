// @vitest-environment jsdom
// On a phone, the word/verse card is a modal bottom sheet: useModalDialog marks background
// regions inert so a real modal doesn't leak background interaction. That inert region used to
// be the whole .reader__main, which included the prose itself — so tapping a different word
// while the sheet was open did nothing (the tap never reached the button), and closing the sheet
// with the × was the only way back to the text. Fixed by inerting only .reader__header and
// .reader__nav, leaving the prose reachable so a tap on another word swaps the sheet directly
// (Reader's existing onProseClick/activate() already supports this — it was purely blocked).
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const notFound = (): Response => new Response('', { status: 404 });

const MATT = { book: 'Matt', chapters: [{ n: 1, verses: [{ n: 1, w: [['Βίβλος', 'βίβλος', 'N-', '----NSF-'], ['γενέσεως', 'γένεσις', 'N-', '----GSF-']] }] }] };

function fetchRouter() {
  return vi.fn((url: string) => {
    if (url.includes('ctx/')) return Promise.resolve(notFound());
    if (url.includes('he-index') || url.includes('gr-index')) return Promise.resolve(jsonResponse([]));
    if (url.includes('data/gr/Matt')) return Promise.resolve(jsonResponse(MATT));
    return Promise.resolve(notFound());
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  // the phone-width layout is what turns the word card into the modal sheet this bug is about
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query === '(max-width: 979px)', media: query, addEventListener: () => {}, removeEventListener: () => {} })),
  );
  vi.stubGlobal('fetch', fetchRouter());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the mobile word-card sheet lets a tap on a different word switch it directly', () => {
  it('inerts the header and nav while a word is selected, but never the prose — a tap on another word swaps the card without closing it first', async () => {
    const { default: Reader } = await import('../src/screens/Reader.tsx');
    render(
      <MemoryRouter initialEntries={['/read/Matt/1']}>
        <Routes>
          <Route path="/read/:book/:ch" element={<Reader />} />
        </Routes>
      </MemoryRouter>,
    );

    const first = await screen.findByRole('button', { name: 'Βίβλος' });
    fireEvent.click(first);
    await screen.findByText('Βίβλος', { selector: '.card__surface' });

    // background chrome is inert, but the prose (and therefore every word button) is not
    expect(document.querySelector('.reader__header')?.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.reader__nav')?.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.reader__main')?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('.reader__prose')?.hasAttribute('inert')).toBe(false);

    // tapping the second word — no close button clicked — must swap the card directly
    const second = screen.getByRole('button', { name: 'γενέσεως' });
    fireEvent.click(second);
    await screen.findByText('γενέσεως', { selector: '.card__surface' });
    expect(screen.queryByText('Βίβλος', { selector: '.card__surface' })).toBeNull();
  });
});
