// @vitest-environment jsdom
// content audit 7: Home.tsx loaded reading positions and finished chapters through IndexedDB
// promise chains with no `.catch`. A storage failure (quota, permission, private mode, corruption)
// produced an unhandled rejection instead of just leaving resume/progress information empty.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.doMock('../src/db/db.ts', () => ({
    db: {
      positions: { orderBy: () => ({ reverse: () => ({ toArray: () => Promise.reject(new Error('offline')) }) }) },
      progress: { filter: () => ({ toArray: () => Promise.reject(new Error('offline')) }) },
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Home does not produce an unhandled rejection when its IndexedDB reads fail', () => {
  it('renders normally, with no "Continue reading" link, when positions and progress both reject', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { default: Home } = await import('../src/screens/Home.tsx');
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );
      await screen.findByText('Biblia Sacra');
      await new Promise((r) => setTimeout(r, 0)); // let both rejections settle

      expect(unhandled).toEqual([]);
      expect(screen.queryByText('Continue reading')).toBeNull();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
