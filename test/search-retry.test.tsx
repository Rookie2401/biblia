// @vitest-environment jsdom
// Search.tsx is the screen the audit named directly: "Search can remain stuck in a loading
// state." Proves the failed-load path now shows an explicit error with a working retry, and that
// clicking it returns the screen to normal operation.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

afterEach(cleanup);
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('the Search screen recovers from a failed lexicon-index load', () => {
  it('shows a loading state, then an error with a retry button, then loads normally on retry', async () => {
    const heRows = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];
    const grRows = [['λόγος', 'G3056', 'lógos', 'a word, speech', 330, 'dodson']];
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('gr-index')) return Promise.reject(new Error('offline'));
      return Promise.resolve(jsonResponse(heRows));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: Search } = await import('../src/screens/Search.tsx');
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    );

    // loading, then the failure surfaces as an explicit, accessible error — never stuck silently
    expect(screen.getByText(/loading the lexica/i)).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load the lexica/i);
    expect(screen.queryByText(/loading the lexica/i)).toBeNull(); // does not stay stuck showing both states
    const retry = screen.getByRole('button', { name: /try again/i });

    // fix the network, then retry — the second attempt must actually re-fetch, not replay the cached rejection
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(grRows)));
    await user.click(retry);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(await screen.findByText('2 lemmas')).toBeTruthy(); // both index rows loaded: search is usable again
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('he-index'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('gr-index'));
  });
});
