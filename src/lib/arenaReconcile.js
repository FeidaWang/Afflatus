/* ============================================================
   ARENA — offline catch-up / idempotency helpers (Part 4 urgent.md §19.3).

   Pure functions only (no fetch/DOM/Date.now() defaults — same discipline
   as arenaRules.js/arenaRun.js). This module answers two questions a
   scheduled-task run needs before it touches the ledger:

   1. "Have I already done this exact run?" -> runIdentity()/hasCompletedRun()
      lets apply-arena-run.mjs no-op a duplicate/retried run instead of
      double-settling (§19.3.1). Run identity = (date, window, model),
      matching src/lib/validateArenaRunlog.js's own uniqueness invariant.
   2. "What did I miss while the Mac was asleep?" -> findMissingRuns()
      diffs the expected schedule against arena-runlog.json's `done` entries
      across every trading day since the last recorded run (§19.3.2).

   Explicitly NOT this module's job: missed *proposal* windows are never
   retro-traded (no hindsight trades, ever — see §19.3.2's own wording).
   The only thing "catching up" ever produces for a missed proposal window
   is a `missed` runlog entry. A missed *mark-to-market* is different: the
   equity curve must stay continuous, so needsLateMarkToMarket() flags when
   a model's ledger slice hasn't been marked for a trading day that has
   passed — the actual EOD price fetch and the `runArenaLedger` call with
   `proposedOrders: []` happen in the calling script (this module has no
   fetch), which is expected to pass `late: true` through to the runlog via
   buildLateMarkToMarketNote().
   ============================================================ */

// Must match src/lib/validateArenaRunlog.js's own enum lists exactly —
// duplicated rather than imported because that file is a pure schema
// validator with no exported constants, and importing internals across
// intent boundaries (validator vs. business logic) is the kind of coupling
// this codebase avoids (see CLAUDE.md's own "small duplication over
// cross-file coupling" convention, also used by arenaPicks.js's etDate
// helper vs arenaTech.js's).
export const WINDOWS = ['pre-market-gather', 'picks-publish', 'open-window', 'late-window', 'post-market', 'weekly-review'];

/** (date, window, model) uniqueness key — matches validateArenaRunlog.js's own key. */
export function runIdentity(date, window, model) {
  return `${date}|${window}|${model}`;
}

/** True when runlog already has a `done` entry for this exact (date, window, model). */
export function hasCompletedRun(runlog, date, window, model) {
  const runs = (runlog && Array.isArray(runlog.runs)) ? runlog.runs : [];
  return runs.some((r) => r.status === 'done' && r.date === date && r.window === window && r.model === model);
}

/**
 * Upsert one entry into a runlog by (date, window, model) identity — used
 * both for recording a just-completed run and for appending `missed`
 * catch-up entries. Pure: returns a new object, never mutates the input.
 */
export function upsertRunlogEntry(runlog, entry) {
  const runs = (runlog && Array.isArray(runlog.runs)) ? runlog.runs : [];
  const key = runIdentity(entry.date, entry.window, entry.model);
  const idx = runs.findIndex((r) => runIdentity(r.date, r.window, r.model) === key);
  const nextRuns = idx >= 0 ? runs.slice() : [...runs, entry];
  if (idx >= 0) nextRuns[idx] = entry;
  return { ...(runlog || {}), runs: nextRuns };
}

function isWeekend(dateStr) {
  const wd = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
}

function isHoliday(dateStr, holidays) {
  return Array.isArray(holidays) && holidays.some((h) => h.date === dateStr);
}

/** True when dateStr is a US/Eastern trading day (not a weekend, not an NYSE holiday). */
export function isTradingDay(dateStr, holidays) {
  return !isWeekend(dateStr) && !isHoliday(dateStr, holidays);
}

