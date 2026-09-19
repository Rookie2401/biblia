// A failed searchIndex()/grShard() request must not poison the module-level cache: the very next
// call (what a "Try again" button does) should attempt the fetch again, not replay the same
// rejection forever.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const failedResponse = (status = 500): Response => new Response('', { status });

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('searchIndex retries after a failed fetch', () => {
  it('a rejected fetch can be retried and the retry succeeds', async () => {
    const rows = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(jsonResponse(rows));
    vi.stubGlobal('fetch', fetchMock);
    const { searchIndex } = await import('../src/data/lexicon.ts');

    await expect(searchIndex('he')).rejects.toThrow('network error');
    await expect(searchIndex('he')).resolves.toEqual(rows);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('an HTTP error response is treated as a failure and also retries', async () => {
    const rows = [['λόγος', 'G3056', 'lógos', 'a word', 330, 'dodson']];
    const fetchMock = vi.fn().mockResolvedValueOnce(failedResponse(503)).mockResolvedValueOnce(jsonResponse(rows));
    vi.stubGlobal('fetch', fetchMock);
    const { searchIndex } = await import('../src/data/lexicon.ts');

    await expect(searchIndex('gr')).rejects.toThrow(/503/);
    await expect(searchIndex('gr')).resolves.toEqual(rows);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('Hebrew and Greek indices retry independently of one another', async () => {
    const heRows = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];
    const grRows = [['λόγος', 'G3056', 'lógos', 'a word', 330, 'dodson']];
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('he-index')) return Promise.reject(new Error('he down'));
      return Promise.resolve(jsonResponse(grRows));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { searchIndex } = await import('../src/data/lexicon.ts');

    await expect(searchIndex('he')).rejects.toThrow('he down');
    await expect(searchIndex('gr')).resolves.toEqual(grRows); // unaffected by the Hebrew failure
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(heRows)));
    await expect(searchIndex('he')).resolves.toEqual(heRows); // now retries and succeeds
  });
  it('a pending request is shared by concurrent callers (no duplicate fetch)', async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolve = r));
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMock);
    const { searchIndex } = await import('../src/data/lexicon.ts');

    const a = searchIndex('he');
    const b = searchIndex('he');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(jsonResponse([]));
    await expect(a).resolves.toEqual([]);
    await expect(b).resolves.toEqual([]);
  });
});

describe('grShard (the manifest cache) retries after a failed fetch', () => {
  it('recovers on the next call after a manifest fetch fails', async () => {
    const manifest = { split: ['α', 'ε'] };
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('manifest unreachable')).mockResolvedValueOnce(jsonResponse(manifest));
    vi.stubGlobal('fetch', fetchMock);
    const { grShard } = await import('../src/data/lexicon.ts');

    await expect(grShard('λόγος')).rejects.toThrow('manifest unreachable');
    await expect(grShard('λόγος')).resolves.toBe('λ');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
