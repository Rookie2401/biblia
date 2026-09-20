/**
 * The canon: 39 books of the Tanakh in Masoretic order, then the 27 of the Greek New
 * Testament. Names, sections and verse counts come from src/data/canon.json, which the
 * data build derives from the text files themselves.
 */
import canonJson from '../data/canon.json';
import type { Lang } from '../model/types.ts';

export interface BookInfo {
  id: string;
  lang: Lang;
  en: string;
  native: string;
  section: string;
  /** verses per chapter */
  verses: number[];
}

export const CANON: BookInfo[] = canonJson as BookInfo[];
const byId = new Map(CANON.map((b) => [b.id, b]));

export const SECTIONS: { id: string; title: string; native: string; lang: Lang }[] = [
  { id: 'Torah', title: 'Torah', native: 'תּוֹרָה', lang: 'he' },
  { id: 'Neviim', title: 'Prophets', native: 'נְבִיאִים', lang: 'he' },
  { id: 'Ketuvim', title: 'Writings', native: 'כְּתוּבִים', lang: 'he' },
  { id: 'Gospels', title: 'Gospels', native: 'Εὐαγγέλια', lang: 'gr' },
  { id: 'Acts', title: 'Acts', native: 'Πράξεις', lang: 'gr' },
  { id: 'Paul', title: 'Letters of Paul', native: 'Ἐπιστολαὶ Παύλου', lang: 'gr' },
  { id: 'General', title: 'General letters', native: 'Καθολικαὶ ἐπιστολαί', lang: 'gr' },
  { id: 'Revelation', title: 'Revelation', native: 'Ἀποκάλυψις', lang: 'gr' },
  { id: 'LxxLaw', title: 'Law', native: 'Νόμος', lang: 'gr' },
  { id: 'LxxHistory', title: 'History', native: 'Ἱστορικά', lang: 'gr' },
  { id: 'LxxPoetry', title: 'Poetry & Wisdom', native: 'Ποιητικά', lang: 'gr' },
  { id: 'LxxProphets', title: 'Prophets', native: 'Προφῆται', lang: 'gr' },
  { id: 'VulgGospels', title: 'Gospels', native: 'Evangelia', lang: 'la' },
  { id: 'VulgActs', title: 'Acts', native: 'Actus Apostolorum', lang: 'la' },
  { id: 'VulgPaul', title: "Letters of Paul", native: 'Epistolæ Paulinæ', lang: 'la' },
  { id: 'VulgGeneral', title: 'General letters', native: 'Epistolæ Catholicæ', lang: 'la' },
  { id: 'VulgRevelation', title: 'Revelation', native: 'Apocalypsis', lang: 'la' },
];

export function book(id: string): BookInfo | undefined {
  return byId.get(id);
}
export function langOf(id: string): Lang {
  return byId.get(id)?.lang ?? 'he';
}
export function bookIndex(id: string): number {
  return CANON.findIndex((b) => b.id === id);
}
export function chapterCount(id: string): number {
  return byId.get(id)?.verses.length ?? 0;
}

/** The Septuagint shares `lang: 'gr'` with the New Testament (so a Septuagint word's vocabulary
 * can merge with the NT's), but they are separate reading sequences — a "next chapter" must
 * never cross from Revelation into Genesis (LXX) or vice versa just because both are Greek.
 * Within each, the existing divisions (Torah/Neviim/Ketuvim; Gospels/Acts/Paul/...; the four
 * Septuagint groups) were always meant to flow into each other, so this only needs to catch
 * the one new boundary, not reintroduce a check on every different `section` value. */
const isLxx = (section: string): boolean => section.startsWith('Lxx');

/** The chapter after (dir = 1) or before (dir = -1) this one, crossing into the next book of the same testament. */
export function adjacentChapter(id: string, ch: number, dir: 1 | -1): { book: string; ch: number } | null {
  const b = byId.get(id);
  if (!b || !Number.isInteger(ch) || ch < 1 || ch > b.verses.length) return null;
  const next = ch + dir;
  if (next >= 1 && next <= b.verses.length) return { book: id, ch: next };
  const i = bookIndex(id) + dir;
  const nb = CANON[i];
  if (!nb || nb.lang !== b.lang || isLxx(nb.section) !== isLxx(b.section)) return null;
  return { book: nb.id, ch: dir === 1 ? 1 : nb.verses.length };
}

/** True when the chapter (and verse, if given) exists. */
export function validRef(id: string, ch: number, v?: number): boolean {
  const b = byId.get(id);
  if (!b || !Number.isInteger(ch) || ch < 1 || ch > b.verses.length) return false;
  if (v === undefined) return true;
  return Number.isInteger(v) && v >= 1 && v <= b.verses[ch - 1];
}

/** "Genesis 1" / "1 Kings 3:4" in English. */
export function refLabel(id: string, ch?: number, v?: number): string {
  const b = byId.get(id);
  if (!b) return id;
  return b.en + (ch ? ` ${ch}` : '') + (v ? `:${v}` : '');
}

