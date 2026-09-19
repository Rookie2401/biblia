// content audit 6: allDataUrls() ("download everything for offline use") hard-coded Hebrew shards
// 0 through 29, but the corpus only ever produced shards 0 through 28 — every "complete" download
// reported two files (a lexicon and a concordance shard) as permanently failing. Every URL this
// function returns must correspond to a real file the build actually produced.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CANON, langOf } from '../src/text/canon.ts';

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const have = fs.existsSync(dataDir);

beforeEach(() => {
  vi.resetModules();
  // serve every "fetch" from the real, already-built public/data tree, so the manifests this
  // function reads are the actual ones the build produced — not a hand-written stand-in that
  // could quietly drift from reality the same way the hard-coded "29" once did
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const rel = url.replace(/^\.\//, '');
      const p = path.join(dataDir, rel.replace(/^data\//, ''));
      if (!fs.existsSync(p)) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(new Response(fs.readFileSync(p)));
    }),
  );
});

describe.skipIf(!have)('allDataUrls only ever points at files the build actually produced', () => {
  it('every returned URL exists under public/data (lexicon shards, concordance shards, manifests, indices, book texts, context)', async () => {
    const { allDataUrls } = await import('../src/data/lexicon.ts');
    const bookIds = CANON.map((b) => b.id);
    const urls = await allDataUrls(bookIds, langOf);

    expect(urls.length).toBeGreaterThan(300); // sanity: this is really the whole corpus, not a stub
    const missing = urls.filter((u) => {
      const rel = u.replace(/^\.\/data\//, '');
      return !fs.existsSync(path.join(dataDir, rel));
    });
    expect(missing).toEqual([]);
  });

  it('includes every Hebrew shard the build actually wrote, and no more', async () => {
    const heManifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'lex', 'he-manifest.json'), 'utf8')) as { shards: number[] };
    const realShardFiles = fs
      .readdirSync(path.join(dataDir, 'lex'))
      .filter((f) => /^he-\d+\.json$/.test(f))
      .map((f) => Number(f.match(/\d+/)![0]))
      .sort((a, b) => a - b);
    expect(heManifest.shards).toEqual(realShardFiles);

    const { allDataUrls } = await import('../src/data/lexicon.ts');
    const urls = await allDataUrls(['Gen'], langOf);
    const requestedHeShards = urls.filter((u) => /lex\/he-\d+\.json$/.test(u)).map((u) => Number(u.match(/he-(\d+)\.json$/)![1])).sort((a, b) => a - b);
    expect(requestedHeShards).toEqual(realShardFiles);
  });
});
