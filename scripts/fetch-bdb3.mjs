// Third pass for the complete BDB: Sefaria exposes the dictionary as a text index
// ("BDB", "BDB Aramaic") whose entries chain through `next`/`prev`, and the texts API
// resolves every headword exactly (roots and names included, unlike the word lookup).
// One chain per letter (from the index's headwordMap) so the walk runs in parallel.
// Saves data/bdb-texts/<index>/<n>.json = { ref, hw, html, next, prev }. Resumable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data', 'bdb-texts');
const UA = { 'user-agent': 'biblia-v0 fetch-bdb (personal study app; BDB is public domain)' };
const INDICES = ['BDB', 'BDB Aramaic'];

async function getJson(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      if (attempt === 6) {
        console.error('FAILED', url, e.message);
        return null;
      }
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  return null;
}

let saved = 0;
let failures = 0;
for (const index of INDICES) {
  const dir = path.join(outDir, index.replace(/\s+/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Map(); // ref -> file
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      seen.set(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).ref, f);
    } catch {
      /* ignore */
    }
  }
  const meta = await getJson(`https://www.sefaria.org/api/v2/index/${encodeURIComponent(index)}`);
  const node = meta?.schema?.nodes?.find((n) => n.nodeType === 'DictionaryNode');
  if (!node) throw new Error(index + ': no dictionary node');
  const starts = node.headwordMap.map(([, ref]) => ref);
  const stops = new Set(starts.slice(1));
  console.log(`${index}: ${starts.length} letter chains (${node.firstWord} … ${node.lastWord}), ${seen.size} entries already on disk`);
  let n = seen.size;
  const walk = async (start, i) => {
    let ref = start;
    let steps = 0;
    while (ref) {
      if (steps > 0 && stops.has(ref)) break; // the next letter's chain takes over
      let entry;
      if (seen.has(ref)) {
        entry = JSON.parse(fs.readFileSync(path.join(dir, seen.get(ref)), 'utf8'));
      } else {
        const j = await getJson(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}`);
        if (!j || j.error) {
          failures++;
          console.error(`${index}: could not fetch "${ref}"`);
          break;
        }
        entry = { ref: j.ref, hw: j.ref.replace(/^BDB( Aramaic)?, /, ''), html: (j.text || []).join(''), next: j.next, prev: j.prev };
        const file = String(++n).padStart(5, '0') + '.json';
        fs.writeFileSync(path.join(dir, file), JSON.stringify(entry));
        seen.set(entry.ref, file);
        saved++;
        if (saved % 200 === 0) console.log(`${new Date().toISOString().slice(11, 19)} ${saved} saved`);
        await new Promise((res) => setTimeout(res, 120));
      }
      ref = entry.next;
      steps++;
    }
    return steps;
  };
  const counts = await Promise.all(starts.map(walk));
  console.log(`${index}: chains ${counts.join(' ')}`);
}
console.log(`DONE: ${saved} new entries, ${failures} failures`);
