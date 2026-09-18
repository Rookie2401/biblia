// Guards over the shipped lexicon files (public/data/lex): the classes of defect the
// content audits found must not come back when the data is rebuilt.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GrEntry, HeEntry } from '../src/model/types.ts';

const root = path.resolve(__dirname, '..');
const lexDir = path.join(root, 'public', 'data', 'lex');
const have = fs.existsSync(path.join(lexDir, 'he-index.json')) && fs.existsSync(path.join(lexDir, 'gr-index.json'));
const load = <T>(prefix: string): T[] => {
  const out: T[] = [];
  for (const f of fs.readdirSync(lexDir)) if (f.startsWith(prefix) && /^\w+-[^-]+\.json$/.test(f) && !/index|manifest|SOURCES/.test(f)) out.push(...(Object.values(JSON.parse(fs.readFileSync(path.join(lexDir, f), 'utf8'))) as T[]));
  return out;
};
const ARCHAIC = /\b(thou|thee|thy|thine|ye|hath|shalt|art|wilt|doth|begat|didst|saith|unto)\b/i;
/** Shapes of a broken fallback gloss: cut-off braces, lexicon cross references, editorial notes, dangling punctuation. */
const MALFORMED = [/[{}[\]]/, /\b(See|Compare)\b/, /\bsee [HG]?\d/i, /\bcf\b/i, /\bmargin\b/i, /\b(i\.e|e\.g)\b/i, /^[\s,;:.]/, /[,;:.]$/, /\.\s*\S/, /\bworth\b/i];
const cons = (w: string) => w.normalize('NFC').replace(/[֑-ׇ]/g, '').replace(/[^א-ת]/g, '');
const plain = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const HE_POS = ['noun', 'proper noun', 'verb', 'adjective', 'adverb', 'pronoun', 'relative pronoun', 'preposition', 'conjunction', 'particle', 'interjection', 'gentilic', 'number', 'ordinal', 'gentilic adjective'];

