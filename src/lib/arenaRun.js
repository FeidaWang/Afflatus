/* ============================================================
   ARENA AUTOPILOT — single-run orchestration (V4, ROADMAP §7.1).

   Pure function, no DOM/fetch/Date.now() defaults — same discipline as
   arenaRules.js (see that file's header). This is the layer a scheduled
   task's CLI wrapper (scripts/apply-arena-run.mjs) calls: the LLM step
   (running as the scheduled task itself) only ever produces a JSON
   proposal (orders + review text) from a market digest it gathered via
   WebSearch/quote fetch. This module is the deterministic "code settles"
   half — it re-derives every hard limit from arenaRules.js, so a bad
   proposal cannot silently mutate the ledger in a way the tests don't
   cover.

   One call = one scheduled-task run (Model A open window / late window /
   Model B post-market / weekly review all go through this same function;
   "weekly review" just skips new proposedOrders and only updates review
   text + reads metrics, same code path). Part 4 (urgent.md §17-20) adds
   three Season 2 books — S/P/T — through the same function; see BOOKS
   below and bootstrapSeason2() for the (not-yet-invoked-on-live-data)
   Season 1 -> Season 2 transition.
   ============================================================ */
import {
  LIMITS, validateOrder, simulateFill, applyFill, rejectOrder, markToMarket,
  checkStopLoss, checkExitBySweep, checkDailyCircuitBreaker, checkSeasonReset, resetSeason,
  computeMetrics,
} from './arenaRules.js';
import { validateArenaExecutionQuoteReceipt } from './arenaExecution.js';

const BOOKS = ['A', 'B', 'S', 'P', 'T'];

function bumpVersion(v) {
  const m = /^(.*-v)(\d+)$/.exec(v || '');
  if (!m) return `${v || 'v'}-2`;
  return `${m[1]}${parseInt(m[2], 10) + 1}`;
}

// Rolling 7-calendar-day window ending on etDateStr (inclusive) — an
// approximation of "per week" turnover, not an exact ISO calendar week;
// good enough for a soft throttle, documented so nobody "fixes" it later
// expecting Mon-Sun week boundaries.
function countRecentTrades(trades, etDateStr) {
  const end = Date.parse(`${etDateStr}T23:59:59Z`);
  const start = end - 6 * 86400000;
  return trades.filter((t) => {
    const ts = Date.parse(t.ts);
    return Number.isFinite(ts) && ts >= start && ts <= end;
  }).length;
}

function upsertDay(history, day, equity) {
  const idx = history.findIndex((h) => h.day === day);
  if (idx >= 0) {
    const copy = history.slice();
    copy[idx] = { day, equity };
    return copy;
  }
  return [...history, { day, equity }];
}

/**
 * @param {object} ledgerFull - full parsed arena-ledger.json
 * @param {'A'|'B'|'S'|'P'|'T'} book
 * @param {object} opts
 *   etDateStr        'YYYY-MM-DD' — US/Eastern trading-day date for this run
 *   nowIso           ISO timestamp for trade/rejection records
 *   priceMap         { sym: price } — latest quotes for every symbol touched
 *                    (existing positions + anything in proposedOrders)
 *   proposedOrders   [{ sym, side, qty, refPx?, confidence?, reduceOnly? }]
 *   universe         string[] — allowed symbols (arena-universe.json symbols)
 *   reviewZh/reviewEn  caller-supplied natural-language reflection (optional)
 *   benchPct         { spyPct, smhPct } optional — updates top-level bench
 *   newPromptVersionOnReset  optional string override if a season reset fires
 *   quoteReceipts    { sym: {sourceUrl,requestId,observedAt,refPx,...} }
 *   requireExecutionQuoteReceipt  true for the live CLI; historical callers
 *                    remain readable without manufacturing receipts
 *   valuationOnly    true only for historical catch-up: mark and audit without
 *                    executing discretionary, stop-loss, or exitBy orders
 * @returns {{ ledger: object, summary: object }}
 */
