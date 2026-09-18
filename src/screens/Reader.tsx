/**
 * The reader: one chapter, every word tappable. Hebrew is rendered token by token from the
 * canonical string (maqaf, paseq and sof pasuq exactly as printed); Greek from MorphGNT's
 * printed tokens. Selection opens the word card (side panel on wide screens, sheet on phones).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VerseCard } from '../components/VerseCard.tsx';
import { WordCard } from '../components/WordCard.tsx';
import { I, IconBtn, Sheet } from '../components/ui.tsx';
import { loadBook, type AnyBook } from '../data/books.ts';
import { db } from '../db/db.ts';
import type { GrVerse, HeVerse, VocabStatus, WordRef } from '../model/types.ts';
import { adjacentChapter, book as bookInfo, refLabel } from '../text/canon.ts';
import { splitPrinted, greekNumeral } from '../text/greek.ts';
import { hebrewNumeral, render, tokens, type HebrewDisplay } from '../text/hebrew.ts';
import { setSettings, useSettings } from '../state/settings.ts';
import { markUnlookedAsKnown, markChapterVisit, onVocabChange, recordEncounters, savePosition, statusMap } from '../state/vocab.ts';
import { chapterWords, ensureGlossIndex, glossIndex, seedFor, shortGloss, wordAt, type WordInfo } from '../state/wordinfo.ts';

type Sel = { kind: 'word'; ref: WordRef } | { kind: 'verse'; v: number } | null;
const POETRY = new Set(['Ps', 'Prov', 'Job', 'Lam', 'Song']);

export default function Reader() {
  const { book: bookId = 'Gen', ch: chS } = useParams();
  const ch = Math.max(1, Number(chS) || 1);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const settings = useSettings();
  const [loaded, setBook] = useState<AnyBook | null>(null);
  // the previous book stays in state for a moment after the route changes; never render it against the new chapter
  const book = loaded && loaded.book === bookId && loaded.chapters[ch - 1] ? loaded : null;
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [statuses, setStatuses] = useState<Map<string, VocabStatus>>(new Map());
  const [showToc, setShowToc] = useState(false);
  const [showType, setShowType] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const proseRef = useRef<HTMLDivElement>(null);
  const endSeen = useRef(false);
  const info = bookInfo(bookId);
  const lang = info?.lang ?? 'he';

  useEffect(() => {
    let alive = true;
    setBook(null);
    setError(null);
    setSel(null);
    endSeen.current = false;
    loadBook(bookId)
      .then((b) => alive && setBook(b))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    setSettings({ lastBook: bookId });
    void markChapterVisit(bookId, ch, false);
    return () => {
      alive = false;
    };
  }, [bookId, ch]);

  useEffect(() => {
    if (!glossIndex(lang)) void ensureGlossIndex(lang).then(() => setTick((t) => t + 1));
  }, [lang]);

  const words = useMemo(() => (book ? chapterWords(book, ch) : []), [book, ch]);
  const keys = useMemo(() => words.map((w) => w.key).filter((k): k is string => Boolean(k)), [words]);
  const refreshStatuses = useCallback(() => {
    if (!keys.length) return;
    statusMap(keys).then(setStatuses);
  }, [keys]);
  useEffect(refreshStatuses, [refreshStatuses]);
  useEffect(() => onVocabChange(refreshStatuses), [refreshStatuses]);

  // deep link ?v=
  useEffect(() => {
    const v = Number(params.get('v'));
    const i = params.get('i');
    if (!book || !v) return;
    const el = document.getElementById(`v${v}`);
    el?.scrollIntoView({ block: 'center' });
    if (i !== null) setSel({ kind: 'word', ref: { book: bookId, ch, v, i: Number(i) } });
    else setSel({ kind: 'verse', v });
  }, [book, params, bookId, ch]);

  // reading position + encounters at the end of the chapter
  useEffect(() => {
    if (!book) return;
    const seedMap = new Map(words.filter((w) => w.key).map((w) => [w.key!, w]));
    const seedFn = (k: string) => {
      const w = seedMap.get(k);
      return w ? seedFor(w) : undefined;
    };
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.target.id === 'chapter-end') {
            if (!endSeen.current) {
              endSeen.current = true;
              void recordEncounters(keys, seedFn);
              void markChapterVisit(bookId, ch, true);
            }
          } else {
            const v = Number((e.target as HTMLElement).dataset.v);
            if (v) void savePosition(bookId, ch, v);
          }
        }
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    proseRef.current?.querySelectorAll('[data-v]').forEach((el) => obs.observe(el));
    const end = document.getElementById('chapter-end');
    if (end) obs.observe(end);
    return () => obs.disconnect();
  }, [book, bookId, ch, keys, words]);

  const selected: WordInfo | null = useMemo(() => (sel?.kind === 'word' && book ? wordAt(book, sel.ref) : null), [sel, book]);
  const selVerse = sel?.kind === 'word' ? sel.ref.v : sel?.kind === 'verse' ? sel.v : undefined;

  function goChapter(target: { book: string; ch: number } | null, top = true) {
    if (!target) return;
    nav(`/read/${target.book}/${target.ch}`);
    if (top) window.scrollTo(0, 0);
  }
  const prev = adjacentChapter(bookId, ch, -1);
  const next = adjacentChapter(bookId, ch, 1);
  const goTo = (r: WordRef) => {
    if (r.book === bookId && r.ch === ch) {
      setSel({ kind: 'word', ref: r });
      document.getElementById(`v${r.v}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else nav(`/read/${r.book}/${r.ch}?v=${r.v}&i=${r.i}`);
  };

  const panel = (() => {
    if (!book || !sel) return null;
    if (sel.kind === 'word') {
      if (!selected) return null;
      return <WordCard info={selected} onOpenVerse={() => setSel({ kind: 'verse', v: sel.ref.v })} onClose={() => setSel(null)} onOpenLexeme={(l, id) => nav(`/word/${l}/${encodeURIComponent(id)}`)} onGoTo={goTo} />;
    }
    const nVerses = book.chapters[ch - 1].verses.length;
    return (
      <VerseCard
        book={book}
        ch={ch}
        v={sel.v}
        onSelectWord={(i) => setSel({ kind: 'word', ref: { book: bookId, ch, v: sel.v, i } })}
        onPrev={sel.v > 1 ? () => setSel({ kind: 'verse', v: sel.v - 1 }) : undefined}
        onNext={sel.v < nVerses ? () => setSel({ kind: 'verse', v: sel.v + 1 }) : undefined}
        onClose={() => setSel(null)}
      />
    );
  })();

  if (!info) {
    return (
      <div className="page">
        <p className="faint">No such book.</p>
        <Link to="/">Library</Link>
      </div>
    );
  }
  const chapter = book?.chapters[ch - 1];
  const nChapters = info.verses.length;
  const numeral = lang === 'he' ? hebrewNumeral(ch) : greekNumeral(ch);
  const selKey = sel?.kind === 'word' ? `${sel.ref.v}:${sel.ref.i}` : '';

  return (
    <div className={`reader${panel ? ' reader--panel' : ''}`}>
      {panel && <aside className="panel">{panel}</aside>}
      <div className="reader__main">
        <header className="reader__header">
          <div className="reader__header-inner">
            <Link to="/" className="iconbtn" aria-label="Library" title="Library">{I.back}</Link>
            <button className="reader__headbtn" onClick={() => setShowToc(true)} title="Chapters">
              <span className="reader__crumb">{info.en} · {ch} / {nChapters}</span>
              <span className={`reader__chapter${lang === 'gr' ? ' reader__chapter--ltr' : ''}`}>{info.native} {numeral}</span>
            </button>
            <IconBtn label="Chapters" onClick={() => setShowToc(true)}>{I.list}</IconBtn>
            <IconBtn label="Type & theme" onClick={() => setShowType(true)}>{I.type}</IconBtn>
            <IconBtn label="Search" to="/search">{I.search}</IconBtn>
          </div>
          <div className="reader__progress"><span style={{ width: `${(ch / nChapters) * 100}%` }} /></div>
        </header>

        {error && <div className="reader__prose" style={{ fontFamily: 'var(--serif)', direction: 'ltr', textAlign: 'center' }}><span className="card__err">{error}</span></div>}
        {!book && !error && <div className="reader__prose faint" style={{ fontFamily: 'var(--serif)', direction: 'ltr', textAlign: 'center' }}>Loading {info.en}…</div>}
        {book && chapter && (
          <div
            ref={proseRef}
            className={`reader__prose reader__prose--${lang}${settings.showStatusMarks ? ' marks' : ''}`}
            onClick={(e) => {
              const t = e.target as HTMLElement;
              const w = t.closest('.w') as HTMLElement | null;
              if (w?.dataset.i !== undefined) {
                const r = { book: bookId, ch, v: Number(w.dataset.v), i: Number(w.dataset.i) };
                setSel(sel?.kind === 'word' && sel.ref.v === r.v && sel.ref.i === r.i ? null : { kind: 'word', ref: r });
                return;
              }
              const vn = t.closest('.vn') as HTMLElement | null;
              if (vn?.dataset.v) {
                const v = Number(vn.dataset.v);
                setSel(sel?.kind === 'verse' && sel.v === v ? null : { kind: 'verse', v });
                return;
              }
              if (!t.closest('.panel')) setSel(null);
            }}
          >
            <div className="reader__title">{refLabel(bookId, ch)}</div>
            {lang === 'he' ? (
              <HebrewChapter verses={chapter.verses as HeVerse[]} bookId={bookId} ch={ch} mode={settings.hebrewDisplay} statuses={statuses} words={words} selKey={selKey} selVerse={selVerse} showNumbers={settings.showVerseNumbers} poetry={POETRY.has(bookId)} glossLine={settings.showGlossLine} />
            ) : (
              <GreekChapter verses={chapter.verses as GrVerse[]} bookId={bookId} ch={ch} statuses={statuses} words={words} selKey={selKey} selVerse={selVerse} showNumbers={settings.showVerseNumbers} glossLine={settings.showGlossLine} />
            )}
            <div className="reader__end" id="chapter-end">
              <div style={{ marginBottom: '1rem' }}>
                <button
                  className="btn btn--quiet"
                  title="Every word in this chapter that is still new and was never tapped becomes “automatic” (known without asking). Tapping a word later undoes it for that word."
                  onClick={async () => {
                    const seedMap = new Map(words.filter((w) => w.key).map((w) => [w.key!, w]));
                    const n = await markUnlookedAsKnown(keys, (k) => {
                      const w = seedMap.get(k);
                      return w ? seedFor(w) : undefined;
                    });
                    setMsg(n ? `${n} untapped word${n === 1 ? '' : 's'} marked automatic.` : 'No untapped new words left in this chapter.');
                  }}
                >
                  Mark the rest of this chapter as known
                </button>
                {msg && <div className="faint" style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>{msg}</div>}
              </div>
              {next ? <button className="btn" onClick={() => goChapter(next)}>{refLabel(next.book, next.ch)} →</button> : `End of the ${lang === 'he' ? 'Tanakh' : 'New Testament'}`}
              <div className="faint" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>{lang === 'he' ? 'Text: Miqra according to the Masorah · Morphology: OSHB' : 'Text: SBL Greek New Testament · Morphology: MorphGNT'}</div>
            </div>
          </div>
        )}

        <nav className="reader__nav">
          <div className="reader__nav-inner" style={lang === 'gr' ? { direction: 'ltr' } : undefined}>
            <button className="reader__nav-btn" disabled={!prev} onClick={() => goChapter(prev)}>
              <span className="reader__nav-dir">Previous</span>
              <span className={`reader__nav-cite${lang === 'gr' ? ' reader__nav-cite--ltr' : ''}`}>{prev ? refLabel(prev.book, prev.ch) : ''}</span>
            </button>
            <button className="reader__nav-btn reader__nav-btn--next" disabled={!next} onClick={() => goChapter(next)}>
              <span className="reader__nav-dir">Next</span>
              <span className={`reader__nav-cite${lang === 'gr' ? ' reader__nav-cite--ltr' : ''}`}>{next ? refLabel(next.book, next.ch) : ''}</span>
            </button>
          </div>
        </nav>
      </div>

      {showToc && (
        <Sheet title={`${info.en} · chapters`} onClose={() => setShowToc(false)}>
          <div className="segmented" style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
            {info.verses.map((_, i) => (
              <button key={i} aria-pressed={i + 1 === ch} onClick={() => { setShowToc(false); goChapter({ book: bookId, ch: i + 1 }); }}>{i + 1}</button>
            ))}
          </div>
        </Sheet>
      )}
      {showType && (
        <Sheet title="Type & theme" onClose={() => setShowType(false)}>
          {lang === 'he' ? (
            <div className="sheet__row"><label>Size</label><input type="range" min={18} max={44} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} /></div>
          ) : (
            <div className="sheet__row"><label>Size</label><input type="range" min={16} max={36} value={settings.greekFontSize} onChange={(e) => setSettings({ greekFontSize: Number(e.target.value) })} /></div>
          )}
          <div className="sheet__row"><label>Spacing</label><input type="range" min={1.4} max={2.6} step={0.05} value={settings.lineHeight} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} /></div>
          {lang === 'he' && (
            <>
              <div className="sheet__row">
                <label>Text</label>
                <div className="segmented">
                  {(['full', 'niqqud', 'consonants'] as HebrewDisplay[]).map((m) => (
                    <button key={m} aria-pressed={settings.hebrewDisplay === m} onClick={() => setSettings({ hebrewDisplay: m })}>{m === 'full' ? 'with accents' : m}</button>
                  ))}
                </div>
              </div>
              <div className="sheet__row">
                <label>Type</label>
                <div className="segmented">
                  <button aria-pressed={settings.hebrewFont === 'frank'} onClick={() => setSettings({ hebrewFont: 'frank' })}>Frank Ruhl</button>
                  <button aria-pressed={settings.hebrewFont === 'david'} onClick={() => setSettings({ hebrewFont: 'david' })}>David</button>
                  <button aria-pressed={settings.hebrewFont === 'system'} onClick={() => setSettings({ hebrewFont: 'system' })}>Sans</button>
                </div>
              </div>
            </>
          )}
          <div className="sheet__row">
            <label>Theme</label>
            <div className="segmented">
              <button aria-pressed={settings.theme === 'auto'} onClick={() => setSettings({ theme: 'auto' })}>auto</button>
              <button aria-pressed={settings.theme === 'light'} onClick={() => setSettings({ theme: 'light' })}>light</button>
              <button aria-pressed={settings.theme === 'dark'} onClick={() => setSettings({ theme: 'dark' })}>dark</button>
            </div>
          </div>
          <div className="sheet__row"><label>Verses</label><input type="checkbox" checked={settings.showVerseNumbers} onChange={(e) => setSettings({ showVerseNumbers: e.target.checked })} /> <span className="faint" style={{ fontSize: '0.85rem' }}>show verse numbers</span></div>
          <div className="sheet__row"><label>Marks</label><input type="checkbox" checked={settings.showStatusMarks} onChange={(e) => setSettings({ showStatusMarks: e.target.checked })} /> <span className="faint" style={{ fontSize: '0.85rem' }}>underline words not yet known</span></div>
          <div className="sheet__row"><label>Glosses</label><input type="checkbox" checked={settings.showGlossLine} onChange={(e) => setSettings({ showGlossLine: e.target.checked })} /> <span className="faint" style={{ fontSize: '0.85rem' }}>gloss line under the tapped verse</span></div>
          <div className="sheet__actions"><button className="btn btn--small" onClick={() => setShowType(false)}>Done</button></div>
        </Sheet>
      )}
    </div>
  );
}

interface ChapterProps {
  bookId: string;
  ch: number;
  statuses: Map<string, VocabStatus>;
  words: WordInfo[];
  selKey: string;
  selVerse?: number;
  showNumbers: boolean;
  glossLine: boolean;
}

function wordClass(w: WordInfo | undefined, statuses: Map<string, VocabStatus>, on: boolean): string {
  const st = w?.key ? statuses.get(w.key) ?? 'new' : undefined;
  return ['w', st && st !== 'known' && st !== 'automatic' ? `st-${st}` : '', !w?.key ? 'tap-null' : '', on ? 'sel' : ''].filter(Boolean).join(' ');
}

function GlossLine({ words, lang, selI }: { words: WordInfo[]; lang: 'he' | 'gr'; selI?: number }) {
  return (
    <span className="glossline">
      {words.map((w) => (
        <span key={w.ref.i} className={selI === w.ref.i ? 'on' : undefined}>{shortGloss(lang, w.lexId) || (w.he?.prefixOnly ? w.he.morph.prefixes.map((p) => p.gloss).join('+') : '·')}</span>
      ))}
    </span>
  );
}

function HebrewChapter({ verses, bookId, ch, mode, statuses, words, selKey, selVerse, showNumbers, poetry, glossLine }: ChapterProps & { verses: HeVerse[]; mode: HebrewDisplay; poetry: boolean }) {
  const byVerse = useMemo(() => {
    const m = new Map<number, WordInfo[]>();
    for (const w of words) (m.get(w.ref.v) ?? m.set(w.ref.v, []).get(w.ref.v)!).push(w);
    return m;
  }, [words]);
  const paras: React.ReactNode[][] = [[]];
  verses.forEach((v) => {
    const vw = byVerse.get(v.n) ?? [];
    let idx = 0;
    const parts: React.ReactNode[] = [];
    if (v.absent) parts.push(<span key="abs" className="absent">[verse absent from this edition]</span>);
    tokens(v.t).forEach((tok, ti) => {
      if (tok === '׀') {
        parts.push(<span key={ti} className="paseq">׀ </span>);
        return;
      }
      const pieces = tok.split('־');
      pieces.forEach((piece, pi) => {
        const sof = piece.endsWith('׃');
        const core = sof ? piece.slice(0, -1) : piece;
        const i = idx++;
        const w = vw[i];
        const on = selKey === `${v.n}:${i}`;
        parts.push(
          <span key={`${ti}-${pi}`}>
            <span className={wordClass(w, statuses, on)} data-v={v.n} data-i={i}>{render(core, mode)}</span>
            {pi < pieces.length - 1 ? '־' : ''}
            {sof ? <span className="sof">׃</span> : ''}
          </span>,
        );
      });
      parts.push(' ');
    });
    const verseEl = (
      <span key={v.n} id={`v${v.n}`} data-v={v.n} className={`verse${selVerse === v.n ? ' verse--on' : ''}`} style={poetry ? { display: 'block', marginBottom: '0.2em' } : undefined}>
        {showNumbers && <span className={`vn${selVerse === v.n ? ' vn--on' : ''}`} data-v={v.n} title={`${bookId} ${ch}:${v.n}`}>{hebrewNumeral(v.n)}</span>}
        {parts}
        {v.s ? <span className="samekh" /> : null}
        {glossLine && selVerse === v.n && <GlossLine words={vw} lang="he" selI={selKey.startsWith(`${v.n}:`) ? Number(selKey.split(':')[1]) : undefined} />}
      </span>
    );
    paras[paras.length - 1].push(verseEl);
    if (v.pe) paras.push([]);
  });
  return (
    <>
      {paras.filter((p) => p.length).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

function GreekChapter({ verses, bookId, ch, statuses, words, selKey, selVerse, showNumbers, glossLine }: ChapterProps & { verses: GrVerse[] }) {
  const byVerse = useMemo(() => {
    const m = new Map<number, WordInfo[]>();
    for (const w of words) (m.get(w.ref.v) ?? m.set(w.ref.v, []).get(w.ref.v)!).push(w);
    return m;
  }, [words]);
  return (
    <p>
      {verses.map((v) => {
        const vw = byVerse.get(v.n) ?? [];
        return (
          <span key={v.n} id={`v${v.n}`} data-v={v.n} className={`verse${selVerse === v.n ? ' verse--on' : ''}`}>
            {showNumbers && <span className={`vn${selVerse === v.n ? ' vn--on' : ''}`} data-v={v.n} title={`${bookId} ${ch}:${v.n}`}>{v.n}</span>}
            {v.w.length === 0 && <span className="absent">[verse not in this edition]</span>}
            {v.w.map((tok, i) => {
              const { lead, word, trail } = splitPrinted(tok[0]);
              const w = vw[i];
              return (
                <span key={i}>
                  {lead}
                  <span className={wordClass(w, statuses, selKey === `${v.n}:${i}`)} data-v={v.n} data-i={i}>{word}</span>
                  {trail}{' '}
                </span>
              );
            })}
            {glossLine && selVerse === v.n && <GlossLine words={vw} lang="gr" selI={selKey.startsWith(`${v.n}:`) ? Number(selKey.split(':')[1]) : undefined} />}
          </span>
        );
      })}
    </p>
  );
}

export function useLastPosition(bookId: string): { ch: number; v: number } | null {
  const [pos, setPos] = useState<{ ch: number; v: number } | null>(null);
  useEffect(() => {
    db.positions.get(bookId).then((p) => setPos(p ? { ch: p.ch, v: p.v } : null));
  }, [bookId]);
  return pos;
}
