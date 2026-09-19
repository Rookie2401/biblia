/**
 * The reader: one chapter, every word tappable. Hebrew is rendered token by token from the
 * canonical string (maqaf, paseq and sof pasuq exactly as printed); Greek from MorphGNT's
 * printed tokens. Words and verse numbers are buttons (keyboard and screen-reader operable);
 * the selection opens the word card in a side panel on wide screens and in a modal bottom
 * sheet on phones. Route parameters are validated before anything is rendered or recorded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { VerseCard } from '../components/VerseCard.tsx';
import { WordCard } from '../components/WordCard.tsx';
import { useMediaQuery, useModalDialog } from '../components/dialog.ts';
import { I, IconBtn, Sheet } from '../components/ui.tsx';
import { loadBook, type AnyBook } from '../data/books.ts';
import { cachedContext, loadContext } from '../data/context.ts';
import type { GrVerse, HeVerse, VocabStatus, WordRef } from '../model/types.ts';
import { adjacentChapter, book as bookInfo, refLabel, validRef } from '../text/canon.ts';
import { splitPrinted, greekNumeral } from '../text/greek.ts';
import { contentWords, hebrewNumeral, render, tokens, type HebrewDisplay } from '../text/hebrew.ts';
import { setSettings, useSettings } from '../state/settings.ts';
import { markUnlookedAsKnown, markChapterVisit, onVocabChange, recordEncounters, savePosition, statusMap } from '../state/vocab.ts';
import { chapterWords, ensureGlossIndex, glossIndex, seedFor, shortGloss, wordAt, type WordInfo } from '../state/wordinfo.ts';

type Sel = { kind: 'word'; ref: WordRef } | { kind: 'verse'; v: number } | null;
const POETRY = new Set(['Ps', 'Prov', 'Job', 'Lam', 'Song']);
const MOBILE = '(max-width: 979px)';

export default function Reader() {
  const { book: bookParam = '', ch: chParam } = useParams();
  const info = bookInfo(bookParam);
  const chRaw = chParam === undefined ? 1 : Number(chParam);
  const routeOk = !!info && /^\d+$/.test(String(chParam ?? '1')) && validRef(bookParam, chRaw);
  if (!routeOk) return <NotFound book={bookParam} ch={chParam} />;
  return <Chapter bookId={bookParam} ch={chRaw} />;
}

function NotFound({ book, ch }: { book: string; ch?: string }) {
  const info = bookInfo(book);
  return (
    <div className="page notfound route-fade">
      <h2>{info ? `${info.en} has no chapter ${ch ?? ''}` : `No book called “${book}”`}</h2>
      <p className="faint">{info ? `${info.en} has ${info.verses.length} chapters.` : 'The link may be malformed or from another edition.'}</p>
      <div className="card__actions" style={{ justifyContent: 'center' }}>
        {info && <Link className="btn" to={`/read/${info.id}/1`}>{info.en} 1</Link>}
        <Link className="btn" to="/">Library</Link>
        <Link className="btn" to="/search">Search</Link>
      </div>
    </div>
  );
}

function Chapter({ bookId, ch }: { bookId: string; ch: number }) {
  const info = bookInfo(bookId)!;
  const [params] = useSearchParams();
  const nav = useNavigate();
  const settings = useSettings();
  const mobile = useMediaQuery(MOBILE);
  const [loaded, setBook] = useState<AnyBook | null>(null);
  // the previous book stays in state for a moment after the route changes; never render it against the new chapter
  const book = loaded && loaded.book === bookId && loaded.chapters[ch - 1] ? loaded : null;
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Map<string, VocabStatus>>(new Map());
  const [showToc, setShowToc] = useState(false);
  const [showType, setShowType] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const proseRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const endSeen = useRef(false);
  const lang = info.lang;

  // Incremented every time the route (bookId/ch) changes or a retry is requested, so a response
  // for a request that is no longer the current one — because the reader moved on before it
  // settled — is recognisable and ignored, whether it succeeds or fails. Without this a slow or
  // retried request for a book the user has since left could still apply itself, or an error for
  // it, to whatever route is on screen when it finally resolves.
  const bookGen = useRef(0);
  useEffect(() => {
    const gen = ++bookGen.current;
    setBook(null);
    setError(null);
    setSel(null);
    setNotice(null);
    endSeen.current = false;
    loadBook(bookId)
      .then((b) => gen === bookGen.current && setBook(b))
      .catch((e) => gen === bookGen.current && setError(e instanceof Error ? e.message : String(e)));
    setSettings({ lastBook: bookId });
    void markChapterVisit(bookId, ch, false);
    // unmount or a route change (including one that happens while a retry below is in flight)
    // invalidates whichever request is current, so nothing pending can resolve into "current" again
    return () => {
      bookGen.current++;
    };
  }, [bookId, ch]);
  const retryBook = () => {
    const gen = ++bookGen.current;
    setError(null);
    loadBook(bookId)
      .then((b) => gen === bookGen.current && setBook(b))
      .catch((e) => gen === bookGen.current && setError(e instanceof Error ? e.message : String(e)));
  };

  const [glossIndexError, setGlossIndexError] = useState(false);
  const [glossReloadTick, setGlossReloadTick] = useState(0);
  useEffect(() => {
    // reset unconditionally: an error from a previous language/book must not survive into a
    // chapter whose own index is already cached and therefore never re-enters the branch below
    setGlossIndexError(false);
    if (!glossIndex(lang)) {
      let alive = true;
      void ensureGlossIndex(lang)
        .then(() => alive && setTick((t) => t + 1))
        .catch(() => alive && setGlossIndexError(true));
      return () => {
        alive = false;
      };
    }
  }, [lang, glossReloadTick]);
  useEffect(() => {
    if (!cachedContext(lang, bookId)) void loadContext(lang, bookId).then(() => setTick((t) => t + 1));
  }, [lang, bookId]);

  const words = useMemo(() => (book ? chapterWords(book, ch) : []), [book, ch]);
  const keys = useMemo(() => words.map((w) => w.key).filter((k): k is string => Boolean(k)), [words]);
  const refreshStatuses = useCallback(() => {
    if (!keys.length) return;
    statusMap(keys).then(setStatuses);
  }, [keys]);
  useEffect(refreshStatuses, [refreshStatuses]);
  useEffect(() => onVocabChange(refreshStatuses), [refreshStatuses]);

  // deep link ?v=&i= — validated against the loaded chapter before anything is selected
  useEffect(() => {
    if (!book || !params.has('v')) return;
    const vS = params.get('v') ?? '';
    const iS = params.get('i');
    const v = /^\d+$/.test(vS) ? Number(vS) : NaN;
    const verse = book.chapters[ch - 1].verses[v - 1];
    if (!verse) {
      setNotice(`${refLabel(bookId, ch)} has no verse ${vS}.`);
      return;
    }
    document.getElementById(`v${v}`)?.scrollIntoView({ block: 'center' });
    if (iS === null) {
      setSel({ kind: 'verse', v });
      return;
    }
    const n = lang === 'he' ? contentWords((verse as HeVerse).t).length : verse.w.length;
    const i = /^\d+$/.test(iS) ? Number(iS) : NaN;
    if (!(i >= 0 && i < n)) {
      setNotice(`${refLabel(bookId, ch, v)} has no word ${iS}.`);
      setSel({ kind: 'verse', v });
      return;
    }
    setSel({ kind: 'word', ref: { book: bookId, ch, v, i } });
  }, [book, params, bookId, ch, lang]);

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
  const close = useCallback(() => setSel(null), []);
  useModalDialog(panelRef, { active: mobile && !!sel, onClose: close, returnTo: triggerRef.current, inertSelector: '.reader__main' });

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

  const panelTitle = sel?.kind === 'word' ? `Word · ${refLabel(bookId, ch, sel.ref.v)}` : sel?.kind === 'verse' ? `Verse · ${refLabel(bookId, ch, sel.v)}` : '';
  const panel = (() => {
    if (!book || !sel) return null;
    if (sel.kind === 'word') {
      if (!selected) return null;
      return <WordCard info={selected} onOpenVerse={() => setSel({ kind: 'verse', v: sel.ref.v })} onClose={close} onOpenLexeme={(l, id) => nav(`/word/${l}/${encodeURIComponent(id)}`)} onGoTo={goTo} />;
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
        onClose={close}
      />
    );
  })();

  const chapter = book?.chapters[ch - 1];
  const nChapters = info.verses.length;
  const numeral = lang === 'he' ? hebrewNumeral(ch) : greekNumeral(ch);
  const selKey = sel?.kind === 'word' ? `${sel.ref.v}:${sel.ref.i}` : '';

  /** Toggle the selection for a word or verse-number control. Returns false when the target is neither. */
  const activate = (t: HTMLElement): boolean => {
    const w = t.closest('button.w') as HTMLElement | null;
    if (w?.dataset.i !== undefined) {
      triggerRef.current = w;
      const r = { book: bookId, ch, v: Number(w.dataset.v), i: Number(w.dataset.i) };
      setSel(sel?.kind === 'word' && sel.ref.v === r.v && sel.ref.i === r.i ? null : { kind: 'word', ref: r });
      return true;
    }
    const vn = t.closest('.vn') as HTMLElement | null;
    if (vn?.dataset.v) {
      triggerRef.current = vn;
      const v = Number(vn.dataset.v);
      setSel(sel?.kind === 'verse' && sel.v === v ? null : { kind: 'verse', v });
      return true;
    }
    return false;
  };
  const onProseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (activate(t)) return;
    if (!t.closest('.panel')) setSel(null);
  };
  // Native buttons activate on Enter/Space by themselves; handling the keys here as well keeps the
  // behaviour identical in browsers and automation that deliver only a keydown, without double-firing.
  const onProseKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const t = e.target as HTMLElement;
    if (!t.matches('button.w, button.vn')) return;
    e.preventDefault();
    activate(t);
  };

  return (
    <div className={`reader${panel ? ' reader--panel' : ''}`}>
      {panel && (
        <aside className="panel" ref={panelRef} role={mobile ? 'dialog' : 'complementary'} aria-modal={mobile ? 'true' : undefined} aria-label={panelTitle}>
          {panel}
        </aside>
      )}
      <div className="reader__main">
        <header className="reader__header">
          <div className="reader__header-inner">
            <Link to="/" className="iconbtn" aria-label="Library" title="Library">{I.back}</Link>
            <button type="button" className="reader__headbtn" onClick={() => setShowToc(true)} title="Chapters" aria-label={`${refLabel(bookId, ch)}: choose a chapter`}>
              <span className="reader__crumb">{info.en} · {ch} / {nChapters}</span>
              <span className={`reader__chapter${lang === 'gr' ? ' reader__chapter--ltr' : ''}`}>{info.native} {numeral}</span>
            </button>
            <IconBtn label="Chapters" onClick={() => setShowToc(true)}>{I.list}</IconBtn>
            <IconBtn label="Type & theme" onClick={() => setShowType(true)}>{I.type}</IconBtn>
            <IconBtn label="Search" to="/search">{I.search}</IconBtn>
          </div>
          <div className="reader__progress"><span style={{ width: `${(ch / nChapters) * 100}%` }} /></div>
        </header>

        {error && (
          <div className="reader__prose" style={{ fontFamily: 'var(--serif)', direction: 'ltr', textAlign: 'center' }} role="alert">
            <span className="card__err">{error}</span>
            <div className="card__actions" style={{ justifyContent: 'center', marginTop: '0.6rem' }}>
              <button type="button" className="btn btn--small" onClick={retryBook}>Try again</button>
            </div>
          </div>
        )}
        {!book && !error && <div className="reader__prose faint" style={{ fontFamily: 'var(--serif)', direction: 'ltr', textAlign: 'center' }} aria-live="polite">Loading {info.en}…</div>}
        {book && chapter && (
          <div ref={proseRef} className={`reader__prose reader__prose--${lang}${settings.showStatusMarks ? ' marks' : ''}`} onClick={onProseClick} onKeyDown={onProseKeyDown}>
            <div className="reader__title">{refLabel(bookId, ch)}</div>
            {notice && <div className="note" style={{ direction: 'ltr', fontFamily: 'var(--serif)', fontSize: '0.9rem' }} role="status">{notice}</div>}
            {glossIndexError && (
              <div className="note" style={{ direction: 'ltr', fontFamily: 'var(--serif)', fontSize: '0.9rem' }} role="alert">
                Could not load the lexicon glosses (offline or a network problem).{' '}
                <button type="button" className="btn btn--small btn--quiet" onClick={() => setGlossReloadTick((t) => t + 1)}>Try again</button>
              </div>
            )}
            {lang === 'he' ? (
              <HebrewChapter verses={chapter.verses as HeVerse[]} bookId={bookId} ch={ch} mode={settings.hebrewDisplay} statuses={statuses} words={words} selKey={selKey} selVerse={selVerse} showNumbers={settings.showVerseNumbers} poetry={POETRY.has(bookId)} glossLine={settings.showGlossLine} />
            ) : (
              <GreekChapter verses={chapter.verses as GrVerse[]} bookId={bookId} ch={ch} statuses={statuses} words={words} selKey={selKey} selVerse={selVerse} showNumbers={settings.showVerseNumbers} glossLine={settings.showGlossLine} />
            )}
            <div className="reader__end" id="chapter-end">
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
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
                {msg && <div className="faint" style={{ marginTop: '0.4rem', fontSize: '0.9rem' }} role="status">{msg}</div>}
              </div>
              {next ? <button type="button" className="btn" onClick={() => goChapter(next)}>{refLabel(next.book, next.ch)} →</button> : `End of the ${lang === 'he' ? 'Tanakh' : 'New Testament'}`}
              <div className="faint" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>{lang === 'he' ? 'Text: Miqra according to the Masorah · Morphology: OSHB' : 'Text: SBL Greek New Testament · Morphology: MorphGNT'}</div>
            </div>
          </div>
        )}

        <nav className="reader__nav" aria-label="Chapters">
          <div className="reader__nav-inner" style={lang === 'gr' ? { direction: 'ltr' } : undefined}>
            <button type="button" className="reader__nav-btn" disabled={!prev} onClick={() => goChapter(prev)}>
              <span className="reader__nav-dir">Previous</span>
              <span className={`reader__nav-cite${lang === 'gr' ? ' reader__nav-cite--ltr' : ''}`}>{prev ? refLabel(prev.book, prev.ch) : ''}</span>
            </button>
            <button type="button" className="reader__nav-btn reader__nav-btn--next" disabled={!next} onClick={() => goChapter(next)}>
              <span className="reader__nav-dir">Next</span>
              <span className={`reader__nav-cite${lang === 'gr' ? ' reader__nav-cite--ltr' : ''}`}>{next ? refLabel(next.book, next.ch) : ''}</span>
            </button>
          </div>
        </nav>
      </div>

      {showToc && (
        <Sheet title={`${info.en} · chapters`} onClose={() => setShowToc(false)}>
          <div className="segmented" style={{ maxHeight: '60dvh', overflowY: 'auto' }} role="group" aria-label="Chapter">
            {info.verses.map((_, i) => (
              <button type="button" key={i} aria-pressed={i + 1 === ch} aria-label={`${info.en} ${i + 1}`} onClick={() => { setShowToc(false); goChapter({ book: bookId, ch: i + 1 }); }}>{i + 1}</button>
            ))}
          </div>
        </Sheet>
      )}
      {showType && <TypeSheet lang={lang} onClose={() => setShowType(false)} />}
    </div>
  );
}

