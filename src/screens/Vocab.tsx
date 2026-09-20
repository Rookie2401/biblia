import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackLink, Topbar } from '../components/ui.tsx';
import { STATUS_NAMES } from '../components/StatusPicker.tsx';
import { db } from '../db/db.ts';
import { VOCAB_STATUSES, type Lexeme, type VocabStatus } from '../model/types.ts';
import { onVocabChange } from '../state/vocab.ts';

export default function Vocab() {
  const [rows, setRows] = useState<Lexeme[]>([]);
  const [tab, setTab] = useState<VocabStatus | 'all'>('all');
  const [lang, setLang] = useState<'all' | 'he' | 'gr' | 'la'>('all');
  // A burst of vocabulary notifications (e.g. several words recorded at once) can start more than
  // one load before the first resolves; an IndexedDB read has no ordering guarantee, so only the
  // most recently started load may commit its result.
  const loadGen = useRef(0);
  useEffect(() => {
    const load = () => {
      const gen = ++loadGen.current;
      db.lexemes
        .orderBy('updatedAt')
        .reverse()
        .toArray()
        .then((r) => {
          if (gen === loadGen.current) setRows(r);
        })
        .catch(() => {
          // IndexedDB failed (quota, permission, private mode, corruption): leave the previous
          // rows in place rather than an unhandled rejection
        });
    };
    load();
    const unsubscribe = onVocabChange(load);
    // a pending read from before unmount must not still be able to commit a result afterward
    return () => {
      loadGen.current++;
      unsubscribe();
    };
  }, []);
  const shown = rows.filter((r) => (tab === 'all' || r.status === tab) && (lang === 'all' || r.lang === lang));
  const counts = Object.fromEntries(VOCAB_STATUSES.map((s) => [s, rows.filter((r) => r.status === s && (lang === 'all' || r.lang === lang)).length]));
  return (
    <div>
      <Topbar title="Vocabulary" left={<BackLink />} />
      <div className="page page--narrow route-fade">
        <div className="filters">
          <div className="segmented">
            <button aria-pressed={lang === 'all'} onClick={() => setLang('all')}>All</button>
            <button aria-pressed={lang === 'he'} onClick={() => setLang('he')}>Hebrew</button>
            <button aria-pressed={lang === 'gr'} onClick={() => setLang('gr')}>Greek</button>
            <button aria-pressed={lang === 'la'} onClick={() => setLang('la')}>Latin</button>
          </div>
        </div>
        <div className="tabs">
          <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>all · {lang === 'all' ? rows.length : rows.filter((r) => r.lang === lang).length}</button>
          {VOCAB_STATUSES.map((s) => (
            <button key={s} aria-pressed={tab === s} onClick={() => setTab(s)}>{STATUS_NAMES[s]} · {counts[s]}</button>
          ))}
        </div>
        {!rows.length && <p className="faint">Words you tap while reading collect here, with their status.</p>}
        {shown.map((r) => (
          <Link key={r.key} to={`/word/${r.lang}/${encodeURIComponent(r.id)}`} className="vocab__row">
            <span className={`vocab__dot vocab__dot--${r.status}`} title={STATUS_NAMES[r.status]} />
            <span className="vocab__lemma"><span className={r.lang}>{r.lemma}</span> <span className="vocab__gloss">{r.gloss}</span></span>
            <span className="list__meta">{r.lookups}× · {r.encounters} read</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
