// Records a SHA-256 for every git-ignored raw input the data build reads (data/mam-raw, oshb,
// gnt, lexicon, bsb) so the exact bytes an audited build used are pinned even though the files
// themselves are not committed (fetch-sources.mjs re-downloads them; the BSB workbook is a manual
// download from berean.bible/downloads.htm). A mismatch here on a later run means an upstream
// source changed since the audit, not that the build is broken.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const DIRS = ['mam-raw', 'oshb', 'gnt', 'lexicon', 'bsb'];

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk = (dir, rel = '') => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const r = rel ? rel + '/' + name : name;
    out.push(...(fs.statSync(p).isDirectory() ? walk(p, r) : [[r, p]]));
  }
  return out;
};

const manifest = { generated: new Date().toISOString().slice(0, 10), note: 'sha256 of every git-ignored raw input under data/ (see fetch-sources.mjs and README "Texts and data"); not the built output', dirs: {} };
let missing = 0;
for (const d of DIRS) {
  const files = walk(path.join(dataDir, d));
  if (!files.length) {
    missing++;
    console.warn(`checksum-sources: data/${d} is empty or missing (run fetch-sources.mjs / download the BSB workbook first)`);
    continue;
  }
  manifest.dirs[d] = Object.fromEntries(files.map(([rel, p]) => [rel, sha256(p)]));
}
const outPath = path.join(root, 'data', 'build', 'SOURCE-CHECKSUMS.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
const total = Object.values(manifest.dirs).reduce((n, f) => n + Object.keys(f).length, 0);
console.log(`checksum-sources: ${total} files across ${Object.keys(manifest.dirs).length}/${DIRS.length} source directories -> ${path.relative(root, outPath)}`);
if (missing) process.exitCode = 1;
