import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useModalDialog, useStableId } from './dialog.ts';

export const I = {
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="17" r="2" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h9" /></svg>,
  type: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19l5-14 5 14M6.5 14h5M15 12l3-6 3 6M16 10h4" /></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h6a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z" /></svg>,
  sentence: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8h16M4 12h10M4 16h13" /><path d="M18 14l2 2-2 2" /></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10l4 4 4-4" /></svg>,
  history: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>,
  vocab: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" /><path d="M5 4v16a3 3 0 0 1 3-3h11" /><path d="M9 9h6" /></svg>,
};

export function Topbar({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      {left}
      <div className="topbar__title">{title}</div>
      <div className="topbar__spacer" />
      {right}
    </header>
  );
}

export function BackLink({ to = '/', label = 'Back' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="iconbtn" aria-label={label} title={label}>
      {I.back}
    </Link>
  );
}

export function IconBtn({ onClick, label, active, children, to }: { onClick?: () => void; label: string; active?: boolean; children: ReactNode; to?: string }) {
  const cls = `iconbtn${active ? ' iconbtn--active' : ''}`;
  if (to) return <Link to={to} className={cls} aria-label={label} title={label}>{children}</Link>;
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label} title={label} aria-pressed={active}>
      {children}
    </button>
  );
}

/** A modal sheet: focus moves in, Tab stays inside, Escape and the backdrop close it, focus returns. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useStableId('sheet-title');
  useModalDialog(ref, { active: true, onClose, inertSelector: '.shell > *:not(.sheet-backdrop)' });
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title" id={titleId}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
