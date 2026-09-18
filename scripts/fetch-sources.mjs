// Downloads every source text and lexicon into data/ (idempotent: skips files already present).
//   Tanakh:  Miqra according to the Masorah via the Sefaria API (CC BY-SA 4.0)  -> data/mam-raw/<Book>.json
//   Morph:   Open Scriptures Hebrew Bible WLC + morphology (CC BY 4.0)         -> data/oshb/<Bk>.xml
//   Lexica:  BDB + LexicalIndex (openscriptures/HebrewLexicon, CC BY 4.0), Strong's Hebrew/Greek (PD),
//            Dodson Greek lexicon (PD), Abbott-Smith (PD, TEI by translatable-exegetical-tools)
//   GNT:     SBLGNT text + MorphGNT analysis (text CC BY 4.0, analysis CC BY-SA 3.0)   -> data/gnt/NN-Xx-morphgnt.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');

export const TANAKH = [
  ['Genesis', 'Gen'], ['Exodus', 'Exod'], ['Leviticus', 'Lev'], ['Numbers', 'Num'], ['Deuteronomy', 'Deut'],
  ['Joshua', 'Josh'], ['Judges', 'Judg'], ['I Samuel', '1Sam'], ['II Samuel', '2Sam'], ['I Kings', '1Kgs'], ['II Kings', '2Kgs'],
  ['Isaiah', 'Isa'], ['Jeremiah', 'Jer'], ['Ezekiel', 'Ezek'], ['Hosea', 'Hos'], ['Joel', 'Joel'], ['Amos', 'Amos'], ['Obadiah', 'Obad'],
  ['Jonah', 'Jonah'], ['Micah', 'Mic'], ['Nahum', 'Nah'], ['Habakkuk', 'Hab'], ['Zephaniah', 'Zeph'], ['Haggai', 'Hag'], ['Zechariah', 'Zech'], ['Malachi', 'Mal'],
  ['Psalms', 'Ps'], ['Proverbs', 'Prov'], ['Job', 'Job'], ['Song of Songs', 'Song'], ['Ruth', 'Ruth'], ['Lamentations', 'Lam'], ['Ecclesiastes', 'Eccl'],
  ['Esther', 'Esth'], ['Daniel', 'Dan'], ['Ezra', 'Ezra'], ['Nehemiah', 'Neh'], ['I Chronicles', '1Chr'], ['II Chronicles', '2Chr'],
];
export const GNT = ['61-Mt', '62-Mk', '63-Lk', '64-Jn', '65-Ac', '66-Ro', '67-1Co', '68-2Co', '69-Ga', '70-Eph', '71-Php', '72-Col', '73-1Th', '74-2Th', '75-1Ti', '76-2Ti', '77-Tit', '78-Phm', '79-Heb', '80-Jas', '81-1Pe', '82-2Pe', '83-1Jn', '84-2Jn', '85-3Jn', '86-Jud', '87-Re'];

async function get(url, dest, check) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 'kept';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'biblia-v0 fetch-sources (personal study app)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.text();
      if (check && !check(body)) throw new Error('unexpected content');
      fs.writeFileSync(dest, body);
      return 'fetched ' + body.length;
    } catch (e) {
      if (attempt === 4) throw new Error(url + ': ' + e.message);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

const jobs = [];
for (const [name, abbr] of TANAKH) {
  const ref = name.replace(/ /g, '_');
  jobs.push([`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew|Miqra_according_to_the_Masorah`, path.join(dataDir, 'mam-raw', abbr + '.json'), (b) => b.includes('Miqra according to the Masorah')]);
  jobs.push([`https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${abbr}.xml`, path.join(dataDir, 'oshb', abbr + '.xml'), (b) => b.includes('<verse')]);
}
for (const f of GNT) jobs.push([`https://raw.githubusercontent.com/morphgnt/sblgnt/master/${f}-morphgnt.txt`, path.join(dataDir, 'gnt', f + '-morphgnt.txt')]);
jobs.push(['https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/BrownDriverBriggs.xml', path.join(dataDir, 'lexicon', 'BrownDriverBriggs.xml')]);
jobs.push(['https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/LexicalIndex.xml', path.join(dataDir, 'lexicon', 'LexicalIndex.xml')]);
jobs.push(['https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js', path.join(dataDir, 'lexicon', 'strongs-hebrew-dictionary.js')]);
jobs.push(['https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js', path.join(dataDir, 'lexicon', 'strongs-greek-dictionary.js')]);
jobs.push(['https://raw.githubusercontent.com/biblicalhumanities/Dodson-Greek-Lexicon/master/dodson.csv', path.join(dataDir, 'lexicon', 'dodson.csv')]);
jobs.push(['https://raw.githubusercontent.com/translatable-exegetical-tools/Abbott-Smith/master/abbott-smith.tei.xml', path.join(dataDir, 'lexicon', 'abbott-smith.tei.xml')]);
jobs.push(['https://raw.githubusercontent.com/morphgnt/sblgnt/master/LICENSE', path.join(dataDir, 'gnt', 'LICENSE.txt')]);
jobs.push(['https://raw.githubusercontent.com/openscriptures/morphhb/master/README.md', path.join(dataDir, 'oshb', 'README.md')]);

let failed = 0;
// modest concurrency, Sefaria is rate-limited
const queue = [...jobs];
async function worker() {
  while (queue.length) {
    const [url, dest, check] = queue.shift();
    try {
      const r = await get(url, dest, check);
      console.log(r.padEnd(16), path.relative(root, dest));
    } catch (e) {
      failed++;
      console.error('FAILED', e.message);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(failed ? `DONE with ${failed} failures` : 'DONE, all sources present');
process.exit(failed ? 1 : 0);
