import { defineConfig } from 'vite';
import { resolve } from 'path';

// MPA multi-entry: index.html (home Three.js app) + the five sub-pages,
// which used to live untouched in public/ (no bundling/hashing/minification).
// Moving their *.html files to project root turns them into real Vite entries;
// their co-located classic <script src="/x.js"> files stay in public/ as
// static passthrough (unbundled) for now — see ROADMAP §6 for the follow-up
// (converting those to ES modules for full bundling).
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        arena: resolve(__dirname, 'arena.html'),
        sectors: resolve(__dirname, 'sectors.html'),
        signal: resolve(__dirname, 'signal.html'),
        games: resolve(__dirname, 'games.html'),
        league: resolve(__dirname, 'league.html'),
        horoscope: resolve(__dirname, 'horoscope.html'),
        serial: resolve(__dirname, 'serial.html'),
        course: resolve(__dirname, 'course.html'),
        stats: resolve(__dirname, 'stats.html')
      },
      output: {
        // U21 Phase 1 D3 (rfcs/2026-07-12-u21-tech-audit.md §1.2/§1.4): the
        // safe half of chunk-splitting — vendor libraries get their own
        // named, content-hashed chunks instead of being baked into each
        // page's app chunk. This does NOT reduce first-load bytes for a
        // page that already needs the library eagerly (that requires an
        // actual lazy-load of the home page's three.js boot sequence,
        // which needs a real Lighthouse baseline + visual QA before it's
        // safe to attempt — flagged, not done, in Urgent.md U21). What
        // this DOES buy for free: 'three' and 'astronomy-engine' change
        // far less often than app code, so long-term browser caching
        // works across deploys instead of re-downloading the vendor code
        // every time main.js/horoscope.js changes; and astronomy-engine's
        // chunk becomes shared/cacheable across every page that imports
        // it (currently duplicated per-page-bundle).
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/astronomy-engine')) return 'vendor-astronomy';
        }
      }
    }
  }
});
