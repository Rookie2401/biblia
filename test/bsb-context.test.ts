// The contextual (BSB) layer: the versification map is explicit and reviewable, every base verse
// lands on the English verse it corresponds to, and the shipped arrays keep the '' / null semantics.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM build script
import { RULES, englishRange, psalmMap } from '../scripts/versification.mjs';

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const ctxDir = path.join(dataDir, 'ctx');
const have = fs.existsSync(path.join(ctxDir, 'he', 'Joel.json')) && fs.existsSync(path.join(ctxDir, 'gr', 'John.json'));
const diagPath = path.join(root, 'data', 'build', 'ctx-diagnostics.json');

type Lang = 'he' | 'gr';
interface TextBook { book: string; chapters: { n: number; verses: { n: number; w: unknown[] }[] }[] }
interface CtxBook { book: string; chapters: (string | null)[][][] }
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const text = (lang: Lang, book: string) => readJson<TextBook>(path.join(dataDir, lang, `${book}.json`));
const ctx = (lang: Lang, book: string) => readJson<CtxBook>(path.join(ctxDir, lang, `${book}.json`));
const verse = (lang: Lang, book: string, ch: number, v: number) => ctx(lang, book).chapters[ch - 1][v - 1];
const english = (lang: Lang, book: string, ch: number, v: number) => verse(lang, book, ch, v).filter(Boolean).join(' ');

describe('versification map', () => {
  const at = (book: string, ch: number, v: number, opts?: { psalmOffset?: number }) => {
    const r = englishRange(book, ch, v, opts);
    return r && `${r.from[0]}:${r.from[1]}-${r.to[0]}:${r.to[1]}`;
  };
  it('maps the audited boundary verses onto the English verses they correspond to', () => {
    expect(at('Joel', 3, 1)).toBe('2:28-2:28');
    expect(at('Joel', 3, 5)).toBe('2:32-2:32');
    expect(at('Joel', 4, 1)).toBe('3:1-3:1');
    expect(at('Joel', 4, 21)).toBe('3:21-3:21');
    expect(at('Mal', 3, 19)).toBe('4:1-4:1');
    expect(at('Mal', 3, 24)).toBe('4:6-4:6');
    expect(at('Mal', 3, 18)).toBeNull();
    expect(at('1Kgs', 5, 1)).toBe('4:21-4:21');
    expect(at('1Kgs', 5, 14)).toBe('4:34-4:34');
    expect(at('1Kgs', 5, 15)).toBe('5:1-5:1');
    expect(at('1Kgs', 5, 32)).toBe('5:18-5:18');
    expect(at('Zech', 2, 1)).toBe('1:18-1:18');
    expect(at('Zech', 2, 4)).toBe('1:21-1:21');
    expect(at('Zech', 2, 5)).toBe('2:1-2:1');
    expect(at('Zech', 2, 17)).toBe('2:13-2:13');
    expect(at('Isa', 63, 19)).toBe('63:19-64:1');
    expect(at('Ps', 13, 6)).toBe('13:5-13:6');
    expect(at('Exod', 20, 13)).toBe('20:1-20:999'); // the Decalogue is one passage in both numberings
    expect(at('Gen', 1, 3)).toBeNull();
    expect(at('John', 1, 1)).toBeNull();
    expect(at('Rev', 12, 18)).toBe('12:17-13:1');
  });
  it('folds Psalm titles into English verse 1', () => {
    expect(psalmMap(3, 1, 1)).toEqual({ from: [3, 1], to: [3, 1] });
    expect(psalmMap(3, 2, 1)).toEqual({ from: [3, 1], to: [3, 1] });
    expect(psalmMap(3, 3, 1)).toEqual({ from: [3, 2], to: [3, 2] });
    expect(psalmMap(51, 3, 2)).toEqual({ from: [51, 1], to: [51, 1] });
    expect(psalmMap(1, 1, 0)).toBeNull();
    expect(at('Ps', 3, 2, { psalmOffset: 1 })).toBe('3:1-3:1');
  });
  it('no two rules claim the same base verse', () => {
    const seen = new Map<string, unknown>();
    for (const r of RULES as { book: string; base?: number[]; chapter?: number }[]) {
      const keys: string[] = [];
      if (r.chapter !== undefined) keys.push(`${r.book} ${r.chapter}:*`);
      else if (r.base!.length === 3) for (let v = r.base![1]; v <= r.base![2]; v++) keys.push(`${r.book} ${r.base![0]}:${v}`);
      else keys.push(`${r.book} ${r.base![0]}:${r.base![1]}`);
      for (const k of keys) {
        expect(seen.has(k), `duplicate rule for ${k}`).toBe(false);
        seen.set(k, r);
      }
    }
    expect(seen.size).toBeGreaterThan(400);
  });
});

