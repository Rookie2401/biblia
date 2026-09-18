import type { HeSegment } from '../morph/hebrew.ts';

function cls(k: HeSegment['kind']): string {
  if (k === 'stem') return 'morph morph--root';
  if (k === 'conjunction' || k === 'preposition' || k === 'article' || k === 'relative' || k === 'interrogative') return 'morph morph--pre';
  return 'morph morph--affix';
}

/** Visual decomposition of a printed Hebrew word into OSHB's morphemes, read right to left. */
export function Morphemes({ segments }: { segments: HeSegment[] }) {
  if (!segments.length) return null;
  return (
    <div className="morphs" aria-label="Morpheme breakdown">
      {segments.map((s, i) => (
        <div className={cls(s.kind)} key={i} title={s.note ?? s.gloss ?? ''}>
          <span className="morph__form">{s.form || '∅'}</span>
          {s.label ? <span className="morph__kind">{s.label}</span> : null}
          {s.gloss ? <span className="morph__gloss">{s.gloss}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Greek: the parsing shown as chips (tense · voice · mood · person/number or case · number · gender). */
export function ParseChips({ items }: { items: { form: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="morphs morphs--ltr" aria-label="Parsing">
      {items.map((s, i) => (
        <div className="morph morph--affix" key={i}>
          <span className="morph__form gr" style={{ fontSize: '1rem' }}>{s.form}</span>
          <span className="morph__kind">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