export function runArenaLedger(ledgerFull, book, opts) {
  const {
    etDateStr, nowIso, priceMap = {}, proposedOrders = [], universe,
    reviewZh, reviewEn, benchPct, newPromptVersionOnReset, valuationOnly = false,
    quoteReceipts = {}, requireExecutionQuoteReceipt = false, executionWindow = null,
  } = opts;
  if (!etDateStr || !nowIso) throw new Error('runArenaLedger: etDateStr and nowIso are required');
  if (!BOOKS.includes(book)) throw new Error(`runArenaLedger: invalid book "${book}"`);
  if (valuationOnly && proposedOrders.length) {
    throw new Error('runArenaLedger: valuationOnly catch-up cannot contain proposed orders');
  }
  const maxOrders = LIMITS.PER_MODEL?.[book]?.MAX_ORDERS_PER_RUN;
  if (maxOrders != null && proposedOrders.length > maxOrders) {
    throw new Error(`runArenaLedger: Model ${book} accepts at most ${maxOrders} proposed orders per run`);
  }

  const weekday = new Date(`${etDateStr}T12:00:00Z`).getUTCDay();
  const isNewTradingDay = ledgerFull.lastRunDate !== etDateStr;
  const day = isNewTradingDay ? (ledgerFull.day || 0) + 1 : (ledgerFull.day || 0);

  let modelLedger = markToMarket(ledgerFull.models[book], priceMap);
  // `lastRunDate` is shared by all books, so whichever book runs first moves
  // it for the others. Equity history is the per-book proof that this book has
  // actually started the computed day.
  const isNewBookDay = !modelLedger.equityHistory.some((entry) => entry.day === day);
  if (isNewBookDay) modelLedger = { ...modelLedger, dayStartEquity: modelLedger.equity };
  const dayStartEquity = modelLedger.dayStartEquity ?? modelLedger.equity;
  let riskLockdown = checkDailyCircuitBreaker(dayStartEquity, modelLedger.equity);

  const filled = [];
  const rejected = [];
  const executionSkipped = [];

  const attachExecutionQuote = (order) => {
    const receipt = quoteReceipts[order.sym];
    if (requireExecutionQuoteReceipt) {
      if (!receipt) throw new Error(`runArenaLedger: missing execution quote receipt for ${order.sym}`);
      const validation = validateArenaExecutionQuoteReceipt(receipt, {
        symbol: order.sym, refPx: priceMap[order.sym], executedAt: nowIso,
      });
      if (!validation.ok) throw new Error(`runArenaLedger: ${order.sym} ${validation.error}`);
    }
    return receipt ? { ...order, executionQuote: { ...receipt } } : order;
  };

  // Forced stop-loss sells always run first and always pass (risk-reducing).
  for (const so of valuationOnly ? [] : checkStopLoss(modelLedger, book)) {
    const order = attachExecutionQuote({
      ...so, executionType: 'stop-loss', executionReason: so.reason,
    });
    const fill = simulateFill(order, book);
    modelLedger = applyFill(modelLedger, order, fill, nowIso);
    filled.push({ order, fill, forced: 'stop-loss' });
  }

  // Forced exitBy closes (Model P holding-period discipline, Part 4 §17.3) —
  // a no-op for any position without an exitBy, i.e. every A/B/S/T position.
  for (const eo of valuationOnly ? [] : checkExitBySweep(modelLedger, etDateStr)) {
    const order = attachExecutionQuote({
      ...eo, executionType: 'exitBy', executionReason: eo.reason,
    });
    const fill = simulateFill(order, book);
    modelLedger = applyFill(modelLedger, order, fill, nowIso);
    filled.push({ order, fill, forced: 'exitBy' });
  }

  for (const raw of valuationOnly ? [] : proposedOrders) {
    riskLockdown = riskLockdown || checkDailyCircuitBreaker(dayStartEquity, modelLedger.equity);
    const order = attachExecutionQuote({
      ...raw, refPx: raw.refPx ?? priceMap[raw.sym],
      ...(requireExecutionQuoteReceipt ? { executionType: 'proposal' } : {}),
    });
    const projectedFill = simulateFill(order, book);
    if (order.side === 'buy' && order.maxExecPx != null && projectedFill.execPx > order.maxExecPx) {
      executionSkipped.push({
        order,
        reason: `projected execution price ${projectedFill.execPx} exceeds signed maximum entry ${order.maxExecPx}`,
      });
      continue;
    }
    if (riskLockdown && order.side === 'buy' && !order.reduceOnly) {
      modelLedger = rejectOrder(modelLedger, order, 'daily circuit breaker: buys blocked for the rest of today', nowIso);
      rejected.push({ order, reason: 'daily circuit breaker' });
      continue;
    }
    const ctx = { model: book, universe, weekday, etDateStr, weeklyTradeCount: countRecentTrades(modelLedger.trades, etDateStr) };
    const v = validateOrder(order, modelLedger, ctx);
    if (!v.ok) {
      modelLedger = rejectOrder(modelLedger, order, v.reason, nowIso);
      rejected.push({ order, reason: v.reason });
      continue;
    }
    const fill = projectedFill;
    modelLedger = applyFill(modelLedger, order, fill, nowIso);
    filled.push({ order, fill });
    modelLedger = markToMarket(modelLedger, priceMap);
    riskLockdown = riskLockdown || checkDailyCircuitBreaker(dayStartEquity, modelLedger.equity);
  }

  // Re-mark after trades so equity reflects the same quotes used to decide,
  // not stale pre-trade marks.
  modelLedger = markToMarket(modelLedger, priceMap);
  modelLedger = {
    ...modelLedger,
    equityHistory: upsertDay(modelLedger.equityHistory, day, modelLedger.equity),
    // The top-level lastRunDate is shared by all books and cannot prove that
    // this particular book was valued. Keep a backward-compatible per-book
    // cursor so catch-up can repair partially completed sessions precisely.
    lastValuationDate: etDateStr,
    ...(executionWindow ? {
      // Every real execution/valuation window leaves a ledger-side witness,
      // even for an empty book and zero orders. This keeps the complete Arena
      // atomic group visible to Git without inventing a trade or changing P&L.
      valuationAudits: [
        ...(Array.isArray(modelLedger.valuationAudits) ? modelLedger.valuationAudits : []),
        {
          date: etDateStr,
          window: executionWindow,
          mode: valuationOnly ? 'valuation-only' : 'live-execution',
          recordedAt: nowIso,
          quoteReceipts: structuredClone(quoteReceipts),
        },
      ],
    } : {}),
  };

  let seasonReset = false;
  // Historical valuation is an audit operation. It must never reset a season,
  // liquidate positions, or rewrite cash based on information observed after
  // the original execution window.
  if (!valuationOnly && checkSeasonReset(modelLedger)) {
    seasonReset = true;
    modelLedger = resetSeason(modelLedger, newPromptVersionOnReset || bumpVersion(modelLedger.promptVersion), day);
  }

  modelLedger = { ...modelLedger, metrics: computeMetrics(modelLedger) };
  if (reviewZh != null || reviewEn != null) {
    modelLedger = { ...modelLedger, review: { zh: reviewZh ?? modelLedger.review.zh, en: reviewEn ?? modelLedger.review.en } };
  }

  const ledger = {
    ...ledgerFull,
    updated: etDateStr,
    day,
    lastRunDate: etDateStr,
    bench: benchPct ? { spyPct: benchPct.spyPct, smhPct: benchPct.smhPct } : ledgerFull.bench,
    models: { ...ledgerFull.models, [book]: modelLedger },
  };

  return {
    ledger,
    summary: {
      book, day, riskLockdown, seasonReset,
      filled, rejected, executionSkipped,
      equity: modelLedger.equity, metrics: modelLedger.metrics,
    },
  };
}

