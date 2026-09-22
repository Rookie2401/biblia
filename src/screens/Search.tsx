/**
 * Search: a reference ("Gen 1:1", "John 3:16") opens the reader; anything else searches both
 * lexica (see state/search.ts for the query rules).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BackLink, Topbar } from '../components/ui.tsx';
import { searchIndex } from '../data/lexicon.ts';
import { parseRef, refLabel } from '../text/canon.ts';
import { searchLexicon, toGreekSearchRows, toHebrewSearchRows, wordUrl, type SearchRow, type SearchScope } from '../state/search.ts';

const SOURCE: Record<string, string> = { curated: 'Biblia', bdb: 'BDB', index: 'OS index', strongs: "Strong's", kjv: 'KJV', dodson: 'Dodson', abbott: 'Abbott-Smith' };

export default function Search() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [scope, setScope] = useState<SearchScope>('all');

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    Promise.all([searchIndex('he'), searchIndex('gr')])
      .then(([he, gr]) => {
        if (!alive) return;
        setRows([...toHebrewSearchRows(he), ...toGreekSearchRows(gr)]);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadTick]);

  // the URL is the source of truth when it changes from outside (a link to #/search?q=…); typing writes it back, debounced
  const fromUrl = params.get('q') ?? '';
  useEffect(() => {
    setQ((current) => (current === fromUrl ? current : fromUrl));
  }, [fromUrl]);
  useEffect(() => {
    if (q === fromUrl) return;
    const t = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 200);
    return () => clearTimeout(t);
  }, [q, fromUrl, setParams]);

  const ref = useMemo(() => parseRef(q), [q]);
  const results = useMemo(() => (rows ? searchLexicon(rows, q, scope) : []), [rows, q, scope]);
  const refUrl = ref ? `/read/${ref.book}/${ref.ch}${ref.v ? `?v=${ref.v}` : ''}` : null;

  return (
    <div>
      <Topbar title="Search" left={<BackLink />} />
      <div className="page page--narrow route-fade">
        <div className="searchbar">
          <label htmlFor="search-q" className="sr-only">Search a reference, a Hebrew or Greek word, an English gloss or a Strong's number</label>
          <input id="search-q" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gen 1:1 · John 3:16 · דבר · λόγος · word · H1697 · G3056" onKeyDown={(e) => { if (e.key === 'Enter' && refUrl) nav(refUrl); }} />
        </div>
        <div className="filters">
          <fieldset className="segmented" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Language</legend>
            <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All</button>
            <button type="button" aria-pressed={scope === 'he'} onClick={() => setScope('he')}>Hebrew</button>
            <button type="button" aria-pressed={scope === 'gr'} onClick={() => setScope('gr')}>Greek</button>
          </fieldset>
          {rows && <span className="faint" style={{ fontSize: '0.85rem' }}>{rows.length.toLocaleString()} lemmas</span>}
        </div>
        <p className="card__note" style={{ margin: '-0.4rem 0 0.8rem' }}>Results show lemma glosses — dictionary meanings, not contextual translations. The source of each gloss is named on the right.</p>
        {ref && refUrl && (
          <Link className="home__continue" to={refUrl}>
            <span className="home__continue-label">Open</span>
            <div className="home__continue-ref">{refLabel(ref.book, ref.ch, ref.v)}</div>
          </Link>
        )}
        {loadError && (
          <div className="card__text" role="alert">
            <span className="card__err">Could not load the lexica. Check your connection and try again.</span>
            <div className="card__actions" style={{ marginTop: '0.4rem' }}>
              <button type="button" className="btn btn--small" onClick={() => setReloadTick((t) => t + 1)}>Try again</button>
            </div>
          </div>
        )}
        {!rows && !loadError && <p className="faint" aria-live="polite">Loading the lexica…</p>}
        {rows && q && !results.length && !ref && <p className="faint" role="status">Nothing found.</p>}
        <div aria-live="polite" className="sr-only">{rows && q ? `${results.length} results` : ''}</div>
        {results.map((r) => (
          <Link key={`${r.lang}:${r.id}`} to={wordUrl(r)} className="result" style={{ display: 'block', color: 'inherit' }}>
            <div className="result__head">
              <span className={r.lang} style={{ fontSize: '1.35rem' }}>{r.lemma}</span>
              {r.transliteration && <span className="faint" style={{ fontStyle: 'italic' }}>{r.transliteration}</span>}
              <span className="g">{r.gloss || <span className="faint">no gloss in the source lexica</span>}</span>
              <span className="result__meta">{r.strong || (r.lang === 'he' ? 'Hebrew' : 'Greek')} · {r.count}×{r.source ? ` · ${SOURCE[r.source] ?? r.source}` : ''}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
