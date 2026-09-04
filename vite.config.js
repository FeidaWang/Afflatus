import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'path';
import { BUILD_ROUTES } from './src/config/siteManifest.js';

const buildInputs = Object.fromEntries(
  BUILD_ROUTES.map((route) => [route.id, resolve(import.meta.dirname, route.file)]),
);
const responsiveCss = readFileSync(
  resolve(import.meta.dirname, 'public/styles/responsive-primitives.css'),
  'utf8',
);
const responsiveLinkPattern = /<link\s+rel=["']stylesheet["']\s+href=["']\/styles\/responsive-primitives\.css["']\s*>/i;
const dataBridgeScript = readFileSync(
  resolve(import.meta.dirname, 'public/lib/data-bridge.js'),
  'utf8',
);
const dataBridgePattern = /<script\s+src=["']\/lib\/data-bridge\.js["']\s*><\/script>/i;

// MPA multi-entry: index.html (home Three.js app) + the five sub-pages,
// which used to live untouched in public/ (no bundling/hashing/minification).
// Moving their *.html files to project root turns them into real Vite entries;
// their co-located classic <script src="/x.js"> files stay in public/ as
// static passthrough (unbundled) for now — see ROADMAP §6 for the follow-up
// (converting those to ES modules for full bundling).
export default defineConfig({
  plugins: [
    {
      name: 'inline-critical-primitives',
      transformIndexHtml(html) {
        return html
          .replace(
            responsiveLinkPattern,
            `<style data-responsive-primitives>\n${responsiveCss}</style>`,
          )
          .replace(
            dataBridgePattern,
            `<script data-data-bridge>\n${dataBridgeScript}</script>`,
          );
      },
    },
  ],
  test: {
    // Keep Playwright's browser specs out of Vitest's default *.spec.js
    // discovery. All existing pure/unit suites live under tests/.
    include: ['tests/**/*.test.{js,ts}'],
  },
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
      // Route inclusion is declared once in siteManifest.js. Retired archive
      // experiences are preserved in source/history but ship only as redirects.
      input: buildInputs,
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
          // City adds Sky + Meshopt while other routes use Three.js loaders,
          // controls and geometry helpers. Keep those official addons out of
          // the stable core chunk so each group has its own cache boundary.
          if (id.includes('node_modules/three/examples/jsm/')) return 'vendor-three-addons';
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/astronomy-engine')) return 'vendor-astronomy';
        }
      }
    }
  }
});
