/**
 * Home: the canon as nested disclosures — testament → division → book → chapters — in the
 * Classical Library's format: a button head with a rotating chevron, a height-animated
 * collapsible, children indented one rung and tied to the parent with a quiet rule, and
 * chapters as a vertical list of entries. Which levels are open is remembered on this device.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Collapsible } from '../components/Collapsible.tsx';
import { I, IconBtn, Topbar } from '../components/ui.tsx';
import { db } from '../db/db.ts';
import type { Lang, Position } from '../model/types.ts';
import { CANON, refLabel, type BookInfo } from '../text/canon.ts';
import { greekNumeral } from '../text/greek.ts';
import { hebrewNumeral } from '../text/hebrew.ts';
import { romanNumeral } from '../text/latin.ts';
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
  /** "bible" = the Hebrew/Greek Tanakh + New Testament; "other" = everything else (Septuagint,
   * Vulgate, ...), set apart under its own "Other resources" heading on the home page. */
  group: 'bible' | 'other';
  divisions: Division[];
}

/** Tanakh in Masoretic order; the New Testament as narrative books and letters (Revelation, addressed to the seven churches, sits with the letters). */
export const TREE: Testament[] = [
  {
    id: 'tanakh',
    title: 'Tanakh',
    native: 'תַּנַ״ךְ',
    lang: 'he',
    group: 'bible',
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
    group: 'bible',
    divisions: [
      { id: 'Histories', title: 'Histories', native: 'Εὐαγγέλια · Πράξεις', sections: ['Gospels', 'Acts'] },
      { id: 'Epistles', title: 'Epistles', native: 'Ἐπιστολαί · Ἀποκάλυψις', sections: ['Paul', 'General', 'Revelation'] },
    ],
  },
  {
    id: 'lxx',
    title: 'Septuagint',
    native: 'Ἡ Μετάφρασις τῶν Ἑβδομήκοντα',
    lang: 'gr',
    group: 'other',
    divisions: [
      { id: 'LxxLaw', title: 'Law', native: 'Νόμος', sections: ['LxxLaw'] },
      { id: 'LxxHistory', title: 'History', native: 'Ἱστορικά', sections: ['LxxHistory'] },
      { id: 'LxxPoetry', title: 'Poetry & Wisdom', native: 'Ποιητικά', sections: ['LxxPoetry'] },
      { id: 'LxxProphets', title: 'Prophets', native: 'Προφῆται', sections: ['LxxProphets'] },
    ],
  },
  {
    id: 'vulgate',
    title: 'Vulgate',
    native: 'Biblia Sacra Vulgata',
    lang: 'la',
    group: 'other',
    divisions: [
      { id: 'VulgGospels', title: 'Gospels', native: 'Evangelia', sections: ['VulgGospels'] },
      { id: 'VulgActs', title: 'Acts', native: 'Actus Apostolorum', sections: ['VulgActs'] },
      { id: 'VulgPaul', title: 'Letters of Paul', native: 'Epistolæ Paulinæ', sections: ['VulgPaul'] },
      { id: 'VulgGeneral', title: 'General letters', native: 'Epistolæ Catholicæ', sections: ['VulgGeneral'] },
      { id: 'VulgRevelation', title: 'Revelation', native: 'Apocalypsis', sections: ['VulgRevelation'] },
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
    db.positions
      .orderBy('at')
      .reverse()
      .toArray()
      .then((rows) => {
        setPositions(new Map(rows.map((r) => [r.book, r])));
        setLast(rows[0] ?? null);
      })
      .catch(() => {});
    db.progress
      .filter((p) => p.done)
      .toArray()
      .then((rows) => setDone(new Set(rows.map((r) => r.id))))
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        /* private mode */
      }
      return next;
    });
  }
  const lastBook = getSettings().lastBook;

  const testamentGroup = (t: Testament) => (
    <Group key={t.id} id={t.id} level={1} open={open.has(t.id)} onToggle={toggle} title={t.title} native={t.native} lang={t.lang} meta={`${t.divisions.reduce((n, d) => n + booksOf(d).length, 0)} books`}>
      {t.divisions.map((d) => {
        const books = booksOf(d);
        return (
          <Group key={d.id} id={d.id} level={2} open={open.has(d.id)} onToggle={toggle} title={d.title} native={d.native} lang={t.lang} meta={`${books.length} books`}>
            {books.map((b) => {
              const p = positions.get(b.id);
              const finished = b.verses.filter((_, i) => done.has(`${b.id}:${i + 1}`)).length;
              return (
                <Group key={b.id} id={b.id} level={3} open={open.has(b.id)} onToggle={toggle} title={b.en} native={b.native} lang={b.lang} current={b.id === lastBook} meta={p ? `at ${p.ch}` : finished ? `${finished}/${b.verses.length}` : `${b.verses.length} ch`}>
                  <div className="entrylist" role="list" aria-label={`${b.en} chapters`}>
                    {p && (
                      <button type="button" className="entry entry--resume" role="listitem" onClick={() => nav(`/read/${b.id}/${p.ch}?v=${p.v}`)}>
                        <span className="entry__num">Resume</span>
                        <span className="entry__preview">{refLabel(b.id, p.ch, p.v)}</span>
                      </button>
                    )}
                    {b.verses.map((count, i) => {
                      const n = i + 1;
                      const isDone = done.has(`${b.id}:${n}`);
                      return (
                        <Link key={n} to={`/read/${b.id}/${n}`} className={`entry entry--chapter${isDone ? ' entry--done' : ''}${p?.ch === n ? ' entry--at' : ''}`} role="listitem" aria-label={`${b.en} ${n}${isDone ? ', read' : ''}`}>
                          <span className="entry__num">Chapter {n}</span>
                          <span className={`entry__native ${b.lang}`} lang={b.lang === 'he' ? 'he' : b.lang === 'la' ? 'la' : 'el'}>{b.lang === 'he' ? `פֶּרֶק ${hebrewNumeral(n)}` : b.lang === 'la' ? `Caput ${romanNumeral(n)}` : `Κεφάλαιον ${greekNumeral(n)}`}</span>
                          <span className="entry__preview">{count} verses{isDone ? ' · read' : p?.ch === n ? ' · reading' : ''}</span>
                        </Link>
                      );
                    })}
                  </div>
                </Group>
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
  const bibleTestaments = TREE.filter((t) => t.group === 'bible');
  const otherTestaments = TREE.filter((t) => t.group === 'other');

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
          Biblia Sacra
        </h1>
        <p className="home__subtitle">The holy scripture in the original language with a linguistic apparatus underneath.</p>
        <div className="home__rule" />
        {last && (
          <Link className="home__continue" to={`/read/${last.book}/${last.ch}?v=${last.v}`}>
            <span className="home__continue-label">Continue reading</span>
            <div className="home__continue-ref">{refLabel(last.book, last.ch, last.v)}</div>
            <div className="home__continue-sub">{CANON.find((b) => b.id === last.book)?.native}</div>
          </Link>
        )}
        <nav className="lib" aria-label="Books">
          {bibleTestaments.map(testamentGroup)}
        </nav>
        {otherTestaments.length > 0 && (
          <>
            <h2 className="home__section">Other resources</h2>
            <p className="home__subtitle home__subtitle--small">Ancient translations and related texts, alongside the Hebrew and Greek Bible above.</p>
            <nav className="lib" aria-label="Other resources">
              {otherTestaments.map(testamentGroup)}
            </nav>
          </>
        )}
        <p className="home__about">
          Miqra according to the Masorah · SBL Greek New Testament · OSHB & MorphGNT morphology · BDB · Abbott-Smith · Strong's.
          {otherTestaments.length > 0 && <> Septuagint (Rahlfs, 1935) · lxx-morph morphology, merged into the Greek vocabulary above. Vulgate (Clementine, 1592) · PROIEL/Syntacticus morphology · Lewis & Short.</>}
          {' '}<Link to="/settings">Sources & licences</Link>
        </p>
      </div>
    </div>
  );
}

/** One disclosure rung: button head with a rotating chevron, height-animated children. */
function Group({ id, level, open, onToggle, title, native, lang, meta, current, children }: { id: string; level: 1 | 2 | 3; open: boolean; onToggle: (id: string) => void; title: string; native: string; lang: Lang; meta?: string; current?: boolean; children: ReactNode }) {
  return (
    <div className={`lib__group lib__group--${level}${current ? ' lib__group--current' : ''}`}>
      <button type="button" className="lib__head" aria-expanded={open} onClick={() => onToggle(id)}>
        <span className={`lib__chev${open ? ' lib__chev--open' : ''}`} aria-hidden="true">{I.chevronRight}</span>
        <span className="lib__title">{title}</span>
        <span className={`lib__native ${lang}`}>{native}</span>
        {meta && <span className="lib__meta">{meta}</span>}
      </button>
      <Collapsible open={open}>
        <div className="lib__children">{children}</div>
      </Collapsible>
    </div>
  );
}
