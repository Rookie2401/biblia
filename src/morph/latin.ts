/**
 * PROIEL parsing codes decoded into the language of the word card. The tagset below is
 * transcribed verbatim from the <annotation> block embedded in data/proiel/latin-nt.xml
 * (the Syntacticus Vulgate NT treebank) — it is that corpus's own authoritative legend,
 * not a paraphrase.
 *   pos:   Nb common noun · Ne proper noun · V- verb · A- adjective · Df adverb · S- article ·
 *          C- conjunction · G- subjunction · R- preposition · Pp personal pronoun ·
 *          Pd demonstrative pronoun · Pr relative pronoun · Pi interrogative pronoun ·
 *          Px indefinite pronoun · Ps possessive pronoun · Pk/Pt (personal/possessive) reflexive ·
 *          Pc reciprocal pronoun · Ma cardinal · Mo ordinal · Py quantifier · Du/Dq interrogative/
 *          relative adverb · N- infinitive marker · I- interjection · F- foreign word · X- unassigned
 *   morph: 10 columns — person · number · tense · mood · voice · gender · case · degree · strength · inflection
 */
import type { LaTok } from '../model/types.ts';

export const POS: Record<string, string> = {
  'A-': 'adjective',
  Df: 'adverb',
  'S-': 'article',
  Ma: 'cardinal numeral',
  Nb: 'common noun',
  'C-': 'conjunction',
  Pd: 'demonstrative pronoun',
  'F-': 'foreign word',
  Px: 'indefinite pronoun',
  'N-': 'infinitive marker',
  'I-': 'interjection',
  Du: 'interrogative adverb',
  Pi: 'interrogative pronoun',
  Mo: 'ordinal numeral',
  Pp: 'personal pronoun',
  Pk: 'personal reflexive pronoun',
  Ps: 'possessive pronoun',
  Pt: 'possessive reflexive pronoun',
  'R-': 'preposition',
  Ne: 'proper noun',
  Py: 'quantifier',
  Pc: 'reciprocal pronoun',
  Dq: 'relative adverb',
  Pr: 'relative pronoun',
  'G-': 'subjunction',
  'V-': 'verb',
  'X-': 'unassigned',
};
const PERSON: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
export const TENSE: Record<string, string> = { p: 'present', i: 'imperfect', r: 'perfect', s: 'resultative', a: 'aorist', u: 'past', l: 'pluperfect', f: 'future', t: 'future perfect' };
export const MOOD: Record<string, string> = { i: 'indicative', s: 'subjunctive', m: 'imperative', o: 'optative', n: 'infinitive', p: 'participle', d: 'gerund', g: 'gerundive', u: 'supine' };
export const VOICE: Record<string, string> = { a: 'active', m: 'middle', p: 'passive', e: 'middle or passive' };
const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', n: 'neuter', p: 'masculine or feminine', o: 'masculine or neuter', r: 'feminine or neuter', q: 'masculine, feminine or neuter' };
export const CASE: Record<string, string> = { n: 'nominative', a: 'accusative', o: 'oblique', g: 'genitive', c: 'genitive or dative', e: 'accusative or dative', d: 'dative', b: 'ablative', i: 'instrumental', l: 'locative', v: 'vocative' };
const DEGREE: Record<string, string> = { c: 'comparative', s: 'superlative' }; // 'p' (positive) is the unmarked default and shown as nothing, matching Greek

export interface LaMorph {
  pos: string;
  posCode: string;
  person?: string;
  number?: string;
  tense?: string;
  mood?: string;
  voice?: string;
  gender?: string;
  case?: string;
  degree?: string;
  /** "perfect · active · indicative · 3rd singular" */
  features: string;
  featureList: string[];
}

const NUMBER: Record<string, string> = { s: 'singular', d: 'dual', p: 'plural' };