describe.skipIf(!have)('shipped lexicon quality', () => {
  const he = load<HeEntry>('he-');
  const gr = load<GrEntry>('gr-');
  const heBy = new Map(he.map((e) => [e.id, e]));
  const grBy = new Map(gr.map((e) => [e.l, e]));

  it('every Hebrew lemma has a short gloss with a named source and no archaic KJV phrasing', () => {
    expect(he.length).toBeGreaterThan(9000);
    expect(he.filter((e) => !e.g)).toEqual([]);
    expect(he.filter((e) => !e.gs).map((e) => e.id)).toEqual([]);
    expect(he.filter((e) => ARCHAIC.test(e.g)).map((e) => `${e.id}: ${e.g}`)).toEqual([]);
  });
  it('no Hebrew gloss is a malformed fragment (braces, cross references, notes, dangling punctuation)', () => {
    const bad = he.filter((e) => MALFORMED.some((re) => re.test(e.g))).map((e) => `${e.id}: ${e.g}`);
    expect(bad).toEqual([]);
    // sanity: the patterns catch the shapes the audit reported
    for (const g of ['{lamentation', 'Ornan. See', 'woe worth.', 'Ashurite.', 'ah! (from the margin)', 'to prophesy, i.e']) expect(MALFORMED.some((re) => re.test(g)), g).toBe(true);
  });
  it('the entries the audit named read correctly', () => {
    expect(heBy.get('190')?.g).toBe('alas! woe!');
    expect(heBy.get('5013')?.g).toBe('to prophesy (Aramaic)');
    expect(heBy.get('771')?.g).toBe('Ornan, a Jebusite (personal name)');
    expect(heBy.get('1929')?.g).toBe('ah! alas!');
    expect(heBy.get('839')?.g).toBe('cedar wood, box wood (a light elastic wood)');
    expect(heBy.get('839')?.pos).toBe('noun');
    for (const id of ['190', '5013', '771', '1929', '839']) expect(heBy.get(id)?.gs, id).toBe('curated');
    expect(heBy.get('2894')?.g).toBe('to sweep away');
    expect(heBy.get('842')?.g).toMatch(/Asherah/);
    expect(heBy.get('1408')?.g).toMatch(/Fortune/);
    expect(heBy.get('528')?.g).toMatch(/Amon/);
    expect(heBy.get('4136')?.pos).toBe('preposition');
  });
  it('part-of-speech labels use the human vocabulary only', () => {
    expect(heBy.get('2004')?.pos).toBe('pronoun');
    expect(heBy.get('7945')?.pos).toBe('relative pronoun');
    expect(heBy.get('7462 b')?.pos).toBe('verb');
    const bad = he.filter((e) => e.pos && !HE_POS.includes(e.pos)).map((e) => `${e.id}: ${e.pos}`);
    expect(bad).toEqual([]);
    expect(he.filter((e) => e.pos && /^[A-Z][a-z]?$/.test(e.pos))).toEqual([]); // no raw OSHB codes (Pp, Pr, Nc …)
  });
  it('the second-person pronoun forms H859 a–e each carry their own metadata and their own BDB entry', () => {
    const want: Record<string, [string, string, RegExp]> = {
      '859 a': ['אתה', 'ʼattâh', /2 s\. m\. thou/],
      '859 b': ['אתי', 'ʾty', /older .* more original form of/],
      '859 c': ['את', 'ʾatt', /2 s\. f\. thou/],
      '859 d': ['אתם', 'ʾattem', /2 m\.pl\. you/],
      '859 e': ['אתן', 'ʾattēn', /2 f\.pl\. you/],
    };
    for (const [id, [c, x, marker]] of Object.entries(want)) {
      const e = heBy.get(id)!;
      expect(e, id).toBeTruthy();
      expect(cons(e.w), id).toBe(c);
      expect(e.x, id).toBe(x);
      expect(e.pos, id).toBe('pronoun');
      expect(e.g, id).toMatch(/^you/);
      expect(e.gs, id).toBe('curated');
      expect(plain(e.bdb), `${id} full entry`).toMatch(marker);
      if (id !== '859 a') {
        // augmented ids naming another form must not inherit the headword's Strong's data
        expect(e.pron, id).toBeUndefined();
        expect(e.sd, id).toBeUndefined();
        expect(e.kj, id).toBeUndefined();
        expect(e.der, id).toBeUndefined();
      } else {
        expect(e.pron).toBe("at-taw'");
        expect(e.sd).toMatch(/thou/);
      }
    }
    const entries = ['859 a', '859 b', '859 c', '859 d', '859 e'].map((id) => heBy.get(id)!.bdb);
    expect(new Set(entries).size).toBe(5);
  });
  it('H7462 a–d: the place name and the three verbs are separate entries', () => {
    const a = heBy.get('7462 a')!;
    expect(cons(a.w)).toBe('ביתעקדהרעים');
    expect(a.x).toBe('bêt-ʿēqed hārōʿîm');
    expect(a.pos).toBe('proper noun');
    expect(a.g).toBe('Beth-eked of the shepherds (place)');
    expect(a.pron).toBeUndefined();
    expect(a.sd).toBeUndefined();
    expect(a.kj).toBeUndefined();
    expect(plain(a.bdb)).toMatch(/n\.pr\.loc/);
    expect(plain(a.bdb)).toMatch(/binding-house of the shepherds/);
    const want: Record<string, [string, RegExp]> = {
      '7462 b': ['to pasture, tend, shepherd; to graze', /vb\. pasture, tend, graze/],
      '7462 c': ['to associate with, be a companion', /vb\. prob\. associate with/],
      '7462 d': ['to be a special friend, befriend', /vb\. denom\. be a special friend/],
    };
    for (const [id, [g, marker]] of Object.entries(want)) {
      const e = heBy.get(id)!;
      expect(cons(e.w), id).toBe('רעה');
      expect(e.x, id).toBe('râʻâh');
      expect(e.pron, id).toBe("raw-aw'");
      expect(e.pos, id).toBe('verb');
      expect(e.g, id).toBe(g);
      expect(plain(e.bdb), `${id} full entry`).toMatch(marker);
    }
    expect(new Set(['7462 a', '7462 b', '7462 c', '7462 d'].map((id) => heBy.get(id)!.bdb)).size).toBe(4);
  });
  it('homographs under one Strong number get their own BDB entry', () => {
    expect(plain(heBy.get('5971 a')?.bdb)).toMatch(/n\.m\. .*people/);
    expect(plain(heBy.get('5971 b')?.bdb)).toMatch(/kinsman/);
    expect(plain(heBy.get('1254 a')?.bdb)).toMatch(/vb\. shape, create/);
    expect(plain(heBy.get('1254 b')?.bdb)).toMatch(/vb\. be fat/);
    expect(plain(heBy.get('6213 b')?.bdb)).toMatch(/vb\. press, squeeze/);
    expect(plain(heBy.get('5869 b')?.bdb)).toMatch(/n\.f\. spring/);
    expect(plain(heBy.get('7451 c')?.bdb)).toMatch(/n\.f\. evil, misery/);
  });

  it('every Greek lemma has a gloss, a transliteration and a named source; no "descendent"', () => {
    expect(gr.length).toBeGreaterThan(5400);
    expect(gr.filter((e) => !e.g).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => !e.x).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => !e.gs).map((e) => e.l)).toEqual([]);
    expect(gr.filter((e) => /descendent/.test(e.g + (e.long ?? ''))).map((e) => e.l)).toEqual([]);
    expect(grBy.get('ἐλεάω')?.g).toMatch(/mercy/);
    expect(grBy.get('ἕνεκεν')?.g).toMatch(/because of/);
    expect(grBy.get('χρυσοῦς')?.g).toMatch(/gold/);
    expect(grBy.get('υἱός')?.g).toBe('a son, descendant');
    expect(grBy.get('ἐλεάω')?.as).toBeTruthy();
    expect(grBy.get('Μαριάμ')?.id).toBe('G3137');
    expect(grBy.get('Ἰωβήλ')?.g).toBe('Jobel (variant of Obed)');
    expect(grBy.get('ραββουνι')?.g).toMatch(/^Rabboni/); // MorphGNT's lemma form (no breathing), kept as the source has it
  });
  it('Greek lemmas resolve to the Strong entry of the same word, not a neighbour', () => {
    const want: Record<string, [string, string, RegExp, RegExp, RegExp]> = {
      // lemma: [Strong's id, transliteration, short gloss, Strong's definition, Dodson long definition]
      'λέγω': ['G3004', 'légō', /^I say, speak/, /lay.*forth|relate|say/, /I say, speak/],
      'εἰμί': ['G1510', 'eimí', /^I am, exist/, /I exist/, /I am, exist/],
      'μοιχαλίς': ['G3428', 'moichalís', /^an adulteress/, /adulteress/, /adulteress/],
      'συμβουλεύω': ['G4823', 'symbouleúō', /^I give advice/, /advice/, /I give advice/],
      'συμπόσιον': ['G4849', 'sympósion', /^a drinking party/, /drinking-party/, /drinking party/],
      'σύνειμι': ['G4895', 'sýneimi', /^I am with/, /in company with/, /I am with/],
      'ἕκτος': ['G1623', 'héktos', /^sixth/, /^sixth/, /^sixth/],
      'ἐκτός': ['G1622', 'ektós', /^without, outside/, /exterior/, /without, outside/],
    };
    for (const [l, [id, x, g, sd, long]] of Object.entries(want)) {
      const e = grBy.get(l)!;
      expect(e, l).toBeTruthy();
      expect(e.id, l).toBe(id);
      expect(e.x, l).toBe(x);
      expect(e.g, l).toMatch(g);
      expect(e.gs, l).toBe('dodson');
      expect(e.sd, l).toMatch(sd);
      expect(e.long, l).toMatch(long);
    }
    // the two are distinct entries in every field that identifies them
    expect(grBy.get('ἕκτος')!.id).not.toBe(grBy.get('ἐκτός')!.id);
    expect(grBy.get('ἕκτος')!.x).not.toBe(grBy.get('ἐκτός')!.x);
    // a Strong's number maps only to the lemma that is that word
    const byId = new Map<string, string[]>();
    for (const e of gr) if (e.id) (byId.get(e.id) ?? byId.set(e.id, []).get(e.id)!).push(e.l);
    expect(byId.get('G3004')).toEqual(['λέγω']);
    expect(byId.get('G1510')).toEqual(['εἰμί']);
    expect(byId.get('G1623')).toEqual(['ἕκτος']);
    expect(byId.get('G1622')).toEqual(['ἐκτός']);
  });
  it('the Strong conflict report exists and every conflict was resolved to the canonical lemma or a reviewed override', () => {
    const p = path.join(root, 'data', 'build', 'gr-strong-conflicts.json');
    if (!fs.existsSync(p)) return;
    const conflicts = JSON.parse(fs.readFileSync(p, 'utf8')) as { lemma: string; abbott: string; canonical: string | null; used: string | null; note: string }[];
    const unresolved = conflicts.filter((c) => !c.used);
    // καταβαρύνομαι and προσκλίνομαι have no Strong's entry under any spelling; Abbott-Smith's numbers point at other words
    expect(unresolved.map((c) => c.lemma).sort()).toEqual(['καταβαρύνομαι', 'προσκλίνομαι']);
    for (const c of conflicts.filter((c) => c.used)) {
      expect(c.used, c.lemma).toBe(c.canonical);
      expect(grBy.get(c.lemma)?.id, c.lemma).toBe(c.used);
    }
    const overrides = JSON.parse(fs.readFileSync(path.join(root, 'data', 'curated', 'gr-overrides.json'), 'utf8')).overrides as Record<string, { strong: string; why: string }>;
    for (const [l, o] of Object.entries(overrides)) {
      expect(grBy.get(l)?.id, l).toBe(o.strong);
      expect(o.why.length, l).toBeGreaterThan(10);
    }
  });
  it('the search index rows carry the gloss source', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(lexDir, 'he-index.json'), 'utf8')) as unknown[][];
    expect(idx.every((r) => r.length === 6 && typeof r[5] === 'string')).toBe(true);
    const gidx = JSON.parse(fs.readFileSync(path.join(lexDir, 'gr-index.json'), 'utf8')) as unknown[][];
    expect(gidx.every((r) => r.length === 6 && typeof r[5] === 'string')).toBe(true);
    expect(gidx.find((r) => r[0] === 'λέγω')?.[1]).toBe('G3004');
  });
});
