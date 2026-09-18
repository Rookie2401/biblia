// Resume a BDB text-index chain from given headwords (when a link in the chain 404s):
//   node scripts/fetch-bdb3-resume.mjs "BDB" "עָפְרָה" "עֶפְרוֹן"
// Walks `next` from each seed until an entry already on disk is reached.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [index, ...seeds] = process.argv.slice(2);
const dir = path.join(root, 'data', 'bdb-texts', index.replace(/\s+/g, '_'));
const seen = new Map();
for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) seen.set(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).ref, f);
let n = seen.size;
let saved = 0;
for (const hw of seeds) {
  let ref = `${index}, ${hw}`;
  while (ref && !seen.has(ref)) {
    const r = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}`, { headers: { 'user-agent': 'biblia-v0 fetch-bdb' } });
    const j = r.ok ? await r.json() : null;
    if (!j || j.error) {
      console.log(`stop: could not fetch "${ref}"`);
      break;
    }
    const entry = { ref: j.ref, hw: j.ref.replace(/^BDB( Aramaic)?, /, ''), html: (j.text || []).join(''), next: j.next, prev: j.prev };
    const file = String(++n).padStart(5, '0') + '.json';
    fs.writeFileSync(path.join(dir, file), JSON.stringify(entry));
    seen.set(entry.ref, file);
    saved++;
    ref = entry.next;
    await new Promise((res) => setTimeout(res, 120));
  }
  console.log(`${hw}: reached ${ref ?? 'end'} (${saved} saved so far)`);
}
console.log(`DONE: ${saved} new entries`);
