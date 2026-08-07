#!/usr/bin/env node
/* apply-arena-run.mjs — deterministic settlement CLI for Arena Autopilot.
 *
 * The scheduled task (Analyst S/P/T at their window, weekly review) is the
 * "LLM proposes" half: it gathers a market digest (quotes via /api/quote,
 * news via WebSearch) and reasons out a JSON order proposal following
 * prompts/arena-autopilot.md. It must NOT touch arena-ledger.json directly
 * — instead it writes its proposal to a JSON file and runs this script,
 * which is the "code settles" half: it calls the already-tested
 * src/lib/arenaRun.js -> src/lib/arenaRules.js pipeline to validate, fill,
 * mark-to-market, sweep stop-losses, and check circuit-breaker/season-reset,
 * then publishes ledger + runlog through the repository's recoverable
 * validate/rename/build/commit transaction. The calling task may push that
 * commit, but cannot bypass the build smoke or leave a half-written pair.
 *
 * Part 4 (urgent.md §19.3.1, 2026-07-23): now also idempotent. Every run
 * carries a `window` (one of src/lib/arenaReconcile.js's WINDOWS) and is
 * identified by (etDateStr, window, book) — the same run identity
 * arena-runlog.json enforces uniqueness on. If that identity already has a
 * `done` entry in arena-runlog.json, this script no-ops (exit 0, ledger
 * untouched) instead of double-settling — safe to retry a flaky scheduled
 * task or replay a flushed outbox entry (§19.3.3) without fear. On success
 * it appends/updates the runlog entry itself, so the calling task commits
 * BOTH public/arena-ledger.json and public/arena-runlog.json together.
 *
 * Usage: node scripts/apply-arena-run.mjs <run-input.json>
 *
 * run-input.json shape:
 * {
 *   "book": "S" | "P" | "T" | "A" | "B",
 *   "window": "open-window",               // one of arenaReconcile.WINDOWS
 *   "etDateStr": "2026-07-06",             // US/Eastern trading-day date
 *   "nowIso": "2026-07-06T14:35:00Z",      // optional, defaults to now
 *   "priceMap": { "NVDA": 118.2, ... },    // latest quotes, from /api/quote
 *   "proposedOrders": [ { "sym":"NVDA","side":"buy","qty":5,"refPx":118.2,"confidence":0.72 } ],
 *   "reviewZh": "...", "reviewEn": "...",  // optional natural-language reflection
 *   "benchPct": { "spyPct": 0.4, "smhPct": 0.9 },  // optional
 *   "newPromptVersionOnReset": "A-v2",     // optional, only used if season reset fires
 *   "note": "...",                          // optional, stored in the runlog entry
 *   "late": false                           // optional — true for a reconcile-driven
 *                                            // catch-up mark-to-market (§19.3.2)
 * }
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runArenaLedger } from '../src/lib/arenaRun.js';
import { WINDOWS, hasCompletedRun, upsertRunlogEntry } from '../src/lib/arenaReconcile.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { runAtomicPublishTransaction } from './lib/publish-transaction.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const LEDGER_PATH = join(REPO, 'public', 'arena-ledger.json');
const UNIVERSE_PATH = join(REPO, 'public', 'arena-universe.json');
const RUNLOG_PATH = join(REPO, 'public', 'arena-runlog.json');

function fail(msg) {
  console.error(`[apply-arena-run] ERROR: ${msg}`);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) fail('usage: node scripts/apply-arena-run.mjs <run-input.json>');

let input;
try {
  input = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`could not read/parse ${inputPath}: ${e.message}`);
}

const {
  book, window, etDateStr, priceMap, proposedOrders, reviewZh, reviewEn,
  benchPct, newPromptVersionOnReset, note, late,
} = input;
const nowIso = input.nowIso || new Date().toISOString();
if (!book || !etDateStr) fail('run-input.json must include "book" and "etDateStr"');
if (!window || !WINDOWS.includes(window)) fail(`run-input.json "window" must be one of ${WINDOWS.join('/')}, got ${JSON.stringify(window)}`);

const runlogFull = existsSync(RUNLOG_PATH) ? JSON.parse(readFileSync(RUNLOG_PATH, 'utf8')) : { runs: [] };
if (hasCompletedRun(runlogFull, etDateStr, window, book)) {
  console.log(`[apply-arena-run] no-op: (${etDateStr}, ${window}, ${book}) already has a "done" runlog entry — refusing to double-settle. Ledger untouched.`);
  process.exit(0);
}

const ledgerFull = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
const universeFull = JSON.parse(readFileSync(UNIVERSE_PATH, 'utf8'));
const universe = universeFull.symbols.map((s) => s.sym);

let result;
try {
  result = runArenaLedger(ledgerFull, book, {
    etDateStr, nowIso, priceMap: priceMap || {}, proposedOrders: proposedOrders || [],
    universe, reviewZh, reviewEn, benchPct, newPromptVersionOnReset,
  });
} catch (e) {
  fail(`runArenaLedger threw: ${e.message}`);
}

const runlogEntry = {
  date: etDateStr, window, model: book, status: 'done',
  ordersProposed: (proposedOrders || []).length,
  ordersFilled: result.summary.filled.length,
  note: note || `settled via apply-arena-run.mjs — ${result.summary.filled.length} filled, ${result.summary.rejected.length} rejected.`,
  ...(late ? { late: true } : {}),
};
const nextRunlog = upsertRunlogEntry(runlogFull, runlogEntry);
try {
  runAtomicPublishTransaction({
    repoRoot: REPO,
    pipelineId: 'arena-settlement',
    commitMessage: `data: settle Arena ${book} ${window} ${etDateStr}`,
    prepare() {
      const ledgerValidation = validateArenaLedger(result.ledger);
      if (!ledgerValidation.ok) throw new Error(`arena-ledger.json: ${ledgerValidation.errors.join('; ')}`);
      const runlogValidation = validateArenaRunlog(nextRunlog);
      if (!runlogValidation.ok) throw new Error(`arena-runlog.json: ${runlogValidation.errors.join('; ')}`);
      return [
        { path: LEDGER_PATH, data: result.ledger },
        { path: RUNLOG_PATH, data: nextRunlog },
      ];
    },
  });
} catch (error) {
  fail(`${error.phase || 'publish'}: ${error.message}`);
}

console.log(JSON.stringify(result.summary, null, 2));
console.log(`[apply-arena-run] committed ${LEDGER_PATH} and ${RUNLOG_PATH} — day ${result.summary.day}, ` +
  `${result.summary.filled.length} filled, ${result.summary.rejected.length} rejected, ` +
  `riskLockdown=${result.summary.riskLockdown}, seasonReset=${result.summary.seasonReset}`);
