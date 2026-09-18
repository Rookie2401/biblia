/**
 * Renders a dictionary entry (BDB / Abbott-Smith) that the data build sanitized into a small
 * HTML subset. The app re-validates the markup before injecting it and falls back to plain
 * text otherwise. Scripture references navigate to the verse; Hebrew cross references open
 * the entry (Abbott-Smith's Strong's numbers directly, BDB's entry ids through a lookup table).
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { book as bookInfo } from '../text/canon.ts';
import { isSafeDictHtml, stripTags } from '../text/safeHtml.ts';

type BdbIndex = Record<string, [string, string, string][]>; // bdb id -> [lemma id, lemma, gloss]
let bdbIndex: Promise<BdbIndex> | null = null;
export function loadBdbIndex(): Promise<BdbIndex> {
  return (bdbIndex ??= fetch('./data/lex/he-bdb-index.json')
    .then((r) => (r.ok ? (r.json() as Promise<BdbIndex>) : {}))
    .catch(() => ({})));
}

export function DictEntry({ html, title, collapsible = true, onHebrew }: { html: string; title: string; collapsible?: boolean; onHebrew?: (lemmaId: string) => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(!collapsible);
  const [choice, setChoice] = useState<{ bdb: string; options: [string, string, string][] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const safe = isSafeDictHtml(html);
  const long = html.length > 1400;

  useEffect(() => {
    setChoice(null);
    setNotice(null);
  }, [html]);

  async function openBdb(id: string) {
    const index = await loadBdbIndex();
    const options = index[id] ?? [];
    if (options.length === 1) {
      onHebrew?.(options[0][0]);
      return;
    }
    if (options.length > 1) {
      setChoice({ bdb: id, options });
      setNotice(null);
      return;
    }
    setNotice(`This cross reference (BDB ${id}) has no entry of its own in the lexicon; it is a variant or a name listed under another headword.`);
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    const ref = a.dataset.ref;
    if (ref) {
      const m = ref.split('-')[0].match(/^(\w+)\.(\d+)(?:\.(\d+))?/);
      if (m && bookInfo(m[1])) nav(`/read/${m[1]}/${m[2]}${m[3] ? `?v=${m[3]}` : ''}`);
      else setNotice(`Reference ${ref} is outside the books in this app.`);
      return;
    }
    if (a.dataset.he) {
      onHebrew?.(a.dataset.he);
      return;
    }
    if (a.dataset.bdb) void openBdb(a.dataset.bdb);
  }

  return (
    <div>
      <span className="label">{title}</span>
      {safe ? (
        <div className={`dict${collapsible && long && !open ? ' dict--collapsed' : ''}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="dict">{stripTags(html)}</div>
      )}
      {collapsible && long && (
        <div className="card__actions" style={{ marginTop: '0.4rem' }}>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Show less' : 'Read the whole entry'}</button>
        </div>
      )}
      {choice && (
        <div className="card__text" role="group" aria-label="Choose an entry">
          <b>Which entry?</b>{' '}
          <span className="chips">
            {choice.options.map(([id, w, g]) => (
              <button type="button" key={id} className="chip chip--btn" onClick={() => onHebrew?.(id)}><span className="he">{w}</span> {g}</button>
            ))}
          </span>
        </div>
      )}
      {notice && <div className="card__text faint" role="status">{notice}</div>}
    </div>
  );
}
