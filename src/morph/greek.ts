/**
 * MorphGNT parsing codes decoded into the language of the word card.
 *   pos:   N- noun · V- verb · RA article · C- conjunction · RP personal pronoun · P- preposition ·
 *          A- adjective · D- adverb · RD demonstrative · RR relative · RI interrogative/indefinite ·
 *          X- particle · I- interjection
 *   parse: 8 columns — person · tense · voice · mood · case · number · gender · degree
 */
import type { GrTok } from '../model/types.ts';

export const POS: Record<string, string> = { 'N-': 'noun', 'V-': 'verb', RA: 'article', 'C-': 'conjunction', RP: 'personal pronoun', 'P-': 'preposition', 'A-': 'adjective', 'D-': 'adverb', RD: 'demonstrative pronoun', RR: 'relative pronoun', RI: 'interrogative / indefinite pronoun', 'X-': 'particle', 'I-': 'interjection' };
const PERSON: Record<string, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
export const TENSE: Record<string, string> = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', X: 'perfect', Y: 'pluperfect' };
export const VOICE: Record<string, string> = { A: 'active', M: 'middle', P: 'passive' };
export const MOOD: Record<string, string> = { I: 'indicative', D: 'imperative', S: 'subjunctive', O: 'optative', N: 'infinitive', P: 'participle' };
export const CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const NUMBER: Record<string, string> = { S: 'singular', P: 'plural' };
const GENDER: Record<string, string> = { M: 'masculine', F: 'feminine', N: 'neuter' };
const DEGREE: Record<string, string> = { C: 'comparative', S: 'superlative' };

export interface GrMorph {
  pos: string;
  posCode: string;
  person?: string;
  tense?: string;
  voice?: string;
  mood?: string;
  case?: string;
  number?: string;
  gender?: string;
  degree?: string;
  /** "aorist · active · indicative · 3rd singular" */
  features: string;
  featureList: string[];
}

export function decode(tok: GrTok): GrMorph {
  const [, , posCode, parse = '--------'] = tok;
  const m: GrMorph = { pos: POS[posCode] ?? posCode, posCode, features: '', featureList: [] };
  m.person = PERSON[parse[0]];
  m.tense = TENSE[parse[1]];
  m.voice = VOICE[parse[2]];
  m.mood = MOOD[parse[3]];
  m.case = CASE[parse[4]];
  m.number = NUMBER[parse[5]];
  m.gender = GENDER[parse[6]];
  m.degree = DEGREE[parse[7]];
  const list: string[] = [];
  if (m.tense) list.push(m.tense);
  if (m.voice) list.push(m.voice);
  if (m.mood) list.push(m.mood);
  if (m.person && m.number) list.push(`${m.person} ${m.number}`);
  else if (m.mood === 'participle' || !m.mood) {
    const nom = [m.case, m.number, m.gender].filter(Boolean).join(' ');
    if (nom) list.push(nom);
  }
  if (m.degree) list.push(m.degree);
  m.featureList = list;
  m.features = list.join(' · ');
  return m;
}

/** Level-1 morphology line: "verb · aorist · active · indicative · 3rd singular". */
export function morphLine(m: GrMorph): string {
  return [m.pos, m.features].filter(Boolean).join(' · ');
}

export const TENSE_NOTE: Record<string, string> = {
  present: 'Present — ongoing or repeated action, the process seen from inside ("is loosing", "keeps loosing"). Outside the indicative it marks aspect (continuing), not time.',
  imperfect: 'Imperfect — past + present stem: an action going on or repeated in the past ("was loosing", "used to loose"). Formed with the augment ἐ- and the present stem; only in the indicative.',
  future: 'Future — usually marked by σ before the ending (λύσω). Time reference is future; aspect is neutral.',
  aorist: 'Aorist — the action as a whole, undifferentiated ("loosed"). In the indicative it is the ordinary past narrative tense (with the augment ἐ-); elsewhere it marks aspect, not time. Most verbs form it with σα (first aorist, ἔλυσα); some with a changed stem (second aorist, ἔλαβον).',
  perfect: 'Perfect — a completed action whose result stands ("has loosed" = it is now loosed). Marked by reduplication of the first consonant with ε (λέλυκα) and, in the active, κα.',
  pluperfect: 'Pluperfect — the perfect moved into the past ("had loosed"): augment + reduplication (ἐλελύκειν). Rare.',
};
export const VOICE_NOTE: Record<string, string> = {
  active: 'Active — the subject does the action.',
  middle: 'Middle — the subject acts with reference to itself, for its own interest, or on itself (λούομαι "I wash myself"; αἰτοῦμαι "I ask for myself"). Many verbs are "deponent": middle in form, active in sense (ἔρχομαι "I come").',
  passive: 'Passive — the subject is acted on. In the present, imperfect, perfect and pluperfect the middle and passive share one form; the aorist and future have a separate passive with θη (ἐλύθην).',
};
export const MOOD_NOTE: Record<string, string> = {
  indicative: 'Indicative — states a fact or asks a plain question; the only mood in which tense marks time.',
  imperative: 'Imperative — command or request (λῦε, λῦσον). Present imperative: keep doing / general rule; aorist imperative: do it (once, as a whole).',
  subjunctive: 'Subjunctive — the mood of possibility and purpose: after ἵνα ("in order that"), ἐάν ("if"), in deliberative questions ("what shall we do?") and hortatory "let us…". Long vowel in the ending (λύωμεν).',
  optative: 'Optative — wish or remote possibility (μὴ γένοιτο "may it never be!"). Rare in the New Testament; marked by οι / αι in the ending.',
  infinitive: 'Infinitive — the verbal noun ("to loose"); often with the article (τὸ λύειν) and as complement of verbs of wishing, being able, beginning. Its tense shows aspect only.',
  participle: 'Participle — the verbal adjective: it agrees in case, number and gender with a noun ("the man loosing…"), or with the article stands for a noun ("the one who looses"). Its tense shows aspect and relative time (aorist participle: usually before the main verb).',
};
export const CASE_NOTE: Record<string, string> = {
  nominative: 'Nominative — the subject, or the predicate after "to be". Also used for naming.',
  genitive: 'Genitive — "of": possession, source, description, the whole of which a part is taken; also the object of many prepositions (ἐκ, ἀπό, διά "through", περί "about") and of some verbs (ἀκούω "hear", in part).',
  dative: 'Dative — "to / for": the indirect object; also means, instrument, place and time ("by faith", "on the third day"); object of ἐν and some verbs.',
  accusative: 'Accusative — the direct object; extent of time or space; subject of an infinitive; object of εἰς, πρός, διά "because of".',
  vocative: 'Vocative — direct address ("Lord!", "brothers"). Often identical to the nominative in the plural.',
};