const ALIASES: Record<string, string> = {
  gn: 'Gen', ge: 'Gen', gen: 'Gen', genesis: 'Gen', bereshit: 'Gen',
  ex: 'Exod', exo: 'Exod', exod: 'Exod', exodus: 'Exod', shemot: 'Exod',
  lv: 'Lev', le: 'Lev', lev: 'Lev', leviticus: 'Lev', vayikra: 'Lev',
  nu: 'Num', nm: 'Num', num: 'Num', numbers: 'Num', bamidbar: 'Num',
  dt: 'Deut', de: 'Deut', deu: 'Deut', deut: 'Deut', deuteronomy: 'Deut', devarim: 'Deut',
  jos: 'Josh', josh: 'Josh', joshua: 'Josh', jdg: 'Judg', jg: 'Judg', judg: 'Judg', judges: 'Judg',
  '1sa': '1Sam', '1sam': '1Sam', '1samuel': '1Sam', isam: '1Sam', '2sa': '2Sam', '2sam': '2Sam', '2samuel': '2Sam', iisam: '2Sam',
  '1ki': '1Kgs', '1kgs': '1Kgs', '1kings': '1Kgs', '2ki': '2Kgs', '2kgs': '2Kgs', '2kings': '2Kgs',
  is: 'Isa', isa: 'Isa', isaiah: 'Isa', je: 'Jer', jer: 'Jer', jeremiah: 'Jer', eze: 'Ezek', ezk: 'Ezek', ezek: 'Ezek', ezekiel: 'Ezek',
  ho: 'Hos', hos: 'Hos', hosea: 'Hos', joe: 'Joel', joel: 'Joel', am: 'Amos', amos: 'Amos', ob: 'Obad', oba: 'Obad', obad: 'Obad', obadiah: 'Obad',
  jon: 'Jonah', jonah: 'Jonah', mi: 'Mic', mic: 'Mic', micah: 'Mic', na: 'Nah', nah: 'Nah', nahum: 'Nah', hab: 'Hab', habakkuk: 'Hab',
  zep: 'Zeph', zeph: 'Zeph', zephaniah: 'Zeph', hag: 'Hag', haggai: 'Hag', zec: 'Zech', zech: 'Zech', zechariah: 'Zech', mal: 'Mal', malachi: 'Mal',
  ps: 'Ps', psa: 'Ps', psalm: 'Ps', psalms: 'Ps', tehillim: 'Ps', pr: 'Prov', pro: 'Prov', prov: 'Prov', proverbs: 'Prov', job: 'Job', jb: 'Job',
  so: 'Song', sos: 'Song', song: 'Song', songofsongs: 'Song', canticles: 'Song', ru: 'Ruth', rut: 'Ruth', ruth: 'Ruth', la: 'Lam', lam: 'Lam', lamentations: 'Lam',
  ec: 'Eccl', ecc: 'Eccl', eccl: 'Eccl', ecclesiastes: 'Eccl', qohelet: 'Eccl', es: 'Esth', est: 'Esth', esth: 'Esth', esther: 'Esth',
  da: 'Dan', dan: 'Dan', daniel: 'Dan', ezr: 'Ezra', ezra: 'Ezra', ne: 'Neh', neh: 'Neh', nehemiah: 'Neh',
  '1ch': '1Chr', '1chr': '1Chr', '1chronicles': '1Chr', '2ch': '2Chr', '2chr': '2Chr', '2chronicles': '2Chr',
  mt: 'Matt', mat: 'Matt', matt: 'Matt', matthew: 'Matt', mk: 'Mark', mar: 'Mark', mark: 'Mark', lk: 'Luke', luk: 'Luke', luke: 'Luke',
  jn: 'John', joh: 'John', john: 'John', ac: 'Acts', act: 'Acts', acts: 'Acts', ro: 'Rom', rom: 'Rom', romans: 'Rom',
  '1co': '1Cor', '1cor': '1Cor', '1corinthians': '1Cor', '2co': '2Cor', '2cor': '2Cor', '2corinthians': '2Cor',
  ga: 'Gal', gal: 'Gal', galatians: 'Gal', eph: 'Eph', ephesians: 'Eph', php: 'Phil', phil: 'Phil', philippians: 'Phil', col: 'Col', colossians: 'Col',
  '1th': '1Thess', '1thess': '1Thess', '1thessalonians': '1Thess', '2th': '2Thess', '2thess': '2Thess', '2thessalonians': '2Thess',
  '1ti': '1Tim', '1tim': '1Tim', '1timothy': '1Tim', '2ti': '2Tim', '2tim': '2Tim', '2timothy': '2Tim', tit: 'Titus', titus: 'Titus',
  phm: 'Phlm', phlm: 'Phlm', philemon: 'Phlm', heb: 'Heb', hebrews: 'Heb', jas: 'Jas', jam: 'Jas', james: 'Jas',
  '1pe': '1Pet', '1pet': '1Pet', '1peter': '1Pet', '2pe': '2Pet', '2pet': '2Pet', '2peter': '2Pet',
  '1jn': '1John', '1jo': '1John', '1john': '1John', '2jn': '2John', '2jo': '2John', '2john': '2John', '3jn': '3John', '3jo': '3John', '3john': '3John',
  jud: 'Jude', jude: 'Jude', re: 'Rev', rev: 'Rev', revelation: 'Rev', apocalypse: 'Rev',
};

/** Parse "Gen 1:1", "1 Kings 3", "John 3.16", "Ps 23" → a reference, or null. */
export function parseRef(input: string): { book: string; ch: number; v?: number } | null {
  const m = input.trim().match(/^([1-3]?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s*(\d+)?(?:\s*[:.,]\s*(\d+))?$/i);
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/\s+/g, '');
  const id = ALIASES[name] ?? CANON.find((b) => b.id.toLowerCase() === name)?.id;
  if (!id) return null;
  const b = byId.get(id)!;
  const ch = m[2] ? Number(m[2]) : 1;
  if (ch < 1 || ch > b.verses.length) return null;
  const v = m[3] ? Number(m[3]) : undefined;
  if (v !== undefined && (v < 1 || v > b.verses[ch - 1])) return null;
  return { book: id, ch, v };
}
