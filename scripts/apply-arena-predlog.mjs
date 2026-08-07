#!/usr/bin/env node
/* apply-arena-predlog.mjs — deterministic settlement CLI for the V19 Arena
 * prediction-delta signal layer (ROADMAP §7.7 Phase 1).
 *
 * The scheduled task (post-market-close backfill) is the "gather" half: it
 * determines the US/Eastern trading date whose session just closed, fetches
 * real open/close quotes via /api/quote for that day's tickers, writes an
 * input file, and runs this script — the "code computes" half. Publication
 * uses the shared recoverable validate/rename/build/commit boundary; the
 * calling task is responsible only for pushing the resulting commit.
 *
 * Usage: node scripts/apply-arena-predlog.mjs <predlog-input.json>
 *
 * predlog-input.json shape:
 * {
 *   "date": "2026-07-06",                                  // must match
 *                                                           // public/arena-news.json's "date"
 *   "actuals": { "NVDA": { "open": 119.1, "close": 121.4 }, ... }
 * }
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPredlogDay, appendPredlogDay } from '../src/lib/predlogEntry.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { runAtomicPublishTransaction } from './lib/publish-transaction.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const NEWS_PATH = join(REPO, 'public', 'arena-news.json');
const PREDLOG_PATH = join(REPO, 'public', 'arena-predlog.json');
const MAX_DAYS = 60;

function fail(msg) {
  console.error(`[apply-arena-predlog] ERROR: ${msg}`);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) fail('usage: node scripts/apply-arena-predlog.mjs <predlog-input.json>');

let input;
try {
  input = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`could not read/parse ${inputPath}: ${e.message}`);
}

const { date, actuals } = input;
if (!date || !actuals) fail('predlog-input.json must include "date" and "actuals"');

const news = JSON.parse(readFileSync(NEWS_PATH, 'utf8'));
if (news.date !== date) {
  fail(`public/arena-news.json is dated ${news.date}, not ${date} — predictions weren't made for ` +
    `this session, refusing to log a mismatched day (no-op, not an error to paper over)`);
}

const prevCloseMap = {};
for (const sym of Object.keys(news.prices || {})) prevCloseMap[sym] = news.prices[sym].prevClose;

const dayEntry = buildPredlogDay(date, news.aiPredictions || {}, prevCloseMap, actuals);

const existing = existsSync(PREDLOG_PATH) ? JSON.parse(readFileSync(PREDLOG_PATH, 'utf8')) : { updated: null, version: 1, days: [] };
const days = appendPredlogDay(existing.days || [], dayEntry, MAX_DAYS);
const out = {
  ...existing,
  updated: new Date().toISOString(),
  version: 1,
  days,
  checkedThrough: !existing.checkedThrough || date > existing.checkedThrough ? date : existing.checkedThrough,
};

try {
  runAtomicPublishTransaction({
    repoRoot: REPO,
    pipelineId: 'arena-predlog-settlement',
    commitMessage: `data: settle Arena prediction log ${date}`,
    prepare() {
      const validation = validateArenaPredlog(out);
      if (!validation.ok) throw new Error(`arena-predlog.json: ${validation.errors.join('; ')}`);
      return [{ path: PREDLOG_PATH, data: out }];
    },
  });
} catch (error) {
  fail(`${error.phase || 'publish'}: ${error.message}`);
}

const scored = Object.values(dayEntry.entries).filter((e) => e.dirHit !== null);
const hits = scored.filter((e) => e.dirHit === true).length;

console.log(JSON.stringify({ date, hits, total: scored.length, daysStored: days.length }, null, 2));
console.log(`[apply-arena-predlog] committed ${PREDLOG_PATH} — ${date}: ${hits}/${scored.length} directional hits, ` +
  `${days.length} days stored (cap ${MAX_DAYS})`);
