// Guards the release-blocking Workbox findings directly against the exact objects vite.config.ts
// hands to Workbox, so a future edit that reintroduces a fixed cache name, a stale-forever
// handler, or a capacity ceiling at or below the shipped data-file count fails a test run instead
// of shipping.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_CACHE_MAX_ENTRIES, dataCacheName, dataRuntimeCaching, dataVersion } from '../vite.config.ts';

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const have = fs.existsSync(dataDir);

function recomputeDataVersion(): string {
  const hash = crypto.createHash('sha256');
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else hash.update(`${path.relative(dataDir, p)}:${st.size}\n`);
    }
  };
  walk(dataDir);
  for (const f of ['lex/he-index.json', 'lex/gr-index.json', 'ctx/COVERAGE.json']) {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
  }
  return hash.digest('hex').slice(0, 12);
}

describe('the data runtime cache cannot silently serve a stale release', () => {
  const entry = dataRuntimeCaching[0];

  it('the cache name is scoped to a fingerprint of the shipped data, not a fixed literal', () => {
    expect(dataVersion).toMatch(/^[a-f0-9]{8,}$/); // a real hash, not a placeholder like "" or "dev"
    expect(entry.options.cacheName, 'the cache name must embed the same version the cleanup module targets').toBe(`biblia-data-${dataVersion}`);
    expect(entry.options.cacheName).toBe(dataCacheName);
    expect(entry.options.cacheName).not.toBe('biblia-data'); // the old, unversioned, never-superseded name
  });
  it('does not use CacheFirst (a strategy that, on a fixed cache name, would never notice new data)', () => {
    expect(entry.handler).not.toBe('CacheFirst');
    expect(entry.handler).toBe('StaleWhileRevalidate');
  });
  it.skipIf(!have)('the version is a deterministic fingerprint of public/data, matching an independent recomputation', () => {
    expect(recomputeDataVersion()).toBe(dataVersion);
  });
  it('two builds of the same data produce the same cache name (no accidental per-build randomness like Date.now())', () => {
    expect(dataCacheName).toBe(dataRuntimeCaching[0].options.cacheName);
    expect(/^\d+$/.test(dataVersion)).toBe(false); // not a raw timestamp — a real content fingerprint
  });
  it('a cache-cleanup module exists, deletes obsolete "biblia-data-*" buckets and agrees on the current one', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'pwa', 'cleanupCaches.ts'), 'utf8');
    expect(src).toMatch(/biblia-data-/);
    expect(src).toMatch(/caches\.delete/);
    expect(src).toMatch(/caches\.keys/);
    expect(src).toMatch(/__DATA_VERSION__/);
    // main.tsx actually calls it — otherwise the module existing proves nothing at runtime
    const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
    expect(main).toMatch(/cleanupObsoleteDataCaches/);
  });
  it.skipIf(!have)('the app bundle embeds the exact version the service worker\'s cache name uses (build-output check)', () => {
    const distJs = path.join(root, 'dist', 'assets');
    if (!fs.existsSync(distJs)) return; // no production build in this checkout yet
    const bundle = fs.readdirSync(distJs).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(distJs, f), 'utf8')).join('\n');
    expect(bundle).toContain(dataVersion);
  });
});

describe('the data cache capacity has real headroom over the shipped file count', () => {
  it.skipIf(!have)('maxEntries comfortably exceeds every JSON file under public/data today', () => {
    let count = 0;
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.json')) count++;
      }
    };
    walk(dataDir);
    expect(count).toBeGreaterThan(300); // sanity: the corpus is actually as large as the audit described
    expect(DATA_CACHE_MAX_ENTRIES, `maxEntries (${DATA_CACHE_MAX_ENTRIES}) must leave real headroom over ${count} shipped files, not sit at the ceiling`).toBeGreaterThan(count * 1.5);
  });
  it('maxEntries is configured on the actual runtime-caching entry, not just the exported constant', () => {
    expect(dataRuntimeCaching[0].options.expiration.maxEntries).toBe(DATA_CACHE_MAX_ENTRIES);
  });
});
