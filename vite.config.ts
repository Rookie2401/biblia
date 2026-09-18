import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base + HashRouter: the built app runs from any static host, sub-path or file: URL.
// The app shell is precached; the text, morphology and lexicon files under data/ are cached as
// they are read (cache-first, so once a book has been opened it is available offline). Settings
// offers "Download everything" to fetch the whole corpus at once.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
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
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/data\/.+\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'biblia-data', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      manifest: {
        name: 'Biblia',
        short_name: 'Biblia',
        description: 'The Masoretic Text and the Greek New Testament, every word explained.',
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