/** dateStr -> the next calendar date string (UTC-noon arithmetic, DST-proof). */
function nextDateStr(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Every trading day strictly after `sinceDateStr` up to and including
 * `throughDateStr`. Both are 'YYYY-MM-DD' US/Eastern calendar dates. Caps
 * at 30 days as a safety net against a runaway loop if the two dates are
 * ever accidentally years apart (a real gap that large means something
 * else is badly wrong and should be investigated, not silently walked).
 */
export function tradingDaysBetween(sinceDateStr, throughDateStr, holidays) {
  const out = [];
  let cur = sinceDateStr;
  let guard = 0;
  while (cur < throughDateStr && guard < 30) {
    cur = nextDateStr(cur);
    guard += 1;
    if (isTradingDay(cur, holidays)) out.push(cur);
  }
  return out;
}

/**
 * The (window, model) pairs expected on a given trading-day date, per
 * urgent.md §19.1's window table. `weeklyReviewOnSaturday` covers the one
 * extra Saturday-only window — Saturdays are already excluded from
 * isTradingDay/tradingDaysBetween since NYSE doesn't trade then, so the
 * weekly review is checked separately by the caller when it cares about it
 * (not folded into this function, since it's not itself an NYSE trading
 * day and a caller only iterating trading days would never see it).
 */
export function expectedRunsForDate() {
  return [
    { window: 'pre-market-gather', model: 'gatherer' },
    { window: 'picks-publish', model: 'gatherer' },
    { window: 'open-window', model: 'S' },
    { window: 'open-window', model: 'P' },
    { window: 'late-window', model: 'S' },
    { window: 'late-window', model: 'P' },
    { window: 'post-market', model: 'T' },
    { window: 'post-market', model: 'reviewer' },
  ];
}

/**
 * Diff the expected schedule against what's actually `done` in runlog for
 * every trading day in `tradingDays` (get this from tradingDaysBetween()).
 * Returns the list of {date, window, model} that never completed — the
 * caller turns each into a `missed` runlog entry via buildMissedEntry(),
 * never into a retro-traded order (§19.3.2's hard rule).
 */
export function findMissingRuns(runlog, tradingDays) {
  const missing = [];
  for (const date of tradingDays) {
    for (const { window, model } of expectedRunsForDate()) {
      if (!hasCompletedRun(runlog, date, window, model)) missing.push({ date, window, model });
    }
  }
  return missing;
}

/** Build a `missed` runlog entry for one gap found by findMissingRuns(). */
export function buildMissedEntry({ date, window, model }, note) {
  return {
    date, window, model, status: 'missed', ordersProposed: 0, ordersFilled: 0,
    note: note || 'catch-up: window never ran (reconcile on wake, §19.3.2) — no retro-trade, proposal opportunity is gone for good.',
  };
}

/**
 * True when `model`'s ledger slice needs a late mark-to-market for
 * dateStr: dateStr is a trading day, and runlog has NO `done` entry at all
 * for (dateStr, model) across ANY window that day. Deliberately checks
 * runlog rather than the ledger's top-level `lastRunDate` — that field is
 * shared across every model (whichever book runs first on a given day
 * bumps it for all of them), so it can't tell "S ran today" from "P ran
 * today" apart. A model only needs a catch-up mark if it truly had zero
 * runs that day; if it completed even one window (say open-window but not
 * late-window), its equity curve already advanced through that date and no
 * catch-up is owed. The caller is responsible for fetching that date's EOD
 * closes and calling runArenaLedger(model, {etDateStr: dateStr, priceMap,
 * proposedOrders: []}) — this function only decides whether that catch-up
 * call is owed.
 */
export function needsLateMarkToMarket(runlog, model, dateStr, holidays) {
  if (!isTradingDay(dateStr, holidays)) return false;
  const runs = (runlog && Array.isArray(runlog.runs)) ? runlog.runs : [];
  return !runs.some((r) => r.status === 'done' && r.date === dateStr && r.model === model);
}

/** Runlog note for a late (post-hoc) mark-to-market catch-up entry. */
export function buildLateMarkToMarketNote(dateStr) {
  return `late catch-up mark-to-market for ${dateStr} (equity curve continuity, §19.3.2) — no new orders proposed.`;
}