/**
 * Season 1 -> Season 2 transition (Part 4 §16.4/§17.5.4): archives nothing
 * itself (the caller is expected to have already written the Season 1
 * ledger out to arena-ledger-s1.json before calling this — see urgent.md
 * §18.1.3) and returns a brand-new ledger seeded with three fresh $10,000
 * books (S/P/T). Pure — does not read or write any file, and is NOT wired
 * into any scheduled task yet: Part 4's implementation order (§20) puts the
 * live flip in Phase 4, after the data/pipeline/API work in Phases 2-3 is
 * in place and dry-run. Exists now so that later work has a tested seed
 * function to call rather than hand-rolling the ledger shape at flip time.
 *
 * @param {object} ledgerFull - the Season 1 ledger (read for version/season bookkeeping only)
 * @param {object} opts
 *   day               starting day counter for Season 2 (default 0)
 *   promptVersions    { S, P, T } initial prompt version strings
 *   note_en/note_zh   optional site-copy overrides (Season 1's note text
 *                      describes Model A/B and would otherwise carry over
 *                      unchanged, since this function only overrides the
 *                      specific fields a season transition needs)
 */
export function bootstrapSeason2(ledgerFull, opts = {}) {
  const { day = 0, promptVersions = { S: 'S-v1', P: 'P-v1', T: 'T-v1' }, note_en, note_zh } = opts;
  const freshModel = (promptVersion) => ({
    promptVersion,
    startEquity: 10000,
    cash: 10000,
    equity: 10000,
    dayStartEquity: 10000,
    equityHistory: [{ day, equity: 10000 }],
    positions: [],
    trades: [],
    rejections: [],
    metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
    review: { zh: '', en: '' },
  });
  return {
    ...ledgerFull,
    version: (ledgerFull.version || 1) + 1,
    season: (ledgerFull.season || 1) + 1,
    day,
    lastRunDate: null,
    bench: { spyPct: 0, smhPct: 0 },
    ...(note_en != null ? { note_en } : {}),
    ...(note_zh != null ? { note_zh } : {}),
    models: {
      S: freshModel(promptVersions.S),
      P: freshModel(promptVersions.P),
      T: freshModel(promptVersions.T),
    },
  };
}
