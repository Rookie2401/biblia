import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * A short fingerprint of the shipped data (public/data): a corrected gloss, a realigned verse or
 * a rebuilt shard changes it, giving the runtime data cache below a fresh name so a returning
 * user's stale cache from a previous release is never served past that release (see
 * src/pwa/cleanupCaches.ts, which deletes the old bucket). Cheap: file sizes only for the whole
 * tree, plus the full bytes of the few small files most content fixes actually touch.
 */
function computeDataVersion(): string {
  const dataDir = path.join(root, 'public', 'data');
  const hash = crypto.createHash('sha256');
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else hash.update(`${path.relative(dataDir, p)}:${st.size}\n`);
    }
  };
  walk(dataDir);
  for (const f of ['lex/he-index.json', 'lex/gr-index.json', 'ctx/COVERAGE.json']) {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) hash.update(fs.readFileSync(p));
  }
  return hash.digest('hex').slice(0, 12);
}

// Exported (in addition to being used below) so test/pwa-config.test.ts can check the exact
// object handed to Workbox without reflecting on vite-plugin-pwa's internal plugin state.
export const dataVersion = computeDataVersion();
export const DATA_CACHE_MAX_ENTRIES = 1000; // ~400 shipped today; generous headroom for the corpus to grow
export const dataCacheName = `biblia-data-${dataVersion}`;
export const dataRuntimeCaching = [
  {
    urlPattern: ({ url }: { url: URL }) => /\/data\/.+\.json$/.test(url.pathname),
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: dataCacheName, expiration: { maxEntries: DATA_CACHE_MAX_ENTRIES }, cacheableResponse: { statuses: [0, 200] } },
  },
];

// Relative base + HashRouter: the built app runs from any static host, sub-path or file: URL.
// The app shell is precached; the text, morphology and lexicon files under data/ are cached as
// they are read (stale-while-revalidate under a data-version-scoped cache name, so once a book
// has been opened it is available offline, a background fetch keeps it current while online, and
// a release with corrected data is never served from an old release's cache indefinitely).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
  define: { __DATA_VERSION__: JSON.stringify(dataVersion) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data/**'],
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: dataRuntimeCaching,
      },
      manifest: {
        name: 'Biblia',
        short_name: 'Biblia',
        description: 'The Masoretic Text and the Greek New Testament, nearly every word explained.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f2e8',
        theme_color: '#6b4f2a',
        icons: [
          { src: './pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: './pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: './pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