function TypeSheet({ lang, onClose }: { lang: 'he' | 'gr'; onClose: () => void }) {
  const settings = useSettings();
  return (
    <Sheet title="Type & theme" onClose={onClose}>
      {lang === 'he' ? (
        <div className="sheet__row"><label htmlFor="rd-size">Size</label><input id="rd-size" type="range" min={18} max={44} value={settings.fontSize} aria-valuetext={`${settings.fontSize} pixels`} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} /></div>
      ) : (
        <div className="sheet__row"><label htmlFor="rd-size">Size</label><input id="rd-size" type="range" min={16} max={36} value={settings.greekFontSize} aria-valuetext={`${settings.greekFontSize} pixels`} onChange={(e) => setSettings({ greekFontSize: Number(e.target.value) })} /></div>
      )}
      <div className="sheet__row"><label htmlFor="rd-spacing">Spacing</label><input id="rd-spacing" type="range" min={1.4} max={2.6} step={0.05} value={settings.lineHeight} aria-valuetext={`line height ${settings.lineHeight.toFixed(2)}`} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} /></div>
      {lang === 'he' && (
        <>
          <div className="sheet__row">
            <fieldset>
              <legend>Text</legend>
              <div className="segmented">
                {(['full', 'niqqud', 'consonants'] as HebrewDisplay[]).map((m) => (
                  <button type="button" key={m} aria-pressed={settings.hebrewDisplay === m} onClick={() => setSettings({ hebrewDisplay: m })}>{m === 'full' ? 'with accents' : m}</button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="sheet__row">
            <fieldset>
              <legend>Type</legend>
              <div className="segmented">
                <button type="button" aria-pressed={settings.hebrewFont === 'frank'} onClick={() => setSettings({ hebrewFont: 'frank' })}>Frank Ruhl</button>
                <button type="button" aria-pressed={settings.hebrewFont === 'david'} onClick={() => setSettings({ hebrewFont: 'david' })}>David</button>
                <button type="button" aria-pressed={settings.hebrewFont === 'system'} onClick={() => setSettings({ hebrewFont: 'system' })}>Sans</button>
              </div>
            </fieldset>
          </div>
        </>
      )}
      <div className="sheet__row">
        <fieldset>
          <legend>Theme</legend>
          <div className="segmented">
            <button type="button" aria-pressed={settings.theme === 'auto'} onClick={() => setSettings({ theme: 'auto' })}>auto</button>
            <button type="button" aria-pressed={settings.theme === 'light'} onClick={() => setSettings({ theme: 'light' })}>light</button>
            <button type="button" aria-pressed={settings.theme === 'dark'} onClick={() => setSettings({ theme: 'dark' })}>dark</button>
          </div>
        </fieldset>
      </div>
      <div className="sheet__row"><label htmlFor="rd-verses">Verses</label><input id="rd-verses" type="checkbox" checked={settings.showVerseNumbers} onChange={(e) => setSettings({ showVerseNumbers: e.target.checked })} /> <label htmlFor="rd-verses" className="faint" style={{ fontSize: '0.85rem', width: 'auto' }}>show verse numbers</label></div>
      <div className="sheet__row"><label htmlFor="rd-marks">Marks</label><input id="rd-marks" type="checkbox" checked={settings.showStatusMarks} onChange={(e) => setSettings({ showStatusMarks: e.target.checked })} /> <label htmlFor="rd-marks" className="faint" style={{ fontSize: '0.85rem', width: 'auto' }}>underline words not yet known</label></div>
      <div className="sheet__row"><label htmlFor="rd-gloss">Glosses</label><input id="rd-gloss" type="checkbox" checked={settings.showGlossLine} onChange={(e) => setSettings({ showGlossLine: e.target.checked })} /> <label htmlFor="rd-gloss" className="faint" style={{ fontSize: '0.85rem', width: 'auto' }}>gloss line under the tapped verse</label></div>
      <div className="sheet__actions"><button type="button" className="btn btn--small" onClick={onClose}>Done</button></div>
    </Sheet>
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

/** A tappable word: a real button when it has a card, plain text when no morphology is aligned to it. */
function Word({ w, text, on, statuses, v, i }: { w: WordInfo | undefined; text: string; on: boolean; statuses: Map<string, VocabStatus>; v: number; i: number }) {
  const cls = wordClass(w, statuses, on);
  if (!w?.key) return <span className={cls} data-v={v} data-i={i}>{text}</span>;
  return (
    <button type="button" className={cls} data-v={v} data-i={i} aria-pressed={on}>
      {text}
    </button>
  );
}

function VerseNumber({ bookId, ch, v, on, label }: { bookId: string; ch: number; v: number; on: boolean; label: string }) {
  return (
    <button type="button" className={`vn${on ? ' vn--on' : ''}`} data-v={v} aria-pressed={on} aria-label={`Open ${refLabel(bookId, ch, v)} verse view`} title={refLabel(bookId, ch, v)}>
      {label}
    </button>
  );
}

/** Under the tapped verse: the BSB's rendering of each word in this verse (a translation), word by word in source order. */
function GlossLine({ words, lang, selI }: { words: WordInfo[]; lang: 'he' | 'gr'; selI?: number }) {
  const w0 = words[0];
  const ctx = w0 ? cachedContext(lang, w0.ref.book)?.chapters[w0.ref.ch - 1]?.[w0.ref.v - 1] : undefined;
  return (
    <span className="glossline">
      <span className="glossline__label">{ctx ? 'BSB, word by word' : 'lemma glosses, not a translation'}</span>
      {words.map((w) => {
        const c = ctx?.[w.ref.i];
        const text = ctx ? (c ? c : c === '' ? '‒' : '·') : shortGloss(lang, w.lexId) || (w.he?.prefixOnly ? w.he.morph.prefixes.map((p) => p.gloss).join('+') : '·');
        return <span key={w.ref.i} className={selI === w.ref.i ? 'on' : undefined}>{text}</span>;
      })}
    </span>
  );
}

export function HebrewChapter({ verses, bookId, ch, mode, statuses, words, selKey, selVerse, showNumbers, poetry, glossLine }: ChapterProps & { verses: HeVerse[]; mode: HebrewDisplay; poetry: boolean }) {
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
        parts.push(
          <span key={`${ti}-${pi}`}>
            <Word w={vw[i]} text={render(core, mode)} on={selKey === `${v.n}:${i}`} statuses={statuses} v={v.n} i={i} />
            {pi < pieces.length - 1 ? '־' : ''}
            {sof ? <span className="sof">׃</span> : ''}
          </span>,
        );
      });
      parts.push(' ');
    });
    const verseEl = (
      <span key={v.n} id={`v${v.n}`} data-v={v.n} className={`verse${selVerse === v.n ? ' verse--on' : ''}`} style={poetry ? { display: 'block', marginBottom: '0.2em' } : undefined}>
        {showNumbers && <VerseNumber bookId={bookId} ch={ch} v={v.n} on={selVerse === v.n} label={hebrewNumeral(v.n)} />}
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

export function GreekChapter({ verses, bookId, ch, statuses, words, selKey, selVerse, showNumbers, glossLine }: ChapterProps & { verses: GrVerse[] }) {
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
            {showNumbers && <VerseNumber bookId={bookId} ch={ch} v={v.n} on={selVerse === v.n} label={String(v.n)} />}
            {v.w.length === 0 && <span className="absent">[verse not in this edition]</span>}
            {v.w.map((tok, i) => {
              const { lead, word, trail } = splitPrinted(tok[0]);
              return (
                <span key={i}>
                  {lead}
                  <Word w={vw[i]} text={word} on={selKey === `${v.n}:${i}`} statuses={statuses} v={v.n} i={i} />
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
