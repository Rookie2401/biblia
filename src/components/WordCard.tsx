/**
 * The tap-a-word card, in Sefer's three levels:
 *   1 tap    — surface · reading · meaning · lemma · root · morphology line · status
 *   2 More   — morpheme chips, "how the letters encode this", provenance
 *   3 Deeper — the complete dictionary entry (BDB / Abbott-Smith), Strong's, root family,
 *              Septuagint links across the two testaments, concordance, your history
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contextGloss, loadContext } from '../data/context.ts';
import { concordance } from '../data/lexicon.ts';
import { db } from '../db/db.ts';
import type { GrEntry, HeEntry, LaEntry, Lexeme, VocabStatus, WordRef } from '../model/types.ts';
import { CANON, refLabel } from '../text/canon.ts';
import { toNiqqud } from '../text/hebrew.ts';
import { entryLemma, loadEntry, plainForm, seedFor, type WordInfo } from '../state/wordinfo.ts';
import { onVocabChange, recordLookup, setLexemeStatus } from '../state/vocab.ts';
import { DictEntry } from './DictEntry.tsx';
import { Morphemes, ParseChips } from './Morphemes.tsx';
import { StatusPicker, STATUS_NAMES } from './StatusPicker.tsx';
import { fmtDate, I } from './ui.tsx';

const lookedUp = new Set<string>();
const GLOSS_SOURCE: Record<string, string> = { curated: 'Biblia', bdb: 'BDB', index: 'Open Scriptures index', strongs: "Strong's", kjv: 'KJV rendering', dodson: 'Dodson', abbott: 'Abbott-Smith', tflsj: 'LSJ' };

export interface WordCardProps {
  info: WordInfo;
  onOpenVerse: () => void;
  onClose: () => void;
  /** open a lexeme by lexicon id (root family, LXX links) */
  onOpenLexeme: (lang: 'he' | 'gr' | 'la', id: string) => void;
  onGoTo: (ref: WordRef) => void;
  /** the card is on the word page (no reading context) */
  standalone?: boolean;
}

