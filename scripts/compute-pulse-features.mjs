#!/usr/bin/env node
/* compute-pulse-features.mjs — Model P (PULSE) feature-vector CLI
 * (urgent.md Part 4 §17.3/§19.1 open-window & late-window tasks).
 *
 * The scheduled task (Analyst P) gathers real data (quote via /api/quote,
 * daily candles via /api/history, and whatever intraday candles it can
 * get) and writes it to an input file — it must NOT compute gap%/VWAP/
 * volume-surge/pivot-break itself, since an LLM computing that math is
 * exactly the kind of number a scheduled task can hallucinate. This
 * script calls the already-tested src/lib/arenaFeatures.js pure functions
 * and prints the real feature vector for the LLM to reason over.
 *
 * Usage: node scripts/compute-pulse-features.mjs <input.json>
 *
 * input.json shape:
 * {
 *   "NVDA": {
 *     "quote": { "c": 118.2, "pc": 116.9, "o": 117.5, "h": 119.0, "l": 117.1 },
 *     "dailyCandles": [ { "t":"2026-07-01","o":..,"h":..,"l":..,"c":..,"v":.. }, ... ],  // ascending, oldest first, excludes today
 *     "intradayCandles": [ { "datetime":"...", "open":.., "high":.., "low":.., "close":.., "volume":.. }, ... ]  // optional
 *   },
 *   "...": { ... }
 * }
 */
import { readFileSync } from 'node:fs';
import { buildPulseFeatures } from '../src/lib/arenaFeatures.js';

function fail(msg) {
  console.error(`[compute-pulse-features] ERROR: ${msg}`);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) fail('usage: node scripts/compute-pulse-features.mjs <input.json>');

let input;
try {
  input = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`could not read/parse ${inputPath}: ${e.message}`);
}

const out = {};
for (const sym of Object.keys(input)) {
  const { quote, dailyCandles, intradayCandles } = input[sym] || {};
  out[sym] = buildPulseFeatures({ quote, dailyCandles, intradayCandles, price: quote ? quote.c : undefined });
}

console.log(JSON.stringify(out, null, 2));
