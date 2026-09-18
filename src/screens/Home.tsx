import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { I, IconBtn, Topbar } from '../components/ui.tsx';
import { db } from '../db/db.ts';
import type { Position } from '../model/types.ts';
import { CANON, SECTIONS, refLabel } from '../text/canon.ts';
import { getSettings } from '../state/settings.ts';

type Filter = 'all' | 'he' | 'gr';

export default function Home() {
  const nav = useNavigate();
  const [last, setLast] = useState<Position | null>(null);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [filter, setFilter] = useState<Filter>(() => {
    try {
      return (localStorage.getItem('biblia:home-filter') as Filter) || 'all';
    } catch {
      return 'all';
    }
  });
  const [done, setDone] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    db.positions.orderBy('at').reverse().toArray().then((rows) => {
      setPositions(new Map(rows.map((r) => [r.book, r])));
      setLast(rows[0] ?? null);
    });
    db.progress.filter((p) => p.done).toArray().then((rows) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.book, (m.get(r.book) ?? 0) + 1);
      setDone(m);
    });
  }, []);

  function pick(f: Filter) {
    setFilter(f);
    try {
      localStorage.setItem('biblia:home-filter', f);
    } catch {
      /* ignore */
    }
  }
  const open = (id: string) => {
    const p = positions.get(id);
    nav(p ? `/read/${id}/${p.ch}?v=${p.v}` : `/read/${id}/1`);
  };
  const lastBook = getSettings().lastBook;

  return (
    <div>
      <Topbar
        title="Biblia"
        right={
          <>
            <IconBtn label="Vocabulary" to="/vocab">{I.vocab}</IconBtn>
            <IconBtn label="Search" to="/search">{I.search}</IconBtn>
            <IconBtn label="Settings" to="/settings">{I.settings}</IconBtn>
          </>
        }
      />
      <div className="page home route-fade">
        <h1 className="home__title">
          <span className="he">תַּנַ״ךְ</span>
          <span className="gr" style={{ display: 'block', textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: '0.9em', marginBottom: '0.3em' }}>Ἡ Καινὴ Διαθήκη</span>
          Biblia
        </h1>
        <p className="home__subtitle">The Masoretic Text and the Greek New Testament, every word explained.</p>
        <div className="home__rule" />
        {last && (
          <Link className="home__continue" to={`/read/${last.book}/${last.ch}?v=${last.v}`}>
            <span className="home__continue-label">Continue reading</span>
            <div className="home__continue-ref">{refLabel(last.book, last.ch, last.v)}</div>
            <div className="home__continue-sub">{CANON.find((b) => b.id === last.book)?.native}</div>
          </Link>
        )}
        <div className="testament segmented">
          <button aria-pressed={filter === 'all'} onClick={() => pick('all')}>All</button>
          <button aria-pressed={filter === 'he'} onClick={() => pick('he')}>Tanakh</button>
          <button aria-pressed={filter === 'gr'} onClick={() => pick('gr')}>New Testament</button>
        </div>
        <div className="canon">
          {SECTIONS.filter((s) => filter === 'all' || s.lang === filter).map((s) => (
            <div key={s.id}>
              <div className="canon__section">
                {s.title} <span className={`native ${s.lang}`}>{s.native}</span>
              </div>
              {CANON.filter((b) => b.section === s.id).map((b) => {
                const p = positions.get(b.id);
                const d = done.get(b.id) ?? 0;
                return (
                  <button key={b.id} className="canon__book" onClick={() => open(b.id)} style={b.id === lastBook ? { color: 'var(--accent)' } : undefined}>
                    <span className="canon__en">{b.en}</span>
                    <span className={`canon__native ${b.lang}`}>{b.native}</span>
                    <span className="canon__meta">{p ? `at ${p.ch}` : d ? `${d}/${b.verses.length}` : `${b.verses.length} ch`}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="home__about">
          Miqra according to the Masorah · SBL Greek New Testament · OSHB & MorphGNT morphology · BDB · Abbott-Smith · Strong's. <Link to="/settings">Sources & licences</Link>
        </p>
      </div>
    </div>
  );
}
