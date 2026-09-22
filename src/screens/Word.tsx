/**
 * Word page: one lexeme (Hebrew lemma id or Greek lemma) outside any reading context —
 * the complete entry, root family, Septuagint links, concordance and history.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { WordCard } from '../components/WordCard.tsx';
import { BackLink, Topbar } from '../components/ui.tsx';
import { lexemeKey, type Lang } from '../model/types.ts';
import { ensureGlossIndex, glossIndex, indexLemma, type WordInfo } from '../state/wordinfo.ts';

export default function Word() {
  const { lang: langS = '', id: idS = '' } = useParams();
  const lang: Lang | null = langS === 'he' || langS === 'gr' ? langS : null;
  const id = decodeURIComponent(idS);
  const nav = useNavigate();
  const [lemma, setLemma] = useState('');
  const [known, setKnown] = useState<boolean | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!lang) return;
    let alive = true;
    setIndexError(false);
    // reset unconditionally: the previous word's known/lemma must not stay on screen while the
    // new one is loading, or indefinitely if the new request fails
    setKnown(null);
    setLemma('');
    ensureGlossIndex(lang)
      .then((m) => {
        if (!alive) return;
        const hit = m.get(id) ?? (lang === 'he' ? m.get(id.split(' ')[0]) : undefined);
        setKnown(!!hit);
        setLemma(indexLemma(lang, id) || hit?.[1] || id);
      })
      .catch(() => {
        if (alive) setIndexError(true);
      });
    return () => {
      alive = false;
    };
  }, [lang, id, reloadTick]);

  if (!lang || !id) {
    return (
      <div>
        <Topbar title="Word" left={<BackLink to="/search" label="Search" />} />
        <div className="page page--narrow notfound route-fade">
          <h2>Not a valid word link</h2>
          <p className="faint">A word address looks like <code>#/word/he/1254 a</code> or <code>#/word/gr/λόγος</code>.</p>
          <div className="card__actions" style={{ justifyContent: 'center' }}>
            <Link className="btn" to="/search">Search</Link>
            <Link className="btn" to="/">Library</Link>
          </div>
        </div>
      </div>
    );
  }
  const langName = lang === 'he' ? 'Hebrew' : 'Greek';
  if (known === false && glossIndex(lang)) {
    return (
      <div>
        <Topbar title={`${langName} word`} left={<BackLink to="/search" label="Search" />} />
        <div className="page page--narrow notfound route-fade">
          <h2>No {langName} entry “{id}”</h2>
          <p className="faint">The lexicon has no entry with that id.</p>
          <div className="card__actions" style={{ justifyContent: 'center' }}>
            <Link className="btn" to={`/search?q=${encodeURIComponent(id)}`}>Search for it</Link>
            <Link className="btn" to="/">Library</Link>
          </div>
        </div>
      </div>
    );
  }
  const info: WordInfo = { ref: { book: '', ch: 0, v: 0, i: 0 }, lang, printed: lemma || id, form: lemma || id, lexId: id, key: lexemeKey(lang, id) };
  return (
    <div>
      <Topbar title={`${langName} word`} left={<BackLink to="/search" label="Search" />} />
      <div className="page page--narrow route-fade">
        {indexError && (
          <div className="card__text" role="alert" style={{ marginBottom: '0.8rem' }}>
            <span className="card__err">Could not confirm this lexicon entry (offline or a network problem).</span>{' '}
            <button type="button" className="btn btn--small btn--quiet" onClick={() => setReloadTick((t) => t + 1)}>Try again</button>
          </div>
        )}
        <WordCard key={`${lang}:${id}`} info={info} standalone onOpenVerse={() => undefined} onClose={() => nav(-1)} onOpenLexeme={(l, i) => nav(`/word/${l}/${encodeURIComponent(i)}`)} onGoTo={(r) => nav(`/read/${r.book}/${r.ch}?v=${r.v}&i=${r.i}`)} />
      </div>
    </div>
  );
}
