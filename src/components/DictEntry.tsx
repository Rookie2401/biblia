/**
 * Renders a dictionary entry (BDB / Abbott-Smith) built at data-build time from the public
 * domain XML into a small HTML subset. Scripture references inside the entry navigate to the
 * verse; cross references to other entries open them.
 */
import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { book as bookInfo } from '../text/canon.ts';

export function DictEntry({ html, title, collapsible = true, onHebrew }: { html: string; title: string; collapsible?: boolean; onHebrew?: (strong: string) => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(!collapsible);
  const long = html.length > 1400;

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    const ref = a.dataset.ref;
    if (ref) {
      const m = ref.split('-')[0].match(/^(\w+)\.(\d+)(?:\.(\d+))?/);
      if (m && bookInfo(m[1])) nav(`/read/${m[1]}/${m[2]}${m[3] ? `?v=${m[3]}` : ''}`);
      return;
    }
    if (a.dataset.he && onHebrew) onHebrew(a.dataset.he);
    if (a.dataset.bdb) nav(`/search?q=${encodeURIComponent('bdb:' + a.dataset.bdb)}`);
  }

  return (
    <div>
      <span className="label">{title}</span>
      <div className={`dict${collapsible && long && !open ? ' dict--collapsed' : ''}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {collapsible && long && (
        <div className="card__actions" style={{ marginTop: '0.4rem' }}>
          <button className="btn btn--small btn--quiet" onClick={() => setOpen((o) => !o)}>{open ? 'Show less' : 'Read the whole entry'}</button>
        </div>
      )}
    </div>
  );
}
