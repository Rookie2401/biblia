/**
 * OSHB morphology, decoded into the language of the word card:
 *   level 1 — one morphology line: "וְ־ + Qal · perfect · 3ms"
 *   level 2 — morpheme chips cut from the printed word at OSHB's boundaries, and the three
 *             fixed "how the letters encode this" lines (Prefixes / Stem / Ending)
 * Codes: https://hb.openscriptures.org/parsing/HebrewMorphologyCodes.html
 */
import type { HeTok } from '../model/types.ts';
import { skeleton, splitByLetters } from '../text/hebrew.ts';

export interface HeSegment {
  /** as printed (pointed, accented) */
  form: string;
  kind: 'conjunction' | 'preposition' | 'article' | 'relative' | 'interrogative' | 'stem' | 'suffix-pronoun' | 'suffix-directional' | 'suffix-paragogic' | 'other';
  label: string;
  gloss?: string;
  note?: string;
}

const PREFIX: Record<string, { kind: HeSegment['kind']; label: string; gloss: string; note: string }> = {
  c: { kind: 'conjunction', label: 'conj', gloss: 'and', note: 'וְ־ "and" — the conjunction is written as one letter joined to the next word. Before a labial (ב מ פ) or a shva it is וּ.' },
  b: { kind: 'preposition', label: 'prep', gloss: 'in / with', note: 'בְּ־ "in, with, by" — an inseparable preposition, written as one letter.' },
  l: { kind: 'preposition', label: 'prep', gloss: 'to / for', note: 'לְ־ "to, for" — an inseparable preposition.' },
  k: { kind: 'preposition', label: 'prep', gloss: 'like / as', note: 'כְּ־ "like, as, according to" — an inseparable preposition.' },
  m: { kind: 'preposition', label: 'prep', gloss: 'from', note: 'מִ־ "from" — מִן assimilated to the next letter, which takes a dagesh (מִבַּיִת "from a house").' },
  d: { kind: 'article', label: 'the', gloss: 'the', note: 'הַ־ the article, followed by a dagesh in the next letter (or a lengthened vowel before א ה ע ר).' },
  s: { kind: 'relative', label: 'rel', gloss: 'that / which', note: 'שֶׁ־ "that, which" — the short relative, rare in the Bible outside Ecclesiastes, Song of Songs and late Psalms.' },
  i: { kind: 'interrogative', label: 'q', gloss: '(question)', note: 'הֲ־ the interrogative he: it turns the clause into a yes/no question.' },
};

export const STEM: Record<string, string> = { q: 'Qal', N: 'Nifʿal', p: 'Piʿel', P: 'Puʿal', h: 'Hifʿil', H: 'Hofʿal', t: 'Hitpaʿel', o: 'Polel', O: 'Polal', r: 'Hitpolel', m: 'Poʿel', M: 'Poʿal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal', f: 'Hitpalpel', D: 'Nitpaʿel', j: 'Peʿalʿal', i: 'Pilel', u: 'Hotpaʿal', c: 'Tifʿil', v: 'Hishtafʿel', w: 'Nitpalel', y: 'Nitpoʿel', z: 'Hitpoʿel' };
const STEM_ARAMAIC: Record<string, string> = { q: 'Peʿal', Q: 'Peʿil', u: 'Hitpeʿel', p: 'Paʿel', P: 'Itpaʿal', M: 'Hitpaʿal', a: 'Afʿel', h: 'Hafʿel', s: 'Safʿel', e: 'Shafʿel', H: 'Hofʿal', i: 'Itpeʿel', t: 'Hishtafʿel', v: 'Ishtafʿel', w: 'Hitafʿel', o: 'Polel', z: 'Itpoʿel', r: 'Hitpolel', f: 'Hitpalpel', b: 'Hefʿal', c: 'Tifʿel', m: 'Poʿel', l: 'Palpel', L: 'Itpalpel', O: 'Itpolel', G: 'Ittafʿal' };

