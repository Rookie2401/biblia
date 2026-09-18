/**
 * The verse as an interlinear: every word with its short gloss and a one-line parse, in
 * reading order. The Sefer "Sentence" view for a corpus that already has per-word data.
 */
import { useEffect, useState } from 'react';
import { type AnyBook, isHeBook } from '../data/books.ts';
import type { HeVerse, WordRef } from '../model/types.ts';
import { book as bookInfo, refLabel } from '../text/canon.ts';
import { contentWords, hebrewNumeral, toNiqqud } from '../text/hebrew.ts';
import { ensureGlossIndex, glossIndex, shortGloss, wordAt } from '../state/wordinfo.ts';
import { I } from './ui.tsx';

export function VerseCard({ book, ch, v, selected, onSelectWord, onPrev, onNext, onClose }: { book: AnyBook; ch: number; v: number; selected?: number; onSelectWord: (i: number) => void; onPrev?: () => void; onNext?: () => void; onClose: () => void }) {
  const lang = isHeBook(book) ? 'he' : 'gr';
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!glossIndex(lang)) void ensureGlossIndex(lang).then(() => setTick((t) => t + 1));
  }, [lang]);
  const verse = book.chapters[ch - 1]?.verses[v - 1];
  if (!verse) return null;
  const n = lang === 'he' ? contentWords((verse as HeVerse).t).length : verse.w.length;
  const infos = Array.from({ length: n }, (_, i) => wordAt(book, { book: book.book, ch, v, i } as WordRef));
  const info = bookInfo(book.book);
  const hv = lang === 'he' ? (verse as HeVerse) : undefined;
  return (
    <div>
      <div className="panel__head">
        <span className="label">Verse</span>
        <button className="iconbtn" onClick={onClose} aria-label="Close">{I.close}</button>
      </div>
      <div className="card__ref">{refLabel(book.book, ch, v)}{lang === 'he' ? <span className="he-inline" style={{ letterSpacing: 0, textTransform: 'none', marginLeft: '0.5rem' }}>{info?.native} {hebrewNumeral(ch)}:{hebrewNumeral(v)}</span> : null}</div>
      {hv && <div className="card__surface" style={{ fontSize: '1.4rem', lineHeight: 1.7 }}>{toNiqqud(hv.t)}</div>}
      {!glossIndex(lang) && <div className="card__text faint">Loading glosses…</div>}
      <div className={`inter${lang === 'he' ? ' inter--rtl' : ''}`}>
        {infos.map((w, i) =>
          w ? (
            <button key={i} className={`inter__w${selected === i ? ' inter__w--on' : ''}`} onClick={() => onSelectWord(i)}>
              <span className={`inter__form ${lang}`}>{lang === 'he' ? toNiqqud(w.printed) : w.printed}</span>
              <span className="inter__gloss">{w.lexId ? shortGloss(lang, w.lexId) || '·' : w.he?.prefixOnly ? w.he.morph.prefixes.map((p) => p.gloss).join(' ') : '·'}</span>
              <span className="inter__morph">{w.he ? shortMorph(w.he.morph.pos, w.he.morph.featureList) : w.gr ? shortMorph(w.gr.morph.pos, w.gr.morph.featureList) : ''}</span>
            </button>
          ) : null,
        )}
      </div>
      {hv?.kq?.length ? (
        <div className="card__text" style={{ marginTop: '0.6rem' }}>
          <b>Ketiv / qere.</b> {hv.kq.map((k, i) => <span key={i}>{i ? '; ' : ''}written <span className="he-inline">{k.k || '—'}</span>, read <span className="he-inline">{k.q || '—'}</span></span>)}. The text above prints the qere (what is read).
        </div>
      ) : null}
      {hv?.note && <div className="card__text faint" style={{ marginTop: '0.4rem' }}><b>Edition note.</b> <span className="he-inline">{hv.note}</span></div>}
      <div className="card__actions">
        <button className="btn btn--small" disabled={!onPrev} onClick={onPrev}>← Previous</button>
        <button className="btn btn--small" disabled={!onNext} onClick={onNext}>Next →</button>
      </div>
      <p className="card__prov">Tap a word for its card. Glosses are dictionary glosses, not a translation of this verse.</p>
    </div>
  );
}

const ABBR: Record<string, string> = { nominative: 'nom', genitive: 'gen', dative: 'dat', accusative: 'acc', vocative: 'voc', singular: 'sg', plural: 'pl', dual: 'du', masculine: 'm', feminine: 'f', neuter: 'n', common: 'c', both: 'c', present: 'pres', imperfect: 'impf', future: 'fut', aorist: 'aor', perfect: 'perf', pluperfect: 'plpf', active: 'act', middle: 'mid', passive: 'pass', indicative: 'ind', imperative: 'impv', subjunctive: 'subj', optative: 'opt', infinitive: 'inf', participle: 'ptc', absolute: 'abs', construct: 'cs', determined: 'det', 'sequential imperfect': 'wayyiqtol', 'sequential perfect': 'weqatal', 'infinitive construct': 'inf cs', 'infinitive absolute': 'inf abs', 'passive participle': 'pass ptc', cohortative: 'coh', jussive: 'juss', article: 'art', conjunction: 'conj', preposition: 'prep', adverb: 'adv', adjective: 'adj', particle: 'ptcl', 'proper noun': 'name', 'personal pronoun': 'pron', 'demonstrative pronoun': 'dem', 'relative pronoun': 'rel', 'interrogative / indefinite pronoun': 'interr', 'object marker': 'obj', noun: 'noun', verb: 'verb', 'with the article': '+art' };
const abbr = (s: string) => s.split(' ').map((w) => ABBR[w] ?? w).join(' ');
function shortMorph(pos: string, features: string[]): string {
  const f = features.filter(Boolean).map((x) => ABBR[x] ?? abbr(x));
  if (pos === 'verb') return f.slice(0, 3).join(' ');
  return [ABBR[pos] ?? pos, ...f.slice(0, 1)].join(' · ');
}
