// content audit 3: the previous cache-cleanup test only grepped the source text for patterns and
// never actually called the function. Exercises cleanupObsoleteDataCaches against a mocked Cache
// Storage: it must delete the legacy unversioned name AND every other stale versioned bucket,
// while leaving the current bucket and unrelated caches (the app-shell precache) alone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockCaches(names: string[]) {
  const store = new Set(names);
  const deleted: string[] = [];
  const caches = {
    keys: vi.fn(async () => [...store]),
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return store.delete(name);
    }),
  };
  return { caches, deleted, store };
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cleanupObsoleteDataCaches', () => {
  it('deletes the legacy unversioned "biblia-data" bucket (no trailing "-", so it never matched the prefix)', async () => {
    const { caches, deleted, store } = mockCaches(['biblia-data', 'biblia-data-current123', 'workbox-precache-v2-http://x/']);
    vi.stubGlobal('caches', caches);
    // __DATA_VERSION__ is a vite `define` (a build-time literal replacement); under vitest it's
    // never substituted, so it stays a real free variable read from the global object at runtime.
    (globalThis as { __DATA_VERSION__?: string }).__DATA_VERSION__ = 'current123';

    const { cleanupObsoleteDataCaches } = await import('../src/pwa/cleanupCaches.ts');
    await cleanupObsoleteDataCaches();

    expect(deleted).toContain('biblia-data');
    expect(store.has('biblia-data')).toBe(false);
    expect(store.has('biblia-data-current123')).toBe(true); // the current bucket must survive
    expect(store.has('workbox-precache-v2-http://x/')).toBe(true); // unrelated caches are never touched
  });
  it('deletes every other stale versioned bucket, even several releases behind', async () => {
    const { caches, deleted, store } = mockCaches(['biblia-data-old1', 'biblia-data-old2', 'biblia-data-current123']);
    vi.stubGlobal('caches', caches);
    (globalThis as { __DATA_VERSION__?: string }).__DATA_VERSION__ = 'current123';

    const { cleanupObsoleteDataCaches } = await import('../src/pwa/cleanupCaches.ts');
    await cleanupObsoleteDataCaches();

    expect(deleted.sort()).toEqual(['biblia-data-old1', 'biblia-data-old2']);
    expect(store.has('biblia-data-current123')).toBe(true);
  });
  it('deletes nothing when only the current bucket exists', async () => {
    const { caches, deleted } = mockCaches(['biblia-data-current123', 'workbox-precache-v2-http://x/']);
    vi.stubGlobal('caches', caches);
    (globalThis as { __DATA_VERSION__?: string }).__DATA_VERSION__ = 'current123';

    const { cleanupObsoleteDataCaches } = await import('../src/pwa/cleanupCaches.ts');
    await cleanupObsoleteDataCaches();

    expect(deleted).toEqual([]);
  });
  it('never throws when Cache Storage is unavailable (older browsers, disabled storage)', async () => {
    vi.stubGlobal('caches', undefined);
    const { cleanupObsoleteDataCaches } = await import('../src/pwa/cleanupCaches.ts');
    await expect(cleanupObsoleteDataCaches()).resolves.toBeUndefined();
  });
  it('never throws when caches.keys() itself rejects', async () => {
    vi.stubGlobal('caches', { keys: vi.fn().mockRejectedValue(new Error('denied')), delete: vi.fn() });
    const { cleanupObsoleteDataCaches } = await import('../src/pwa/cleanupCaches.ts');
    await expect(cleanupObsoleteDataCaches()).resolves.toBeUndefined();
  });
});