describe.skipIf(!have)('shipped contextual renderings', () => {
  it('every verse carries exactly one value per word, each a string or null', () => {
    for (const lang of ['he', 'gr'] as Lang[]) {
      for (const f of fs.readdirSync(path.join(ctxDir, lang))) {
        const c = readJson<CtxBook>(path.join(ctxDir, lang, f));
        const t = text(lang, c.book);
        expect(c.chapters.length, `${lang} ${c.book} chapters`).toBe(t.chapters.length);
        t.chapters.forEach((ch, ci) => {
          expect(c.chapters[ci].length, `${lang} ${c.book} ${ch.n} verses`).toBe(ch.verses.length);
          ch.verses.forEach((v, vi) => {
            const arr = c.chapters[ci][vi];
            expect(arr.length, `${lang} ${c.book} ${ch.n}:${v.n}`).toBe(v.w.length);
            for (const g of arr) expect(g === null || typeof g === 'string').toBe(true);
          });
        });
      }
    }
  });
  it('Joel 3–4 (MT) read as English 2:28–32 and 3', () => {
    expect(english('he', 'Joel', 3, 1)).toMatch(/pour out/);
    expect(english('he', 'Joel', 3, 1)).toMatch(/Spirit/);
    expect(english('he', 'Joel', 3, 1)).toMatch(/dream/);
    expect(english('he', 'Joel', 4, 1)).toMatch(/Judah/);
    expect(english('he', 'Joel', 4, 1)).toMatch(/Jerusalem/);
    expect(english('he', 'Joel', 4, 2)).toMatch(/Jehoshaphat/);
    expect(english('he', 'Joel', 4, 10)).toMatch(/plowshares|plow/);
  });
  it('Malachi 3:19–24 (MT) read as English 4:1–6', () => {
    expect(english('he', 'Mal', 3, 19)).toMatch(/furnace/);
    expect(english('he', 'Mal', 3, 19)).toMatch(/stubble/);
    expect(english('he', 'Mal', 3, 20)).toMatch(/sun of righteousness|righteousness/);
    expect(english('he', 'Mal', 3, 23)).toMatch(/Elijah/);
    expect(english('he', 'Mal', 3, 24)).toMatch(/hearts/);
    expect(english('he', 'Mal', 3, 24)).toMatch(/curse/);
  });
  it('1 Kings 5 (MT) reads as English 4:21–34 then 5:1–18', () => {
    expect(english('he', '1Kgs', 5, 1)).toMatch(/Solomon/);
    expect(english('he', '1Kgs', 5, 1)).toMatch(/kingdoms/);
    expect(english('he', '1Kgs', 5, 1)).toMatch(/Philistines/);
    expect(english('he', '1Kgs', 5, 15)).toMatch(/Hiram/);
    expect(english('he', '1Kgs', 5, 15)).toMatch(/Tyre/);
    expect(english('he', '1Kgs', 5, 20)).toMatch(/cedars|cedar/);
  });
  it('Zechariah 2 (MT) reads as English 1:18–21 then 2:1–13', () => {
    expect(english('he', 'Zech', 2, 1)).toMatch(/four/);
    expect(english('he', 'Zech', 2, 1)).toMatch(/horns/);
    expect(english('he', 'Zech', 2, 5)).toMatch(/measuring/);
    expect(english('he', 'Zech', 2, 5)).toMatch(/man/);
  });
  it('other mapped boundaries land on their passages', () => {
    expect(english('he', 'Ps', 13, 1)).toMatch(/choirmaster/);
    expect(english('he', 'Ps', 13, 6)).toMatch(/loving devotion|trusted/);
    expect(english('he', 'Isa', 63, 19)).toMatch(/rend/);
    expect(english('he', 'Isa', 63, 19)).toMatch(/heavens/);
    expect(english('he', 'Dan', 4, 1)).toMatch(/Nebuchadnezzar/);
    expect(english('he', 'Dan', 4, 1)).toMatch(/palace/);
    const exod20 = ctx('he', 'Exod').chapters[19].flat().filter(Boolean).join(' ');
    expect(exod20).toMatch(/murder/);
    expect(exod20).toMatch(/steal/);
    expect(english('gr', 'Rev', 12, 18)).toMatch(/sea|shore/);
    expect(english('gr', '3John', 1, 15)).toMatch(/Peace/);
  });
  it('unmapped verses are unchanged', () => {
    expect(english('he', 'Gen', 1, 3)).toMatch(/Let there be/);
    expect(english('he', 'Gen', 1, 3)).toMatch(/light/);
    const john = verse('gr', 'John', 1, 1);
    expect(john.filter((g) => g === 'Word')).toHaveLength(3);
    expect(john[0]).toBe('In');
  });
  it("'' marks a word rendered with its neighbour and null a word the BSB does not have", () => {
    // the object marker in Joel 3:1 (MT) has no English of its own
    expect(verse('he', 'Joel', 3, 1)[4]).toBe('');
    // the BSB never prints its own placeholders as renderings
    for (const lang of ['he', 'gr'] as Lang[]) {
      for (const book of lang === 'he' ? ['Gen', 'Joel', 'Ps'] : ['Mark', 'Rom', 'John']) {
        for (const g of ctx(lang, book).chapters.flat(2)) expect(g === null || !/^(-|vvv|\. \. \.|\.\.\.)$/.test(g)).toBe(true);
      }
    }
    // the shorter ending of Mark (absent from the BSB) is null, the verse before it is rendered
    const mk = verse('gr', 'Mark', 16, 8);
    expect(mk.slice(0, 18).some((g) => g)).toBe(true);
    expect(mk.slice(18).every((g) => g === null)).toBe(true);
    // Romans 16:24 is not in the BSB
    expect(verse('gr', 'Rom', 16, 24).every((g) => g === null)).toBe(true);
  });
  it('the coverage summary is above the floor', () => {
    const cov = readJson<{ he: { total: { coverage: number } }; gr: { total: { coverage: number } } }>(path.join(ctxDir, 'COVERAGE.json'));
    expect(cov.he.total.coverage).toBeGreaterThan(0.99);
    expect(cov.gr.total.coverage).toBeGreaterThan(0.99);
  });
  it.skipIf(!fs.existsSync(diagPath))('every mapped boundary chapter aligned nearly completely (build diagnostics)', () => {
    const d = readJson<{ chapters: Record<Lang, Record<string, { coverage: number; rules: unknown[] }>>; problems: unknown[] }>(diagPath);
    expect(d.problems).toEqual([]);
    for (const k of ['Joel 3', 'Joel 4', 'Mal 3', '1Kgs 5', 'Zech 2', 'Ps 13', 'Isa 63', 'Isa 64', 'Exod 20', 'Deut 5', 'Neh 10', 'Hos 2', 'Num 17']) {
      expect(d.chapters.he[k].coverage, k).toBeGreaterThanOrEqual(0.98);
      expect(d.chapters.he[k].rules.length, `${k} rules`).toBeGreaterThan(0);
    }
    for (const k of ['Acts 19', '2Cor 13', '3John 1', 'Rev 12']) expect(d.chapters.gr[k].coverage, k).toBeGreaterThanOrEqual(0.98);
  });
});
