// Fetches the complete Brown-Driver-Briggs lexicon (1906, public domain) from Sefaria's
// lexicon API by walking the headword chain (prev_hw / next_hw) of "BDB Dictionary" and
// "BDB Aramaic Dictionary". Each entry is saved once by its rid into data/bdb-sefaria/.
// Idempotent and resumable: already-saved rids are not refetched; the frontier is kept in
// data/bdb-sefaria/_state.json. Polite: two requests in flight, a short pause between them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'bdb-sefaria');
fs.mkdirSync(dir, { recursive: true });
const statePath = path.join(dir, '_state.json');
const LEXICA = ['BDB Dictionary', 'BDB Aramaic Dictionary'];
const SEEDS = { 'BDB Dictionary': ['אָב', 'מָה', 'שָׁלוֹם'], 'BDB Aramaic Dictionary': ['בַּר', 'מֶלֶךְ'] };

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { visited: {}, queue: [] };
const visited = new Map(Object.entries(state.visited)); // "lexicon|headword" -> true
const queue = state.queue.length ? state.queue : LEXICA.flatMap((l) => SEEDS[l].map((h) => [l, h]));
const have = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.slice(0, -5)));
let fetched = 0;
let failures = 0;

function save() {
  fs.writeFileSync(statePath, JSON.stringify({ visited: Object.fromEntries(visited), queue }));
}

async function lookup(hw) {
  const url = `https://www.sefaria.org/api/words/${encodeURIComponent(hw)}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'biblia-v0 fetch-bdb (personal study app; BDB is public domain)' } });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) return [];
      return await r.json();
    } catch (e) {
      if (attempt === 5) {
        failures++;
        console.error('FAILED', hw, e.message);
        return [];
      }
      await new Promise((res) => setTimeout(res, 3000 * attempt));
    }
  }
  return [];
}

async function worker() {
  while (queue.length) {
    const [lex, hw] = queue.shift();
    const key = lex + '|' + hw;
    if (visited.has(key)) continue;
    visited.set(key, true);
    const entries = await lookup(hw);
    for (const e of entries) {
      if (!LEXICA.includes(e.parent_lexicon)) continue;
      if (e.rid && !have.has(e.rid)) {
        fs.writeFileSync(path.join(dir, e.rid + '.json'), JSON.stringify(e));
        have.add(e.rid);
        fetched++;
      }
      for (const nb of [e.prev_hw, e.next_hw]) if (nb && !visited.has(e.parent_lexicon + '|' + nb)) queue.push([e.parent_lexicon, nb]);
    }
    if ((fetched + failures) % 50 === 0) {
      save();
      console.log(`${new Date().toISOString().slice(11, 19)} saved ${have.size} entries, queue ${queue.length}`);
    }
    await new Promise((res) => setTimeout(res, 250));
  }
}

await Promise.all([worker(), worker()]);
save();
console.log(`DONE: ${have.size} BDB entries on disk (${fetched} new this run, ${failures} failures)`);