export interface EncodingLine {
  title: string;
  text: string;
}

/** Level-2 lines: what the form encodes and why Greek marks it that way. */
export function encodingLines(m: GrMorph, word: string): EncodingLine[] {
  const lines: EncodingLine[] = [];
  if (m.posCode === 'V-') {
    const head: string[] = [];
    if (m.tense && TENSE_NOTE[m.tense]) head.push(TENSE_NOTE[m.tense]);
    if (m.voice && VOICE_NOTE[m.voice]) head.push(VOICE_NOTE[m.voice]);
    lines.push({ title: 'Stem', text: `${word} — ${m.tense ?? ''} ${m.voice ?? ''} stem. ${head.join(' ')}`.replace(/\s+/g, ' ').trim() });
    if (m.mood && MOOD_NOTE[m.mood]) lines.push({ title: 'Mood', text: MOOD_NOTE[m.mood] });
    if (m.person && m.number) lines.push({ title: 'Ending', text: `The ending marks ${m.person} person ${m.number}. Greek verbs carry their subject in the ending, so a separate pronoun is emphatic.` });
    else if (m.mood === 'participle' && m.case) lines.push({ title: 'Ending', text: `The ending marks ${m.case} ${m.number ?? ''} ${m.gender ?? ''} — the participle declines like an adjective and agrees with what it describes. ${CASE_NOTE[m.case] ?? ''}`.replace(/\s+/g, ' ') });
    return lines;
  }
  if (['N-', 'A-', 'RA', 'RP', 'RD', 'RR', 'RI'].includes(m.posCode)) {
    const what = [m.case, m.number, m.gender].filter(Boolean).join(' ');
    let t = `${word} — ${m.pos}${what ? ', ' + what : ''}${m.degree ? ', ' + m.degree : ''}.`;
    if (m.case && CASE_NOTE[m.case]) t += ' ' + CASE_NOTE[m.case];
    if (m.posCode === 'RA') t += ' The article agrees with its noun in case, number and gender; it can turn any word or phrase into a noun (τὸ ἀγαθόν "the good", οἱ περὶ αὐτόν "those around him").';
    if (m.posCode === 'A-' && m.degree === 'comparative') t += ' Comparative: "more …", with ἤ "than" or a genitive of comparison.';
    if (m.posCode === 'A-' && m.degree === 'superlative') t += ' Superlative: "most …", in Koine often just elative ("very …").';
    if (m.posCode === 'RR') t += ' The relative takes its gender and number from its antecedent but its case from its own clause (attraction to the antecedent\'s case is common).';
    lines.push({ title: 'Form', text: t });
    if (m.person && m.number) lines.push({ title: 'Person', text: `${m.person} person ${m.number}.` });
    return lines;
  }
  if (m.posCode === 'P-') lines.push({ title: 'Form', text: `${word} — preposition; invariable. Its meaning depends on the case of the noun that follows (e.g. διά + genitive "through", + accusative "because of"; παρά + genitive "from", + dative "beside", + accusative "alongside").` });
  else if (m.posCode === 'C-') lines.push({ title: 'Form', text: `${word} — conjunction; invariable. Postpositive conjunctions (δέ, γάρ, οὖν) stand second in their clause.` });
  else if (m.posCode === 'D-') lines.push({ title: 'Form', text: `${word} — adverb; invariable${m.degree ? ', ' + m.degree : ''}.` });
  else if (m.posCode === 'X-') lines.push({ title: 'Form', text: `${word} — particle; invariable (ἄν, μέν, οὐ/μή and the like carry modality, contrast or negation).` });
  else if (m.posCode === 'I-') lines.push({ title: 'Form', text: `${word} — interjection.` });
  return lines;
}