export const STEM_NOTE: Record<string, string> = {
  Qal: 'Qal — the simple active stem, the base pattern: קָטַל "he killed". No doubling, no prefixed ה or נ.',
  'Nifʿal': 'Nifʿal — the נ-prefixed stem: passive or reflexive of Qal (נִשְׁבַּר "was broken"), sometimes reciprocal. In the imperfect the נ assimilates into the first radical, which doubles: יִשָּׁבֵר.',
  'Piʿel': 'Piʿel — the doubled-middle-radical stem: intensive, factitive (making something so) or denominative. דִּבֵּר "he spoke", שִׁבַּר "he shattered".',
  'Puʿal': 'Puʿal — the passive of Piʿel: doubled middle radical with u–a vowels. שֻׁבַּר "was shattered".',
  'Hifʿil': 'Hifʿil — the ה-prefixed causative: הִשְׁמִיעַ "he caused to hear". The ה shows only in the perfect and infinitive; the imperfect has a patach under the prefix and the long i (יַשְׁמִיעַ).',
  'Hofʿal': 'Hofʿal — passive of Hifʿil: הֻשְׁלַךְ "was thrown".',
  'Hitpaʿel': 'Hitpaʿel — הִתְ prefix + doubled middle radical: reflexive, reciprocal or iterative. הִתְהַלֵּךְ "walked about". With a sibilant first radical the ת and it swap places (הִשְׁתַּמֵּר).',
  Polel: 'Polel — the Piʿel-equivalent of hollow and geminate roots: the second radical is repeated instead of doubled (קוֹמֵם from קום).',
  'Qal passive': 'Qal passive — an old passive of Qal surviving in a few forms the Masoretes pointed as Puʿal or Hofʿal.',
  'Peʿal': 'Peʿal — the Aramaic simple stem, corresponding to Hebrew Qal.',
  'Paʿel': 'Paʿel — the Aramaic doubled stem, corresponding to Hebrew Piʿel.',
  'Hafʿel': 'Hafʿel — the Aramaic causative, corresponding to Hebrew Hifʿil.',
  'Afʿel': 'Afʿel — the Aramaic causative with א instead of ה (Hebrew Hifʿil).',
};

