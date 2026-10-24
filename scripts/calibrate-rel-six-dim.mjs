#!/usr/bin/env node
/* Calibration sample for rel-six-dim (src/lib/relationships/scale.js).
   Synthetic births only: dates uniform over 1900-01-01..2100-12-31, clock
   time uniform to the minute, China civil time (no zone given), seeded
   mulberry32. Pairs whose model is not 'ready' (e.g. a lunar date before
   1900-01-31, a solar-term or other in-window conflict) are excluded and
   counted. Prints the CALIBRATION object to paste into scale.js.

   node scripts/calibrate-rel-six-dim.mjs [pairs=100000] [seed=20261024] */
import { computeRelationshipReport } from '../src/lib/relationships/kernel.js';
import { DEFAULT_CONFIG, DIMENSION_IDS, SCHEMA_VERSION } from '../src/lib/relationships/contract.js';
import { THEORETICAL_RANGE, DIMENSION_FAMILIES, SCORE_MODEL } from '../src/lib/relationships/scale.js';

const PAIRS = Number(process.argv[2] || 100000);
const SEED = Number(process.argv[3] || 20261024);
const FROM = Date.UTC(1900, 0, 1), TO = Date.UTC(2100, 11, 31);
const DAYS = (TO - FROM) / 86400000 + 1;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const pad = (n) => String(n).padStart(2, '0');
function birth() {
  const d = new Date(FROM + Math.floor(rnd() * DAYS) * 86400000);
  const minute = Math.floor(rnd() * 1440);
  return { localDate: d.toISOString().slice(0, 10), calendar: 'gregorian', time: { kind: 'exact', localTime: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`, precision: 'minute' } };
}

const raws = Object.fromEntries(DIMENSION_IDS.map((d) => [d, []]));
const excluded = {};
for (let i = 0; i < PAIRS; i++) {
  const r = computeRelationshipReport({ schemaVersion: SCHEMA_VERSION, requestId: `calib-${String(i).padStart(8, '0')}`, A: birth(), B: birth(), config: DEFAULT_CONFIG, scoreModelId: SCORE_MODEL.modelId });
  if (r.overall.status === 'insufficient') { for (const k of r.overall.reasonKeys) excluded[k] = (excluded[k] || 0) + 1; continue; }
  for (const d of DIMENSION_IDS) raws[d].push(r.dimensions[d].support - r.dimensions[d].friction);
}

const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const round4 = (x) => Math.round(x * 1e4) / 1e4;
const dimensions = {};
for (const d of DIMENSION_IDS) {
  const a = raws[d].sort((x, y) => x - y);
  const median = round4(q(a, 0.5));
  const { lo, hi } = THEORETICAL_RANGE[d];
  const map = (v) => Math.round(v <= median ? 50 * (v - lo) / (median - lo) : 50 + 50 * (v - median) / (hi - median));
  const p5 = map(q(a, 0.05)), p95 = map(q(a, 0.95));
  const fams = DIMENSION_FAMILIES[d];
  const flags = [];
  // One-sided: no rule can push the net below (or above) "nothing matched".
  const oneSided = lo >= 0 || hi <= 0 || !fams.some((f) => f.support) || !fams.some((f) => f.friction);
  if (fams.length < 2 || oneSided || p95 - p5 < 20) flags.push('rule_coverage_low');
  dimensions[d] = {
    median, flags,
    sample: { rawMin: round4(a[0]), rawP5: round4(q(a, 0.05)), rawP95: round4(q(a, 0.95)), rawMax: round4(a.at(-1)), scoreP5: p5, scoreP25: map(q(a, 0.25)), scoreP75: map(q(a, 0.75)), scoreP95: p95 },
  };
}
const used = raws[DIMENSION_IDS[0]].length;
console.log(JSON.stringify({
  sample: { generator: 'scripts/calibrate-rel-six-dim.mjs', prng: 'mulberry32', seed: SEED, pairs: PAIRS, used, excluded, dates: '1900-01-01..2100-12-31 uniform', time: 'uniform minute, China civil time' },
  dimensions,
}, null, 2));
