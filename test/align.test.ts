import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM build script
import { fillGaps } from '../scripts/align-fallback.mjs';

describe('alignment spelling fallback', () => {
  it('fills a single gap between matched neighbours when the skeletons are close', () => {
    const mc = ['ויקח', 'מכל', 'הבהמה', 'הטהרה', 'ומכל'];
    const oc = ['ויקח', 'מכל', 'הבהמה', 'הטהורה', 'ומכל'];
    const map = [0, 1, 2, -1, 4];
    expect(fillGaps(map, mc, oc)).toBe(1);
    expect(map).toEqual([0, 1, 2, 3, 4]);
  });
  it('never guesses across a different word or a wider gap', () => {
    const map = [0, -1, 2];
    expect(fillGaps(map, ['א', 'שלום', 'ג'], ['א', 'מלך', 'ג'])).toBe(0);
    expect(map[1]).toBe(-1);
    const wide = [0, -1, 3];
    expect(fillGaps(wide, ['א', 'ב', 'ג'], ['א', 'ב', 'x', 'ג'])).toBe(0);
  });
});
