#!/usr/bin/env node
/* ============================================================
   gen-shensha-rarity.mjs (V21 Phase 1) — precompute how often each 神煞
   appears in a chart, by enumerating a uniform sample of births:
   years 1950–2009, every 2nd day of each month (1,3,...,27), all 13
   shichen hour values (both zi variants included). ~1.4M pillar sets is
   overkill for two-decimal frequencies, so the day sampling keeps it fast
   while staying uniform across seasons (shensha rules key off branches,
   which cycle fast — sampling parity doesn't bias any branch).

   Output: src/lib/shenshaRarity.js (a generated, committed module — the
   horoscope page is zero-fetch by design, so this ships in the bundle
   rather than as a JSON the page would have to fetch).

   Rerun: node scripts/gen-shensha-rarity.mjs
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeBazi } from '../src/lib/bazi.js';
import { computeShensha, SHENSHA_EN } from '../src/lib/ziping.js';

const HOURS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const counts = Object.create(null);
for (const name of Object.keys(SHENSHA_EN)) counts[name] = 0;
let total = 0;

for (let y = 1950; y <= 2009; y++) {
  for (let m = 1; m <= 12; m++) {
    const dim = DAYS_IN_MONTH[m - 1] + (m === 2 && y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 1 : 0);
    for (let d = 1; d <= dim; d += 2) {
      for (const hour of HOURS) {
        const c = computeBazi({ y, m, d, hour });
        const tags = computeShensha([c.year, c.month, c.day, c.hour]);
        const present = new Set();
        for (const list of tags) for (const name of list) present.add(name);
        for (const name of present) counts[name]++;
        total++;
      }
    }
  }
}

const freq = {};
for (const [name, n] of Object.entries(counts)) freq[name] = +(n / total).toFixed(4);

const sorted = Object.entries(freq).sort((a, b) => a[1] - b[1]);
console.log(`sample size: ${total} charts`);
for (const [name, f] of sorted) console.log(`${name}\t${(f * 100).toFixed(2)}%`);

const header = `/* ============================================================
   GENERATED FILE — do not edit by hand.
   Produced by scripts/gen-shensha-rarity.mjs (V21 Phase 1).
   SHENSHA_RARITY[name] = fraction of charts in a uniform birth sample
   (1950–2009, every-2nd-day, all 13 shichen values; ${total} charts)
   that contain that shensha at least once. This is an ESTIMATE over a
   synthetic uniform sample, not real-population statistics — the page
   labels it as such.
   ============================================================ */
export const SHENSHA_RARITY = `;

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'shenshaRarity.js');
writeFileSync(outPath, header + JSON.stringify(freq, null, 2) + ';\n');
console.log(`\nwrote ${outPath}`);
