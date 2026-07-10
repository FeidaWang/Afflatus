#!/usr/bin/env node
/* ============================================================
   gen-mingzao-dist.mjs (U5, Urgent.md) — precompute the distribution of
   the mingzaoRank CORE score (中和/格局/用神 only — the 岁运 axis depends
   on gender + the current calendar year, so it stays out of the
   percentile base) over the same uniform synthetic sample the shensha
   rarity table uses: 1950–2009, every 2nd day, all 13 shichen values.

   Output: src/lib/mingzaoDist.js (generated, committed — the page is
   zero-fetch by design). Rerun: node scripts/gen-mingzao-dist.mjs
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeBazi } from '../src/lib/bazi.js';
import { mingzaoRank } from '../src/lib/mingzao.js';

const HOURS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const hist = new Array(101).fill(0);
let total = 0;
for (let y = 1950; y <= 2009; y++) {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= DAYS_IN_MONTH[m - 1]; d += 2) {
      for (const hour of HOURS) {
        const chart = computeBazi({ y, m, d, hour });
        const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
        const r = mingzaoRank(pillars);
        hist[r.core]++;
        total++;
      }
    }
  }
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'mingzaoDist.js');
writeFileSync(outPath, `/* ============================================================
   GENERATED FILE — do not edit by hand.
   Produced by scripts/gen-mingzao-dist.mjs (U5).
   MINGZAO_DIST[i] = number of charts in a uniform synthetic birth sample
   (1950–2009, every-2nd-day, all 13 shichen values; ${total} charts)
   whose mingzaoRank CORE score is exactly i. Percentiles computed from
   this are estimates over a synthetic uniform sample, not real-population
   statistics — the page labels them as such.
   ============================================================ */
export const MINGZAO_DIST = ${JSON.stringify(hist)};
export const MINGZAO_DIST_TOTAL = ${total};
`);
console.log(`wrote ${outPath} — ${total} charts, core range [${hist.findIndex((c) => c > 0)}, ${100 - [...hist].reverse().findIndex((c) => c > 0)}]`);
