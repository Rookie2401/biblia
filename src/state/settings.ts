/**
 * App settings — localStorage, tiny pub/sub, React hook (same shape as Sefer's).
 */
import { useSyncExternalStore } from 'react';
import type { HebrewDisplay } from '../text/hebrew.ts';

export type Theme = 'auto' | 'light' | 'dark';
export type HebrewFont = 'frank' | 'david' | 'system';

export interface Settings {
  theme: Theme;
  fontSize: number; // px, Hebrew
  greekFontSize: number; // px
  lineHeight: number;
  hebrewFont: HebrewFont;
  hebrewDisplay: HebrewDisplay;
  showVerseNumbers: boolean;
  showStatusMarks: boolean;
  /** Looking a word up moves it from new/automatic to "recognized" (LingQ-style). */
  lookupMarksRecognized: boolean;
  /** A new word read past this many times without a lookup becomes "automatic" (0 = off). */
  autoKnownAfter: number;
  /** Show the verse's interlinear glosses beneath the tapped word's verse. */
  showGlossLine: boolean;
  lastBook?: string;
}

const KEY = 'biblia:settings';

export const DEFAULTS: Settings = {
  theme: 'auto',
  fontSize: 26,
  greekFontSize: 22,
  lineHeight: 1.9,
  hebrewFont: 'frank',
  hebrewDisplay: 'full',
  showVerseNumbers: true,
  showStatusMarks: true,
  lookupMarksRecognized: true,
  autoKnownAfter: 4,
  showGlossLine: false,
};

let current: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  applyTheme(current.theme);
  listeners.forEach((l) => l());
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

applyTheme(current.theme);
