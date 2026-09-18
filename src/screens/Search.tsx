/**
 * Search: a reference ("Gen 1:1", "John 3:16") opens the reader; anything else searches both
 * lexica — Hebrew or Greek letters match lemmas, Latin letters match glosses and
 * transliterations, "H1254" / "G3056" / "1254" match Strong's numbers.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BackLink, Topbar } from '../components/ui.tsx';
import { searchIndex, type IndexRow } from '../data/lexicon.ts';
import type { Lang } from '../model/types.ts';
import { parseRef, refLabel } from '../text/canon.ts';
import { greekBase } from '../text/greek.ts';
import { skeleton } from '../text/hebrew.ts';

type Row = IndexRow & { lang: Lang };

export default function Search() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q')?.replace(/^bdb:.*$/, '') ?? '');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [scope, setScope] = useState<'all' | 'he' | 'gr'>('all');

  useEffect(() => {
    let alive = true;
    Promise.all([searchIndex('he'), searchIndex('gr')]).then(([he, gr]) => {
      if (!alive) return;
      setRows([...he.map((r) => [...r, 'he'] as unknown as Row), ...gr.map((r) => [...r, 'gr'] as unknown as Row)]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 200);
    return () => clearTimeout(t);
  }, [q, setParams]);

  const ref = useMemo(() => parseRef(q), [q]);
  const results = useMemo(() => {
    if (!rows || q.trim().length < 1) return [];
    const s = q.trim();
    const isHe = /[א-ת]/.test(s);
    const isGr = /[Ͱ-Ͽἀ-῿]/.test(s);
    const num = s.match(/^([HG])?(\d+)( [a-z])?$/i);
    let out: Row[] = [];
    if (num) {
      const n = num[2];
      const want = num[1]?.toUpperCase();
      out = rows.filter((r) => (r.lang === 'he' ? r[0].split(' ')[0] === n && want !== 'G' : r[1] === 'G' + n && want !== 'H'));
    } else if (isHe) {
      const sk = skeleton(s);
      out = rows.filter((r) => r.lang === 'he' && skeleton(r[1]).includes(sk)).sort((a, b) => (skeleton(a[1]) === sk ? -1 : skeleton(b[1]) === sk ? 1 : b[4] - a[4]));
    } else if (isGr) {
      const b = greekBase(s);
      out = rows.filter((r) => r.lang === 'gr' && greekBase(r[0]).includes(b)).sort((a, b2) => (greekBase(a[0]) === b ? -1 : greekBase(b2[0]) === b ? 1 : b2[4] - a[4]));
    } else {
      const l = s.toLowerCase();
      const word = new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      out = rows
        .filter((r) => word.test(r[3]) || r[2].toLowerCase().startsWith(l))
        .sort((a, b) => Number(b[3].toLowerCase() === l || b[2].toLowerCase() === l) - Number(a[3].toLowerCase() === l || a[2].toLowerCase() === l) || b[4] - a[4]);
    }
    if (scope !== 'all') out = out.filter((r) => r.lang === scope);
    return out.slice(0, 80);
  }, [rows, q, scope]);

  return (
    <div>
      <Topbar title="Search" left={<BackLink />} />
      <div className="page page--narrow route-fade">
        <div className="searchbar">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gen 1:1 · John 3:16 · דבר · λόγος · word · H1697" onKeyDown={(e) => { if (e.key === 'Enter' && ref) nav(`/read/${ref.book}/${ref.ch}${ref.v ? `?v=${ref.v}` : ''}`); }} />
        </div>
        <div className="filters">
          <div className="segmented">
            <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Both</button>
            <button aria-pressed={scope === 'he'} onClick={() => setScope('he')}>Hebrew</button>
            <button aria-pressed={scope === 'gr'} onClick={() => setScope('gr')}>Greek</button>
          </div>
          {rows && <span className="faint" style={{ fontSize: '0.85rem' }}>{rows.length.toLocaleString()} lemmas</span>}
        </div>
        {ref && (
          <Link className="home__continue" to={`/read/${ref.book}/${ref.ch}${ref.v ? `?v=${ref.v}` : ''}`}>
            <span className="home__continue-label">Open</span>
            <div className="home__continue-ref">{refLabel(ref.book, ref.ch, ref.v)}</div>
          </Link>
        )}
        {!rows && <p className="faint">Loading the lexica…</p>}
        {rows && q && !results.length && !ref && <p className="faint">Nothing found.</p>}
        {results.map((r) => (
          <Link key={r.lang + r[0]} to={`/word/${r.lang}/${encodeURIComponent(r[0])}`} className="result" style={{ display: 'block', color: 'inherit' }}>
            <div className="result__head">
              <span className={r.lang === 'he' ? 'he' : 'gr'} style={{ fontSize: '1.35rem' }}>{r[1] || r[0]}</span>
              {r[2] && <span className="faint" style={{ fontStyle: 'italic' }}>{r[2]}</span>}
              <span className="g">{r[3]}</span>
              <span className="result__meta">{r.lang === 'he' ? `H${r[0]}` : r[1]} · {r[4]}×</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