export function decode(tok: LaTok): LaMorph {
  const [, posCode, parse = '----------'] = tok;
  const m: LaMorph = { pos: POS[posCode] ?? posCode, posCode, features: '', featureList: [] };
  m.person = PERSON[parse[0]];
  m.number = NUMBER[parse[1]];
  m.tense = TENSE[parse[2]];
  m.mood = MOOD[parse[3]];
  m.voice = VOICE[parse[4]];
  m.gender = GENDER[parse[5]];
  m.case = CASE[parse[6]];
  m.degree = DEGREE[parse[7]];
  const list: string[] = [];
  if (m.tense) list.push(m.tense);
  if (m.voice) list.push(m.voice);
  if (m.mood) list.push(m.mood);
  if (m.person && m.number) list.push(`${m.person} ${m.number}`);
  else if (m.mood === 'participle' || m.mood === 'gerundive' || !m.mood) {
    const nom = [m.case, m.number, m.gender].filter(Boolean).join(' ');
    if (nom) list.push(nom);
  }
  if (m.degree) list.push(m.degree);
  m.featureList = list;
  m.features = list.join(' · ');
  return m;
}

/** Level-1 morphology line: "verb · perfect · active · indicative · 3rd singular". */
export function morphLine(m: LaMorph): string {
  return [m.pos, m.features].filter(Boolean).join(' · ');
}

export const TENSE_NOTE: Record<string, string> = {
  present: 'Present — ongoing or repeated action, or a general truth ("looses", "is loosing").',
  imperfect: 'Imperfect — a past action seen as ongoing, repeated or attempted ("was loosing", "used to loose"). Formed with -ba- before the ending.',
  perfect: 'Perfect — a completed action, viewed as a single event ("loosed", "has loosed") or its present result. Formed from the third principal part.',
  pluperfect: 'Pluperfect — the perfect moved further into the past ("had loosed"): perfect stem + -era- before the ending.',
  future: 'Future — a following action ("will loose"). First/second conjugation: -bi-/-bo-/-bu-; third/fourth: -a-/-e-.',
  'future perfect': 'Future perfect — will be completed before some other future action ("will have loosed"): perfect stem + -eri-.',
};
export const VOICE_NOTE: Record<string, string> = {
  active: 'Active — the subject does the action.',
  passive: 'Passive — the subject is acted on ("is loosed"). Some verbs are "deponent": passive in form, active in sense (loquor "I speak").',
};
export const MOOD_NOTE: Record<string, string> = {
  indicative: 'Indicative — states a fact or asks a plain question; tense marks real time.',
  subjunctive: 'Subjunctive — possibility, wish, command or a subordinate clause (purpose ut, result ut, indirect question). Not primarily a tense of time.',
  imperative: 'Imperative — a direct command (solve "loose!").',
  infinitive: 'Infinitive — the verbal noun ("to loose"); as the subject or object of another verb, or in indirect statement with an accusative subject.',
  participle: 'Participle — the verbal adjective: agrees in case, number and gender with the noun it describes ("the man loosing…"). Present participles are active only; perfect participles are passive only (deponents excepted); the future active and passive (gerundive) participles complete the set.',
  gerund: 'Gerund — a verbal noun used where the infinitive cannot go (after a preposition, or in the genitive/dative/ablative): "ars scribendi", the art of writing.',
  gerundive: 'Gerundive — a verbal adjective of obligation or a future-passive sense ("to be loosed", "must be loosed"), agreeing with its noun like an adjective.',
  supine: 'Supine — a verbal noun in -um (purpose after a verb of motion) or -u (with certain adjectives): "venit spectatum", he came to watch.',
};
export const CASE_NOTE: Record<string, string> = {
  nominative: 'Nominative — the subject, or the predicate after "to be". Also used for naming.',
  genitive: 'Genitive — "of": possession, the whole of which a part is taken, description, or the object of certain adjectives/verbs.',
  dative: 'Dative — "to / for": the indirect object; also the object of a number of intransitive verbs (credo, impero, faveo) and of "to be" in possession (mihi est).',
  accusative: 'Accusative — the direct object; extent of time or space; subject of an infinitive in indirect statement; object of many prepositions (ad, per, in with motion).',
  ablative: 'Ablative — "by / with / from": means, manner, agent (with ab), time when/within which, place from which, and the object of prepositions like ab, cum, de, ex, in (with place where).',
  vocative: 'Vocative — direct address. Identical to the nominative except in the singular of second-declension -us nouns (domine).',
  locative: 'Locative — "at/in" a place, surviving mainly with names of cities, small islands, and a few nouns (domi "at home", Romae "at Rome").',
};

