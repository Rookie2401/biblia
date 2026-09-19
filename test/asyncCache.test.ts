// The exact defect content audit 3 found: a rejected fetch cached forever, dead until a full page
// reload. memoAsync/memoAsyncKeyed must self-heal (clear on rejection) while still deduplicating
// concurrent in-flight callers.
import { describe, expect, it, vi } from 'vitest';
import { memoAsync, memoAsyncKeyed } from '../src/data/asyncCache.ts';

describe('memoAsync', () => {
  it('a failed attempt can be retried and the next attempt succeeds', async () => {
    const box: { current: Promise<string> | null } = { current: null };
    const factory = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce('ok');

    await expect(memoAsync(box, factory)).rejects.toThrow('network down');
    await expect(memoAsync(box, factory)).resolves.toBe('ok');
    expect(factory).toHaveBeenCalledTimes(2);
  });
  it('does not poison later calls: a second failure after a success does not resurrect the first', async () => {
    const box: { current: Promise<string> | null } = { current: null };
    const factory = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValueOnce('ok');
    await expect(memoAsync(box, factory)).rejects.toThrow('a');
    await expect(memoAsync(box, factory)).rejects.toThrow('b');
    await expect(memoAsync(box, factory)).resolves.toBe('ok');
    expect(factory).toHaveBeenCalledTimes(3);
  });
  it('concurrent callers before settlement share one in-flight factory call', async () => {
    let resolve!: (v: string) => void;
    const pending = new Promise<string>((r) => (resolve = r));
    const factory = vi.fn(() => pending);
    const box: { current: Promise<string> | null } = { current: null };
    const a = memoAsync(box, factory);
    const b = memoAsync(box, factory);
    expect(factory).toHaveBeenCalledTimes(1);
    resolve('shared');
    await expect(a).resolves.toBe('shared');
    await expect(b).resolves.toBe('shared');
  });
  it('a successful result stays memoized (the factory is not called again)', async () => {
    const factory = vi.fn<() => Promise<string>>().mockResolvedValue('once');
    const box: { current: Promise<string> | null } = { current: null };
    await memoAsync(box, factory);
    await memoAsync(box, factory);
    await memoAsync(box, factory);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('memoAsyncKeyed', () => {
  it('retries independently per key after a rejection, without disturbing other keys', async () => {
    const store: Partial<Record<'he' | 'gr', Promise<string>>> = {};
    const heFactory = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('he down')).mockResolvedValueOnce('he-ok');
    const grFactory = vi.fn<() => Promise<string>>().mockResolvedValue('gr-ok');

    await expect(memoAsyncKeyed(store, 'he', heFactory)).rejects.toThrow('he down');
    await expect(memoAsyncKeyed(store, 'gr', grFactory)).resolves.toBe('gr-ok');
    await expect(memoAsyncKeyed(store, 'he', heFactory)).resolves.toBe('he-ok');
    expect(heFactory).toHaveBeenCalledTimes(2);
    expect(grFactory).toHaveBeenCalledTimes(1);
  });
});
