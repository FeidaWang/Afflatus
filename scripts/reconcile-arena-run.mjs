#!/usr/bin/env node
/* reconcile-arena-run.mjs — offline catch-up scan for Arena Autopilot
 * (urgent.md Part 4 §19.3.2). Meant to be the FIRST thing a scheduled task
 * runs, before its own window's work: it walks every US/Eastern trading day
 * since the last runlog entry through "today" and:
 *
 *   1. Records a `missed` runlog entry for any (date, window, model) that
 *      never completed. This is bookkeeping only — a missed proposal
 *      window is gone for good, never retro-traded (§19.3.2's hard rule).
 *   2. Prints a `lateMarkNeeded` list of {model, dates} pairs — models that
 *      have zero completed runs at all on a given trading day, meaning
 *      their equity curve never advanced through it. THIS SCRIPT DOES NOT
 *      FETCH PRICES OR TOUCH THE LEDGER for those — it has no network
 *      access by design (same "pure decision, not pure I/O" split as
 *      apply-arena-run.mjs). The calling scheduled task reads this list,
 *      fetches that date's EOD close via /api/history, and calls
 *      apply-arena-run.mjs itself with `"late": true` for each one.
 *
 * Usage: node scripts/reconcile-arena-run.mjs <todayEtDateStr>
 *   todayEtDateStr — 'YYYY-MM-DD', the caller's own correctly-computed
 *   US/Eastern "today". Never guessed here — computing wall-clock "today"
 *   in the right timezone is the caller's job (same convention as every
 *   existing Arena scheduled task's own STEP 0).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  tradingDaysBetween, findMissingRuns, buildMissedEntry, upsertRunlogEntry,
  needsLateMarkToMarket,
} from '../src/lib/arenaReconcile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const RUNLOG_PATH = join(REPO, 'public', 'arena-runlog.json');
const HOLIDAYS_PATH = join(REPO, 'public', 'nyse-holidays-2026.json');

function fail(msg) {
  console.error(`[reconcile-arena-run] ERROR: ${msg}`);
  process.exit(1);
}

const throughDateStr = process.argv[2];
if (!throughDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(throughDateStr)) {
  fail('usage: node scripts/reconcile-arena-run.mjs <todayEtDateStr YYYY-MM-DD>');
}

const runlog = existsSync(RUNLOG_PATH) ? JSON.parse(readFileSync(RUNLOG_PATH, 'utf8')) : { runs: [] };
const holidaysFull = JSON.parse(readFileSync(HOLIDAYS_PATH, 'utf8'));
const holidays = holidaysFull.holidays || [];

// "Since" = the latest date already present in the runlog (done or missed —
// either way it means reconcile already looked at that day once). If the
// runlog is empty (fresh Season 2, no runs yet), there is nothing to
// reconcile against — reconcile only makes sense once at least one real
// run has happened, so this cleanly no-ops rather than guessing a start.
const knownDates = (runlog.runs || []).map((r) => r.date).filter(Boolean);
if (knownDates.length === 0) {
  console.log('[reconcile-arena-run] runlog is empty — nothing to reconcile against yet. No-op.');
  process.exit(0);
}
const sinceDateStr = knownDates.reduce((a, b) => (a > b ? a : b));

const tradingDays = tradingDaysBetween(sinceDateStr, throughDateStr, holidays);
if (tradingDays.length === 0) {
  console.log(`[reconcile-arena-run] no trading days between ${sinceDateStr} (exclusive) and ${throughDateStr} (inclusive) — nothing to reconcile. No-op.`);
  process.exit(0);
}

const missing = findMissingRuns(runlog, tradingDays);
let nextRunlog = runlog;
for (const gap of missing) {
  nextRunlog = upsertRunlogEntry(nextRunlog, buildMissedEntry(gap));
}
if (missing.length > 0) {
  writeFileSync(RUNLOG_PATH, `${JSON.stringify(nextRunlog, null, 2)}\n`);
}

const MODELS = ['S', 'P', 'T'];
const lateMarkNeeded = MODELS
  .map((model) => ({ model, dates: tradingDays.filter((d) => needsLateMarkToMarket(nextRunlog, model, d, holidays)) }))
  .filter((x) => x.dates.length > 0);

console.log(JSON.stringify({ sinceDateStr, throughDateStr, tradingDays, missedRecorded: missing.length, lateMarkNeeded }, null, 2));
console.log(`[reconcile-arena-run] scanned ${tradingDays.length} trading day(s) since ${sinceDateStr}; ` +
  `recorded ${missing.length} missed entr${missing.length === 1 ? 'y' : 'ies'}` +
  (missing.length > 0 ? ` (wrote ${RUNLOG_PATH})` : '') +
  `. ${lateMarkNeeded.length} model(s) need a late mark-to-market catch-up — see "lateMarkNeeded" above; ` +
  `fetch EOD closes for those dates and call apply-arena-run.mjs with "late": true.`);
