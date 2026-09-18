import { VOCAB_STATUSES, type VocabStatus } from '../model/types.ts';

const NAMES: Record<VocabStatus, string> = { new: 'new', recognized: 'recognized', familiar: 'familiar', known: 'known', automatic: 'automatic' };

export function StatusPicker({ value, onChange, label = 'Word' }: { value: VocabStatus; onChange: (s: VocabStatus) => void; label?: string }) {
  const idx = VOCAB_STATUSES.indexOf(value);
  return (
    <div className="status" role="radiogroup" aria-label={`${label} status`}>
      {VOCAB_STATUSES.map((s, i) => (
        <button key={s} className="status__dot" aria-pressed={i <= idx} title={NAMES[s]} onClick={() => onChange(s)} role="radio" aria-checked={s === value} aria-label={NAMES[s]}>
          •
        </button>
      ))}
      <span className="status__name">{NAMES[value]}</span>
    </div>
  );
}

export const STATUS_NAMES = NAMES;
