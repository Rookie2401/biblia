// ensureGlossIndex is what Reader.tsx, VerseCard.tsx and Word.tsx all wait on for the lemma-gloss
// index. A failed load must not poison it: the next call (a "Try again" click) must attempt the
// underlying searchIndex() fetch again and succeed once the network recovers.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('ensureGlossIndex retries after a failed fetch', () => {
  it('rejects on failure, then resolves on the next call once the network recovers', async () => {
    const rows = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(jsonResponse(rows));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureGlossIndex, glossIndex } = await import('../src/state/wordinfo.ts');

    expect(glossIndex('he')).toBeUndefined();
    await expect(ensureGlossIndex('he')).rejects.toThrow('offline');
    expect(glossIndex('he')).toBeUndefined(); // the failed attempt must not have installed a half-built index

    const map = await ensureGlossIndex('he');
    expect(map.get('1697')).toEqual(rows[0]);
    expect(glossIndex('he')).toBe(map);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('once loaded, glossIndex is served from memory without another fetch', async () => {
    const rows = [['1697', 'דָּבָר', 'dâbâr', 'word', 1440, 'bdb']];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rows));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureGlossIndex } = await import('../src/state/wordinfo.ts');

    await ensureGlossIndex('he');
    await ensureGlossIndex('he');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('concurrent callers during a failure all see the same rejection, and all can retry afterward', async () => {
    // the two concurrent calls below dedupe into a single in-flight fetch, so only one rejection
    // is consumed before the retry's fetch gets the resolved response
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const { ensureGlossIndex } = await import('../src/state/wordinfo.ts');

    const [a, b] = await Promise.allSettled([ensureGlossIndex('he'), ensureGlossIndex('he')]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    // in-flight de-duplication means only ONE fetch happened for both concurrent callers
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(ensureGlossIndex('he')).resolves.toBeInstanceOf(Map);
  });
});
