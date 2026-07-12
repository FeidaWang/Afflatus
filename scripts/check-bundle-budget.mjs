#!/usr/bin/env node
/* check-bundle-budget.mjs — fails CI if any built JS chunk exceeds budget
 * (U21 Phase 1 D3, rfcs/2026-07-12-u21-phase1-tech-audit.md §1.2/§1.4).
 * The home page's main chunk sat at 864.72 kB for months with nothing to
 * notice; this is the noticing mechanism. Run after `vite build` (dist/
 * must exist). Budgets are deliberately tight headroom above what was
 * actually measured on 2026-07-12, not room to grow into — tighten them
 * as Phase 2 chunk-splitting work lands. */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] || 'dist';
const ASSETS = join(DIST, 'assets');

// Per-chunk-prefix budgets in bytes, re-measured 2026-07-12 after U21
// Phase 1 T6 split 'three' and 'astronomy-engine' into their own
// manualChunks (vite.config.js) — main.js dropped from 864.72 kB to
// ~190 kB the moment three.js moved into vendor-three. Everything not
// listed defaults to 300 kB, generous headroom above the next-largest
// unlisted chunk (horoscope's app code, ~186 kB) so a genuinely new page
// doesn't need a budget bump just to exist.
const BUDGETS = {
  main: 250 * 1024,
  'vendor-three': 700 * 1024, // three.js core, ~674 kB minified — the single heaviest dependency on the site
  'vendor-astronomy': 60 * 1024, // astronomy-engine, ~46 kB
};
const DEFAULT_BUDGET = 300 * 1024;

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
} catch (e) {
  console.error(`FAIL: could not read ${ASSETS} — did you run "vite build" first? (${e.message})`);
  process.exit(1);
}

// Match by configured-name PREFIX rather than trying to strip Vite's
// content hash first — the hash alphabet can itself contain "-", so a
// chunk like "vendor-three-CBWxXVfs.js" can't be reliably split into
// name vs. hash by a character-class regex (learned the hard way: it
// stripped down to just "vendor"). Longest key first so "vendor-three"
// wins over a hypothetical shorter "vendor" entry.
const sortedKeys = Object.keys(BUDGETS).sort((a, b) => b.length - a.length);
function budgetFor(filename) {
  for (const key of sortedKeys) {
    if (filename === `${key}.js` || filename.startsWith(`${key}-`)) return BUDGETS[key];
  }
  return DEFAULT_BUDGET;
}

let anyFail = false;
for (const f of files) {
  const budget = budgetFor(f);
  const size = statSync(join(ASSETS, f)).size;
  const pct = ((size / budget) * 100).toFixed(0);
  if (size > budget) {
    console.error(`FAIL: ${f} is ${(size / 1024).toFixed(1)} kB, over budget ${(budget / 1024).toFixed(0)} kB (${pct}%)`);
    anyFail = true;
  } else {
    console.log(`OK: ${f} — ${(size / 1024).toFixed(1)} kB / ${(budget / 1024).toFixed(0)} kB (${pct}%)`);
  }
}

process.exit(anyFail ? 1 : 0);