export interface EncodingLine {
  title: string;
  text: string;
}

/** Level-2 lines: what the form encodes and why Latin marks it that way. */
export function encodingLines(m: LaMorph, word: string): EncodingLine[] {
  const lines: EncodingLine[] = [];
  if (m.posCode === 'V-') {
    const head: string[] = [];
    if (m.tense && TENSE_NOTE[m.tense]) head.push(TENSE_NOTE[m.tense]);
    if (m.voice && VOICE_NOTE[m.voice]) head.push(VOICE_NOTE[m.voice]);
    lines.push({ title: 'Stem', text: `${word} — ${m.tense ?? ''} ${m.voice ?? ''} stem. ${head.join(' ')}`.replace(/\s+/g, ' ').trim() });
    if (m.mood && MOOD_NOTE[m.mood]) lines.push({ title: 'Mood', text: MOOD_NOTE[m.mood] });
    if (m.person && m.number) lines.push({ title: 'Ending', text: `The ending marks ${m.person} person ${m.number}. Latin verbs carry their subject in the ending, so a separate pronoun is emphatic.` });
    else if ((m.mood === 'participle' || m.mood === 'gerundive') && m.case) lines.push({ title: 'Ending', text: `The ending marks ${m.case} ${m.number ?? ''} ${m.gender ?? ''} — it declines like an adjective and agrees with what it describes. ${CASE_NOTE[m.case] ?? ''}`.replace(/\s+/g, ' ') });
    return lines;
  }
  if (['Nb', 'Ne', 'A-', 'S-', 'Pp', 'Pd', 'Pr', 'Pi', 'Px', 'Ps', 'Pk', 'Pt', 'Pc', 'Ma', 'Mo', 'Py'].includes(m.posCode)) {
    const what = [m.case, m.number, m.gender].filter(Boolean).join(' ');
    let t = `${word} — ${m.pos}${what ? ', ' + what : ''}${m.degree ? ', ' + m.degree : ''}.`;
    if (m.case && CASE_NOTE[m.case]) t += ' ' + CASE_NOTE[m.case];
    if (m.posCode === 'A-' && m.degree === 'comparative') t += ' Comparative: "more …", with quam "than" or an ablative of comparison.';
    if (m.posCode === 'A-' && m.degree === 'superlative') t += ' Superlative: "most …" or "very …".';
    if (m.posCode === 'Pr') t += ' The relative takes its gender and number from its antecedent but its case from its own clause.';
    lines.push({ title: 'Form', text: t });
    if (m.person && m.number) lines.push({ title: 'Person', text: `${m.person} person ${m.number}.` });
    return lines;
  }
  if (m.posCode === 'R-') lines.push({ title: 'Form', text: `${word} — preposition; invariable. Governs either the accusative (motion, extent: ad, per, in "into") or the ablative (place where, separation: ab, cum, de, in "in").` });
  else if (m.posCode === 'C-' || m.posCode === 'G-') lines.push({ title: 'Form', text: `${word} — ${m.posCode === 'C-' ? 'conjunction' : 'subjunction'}; invariable. A subjunction (ut, cum, si, quod…) introduces a subordinate clause, often with the subjunctive.` });
  else if (m.posCode === 'Df' || m.posCode === 'Du' || m.posCode === 'Dq') lines.push({ title: 'Form', text: `${word} — adverb; invariable${m.degree ? ', ' + m.degree : ''}.` });
  else if (m.posCode === 'I-') lines.push({ title: 'Form', text: `${word} — interjection.` });
  else if (m.posCode === 'N-') lines.push({ title: 'Form', text: `${word} — infinitive marker.` });
  return lines;
}