export function WordCard(p: WordCardProps) {
  const { info } = p;
  const nav = useNavigate();
  const [level, setLevel] = useState<1 | 2 | 3>(p.standalone ? 3 : 1);
  const [entry, setEntry] = useState<HeEntry | GrEntry | LaEntry | null | undefined>(undefined);
  const [lex, setLex] = useState<Lexeme | null>(null);
  const [history, setHistory] = useState(false);
  const [conc, setConc] = useState<number[][] | null>(null);
  const [concAll, setConcAll] = useState(false);
  const [ctx, setCtx] = useState<string | null | undefined>(undefined);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const refId = `${info.ref.book}:${info.ref.ch}:${info.ref.v}:${info.ref.i}`;

  useEffect(() => {
    setLevel(p.standalone ? 3 : 1);
    setHistory(false);
    setConc(null);
    setConcAll(false);
    setEntry(undefined);
    setCtx(undefined);
    setStatusErr(null);
    // the previous word's vocabulary record (status, encounters, forms) must not stay attached
    // to the new word — and stay actionable, since the status picker writes by lex.key — while
    // this word's own lookup is pending, or indefinitely if it fails
    setLex(null);
    let alive = true;
    if (info.ref.book && !p.standalone) loadContext(info.lang, info.ref.book).then(() => alive && setCtx(contextGloss(info.lang, info.ref.book, info.ref.ch, info.ref.v, info.ref.i)));
    (async () => {
      const e = await loadEntry(info).catch(() => undefined);
      if (!alive) return;
      setEntry(e ?? null);
      if (!info.key) return;
      const seed = seedFor(info, e);
      if (!seed) return;
      try {
        if (p.standalone || lookedUp.has(refId)) {
          const lx = await db.lexemes.get(info.key);
          if (alive) setLex(lx ?? null);
        } else {
          lookedUp.add(refId);
          try {
            const lx = await recordLookup(seed, info.ref, plainForm(info));
            if (alive) setLex(lx);
          } catch (e) {
            // the write never landed — a later visit must retry it, not treat this word as
            // already recorded and only read the (still-missing) row
            lookedUp.delete(refId);
            throw e;
          }
        }
      } catch {
        // IndexedDB failed (quota, permission, private mode, corruption): lex stays at the safe
        // default set above rather than becoming an unhandled rejection
      }
    })();
    return () => {
      alive = false;
    };
  }, [refId, info.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    // unsubscribing stops FUTURE notifications, but a lookup already in flight when the card
    // moves to a different word must not apply that stale word's record to the new one
    const unsubscribe = onVocabChange(() => {
      if (!info.key) return;
      db.lexemes
        .get(info.key)
        .then((lx) => alive && setLex(lx ?? null))
        .catch(() => {});
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [info.key]);

  useEffect(() => {
    if (level < 3 || conc || !info.lexId) return;
    let alive = true;
    concordance(info.lang, info.lexId)
      .then((c) => alive && setConc(c))
      .catch(() => alive && setConc([]));
    return () => {
      alive = false;
    };
  }, [level, conc, info.lang, info.lexId]);

  const he = info.lang === 'he' ? (entry as HeEntry | null | undefined) : undefined;
  const gr = info.lang === 'gr' ? (entry as GrEntry | null | undefined) : undefined;
  const la = info.lang === 'la' ? (entry as LaEntry | null | undefined) : undefined;
  const gloss = entry?.g ?? '';
  const glossSource = GLOSS_SOURCE[entry?.gs ?? ''] ?? '';
  const prefixForms = info.he?.segments.filter((s) => ['conjunction', 'preposition', 'article', 'relative', 'interrogative'].includes(s.kind)).map((s) => toNiqqud(s.form)) ?? [];
  const morphLine = info.he ? heMorphLine(info, prefixForms) : info.gr ? [info.gr.morph.pos, info.gr.morph.features].filter(Boolean).join(' · ') : info.la ? [info.la.morph.pos, info.la.morph.features].filter(Boolean).join(' · ') : '';
  const reading = info.lang === 'he' ? toNiqqud(info.printed) : '';
  const provenance =
    info.lang === 'he'
      ? `OSHB morphology${he?.id ? ` · Strong's H${he.id}` : ''}${he?.bdb ? ' · BDB' : ''}`
      : info.lang === 'la'
        ? `PROIEL / Syntacticus morphology${la?.ls ? ' · Lewis & Short' : ''}`
        : `MorphGNT (SBLGNT)${gr?.id ? ` · Strong's ${gr.id}` : ''}${gr?.as ? ' · Abbott-Smith' : ''}`;
  const prefixOnly = info.he?.prefixOnly;
  const lemmaShown = entry ? entryLemma(info.lang, entry) : '';
  const concShown = conc ? (concAll ? conc : conc.slice(0, 25)) : [];
  const langClass = info.lang === 'he' ? 'he' : info.lang === 'la' ? 'la' : 'gr';

  return (
    <div>
      <div className="panel__head">
        <span className="label">{p.standalone || !info.ref.book ? 'Word' : `Word · ${refLabel(info.ref.book, info.ref.ch, info.ref.v)}`}</span>
        <button className="iconbtn" onClick={p.onClose} aria-label="Close">{I.close}</button>
      </div>
      <div className={info.lang === 'he' ? 'card__surface' : `card__surface card__surface--${info.lang}`}>{info.printed}</div>
      {reading && reading !== info.printed && <div className="card__vocalized" title="Reading without the accents">{reading}</div>}
      {ctx !== undefined && !p.standalone && (
        <div className="card__ctx">
          {ctx ? <span className="card__ctx-text">“{ctx}”</span> : ctx === '' ? <span className="card__ctx-text faint">rendered together with a neighbouring word</span> : <span className="card__ctx-text faint">no rendering aligned for this word</span>}
          <span className="card__ctx-src">in this verse · BSB</span>
        </div>
      )}
      {entry === undefined && info.lexId ? (
        <div className="card__gloss faint">Loading…</div>
      ) : gloss ? (
        <div className="card__gloss">
          <span className="card__gloss-text">{gloss}</span>
          <span className="card__gloss-src">lemma gloss{glossSource ? ' · ' + glossSource : ''}</span>
        </div>
      ) : prefixOnly ? (
        <div className="card__gloss"><span className="card__gloss-text">{info.he!.morph.prefixes.map((x) => x.gloss).join(' + ')}</span><span className="card__gloss-src">prefix only</span></div>
      ) : !info.lexId ? (
        <div className="card__gloss faint">no morphology aligned to this word</div>
      ) : entry === null ? (
        <div className="card__gloss faint">no gloss in the source lexica</div>
      ) : null}
      {gloss && <div className="card__note">Lemma gloss — the dictionary meaning, not a contextual translation{ctx ? '; the BSB line above is what this verse says' : ''}.</div>}
      {entry && (
        <div className="card__line">
          <span className="k">Lemma</span>
          <span className={langClass}>{lemmaShown}</span>
          {entry.x && <span className="soft" style={{ fontStyle: 'italic' }}>{entry.x}</span>}
          {he?.pos && <span className="faint">{he.pos}</span>}
          {gr?.id && <span className="faint">{gr.id}</span>}
        </div>
      )}
      {he?.root && (
        <div className="card__line">
          <span className="k">Root</span>
          <span className="he">{he.root}</span>
          {he.rootDef && <span className="soft">{he.rootDef}</span>}
        </div>
      )}
      {gr?.der && (
        <div className="card__line">
          <span className="k">From</span>
          <span className="soft">{gr.der.replace(/^from /, '').replace(/[;.]$/, '')}</span>
        </div>
      )}
      {morphLine && <div className="card__morph">{morphLine}{info.he?.morph.lang === 'Aramaic' ? ' · Aramaic' : ''}</div>}
      {lex && info.key && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPicker
            value={lex.status}
            onChange={(s: VocabStatus) => {
              setStatusErr(null);
              setLexemeStatus(lex.key, s).catch(() => setStatusErr('Could not update the status (offline storage problem). Try again.'));
            }}
          />
          {entry?.n ? <span className="status__form" style={{ marginTop: '0.5rem' }}>· {entry.n}× in the {info.lang === 'he' ? 'Tanakh' : info.lang === 'la' ? 'Vulgate New Testament' : 'New Testament and Septuagint'}</span> : null}
        </div>
      )}
      {statusErr && <div className="card__err" role="alert">{statusErr}</div>}

      <div className="card__actions">
        {level === 1 && <button className="btn btn--small" onClick={() => setLevel(2)}>More {I.chevron}</button>}
        {level === 2 && <button className="btn btn--small" onClick={() => setLevel(3)}>Deeper {I.chevron}</button>}
        {level === 3 && !p.standalone && <button className="btn btn--small btn--quiet" onClick={() => setLevel(1)}>Less</button>}
        {!p.standalone && <button className="btn btn--small" onClick={p.onOpenVerse}>{I.sentence} Verse</button>}
        {info.key && <button className="btn btn--small" aria-pressed={history} onClick={() => setHistory((h) => !h)}>{I.history} History</button>}
      </div>

      {history && lex && (
        <div className="card__section">
          <span className="label">Your history with this word</span>
          <div className="stat-row">
            <div className="stat"><b>{lex.encounters}</b><span>read past</span></div>
            <div className="stat"><b>{lex.lookups}</b><span>looked up</span></div>
            <div className="stat"><b>{lex.chapters.length}</b><span>chapters</span></div>
          </div>
          <div className="card__text">Status <b>{STATUS_NAMES[lex.status]}</b>{lex.firstLookup ? <> · first looked up in {refLabel(lex.firstLookup.book, lex.firstLookup.ch, lex.firstLookup.v)} on {fmtDate(lex.firstLookup.at)}</> : null}.</div>
          {lex.forms.length > 0 && <div className="card__text"><b>Forms you have met:</b> <span className="chips">{lex.forms.map((f) => <span key={f} className="chip"><span className={info.lang}>{f}</span></span>)}</span></div>}
        </div>
      )}

      {level >= 2 && (
        <div className="card__section">
          <span className="label">How the form is built</span>
          {info.he && <Morphemes segments={info.he.segments} />}
          {info.gr && <ParseChips items={grChips(info)} />}
          {info.la && <ParseChips items={laChips(info)} />}
          {(() => {
            const lines = info.he?.lines ?? info.gr?.lines ?? info.la?.lines ?? [];
            return lines.length ? (
              <div className="encoding">
                {lines.map((l) => (
                  <span key={l.title} style={{ display: 'contents' }}>
                    <span className="k">{l.title}</span>
                    <span className="t">{l.text}</span>
                  </span>
                ))}
              </div>
            ) : null;
          })()}
          {info.he?.morph.lang === 'Aramaic' && <div className="card__text"><b>Aramaic.</b> This word is in the Aramaic portions of the Bible (Daniel 2:4b–7:28, Ezra 4:8–6:18 and 7:12–26, Jeremiah 10:11, two words in Genesis 31:47).</div>}
          {he?.kj && <div className="card__text"><b>Historical renderings (KJV, 1611):</b> {he.kj}</div>}
          {gr?.long && gr.long !== gloss && <div className="card__text">{gr.long}</div>}
          <div className="card__prov">{provenance}{glossSource ? ` · gloss: ${glossSource}` : ''}</div>
        </div>
      )}

      {level >= 3 && (
        <>
          {he?.bdb && (
            <div className="card__section">
              <DictEntry html={he.bdb} title="Brown–Driver–Briggs" collapsible={!p.standalone} onHebrew={(id) => p.onOpenLexeme('he', id)} />
            </div>
          )}
          {gr?.as && (
            <div className="card__section">
              <DictEntry html={gr.as} title="Abbott-Smith" collapsible={!p.standalone} onHebrew={(n) => p.onOpenLexeme('he', n)} />
            </div>
          )}
          {la?.ls && (
            <div className="card__section">
              <DictEntry html={la.ls} title="Lewis & Short" collapsible={!p.standalone} onHebrew={() => {}} />
            </div>
          )}
          {entry?.sd && (
            <div className="card__section">
              <span className="label">Strong's {he ? `H${he.id}` : gr?.id}</span>
              <div className="card__text">{entry.der ? <span className="faint">{entry.der} </span> : null}{entry.sd}</div>
              {entry.kj && <div className="card__kj">Historical renderings (KJV): {entry.kj}</div>}
            </div>
          )}
          {he && (he.fam?.length || he.lxx?.length) ? (
            <div className="card__section">
              <span className="label">Root family {he.root ? <span className="he-inline">{he.root}</span> : null}</span>
              {he.fam?.length ? (
                <div className="card__text">
                  <span className="chips">
                    {he.fam.slice(0, 14).map(([id, w, g]) => (
                      <button key={id} className="chip chip--btn" onClick={() => p.onOpenLexeme('he', id)}><span className="he">{w}</span> {g}</button>
                    ))}
                  </span>
                </div>
              ) : null}
              {he.lxx?.length ? (
                <div className="card__text" style={{ marginTop: '0.5rem' }}>
                  <b>In the Septuagint rendered by:</b>{' '}
                  <span className="chips">{he.lxx.slice(0, 12).map((l) => <button key={l} className="chip chip--btn" onClick={() => p.onOpenLexeme('gr', l)}><span className="gr">{l}</span></button>)}</span>
                  <span className="faint" style={{ fontSize: '0.8rem' }}> — from Abbott-Smith's Septuagint notes</span>
                </div>
              ) : null}
            </div>
          ) : null}
          {gr?.heb?.length ? (
            <div className="card__section">
              <span className="label">Hebrew behind it (Septuagint)</span>
              <div className="card__text">
                <span className="chips">{gr.heb.map(([n, w]) => <button key={n + w} className="chip chip--btn" onClick={() => p.onOpenLexeme('he', String(n))}><span className="he">{w}</span> H{n}</button>)}</span>
              </div>
            </div>
          ) : null}
          {info.lexId && (
            <div className="card__section">
              <span className="label">Concordance{conc ? ` · ${conc.length}` : ''}</span>
              {!conc && <div className="card__text faint">Loading…</div>}
              {conc && (
                <ul className="conc">
                  {concShown.map(([b, c, v, i], k) => {
                    const id = CANON[b]?.id ?? '';
                    const here = id === info.ref.book && c === info.ref.ch && v === info.ref.v;
                    return (
                      <li key={k}>
                        <span className="ref" style={here ? { fontWeight: 600 } : undefined} onClick={() => p.onGoTo({ book: id, ch: c, v, i })}>{refLabel(id, c, v)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {conc && conc.length > 25 && (
                <div className="card__actions" style={{ marginTop: '0.4rem' }}>
                  <button className="btn btn--small btn--quiet" onClick={() => setConcAll((a) => !a)}>{concAll ? 'Fewer' : `All ${conc.length}`}</button>
                </div>
              )}
            </div>
          )}
          {info.key && !p.standalone && (
            <div className="card__actions">
              <button className="btn btn--small" onClick={() => nav(`/word/${info.lang}/${encodeURIComponent(info.lexId!)}`)}>Open word page</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function heMorphLine(info: WordInfo, prefixForms: string[]): string {
  const m = info.he!.morph;
  const pre = prefixForms.map((f) => f + '־').join(' ');
  if (info.he!.prefixOnly) return pre ? `${pre} (prefix only)` : m.features;
  const body = m.pos === 'verb' ? m.features : [m.pos, m.features].filter(Boolean).join(' · ');
  const suf = m.suffix ? ` · + ${m.suffix.kind === 'pronominal suffix' ? (m.pos === 'verb' ? 'object' : 'possessive') + ' ' + (m.suffix.pgn ?? '') : m.suffix.kind}` : '';
  return (pre ? pre + ' + ' : '') + body + suf;
}

function grChips(info: WordInfo): { form: string; label: string }[] {
  const m = info.gr!.morph;
  const out: { form: string; label: string }[] = [{ form: info.printed, label: m.pos }];
  if (m.tense) out.push({ form: m.tense, label: 'tense' });
  if (m.voice) out.push({ form: m.voice, label: 'voice' });
  if (m.mood) out.push({ form: m.mood, label: 'mood' });
  if (m.person) out.push({ form: m.person, label: 'person' });
  if (m.case) out.push({ form: m.case, label: 'case' });
  if (m.number) out.push({ form: m.number, label: 'number' });
  if (m.gender) out.push({ form: m.gender, label: 'gender' });
  if (m.degree) out.push({ form: m.degree, label: 'degree' });
  return out;
}

function laChips(info: WordInfo): { form: string; label: string }[] {
  const m = info.la!.morph;
  const out: { form: string; label: string }[] = [{ form: info.printed, label: m.pos }];
  if (m.tense) out.push({ form: m.tense, label: 'tense' });
  if (m.voice) out.push({ form: m.voice, label: 'voice' });
  if (m.mood) out.push({ form: m.mood, label: 'mood' });
  if (m.person) out.push({ form: m.person, label: 'person' });
  if (m.case) out.push({ form: m.case, label: 'case' });
  if (m.number) out.push({ form: m.number, label: 'number' });
  if (m.gender) out.push({ form: m.gender, label: 'gender' });
  if (m.degree) out.push({ form: m.degree, label: 'degree' });
  return out;
}