export const VTYPE: Record<string, string> = { p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect', h: 'cohortative', j: 'jussive', v: 'imperative', r: 'participle', s: 'passive participle', a: 'infinitive absolute', c: 'infinitive construct' };
export const VTYPE_NOTE: Record<string, string> = {
  perfect: 'Perfect (qatal) — the suffix conjugation: the person is marked by an ending (קָטַלְתִּי, קָטַלְתָּ, קָטַל…). Completed or whole action; in narrative usually past.',
  'sequential perfect': 'Weqatal — וְ + perfect carrying the narrative or instruction forward with the sense of the preceding imperfect or imperative ("and then you shall…"). The stress often moves to the last syllable (וְקָטַלְתָּ֫).',
  imperfect: 'Imperfect (yiqtol) — the prefix conjugation: the person is marked by a prefix (אֶ־ תִּ־ יִ־ נִ־) and sometimes an ending. Incomplete, future, habitual or modal action.',
  'sequential imperfect': 'Wayyiqtol — וַ + doubled prefix letter + imperfect: the ordinary narrative past ("and he said"). This is the form Modern Hebrew has lost; it carries most of Biblical story-telling.',
  cohortative: 'Cohortative — first person with a lengthened ending ־ָה: "let me / let us" (אֶקְטְלָה).',
  jussive: 'Jussive — third (or second) person wish or command: "let him…", "may it…". Often a shortened imperfect (יְהִי rather than יִהְיֶה).',
  imperative: 'Imperative — second person command; the imperfect without its prefix (קְטֹל, קִטְלִי, קִטְלוּ, קְטֹלְנָה).',
  participle: 'Participle — a verbal adjective: the person doing the action ("one who kills", "killing"). It agrees like an adjective (gender and number) and has no person.',
  'passive participle': 'Passive participle (qatul) — "killed", "written": כָּתוּב.',
  'infinitive absolute': 'Infinitive absolute — an invariable verbal noun; beside a finite verb of the same root it intensifies it (מוֹת תָּמוּת "you shall surely die").',
  'infinitive construct': 'Infinitive construct — the "to …" form; takes prefixes (לִקְטֹל "to kill", בִּקְטֹל "when killing") and pronominal suffixes (קָטְלוֹ "his killing").',
};

const NTYPE: Record<string, string> = { c: 'noun', p: 'proper noun', g: 'gentilic' };
const ATYPE: Record<string, string> = { a: 'adjective', c: 'number', g: 'gentilic adjective', o: 'ordinal' };
const PTYPE: Record<string, string> = { d: 'demonstrative', f: 'indefinite', i: 'interrogative', p: 'personal', r: 'relative' };
const TTYPE: Record<string, string> = { a: 'affirmation', d: 'definite article', e: 'exhortation', i: 'interrogative', j: 'interjection', m: 'negative', o: 'object marker', r: 'relative' };
const STYPE: Record<string, string> = { d: 'directional ה', h: 'paragogic ה', n: 'paragogic ן', p: 'pronominal suffix' };
const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', b: 'both', c: 'common' };
const NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' };
const PERSON: Record<string, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

export const STATE_NOTE: Record<string, string> = {
  absolute: 'Absolute state — the noun standing on its own, the dictionary form.',
  construct: 'Construct state (סְמִיכוּת) — the noun is bound to the following noun ("X of Y"): it loses its stress and often shortens (דְּבַר יְהוָה "the word of the LORD"). The construct noun never takes the article; definiteness comes from the last noun of the chain.',
  determined: 'Determined (emphatic) state — the Aramaic definite form with the ending ־ָא (מַלְכָּא "the king").',
};

export interface HeMorph {
  lang: 'Hebrew' | 'Aramaic';
  prefixes: { code: string; label: string; gloss: string; note: string }[];
  pos: string;
  /** e.g. "Qal · perfect · 3ms" or "noun · masculine plural · construct" */
  features: string;
  featureList: string[];
  stem?: string;
  vtype?: string;
  pgn?: string;
  gender?: string;
  number?: string;
  state?: string;
  suffix?: { kind: string; pgn?: string; text: string };
}

function pgn(s: string, order: 'pgn' | 'gn' = 'pgn'): { short: string; long: string; gender?: string; number?: string } {
  const p = order === 'pgn' ? s[0] : undefined;
  const g = order === 'pgn' ? s[1] : s[0];
  const n = order === 'pgn' ? s[2] : s[1];
  const short = (p && PERSON[p] ? p : '') + (g && GENDER[g] ? g : '') + (n && NUMBER[n] ? n : '');
  const long = [p && PERSON[p] ? PERSON[p] + ' person' : '', g && GENDER[g], n && NUMBER[n]].filter(Boolean).join(' ');
  return { short, long, gender: g && GENDER[g], number: n && NUMBER[n] };
}

function stemName(code: string, aramaic: boolean): string {
  return (aramaic ? STEM_ARAMAIC[code] : STEM[code]) ?? STEM[code] ?? code;
}

/** Decode one morphology segment (after the language letter). */
export function decodeSegment(seg: string, aramaic: boolean): { pos: string; features: string[]; stem?: string; vtype?: string; pgn?: string; gender?: string; number?: string; state?: string } {
  const c = seg[0];
  const r = seg.slice(1);
  switch (c) {
    case 'V': {
      const stem = stemName(r[0], aramaic);
      const type = VTYPE[r[1]] ?? '';
      const rest = r.slice(2);
      if (type.includes('participle')) {
        const x = pgn(rest, 'gn');
        return { pos: 'verb', features: [stem, type, x.long, STATE[rest[2]] ?? ''].filter(Boolean), stem, vtype: type, gender: x.gender, number: x.number, state: STATE[rest[2]] };
      }
      if (type.startsWith('infinitive')) return { pos: 'verb', features: [stem, type], stem, vtype: type };
      const x = pgn(rest);
      return { pos: 'verb', features: [stem, type, x.short].filter(Boolean), stem, vtype: type, pgn: x.short, gender: x.gender, number: x.number };
    }
    case 'N': {
      const g = GENDER[r[1]];
      const n = NUMBER[r[2]];
      const st = STATE[r[3]];
      return { pos: NTYPE[r[0]] ?? 'noun', features: [[g, n].filter(Boolean).join(' '), st].filter(Boolean), gender: g, number: n, state: st };
    }
    case 'A': {
      const g = GENDER[r[1]];
      const n = NUMBER[r[2]];
      const st = STATE[r[3]];
      return { pos: ATYPE[r[0]] ?? 'adjective', features: [[g, n].filter(Boolean).join(' '), st].filter(Boolean), gender: g, number: n, state: st };
    }
    case 'P': {
      const x = pgn(r.slice(1));
      return { pos: `${PTYPE[r[0]] ?? ''} pronoun`.trim(), features: [x.long].filter(Boolean), pgn: x.short, gender: x.gender, number: x.number };
    }
    case 'R':
      return { pos: 'preposition', features: r === 'd' ? ['with the article'] : [] };
    case 'C':
      return { pos: 'conjunction', features: [] };
    case 'D':
      return { pos: 'adverb', features: [] };
    case 'T':
      return { pos: TTYPE[r[0]] === 'definite article' ? 'article' : TTYPE[r[0]] === 'object marker' ? 'object marker' : 'particle', features: TTYPE[r[0]] && !['definite article', 'object marker'].includes(TTYPE[r[0]]) ? [TTYPE[r[0]]] : [] };
    case 'S': {
      const x = pgn(r.slice(1));
      return { pos: 'suffix', features: [STYPE[r[0]] ?? '', x.long].filter(Boolean), pgn: x.short };
    }
    default:
      return { pos: '', features: [seg] };
  }
}

/** The whole code ("HC/R/Ncbsc/Sp3ms") with the OSHB lemma ("c/b/1870"). */
export function decode(tok: HeTok): HeMorph {
  const [lemma, code] = tok;
  const aramaic = code[0] === 'A';
  const segs = code.slice(1).split('/');
  const lemmaParts = lemma.split('/');
  const prefixCodes = lemmaParts.slice(0, -1);
  const out: HeMorph = { lang: aramaic ? 'Aramaic' : 'Hebrew', prefixes: [], pos: '', features: '', featureList: [] };
  // Prefix segments come first in both lemma and morph; the count of prefix codes in the lemma tells how many.
  let i = 0;
  let fusedArticle = false;
  for (; i < prefixCodes.length && i < segs.length - 1; i++) {
    const p = PREFIX[prefixCodes[i]];
    const d = decodeSegment(segs[i], aramaic);
    // "Rd": a preposition whose vowel shows the article swallowed into it (בַּשָּׁמַיִם = בְּ + הַ + שָׁמַיִם)
    const fused = segs[i] === 'Rd';
    if (fused) fusedArticle = true;
    out.prefixes.push(p ? { code: prefixCodes[i], ...p, gloss: fused ? p.gloss + ' the' : p.gloss, note: fused ? p.note + ' Here the article הַ has merged into it: the ה is gone, its vowel (patach) and the dagesh in the next letter remain.' : p.note } : { code: prefixCodes[i], label: d.pos, gloss: '', note: '' });
  }
  const main = segs[i] ? decodeSegment(segs[i], aramaic) : undefined;
  if (main) {
    out.pos = main.pos;
    out.featureList = main.features;
    out.stem = main.stem;
    out.vtype = main.vtype;
    out.pgn = main.pgn;
    out.gender = main.gender;
    out.number = main.number;
    out.state = main.state;
  }
  if (fusedArticle) out.featureList.push('with the article');
  for (let j = i + 1; j < segs.length; j++) {
    const s = decodeSegment(segs[j], aramaic);
    if (s.pos === 'suffix') out.suffix = { kind: STYPE[segs[j][1]] ?? 'suffix', pgn: s.pgn, text: s.features.join(' · ') };
    else if (s.pos === 'article') out.featureList.push('with the article'); // Rd: preposition + article fused (בַּ־)
  }
  out.features = out.featureList.join(' · ');
  return out;
}

const STEM_NAMES = new Set(Object.values(STEM).concat(Object.values(STEM_ARAMAIC)));

/** Level-1 morphology line, Sefer format: "וְ־ בְּ־ + Qal · perfect · 3ms · + suffix 3ms". */
export function morphLine(m: HeMorph, prefixForms: string[] = []): string {
  const pre = m.prefixes.map((p, i) => (prefixForms[i] ? prefixForms[i] + '־' : PREFIX[p.code]?.gloss ?? p.code)).join(' ');
  const body = m.pos === 'verb' ? m.features : [m.pos, m.features].filter(Boolean).join(' · ');
  const suf = m.suffix ? ` · + ${m.suffix.kind === 'pronominal suffix' ? (m.pos === 'verb' ? 'object' : 'possessive') + ' ' + (m.suffix.pgn ?? '') : m.suffix.kind}` : '';
  return (pre ? pre + ' + ' : '') + body + suf;
}

/** Cut the printed word into OSHB's morphemes: prefixes · stem · suffix. */
export function segments(tok: HeTok, printed: string, m: HeMorph): HeSegment[] {
  const seg = tok[2];
  if (!seg) return [{ form: printed, kind: 'stem', label: m.pos === 'verb' ? 'verb' : m.pos || 'stem' }];
  const pieces = seg.split('/');
  const counts = pieces.map((p) => skeleton(p).length);
  const forms = splitByLetters(printed.replace(/[׃׀]/g, ''), counts);
  if (!forms) return [{ form: printed, kind: 'stem', label: m.pos || 'stem' }];
  const out: HeSegment[] = [];
  const nPre = m.prefixes.length;
  forms.forEach((f, k) => {
    if (k < nPre) {
      const p = m.prefixes[k];
      out.push({ form: f, kind: PREFIX[p.code]?.kind ?? 'other', label: p.label, gloss: p.gloss, note: p.note });
    } else if (k === nPre) {
      out.push({ form: f, kind: 'stem', label: m.pos === 'verb' && m.stem ? m.stem : m.pos || 'stem', gloss: m.pos === 'verb' ? m.vtype : m.featureList[0] });
    } else {
      const kind: HeSegment['kind'] = m.suffix?.kind === 'directional ה' ? 'suffix-directional' : m.suffix?.kind.startsWith('paragogic') ? 'suffix-paragogic' : 'suffix-pronoun';
      out.push({ form: f, kind, label: kind === 'suffix-pronoun' ? (m.pos === 'verb' ? 'object' : 'poss.') : kind === 'suffix-directional' ? 'dir.' : 'parag.', gloss: m.suffix?.pgn ? pronounGloss(m.suffix.pgn, m.pos === 'verb') : m.suffix?.kind });
    }
  });
  return out;
}

function pronounGloss(p: string, object: boolean): string {
  const map: Record<string, [string, string]> = { '1cs': ['me', 'my'], '1cp': ['us', 'our'], '2ms': ['you (m)', 'your (m)'], '2fs': ['you (f)', 'your (f)'], '2mp': ['you (mp)', 'your (mp)'], '2fp': ['you (fp)', 'your (fp)'], '3ms': ['him / it', 'his / its'], '3fs': ['her / it', 'her / its'], '3mp': ['them (m)', 'their (m)'], '3fp': ['them (f)', 'their (f)'], '3cp': ['them', 'their'] };
  const e = map[p];
  return e ? (object ? e[0] : e[1]) : p;
}

export interface EncodingLine {
  title: string;
  text: string;
}

/** Level-2 "how the letters encode this": Prefixes · Stem · Ending, only the lines with something to say. */
export function encodingLines(m: HeMorph, segs: HeSegment[]): EncodingLine[] {
  const lines: EncodingLine[] = [];
  const pre = segs.filter((s) => ['conjunction', 'preposition', 'article', 'relative', 'interrogative'].includes(s.kind));
  if (pre.length) lines.push({ title: 'Prefixes', text: pre.map((s) => `${s.form}־ "${s.gloss}"${s.note ? ' — ' + s.note : ''}`).join(' ') });
  const stem = segs.find((s) => s.kind === 'stem');
  if (stem) {
    let t = '';
    if (m.pos === 'verb') {
      t = `${stem.form} — ${m.stem ?? ''}${m.vtype ? ' ' + m.vtype : ''}${m.pgn ? ' ' + pgnLong(m.pgn) : ''}.`;
      if (m.stem && STEM_NOTE[m.stem]) t += ' ' + STEM_NOTE[m.stem];
      if (m.vtype && VTYPE_NOTE[m.vtype]) t += ' ' + VTYPE_NOTE[m.vtype];
    } else if (m.pos.includes('noun') || m.pos.includes('adjective') || m.pos === 'number' || m.pos === 'ordinal' || m.pos === 'gentilic') {
      t = `${stem.form} — ${m.pos}${m.gender ? ', ' + m.gender : ''}${m.number ? ' ' + m.number : ''}${m.state ? ', ' + m.state + ' state' : ''}.`;
      if (m.state && STATE_NOTE[m.state]) t += ' ' + STATE_NOTE[m.state];
      if (m.number === 'dual') t += ' The dual ־ַיִם is used for things that come in pairs (hands, eyes, days in "two days").';
      if (m.number === 'plural' && m.gender === 'feminine') t += ' Feminine plural ending ־וֹת.';
      if (m.number === 'plural' && m.gender === 'masculine') t += ' Masculine plural ending ־ִים (construct ־ֵי).';
    } else if (m.pos.includes('pronoun')) {
      t = `${stem.form} — ${m.pos}${m.featureList.length ? ', ' + m.featureList.join(' ') : ''}.`;
    } else {
      t = `${stem.form} — ${m.pos}${m.featureList.length ? ' (' + m.featureList.join(', ') + ')' : ''}.`;
    }
    lines.push({ title: 'Stem', text: t });
  }
  const suf = segs.filter((s) => s.kind.startsWith('suffix'));
  if (suf.length) {
    const s = suf[0];
    let t = `־${s.form} = `;
    if (s.kind === 'suffix-pronoun') t += `${m.pos === 'verb' ? 'object' : 'possessive'} suffix, ${m.suffix?.pgn ? pgnLong(m.suffix.pgn) : ''} ("${s.gloss}"). ${m.pos === 'verb' ? 'Hebrew attaches the pronoun object straight to the verb (שְׁמָרַנִי "he kept me").' : 'Possession is marked by a suffix on the noun, not by a separate word (דְּבָרוֹ "his word").'}`;
    else if (s.kind === 'suffix-directional') t += 'directional ה (he locale): "towards" — an unstressed ־ָה that turns a place into a direction (מִצְרַיְמָה "to Egypt").';
    else t += `${m.suffix?.kind}: a lengthening of the form with no change of meaning — archaic or poetic (יִשְׁמְרוּן for יִשְׁמְרוּ).`;
    lines.push({ title: 'Ending', text: t });
  } else if (m.pos === 'verb' && m.pgn && m.vtype && ['perfect', 'sequential perfect'].includes(m.vtype)) {
    lines.push({ title: 'Ending', text: `Person is carried by the perfect ending: ${PERFECT_ENDINGS[m.pgn] ?? m.pgn}. The same endings in every binyan.` });
  } else if (m.pos === 'verb' && m.pgn && m.vtype && ['imperfect', 'sequential imperfect', 'jussive', 'cohortative'].includes(m.vtype)) {
    lines.push({ title: 'Prefix & ending', text: `Person is carried by the imperfect prefix (and ending): ${IMPERFECT_AFFIXES[m.pgn] ?? m.pgn}.` });
  }
  return lines;
}

function pgnLong(p: string): string {
  const x = pgn(p);
  return x.long || p;
}

const PERFECT_ENDINGS: Record<string, string> = {
  '3ms': '3ms has no ending (קָטַל)',
  '3fs': '־ָה 3fs (קָטְלָה)',
  '2ms': '־תָּ 2ms (קָטַלְתָּ)',
  '2fs': '־תְּ 2fs (קָטַלְתְּ)',
  '1cs': '־תִּי 1cs (קָטַלְתִּי)',
  '3cp': '־וּ 3cp (קָטְלוּ)',
  '3mp': '־וּ 3p (קָטְלוּ)',
  '3fp': '־וּ 3p (קָטְלוּ)',
  '2mp': '־תֶּם 2mp (קְטַלְתֶּם)',
  '2fp': '־תֶּן 2fp (קְטַלְתֶּן)',
  '1cp': '־נוּ 1cp (קָטַלְנוּ)',
};
const IMPERFECT_AFFIXES: Record<string, string> = {
  '3ms': 'יִ־ 3ms (יִקְטֹל)',
  '3fs': 'תִּ־ 3fs (תִּקְטֹל)',
  '2ms': 'תִּ־ 2ms (תִּקְטֹל — identical to 3fs; context decides)',
  '2fs': 'תִּ־ … ־ִי 2fs (תִּקְטְלִי)',
  '1cs': 'אֶ־ 1cs (אֶקְטֹל)',
  '3mp': 'יִ־ … ־וּ 3mp (יִקְטְלוּ)',
  '3fp': 'תִּ־ … ־נָה 3fp (תִּקְטֹלְנָה)',
  '2mp': 'תִּ־ … ־וּ 2mp (תִּקְטְלוּ)',
  '2fp': 'תִּ־ … ־נָה 2fp (תִּקְטֹלְנָה)',
  '1cp': 'נִ־ 1cp (נִקְטֹל)',
};

export function isStemName(s: string): boolean {
  return STEM_NAMES.has(s);
}
