/**
 * Home: the canon as nested disclosures — testament → division → book → chapters — using
 * native <details>/<summary> so every level is keyboard and screen-reader operable. Which
 * levels are open is remembered on this device.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { I, IconBtn, Topbar } from '../components/ui.tsx';
import { db } from '../db/db.ts';
import type { Lang, Position } from '../model/types.ts';
import { CANON, refLabel, type BookInfo } from '../text/canon.ts';
import { greekNumeral } from '../text/greek.ts';
import { hebrewNumeral } from '../text/hebrew.ts';
import { getSettings } from '../state/settings.ts';

interface Division {
  id: string;
  title: string;
  native: string;
  /** canon sections that belong to this division, in order */
  sections: string[];
}
interface Testament {
  id: string;
  title: string;
  native: string;
  lang: Lang;
  divisions: Division[];
}

/** Tanakh in Masoretic order; the New Testament as narrative books and letters (Revelation, addressed to the seven churches, sits with the letters). */
export const TREE: Testament[] = [
  {
    id: 'tanakh',
    title: 'Tanakh',
    native: 'תַּנַ״ךְ',
    lang: 'he',
    divisions: [
      { id: 'Torah', title: 'Torah', native: 'תּוֹרָה', sections: ['Torah'] },
      { id: 'Neviim', title: 'Neviʾim · Prophets', native: 'נְבִיאִים', sections: ['Neviim'] },
      { id: 'Ketuvim', title: 'Ketuvim · Writings', native: 'כְּתוּבִים', sections: ['Ketuvim'] },
    ],
  },
  {
    id: 'nt',
    title: 'New Testament',
    native: 'Ἡ Καινὴ Διαθήκη',
    lang: 'gr',
    divisions: [
      { id: 'Histories', title: 'Histories', native: 'Εὐαγγέλια · Πράξεις', sections: ['Gospels', 'Acts'] },
      { id: 'Epistles', title: 'Epistles', native: 'Ἐπιστολαί · Ἀποκάλυψις', sections: ['Paul', 'General', 'Revelation'] },
    ],
  },
];

export function booksOf(d: Division): BookInfo[] {
  return d.sections.flatMap((s) => CANON.filter((b) => b.section === s));
}

const OPEN_KEY = 'biblia:home-open';
function loadOpen(): Set<string> {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : ['tanakh', 'nt']);
  } catch {
    return new Set(['tanakh', 'nt']);
  }
}

export default function Home() {
  const nav = useNavigate();
  const [last, setLast] = useState<Position | null>(null);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(loadOpen);

  useEffect(() => {
    db.positions.orderBy('at').reverse().toArray().then((rows) => {
      setPositions(new Map(rows.map((r) => [r.book, r])));
      setLast(rows[0] ?? null);
    });
    db.progress.filter((p) => p.done).toArray().then((rows) => setDone(new Set(rows.map((r) => r.id))));
  }, []);

  function toggle(id: string, isOpen: boolean) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        /* private mode */
      }
      return next;
    });
  }
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
        <nav className="tree" aria-label="Books">
          {TREE.map((t) => (
            <Node key={t.id} id={t.id} level={1} open={open} onToggle={toggle} title={t.title} native={t.native} lang={t.lang} meta={`${t.divisions.reduce((n, d) => n + booksOf(d).length, 0)} books`}>
              {t.divisions.map((d) => {
                const books = booksOf(d);
                return (
                  <Node key={d.id} id={d.id} level={2} open={open} onToggle={toggle} title={d.title} native={d.native} lang={t.lang} meta={`${books.length} books`}>
                    {books.map((b) => {
                      const p = positions.get(b.id);
                      const finished = b.verses.filter((_, i) => done.has(`${b.id}:${i + 1}`)).length;
                      return (
                        <Node key={b.id} id={b.id} level={3} open={open} onToggle={toggle} title={b.en} native={b.native} lang={b.lang} current={b.id === lastBook} meta={p ? `at ${p.ch}` : finished ? `${finished}/${b.verses.length}` : `${b.verses.length} ch`}>
                          <div className="chapters" role="group" aria-label={`${b.en} chapters`}>
                            {p && (
                              <button type="button" className="chapters__resume" onClick={() => nav(`/read/${b.id}/${p.ch}?v=${p.v}`)}>
                                Resume at {refLabel(b.id, p.ch, p.v)}
                              </button>
                            )}
                            {b.verses.map((_, i) => {
                              const n = i + 1;
                              const isDone = done.has(`${b.id}:${n}`);
                              return (
                                <Link key={n} to={`/read/${b.id}/${n}`} className={`chapters__ch${isDone ? ' chapters__ch--done' : ''}${p?.ch === n ? ' chapters__ch--at' : ''}`} aria-label={`${b.en} ${n}`} title={`${b.en} ${n}${isDone ? ' · read' : ''}`}>
                                  <span>{n}</span>
                                  <span className={`chapters__native ${b.lang}`}>{b.lang === 'he' ? hebrewNumeral(n) : greekNumeral(n)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </Node>
                      );
                    })}
                  </Node>
                );
              })}
            </Node>
          ))}
        </nav>
        <p className="home__about">
          Miqra according to the Masorah · SBL Greek New Testament · OSHB & MorphGNT morphology · BDB · Abbott-Smith · Strong's. <Link to="/settings">Sources & licences</Link>
        </p>
      </div>
    </div>
  );
}

/** One disclosure level. Native <details> keeps it operable by keyboard and assistive technology. */
function Node({ id, level, open, onToggle, title, native, lang, meta, current, children }: { id: string; level: 1 | 2 | 3; open: Set<string>; onToggle: (id: string, open: boolean) => void; title: string; native: string; lang: Lang; meta?: string; current?: boolean; children: ReactNode }) {
  const isOpen = open.has(id);
  return (
    <details className={`tree__node tree__node--${level}${current ? ' tree__node--current' : ''}`} open={isOpen} onToggle={(e) => onToggle(id, (e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="tree__summary">
        <span className="tree__chevron" aria-hidden="true">{I.chevron}</span>
        <span className="tree__title">{title}</span>
        <span className={`tree__native ${lang}`}>{native}</span>
        {meta && <span className="tree__meta">{meta}</span>}
      </summary>
      {isOpen && <div className="tree__body">{children}</div>}
    </details>
  );
}
