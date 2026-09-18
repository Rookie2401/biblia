// Second pass for the complete BDB: Sefaria's /api/words/<form> only resolves entries that have
// registered word forms, so walking prev_hw/next_hw stops at roots and names. Every lexeme the
// app needs has a Strong's number, and looking up the Strong's lemma (consonantal, then pointed)
// returns the BDB entries that carry it. Saves by rid into data/bdb-sefaria/ like fetch-bdb.mjs.
// Resumable: data/bdb-sefaria/_done2.json lists the forms already queried.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'bdb-sefaria');
fs.mkdirSync(dir, { recursive: true });
const donePath = path.join(dir, '_done2.json');
const done = new Set(fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, 'utf8')) : []);
const have = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.slice(0, -5)));
const LEXICA = new Set(['BDB Dictionary', 'BDB Aramaic Dictionary']);

const sj = fs.readFileSync(path.join(root, 'data', 'lexicon', 'strongs-hebrew-dictionary.js'), 'utf8');
const strongs = JSON.parse(sj.slice(sj.indexOf('{'), sj.lastIndexOf('}') + 1));
const cons = (w) => w.normalize('NFC').replace(/[֑-ׇ͏]/g, '').replace(/[^א-ת]/g, '');
// which Strong's numbers already have an entry on disk
const covered = new Set();
for (const rid of have) {
  try {
    const e = JSON.parse(fs.readFileSync(path.join(dir, rid + '.json'), 'utf8'));
    for (const n of e.strong_numbers || []) covered.add(String(n));
  } catch {
    /* ignore */
  }
}
const forms = [];
const seen = new Set();
for (const [id, e] of Object.entries(strongs)) {
  const num = id.slice(1);
  if (covered.has(num)) continue;
  const c = cons(e.lemma || '');
  if (c && !seen.has(c)) {
    seen.add(c);
    forms.push([c, num]);
  }
}
console.log(`${forms.length} forms to query (${covered.size} Strong's numbers already covered by ${have.size} entries)`);

let fetched = 0;
let failures = 0;
let queried = 0;
async function lookup(form) {
  const url = `https://www.sefaria.org/api/words/${encodeURIComponent(form)}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'biblia-v0 fetch-bdb (personal study app; BDB is public domain)' } });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) return [];
      return await r.json();
    } catch (e) {
      if (attempt === 5) {
        failures++;
        console.error('FAILED', form, e.message);
        return [];
      }
      await new Promise((res) => setTimeout(res, 3000 * attempt));
    }
  }
  return [];
}
const queue = forms.filter(([f]) => !done.has(f));
function save() {
  fs.writeFileSync(donePath, JSON.stringify([...done]));
}
async function worker() {
  while (queue.length) {
    const [form, num] = queue.shift();
    let entries = await lookup(form);
    let bdb = entries.filter((e) => LEXICA.has(e.parent_lexicon));
    if (!bdb.length) {
      // the pointed lemma as a second try
      const pointed = strongs['H' + num]?.lemma?.normalize('NFC');
      if (pointed && pointed !== form) {
        entries = await lookup(pointed);
        bdb = entries.filter((e) => LEXICA.has(e.parent_lexicon));
      }
    }
    for (const e of bdb) {
      if (e.rid && !have.has(e.rid)) {
        fs.writeFileSync(path.join(dir, e.rid + '.json'), JSON.stringify(e));
        have.add(e.rid);
        fetched++;
      }
    }
    done.add(form);
    queried++;
    if (queried % 100 === 0) {
      save();
      console.log(`${new Date().toISOString().slice(11, 19)} queried ${queried}/${forms.length}, ${have.size} entries on disk`);
    }
    await new Promise((res) => setTimeout(res, 200));
  }
}
await Promise.all([worker(), worker(), worker()]);
save();
console.log(`DONE: ${have.size} BDB entries on disk (${fetched} new this run, ${failures} failures)`);
