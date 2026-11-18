import { setSettings, type VerseNumberMode } from '../state/settings.ts';

const OPTIONS: { value: VerseNumberMode; label: string }[] = [
  { value: 'native', label: 'Hebrew / Greek' },
  { value: 'decimal', label: '1, 2, 3' },
  { value: 'hidden', label: 'None' },
];

export function VerseNumberOptions({ value, className }: { value: VerseNumberMode; className?: string }) {
  return (
    <fieldset className={className}>
      <legend>Verse numbers</legend>
      <div className="segmented">
        {OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={value === option.value}
            onClick={() => setSettings({ verseNumberMode: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
