// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'biblia:settings';

describe('verse number preference migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function loadSettings() {
    return import('../src/state/settings.ts');
  }

  it('migrates a legacy false value to hidden', async () => {
    localStorage.setItem(KEY, JSON.stringify({ showVerseNumbers: false, fontSize: 31 }));

    const { getSettings } = await loadSettings();

    expect(getSettings().verseNumberMode).toBe('hidden');
    expect(getSettings().fontSize).toBe(31);
    expect(localStorage.getItem(KEY)).toContain('showVerseNumbers');
  });

  it('migrates a legacy true value to native', async () => {
    localStorage.setItem(KEY, JSON.stringify({ showVerseNumbers: true }));

    const { getSettings } = await loadSettings();

    expect(getSettings().verseNumberMode).toBe('native');
  });

  it('prefers a valid saved mode over the legacy boolean', async () => {
    localStorage.setItem(KEY, JSON.stringify({ showVerseNumbers: false, verseNumberMode: 'decimal' }));

    const { getSettings, setSettings } = await loadSettings();
    expect(getSettings().verseNumberMode).toBe('decimal');

    setSettings({ fontSize: 30 });
    expect(JSON.parse(localStorage.getItem(KEY)!).verseNumberMode).toBe('decimal');
    expect(JSON.parse(localStorage.getItem(KEY)!).showVerseNumbers).toBeUndefined();
  });
});
