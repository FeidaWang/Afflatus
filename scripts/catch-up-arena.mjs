#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { runArenaLedger } from '../src/lib/arenaRun.js';
import {
  buildLateMarkToMarketNote,
  buildMissedEntry,
  expectedRunsForDate,
  findMissingRuns,
  upsertRunlogEntry,
} from '../src/lib/arenaReconcile.js';
import { expectedMarketSnapshotDate } from '../src/lib/marketFreshness.js';
import { easternTimeParts, isNyseSession } from '../src/lib/marketSession.js';
import { assessArenaWindow, isEarlyCloseSession } from '../src/lib/arenaWindowGate.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';

const ROOT = resolve(import.meta.dirname, '..');
const paths = {
  ledger: resolve(ROOT, 'public/arena-ledger.json'),
  runlog: resolve(ROOT, 'public/arena-runlog.json'),
  digest: resolve(ROOT, 'public/arena-daily-digest.json'),
  predlog: resolve(ROOT, 'public/arena-predlog.json'),
  news: resolve(ROOT, 'public/arena-news.json'),
  picks: resolve(ROOT, 'public/arena-picks.json'),
  universe: resolve(ROOT, 'public/arena-universe.json'),
  holidays: resolve(ROOT, 'public/nyse-holidays-2026.json'),
};

function fail(message) {
  console.error(`[catch-up-arena] ERROR: ${message}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const HISTORY_ORIGIN = 'https://feida.au';
const HISTORY_BATCH_SIZE = 18;

async function fetchHistory(symbol, outputsize) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL('/api/history', HISTORY_ORIGIN);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', '1day');
    url.searchParams.set('outputsize', String(outputsize));
    const headers = process.env.ARENA_ADMIN_KEY
      ? { 'x-arena-key': process.env.ARENA_ADMIN_KEY }
      : {};
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data?.status !== 'ok' || !Array.isArray(data.values)) throw new Error('invalid upstream schema');
    const requestId = String(response.headers?.get?.('X-Request-Id') || '').trim();
    if (!requestId) throw new Error('history response is missing X-Request-Id');
    return {
      closes: new Map(data.values.map((row) => [row.datetime, Number(row.close)])),
      receipt: {
        sourceUrl: url.toString(),
        requestId,
        observedAt: new Date().toISOString(),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function percentChange(current, previous) {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
}

function marketSessionsBetween(startDate, throughDate, extraHolidays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''))) fail('invalid market-session start date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(throughDate || ''))) fail('invalid --through date');
  const dates = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= throughDate && guard < 370) {
    if (isNyseSession(cursor, extraHolidays)) dates.push(cursor);
    const next = new Date(`${cursor}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    guard += 1;
  }
  if (cursor <= throughDate) fail(`catch-up gap exceeds 370 calendar days after ${startDate}`);
  return dates;
}

function isValuationEvidence(run, model) {
  if (run?.model !== model || !/^\d{4}-\d{2}-\d{2}$/.test(String(run.date || ''))) return false;
  if (run.valuationRecovered === true) return true;
  if (run.status !== 'done') return false;
  if (model === 'T') return run.window === 'post-market';
  return ['open-window', 'late-window', 'post-market'].includes(run.window);
}

function latestDate(dates) {
  return dates.reduce((latest, date) => (date > latest ? date : latest), '');
}

function previousMarketSession(date, extraHolidays) {
  let cursor = new Date(`${date}T12:00:00Z`);
  for (let guard = 0; guard < 10; guard += 1) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const candidate = cursor.toISOString().slice(0, 10);
    if (isNyseSession(candidate, extraHolidays)) return candidate;
  }
  fail(`could not resolve the NYSE session before ${date}`);
}

if (option('now') != null || option('base-url') != null) {
  fail('production catch-up always uses the real wall clock and trusted https://feida.au history origin');
}
const now = new Date();
const dryRun = process.argv.includes('--dry-run');
const outputOption = option('output');
if (dryRun && outputOption) fail('--dry-run and --output cannot be used together');
const outputDirectory = outputOption ? resolve(outputOption) : null;
if (!dryRun && !outputDirectory) {
  fail('candidate-only command: pass --output=<directory-outside-repo> or use --dry-run; publishing is owned by data:publish');
}
if (outputDirectory) {
  const outputRelative = relative(ROOT, outputDirectory);
  if (!outputRelative.startsWith('..')) {
    fail('--output must be outside the repository; candidate generation must not touch tracked data');
  }
}
const holidays = readJson(paths.holidays).holidays || [];
const holidayDates = holidays.map((holiday) => holiday.date);
const currentEtDate = easternTimeParts(now).date;
const currentSettlementDate = expectedMarketSnapshotDate(now, {
  availableFromMinutes: isEarlyCloseSession(currentEtDate) ? 13 * 60 + 30 : 16 * 60 + 30,
  extraHolidays: holidayDates,
});
const postmarketGate = assessArenaWindow('postmarket', now, { extraHolidays: holidayDates });
const requestedThroughDate = option('through');
// While the live post-market window is due, the current session belongs to
// the ordinary settlement flow and catch-up may repair only its predecessor.
// Before that window the provider-complete target is still the prior session;
// after it closes, the just-completed session is safe for honest no-trade
// recovery. This avoids both prematurely marking today's T window missed and
// staying one day behind forever after the window has expired.
const latestCatchUpDate = postmarketGate.due
  ? previousMarketSession(postmarketGate.date, holidayDates)
  : currentSettlementDate;
const targetThroughDate = requestedThroughDate || latestCatchUpDate;
if (requestedThroughDate && requestedThroughDate > latestCatchUpDate) {
  fail(`--through exceeds the latest safely recoverable session ${latestCatchUpDate}`);
}

const ledger = readJson(paths.ledger);
const runlog = readJson(paths.runlog);
const predlog = readJson(paths.predlog);
const existingDigest = readJson(paths.digest);
const news = readJson(paths.news);
const picks = readJson(paths.picks);
const universe = readJson(paths.universe).symbols.map((item) => item.sym);
const knownDates = (runlog.runs || []).map((run) => run.date).filter(Boolean);
if (!knownDates.length) fail('arena-runlog.json has no baseline date');
const marketRunDates = knownDates.filter((date) => isNyseSession(date, holidayDates));
if (!marketRunDates.length) fail('arena-runlog.json has no NYSE-session baseline date');
const seasonStartDate = marketRunDates.reduce((earliest, date) => (date < earliest ? date : earliest));
const sinceDate = ledger.lastRunDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sinceDate || ''))) {
  fail('arena-ledger.json lastRunDate must identify the latest settled session');
}
const seasonSessions = marketSessionsBetween(seasonStartDate, targetThroughDate, holidayDates);
if (!seasonSessions.length) fail(`no NYSE sessions from ${seasonStartDate} through ${targetThroughDate}`);
const throughDate = seasonSessions.at(-1);
const terminalStatuses = new Set(['done', 'missed']);
const expectedRuns = expectedRunsForDate();
const runGapDates = seasonSessions.filter((date) => expectedRuns.some(({ window, model }) => (
  !(runlog.runs || []).some((run) => (
    run.date === date && run.window === window && run.model === model
      && terminalStatuses.has(run.status)
  ))
)));
const expiredQueuedExists = (runlog.runs || []).some((run) => (
  run.status === 'queued' && run.date <= throughDate
));
const legacyLateTExists = (runlog.runs || []).some((run) => (
  run.date <= throughDate && run.window === 'post-market' && run.model === 'T'
    && run.status === 'done' && run.late === true
));
const explicitValuationsComplete = ['S', 'P', 'T'].every((model) => (
  /^\d{4}-\d{2}-\d{2}$/.test(String(ledger.models?.[model]?.lastValuationDate || ''))
    && ledger.models[model].lastValuationDate >= throughDate
));
const auditStartCandidate = (predlog.days || [])
  .map((day) => day?.date)
  .filter((date) => date && date <= throughDate)
  .sort()[0] || seasonStartDate;
const auditSessions = marketSessionsBetween(auditStartCandidate, throughDate, holidayDates);
const auditStatuses = new Set(['scored', 'partial', 'no-predictions', 'missed-source']);
const auditGapDates = auditSessions.filter((date) => !(predlog.days || []).some((day) => (
  day.date === date
    && auditStatuses.has(day.audit?.status)
    && Number.isFinite(Date.parse(day.audit?.checkedAt))
    && typeof day.audit?.note === 'string' && day.audit.note.trim()
)));
if (throughDate < sinceDate) {
  const incomplete = [
    ...(!explicitValuationsComplete ? ['one or more book lastValuationDate values'] : []),
    ...(runGapDates.length ? [`terminal run coverage (${runGapDates.join(', ')})`] : []),
    ...(auditGapDates.length ? [`prediction audit coverage (${auditGapDates.join(', ')})`] : []),
    ...(expiredQueuedExists ? ['expired queued runs'] : []),
    ...(legacyLateTExists ? ['legacy late T terminal entries'] : []),
  ];
  if (incomplete.length) {
    fail(
      `ledger is ahead at ${sinceDate}, but bounded history through ${throughDate} is incomplete: `
      + `${incomplete.join('; ')}; refusing retrospective repair after current-session state changed`,
    );
  }
  if (outputDirectory) {
    mkdirSync(outputDirectory, { recursive: true });
    for (const source of [paths.ledger, paths.runlog, paths.digest, paths.predlog]) {
      const target = resolve(outputDirectory, basename(source));
      if (!existsSync(target)) copyFileSync(source, target);
    }
  }
  console.log(JSON.stringify({
    dryRun,
    candidateOnly: Boolean(outputDirectory),
    sinceDate,
    throughDate,
    targetThroughDate,
    currentSettlementDate,
    latestCatchUpDate,
    postmarketDue: postmarketGate.due,
    historyRequestCount: 0,
    historyRequestsInLastBatch: 0,
    recoveredSessions: [],
    note: 'ledger is ahead and valuation/run/audit evidence proves the bounded prior session complete; candidate bytes were preserved',
  }, null, 2));
  process.exit(0);
}
const catchUpAlreadyComplete = explicitValuationsComplete
  && runGapDates.length === 0
  && auditGapDates.length === 0
  && !expiredQueuedExists
  && !legacyLateTExists
  && existingDigest.date === throughDate;

if (catchUpAlreadyComplete) {
  if (outputDirectory) {
    mkdirSync(outputDirectory, { recursive: true });
    for (const source of [paths.ledger, paths.runlog, paths.digest, paths.predlog]) {
      const target = resolve(outputDirectory, basename(source));
      if (!existsSync(target)) copyFileSync(source, target);
    }
  }
  console.log(JSON.stringify({
    dryRun,
    candidateOnly: Boolean(outputDirectory),
    outputDirectory,
    sinceDate,
    throughDate,
    targetThroughDate,
    currentSettlementDate,
    latestCatchUpDate,
    postmarketDue: postmarketGate.due,
    historyRequestCount: 0,
    historyRequestsInLastBatch: 0,
    recoveredSessions: [],
    auditGapDates: [],
    note: 'prior-session catch-up is already complete; candidate bytes were preserved',
  }, null, 2));
  process.exit(0);
}

const heldSymbols = [...new Set(Object.values(ledger.models)
  .flatMap((model) => model.positions || [])
  .map((position) => position.sym))];
const requestedSymbols = [...new Set([...heldSymbols, 'SPY', 'SMH'])];
// The benchmark return is season-to-date, not merely catch-up-to-date. Ask
// the history provider for every session from season start plus a margin;
// otherwise a mature season silently loses its baseline once it exceeds the
// provider's former fixed 30-row request.
const outputsize = Math.max(30, seasonSessions.length + 10);
let histories;
let historyRequestReceipts;
try {
  // The public history proxy is deliberately rate limited. Fetch in bounded
  // batches so a maximum-size legal ledger cannot exceed its 20/minute quota.
  const fetched = [];
  for (let index = 0; index < requestedSymbols.length; index += HISTORY_BATCH_SIZE) {
    if (index > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 61_000));
    }
    fetched.push(...await Promise.all(requestedSymbols.slice(index, index + HISTORY_BATCH_SIZE).map(async (symbol) => [
      symbol, await fetchHistory(symbol, outputsize),
    ])));
  }
  histories = new Map(fetched.map(([symbol, result]) => [symbol, result.closes]));
  historyRequestReceipts = new Map(fetched.map(([symbol, result]) => [symbol, result.receipt]));
} catch (error) {
  fail(`market history fetch failed: ${error.message}`);
}

for (const symbol of ['SPY', 'SMH']) {
  if (!Number.isFinite(histories.get(symbol)?.get(seasonStartDate))) {
    fail(`missing ${symbol} benchmark baseline for ${seasonStartDate}`);
  }
}

let nextLedger = ledger;
const historicalRecoveredDates = new Set((runlog.runs || [])
  .filter((run) => (
    run.date <= throughDate
    &&
    run.window === 'post-market'
    && run.model === 'T'
    && run.status === 'done'
    && run.late === true
  ))
  .map((run) => run.date));
let nextRunlog = {
  ...runlog,
  runs: (runlog.runs || []).map((run) => {
    if (run.status === 'queued' && run.date <= throughDate) {
      return {
        ...run,
        status: 'missed',
        ordersProposed: Number.isInteger(run.ordersProposed) ? run.ordersProposed : 0,
        ordersFilled: 0,
        note: 'expired queued window: the session closed before execution; no retroactive trade was created.',
      };
    }
    if (historicalRecoveredDates.has(run.date) && run.window === 'post-market') {
      if (run.model === 'T') {
        return {
          ...run,
          status: 'missed',
          ordersProposed: 0,
          ordersFilled: 0,
          note: `original T proposal window for ${run.date} was missed; a late no-order valuation was recovered separately.`,
          valuationRecovered: true,
          valuationOrdersFilled: Number.isInteger(run.ordersFilled) ? run.ordersFilled : 0,
        };
      }
    }
    return run;
  }),
};

const models = ['S', 'P', 'T'];
const ledgerSessions = seasonSessions.filter((date) => date <= ledger.lastRunDate);
const lastValuationDates = {};
const recoveryDatesByModel = {};
for (const model of models) {
  const evidenceDates = new Set(nextRunlog.runs
    .filter((run) => isValuationEvidence(run, model))
    .map((run) => run.date));
  const explicitDate = nextLedger.models[model].lastValuationDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(explicitDate || ''))) evidenceDates.add(explicitDate);
  for (const point of nextLedger.models[model].equityHistory || []) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(point?.date || ''))) evidenceDates.add(point.date);
  }
  // Legacy equity history stored only a shared integer day. Map its latest
  // point back to the season calendar; this distinguishes a partially-run day
  // (S has the current day, P/T do not) without pretending the shared
  // ledger.lastRunDate proves every book was valued.
  const maxHistoryDay = (nextLedger.models[model].equityHistory || [])
    .reduce((maximum, point) => (Number.isInteger(point?.day) ? Math.max(maximum, point.day) : maximum), 0);
  if (maxHistoryDay > 0 && ledgerSessions[maxHistoryDay - 1]) {
    evidenceDates.add(ledgerSessions[maxHistoryDay - 1]);
  }
  const lastValuationDate = latestDate([...evidenceDates].filter((date) => date <= throughDate));
  lastValuationDates[model] = lastValuationDate || null;
  recoveryDatesByModel[model] = seasonSessions.filter((date) => !lastValuationDate || date > lastValuationDate);
  const firstRecovery = recoveryDatesByModel[model][0];
  if (firstRecovery && firstRecovery < ledger.lastRunDate) {
    fail(
      `${model} has an internal valuation gap at ${firstRecovery} before shared ledger date ${ledger.lastRunDate}; `
      + 'refusing to apply current positions retrospectively',
    );
  }
  if (lastValuationDate) nextLedger.models[model].lastValuationDate = lastValuationDate;
}

const recoveryByDate = new Map();
for (const model of models) {
  for (const date of recoveryDatesByModel[model]) {
    recoveryByDate.set(date, [...(recoveryByDate.get(date) || []), model]);
  }
}
const recoveryDates = [...recoveryByDate.keys()].sort();
const catchUpSessions = [...new Set([
  ...recoveryDates,
  ...runGapDates,
  ...historicalRecoveredDates,
])].sort();

for (const date of recoveryDates) {
  for (const model of recoveryByDate.get(date)) {
    for (const position of nextLedger.models[model].positions || []) {
      if (!Number.isFinite(histories.get(position.sym)?.get(date))) {
        fail(`missing ${position.sym} close for ${model} valuation on ${date}`);
      }
    }
  }
  for (const symbol of ['SPY', 'SMH']) {
    if (!Number.isFinite(histories.get(symbol)?.get(date))) fail(`missing ${symbol} close for ${date}`);
  }
}

const daily = new Map();
for (const date of catchUpSessions) {
  const missing = findMissingRuns(nextRunlog, [date]);
  for (const gap of missing) {
    const existing = nextRunlog.runs.find((run) => (
      run.date === gap.date && run.window === gap.window && run.model === gap.model
    ));
    // Preserve the exact audit evidence of an expired queued proposal. It is
    // already missed; replacing it with a generic zero-proposal gap would
    // erase the honest record that a pre-close decision existed.
    if (existing?.status !== 'missed') {
      nextRunlog = upsertRunlogEntry(nextRunlog, buildMissedEntry(gap));
    }
  }

  const before = Object.fromEntries(models.map((model) => [model, nextLedger.models[model].equity]));
  const summaries = [];
  for (const model of recoveryByDate.get(date) || []) {
    const priceMap = Object.fromEntries((nextLedger.models[model].positions || []).map((position) => [
      position.sym,
      histories.get(position.sym).get(date),
    ]));
    const spyStart = histories.get('SPY').get(seasonStartDate);
    const smhStart = histories.get('SMH').get(seasonStartDate);
    const result = runArenaLedger(nextLedger, model, {
      etDateStr: date,
      nowIso: now.toISOString(),
      priceMap,
      proposedOrders: [],
      valuationOnly: true,
      universe,
      benchPct: {
        spyPct: percentChange(histories.get('SPY').get(date), spyStart),
        smhPct: percentChange(histories.get('SMH').get(date), smhStart),
      },
    });
    nextLedger = result.ledger;
    summaries.push(result.summary);
    // T's post-market identity is also its original proposal window. Keep a
    // missed T decision visibly missed; recording a late valuation as `done`
    // under the same identity would rewrite history. S/P have no original
    // post-market proposal identity, so their late valuation can be explicit.
    if (model === 'T') {
      const missedT = nextRunlog.runs.find((run) => (
        run.date === date && run.window === 'post-market' && run.model === 'T'
      ));
      nextRunlog = upsertRunlogEntry(nextRunlog, {
        ...missedT,
        date,
        window: 'post-market',
        model: 'T',
        status: 'missed',
        ordersProposed: Number.isInteger(missedT?.ordersProposed) ? missedT.ordersProposed : 0,
        ordersFilled: 0,
        note: `original T proposal window for ${date} was missed; late provider-close valuation recovered with no hindsight proposal.`,
        late: true,
        valuationRecovered: true,
        valuationOrdersFilled: result.summary.filled.length,
        historyReceipts: Object.fromEntries([...new Set([
          ...(nextLedger.models[model].positions || []).map((position) => position.sym),
          'SPY', 'SMH',
        ])].map((symbol) => [symbol, {
          ...historyRequestReceipts.get(symbol),
          session: date,
          close: histories.get(symbol).get(date),
          ...(['SPY', 'SMH'].includes(symbol) ? { seasonStartClose: histories.get(symbol).get(seasonStartDate) } : {}),
        }])),
      });
    } else {
      nextRunlog = upsertRunlogEntry(nextRunlog, {
        date,
        window: 'post-market',
        model,
        status: 'done',
        ordersProposed: 0,
        ordersFilled: result.summary.filled.length,
        note: buildLateMarkToMarketNote(date),
        late: true,
        valuationRecovered: true,
        historyReceipts: Object.fromEntries([...new Set([
          ...(nextLedger.models[model].positions || []).map((position) => position.sym),
          'SPY', 'SMH',
        ])].map((symbol) => [symbol, {
          ...historyRequestReceipts.get(symbol),
          session: date,
          close: histories.get(symbol).get(date),
          ...(['SPY', 'SMH'].includes(symbol) ? { seasonStartClose: histories.get(symbol).get(seasonStartDate) } : {}),
        }])),
      });
    }
  }
  const existingReviewer = nextRunlog.runs.find((run) => (
    run.date === date && run.window === 'post-market' && run.model === 'reviewer'
  ));
  const baselineReviewer = (runlog.runs || []).find((run) => (
    run.date === date && run.window === 'post-market' && run.model === 'reviewer'
  ));
  if (!existingReviewer) {
    nextRunlog = upsertRunlogEntry(nextRunlog, {
      date,
      window: 'post-market',
      model: 'reviewer',
      status: 'done',
      ordersProposed: 0,
      ordersFilled: 0,
      note: `late catch-up review for ${date}: provider-close valuation and audit recorded; original missed proposal windows remain missed.`,
      late: true,
    });
  } else if (
    existingReviewer.status === 'missed'
    && baselineReviewer?.status !== 'queued'
    && Number(existingReviewer.ordersProposed || 0) === 0
    && Number(existingReviewer.ordersFilled || 0) === 0
  ) {
    // The proposal identities stay missed. Reviewer is different: once the
    // provider-close valuation and audit have actually been recovered, a
    // former missed review may truthfully become a late zero-order review.
    // Spread the baseline entry so every unrelated historical field remains
    // byte-for-byte equivalent.
    nextRunlog = upsertRunlogEntry(nextRunlog, {
      ...existingReviewer,
      status: 'done',
      note: `late catch-up review for ${date}: provider-close valuation and audit recorded; original missed proposal windows remain missed.`,
      late: true,
    });
  }
  daily.set(date, { before, summaries });
}

const latest = daily.get(throughDate);
if (recoveryDates.length) {
  for (const model of ['S', 'P', 'T']) {
    const symbols = (nextLedger.models[model].positions || []).map((position) => position.sym);
    const positionEn = symbols.length ? `Open positions (${symbols.join(', ')}) were marked` : 'The empty book was marked';
    const positionZh = symbols.length ? `现有持仓（${symbols.join('、')}）已完成估值` : '空仓账本已完成核对';
    nextLedger.models[model].review = {
      en: `${positionEn} through the ${throughDate} provider close during late recovery. Missed proposal windows remain missed and no discretionary or hindsight order was added.`,
      zh: `${positionZh}至 ${throughDate} 行情供应商收盘价。错过的提案窗口仍保留为 missed，未新增主观或事后订单。`,
    };
  }
}
const digest = recoveryDates.length ? {
  date: throughDate,
  generatedAt: now.toISOString(),
  note_en: `Recovered ${recoveryDates.length} incomplete market session${recoveryDates.length === 1 ? '' : 's'} across the books that lacked valuation evidence. Missed proposal windows remain marked missed; no hindsight trades were created.`,
  note_zh: `已为缺少估值证据的账本恢复 ${recoveryDates.length} 个不完整交易日。错过的提案窗口仍标记为 missed，未创建任何事后交易。`,
  books: ['S', 'P', 'T'].map((model) => {
    const current = nextLedger.models[model];
    const summary = latest.summaries.find((item) => item.book === model);
    const fills = summary?.filled?.length || 0;
    return {
      model,
      pnlPct: percentChange(current.equity, latest?.before?.[model] ?? current.equity),
      tradesCount: fills,
      note_en: fills
        ? `${fills} deterministic risk exit(s) executed while marking the book to market; no discretionary or retroactive orders were added.`
        : `Marked to the ${throughDate} close with no discretionary or retroactive orders.`,
      note_zh: fills
        ? `按市值计价时执行 ${fills} 笔确定性风险退出；未新增主观或事后订单。`
        : `已按 ${throughDate} 收盘价计价，未新增主观或事后订单。`,
    };
  }),
  tomorrowPicksCount: picks.date > throughDate
    ? Object.values(picks.models || {}).reduce((sum, list) => sum + list.length, 0)
    : 0,
  delayed: models.filter((model) => recoveryDatesByModel[model].length).map((model) => ({
    date: throughDate,
    window: 'post-market',
    model,
    note_en: `Late mark-to-market recovery completed for ${recoveryDatesByModel[model].length} missing ${model} valuation(s).`,
    note_zh: `已为 ${model} 补齐 ${recoveryDatesByModel[model].length} 个缺失估值。`,
  })),
} : existingDigest;
const nextPredlogDays = [...(predlog.days || [])];
const explicitPredlogDates = nextPredlogDays.map((day) => day.date).filter(Boolean).sort();
const predlogAuditStartDate = explicitPredlogDates.find((date) => date <= throughDate) || seasonStartDate;
const auditDates = [];
let auditCursor = predlogAuditStartDate;
let auditGuard = 0;
while (auditCursor <= throughDate && auditGuard < 370) {
  if (isNyseSession(auditCursor, holidayDates)) auditDates.push(auditCursor);
  const next = new Date(`${auditCursor}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  auditCursor = next.toISOString().slice(0, 10);
  auditGuard += 1;
}
if (auditCursor <= throughDate) fail(`prediction audit gap exceeds 370 calendar days from ${predlogAuditStartDate}`);

for (const date of auditDates) {
  const index = nextPredlogDays.findIndex((day) => day.date === date);
  const existingDay = index >= 0 ? nextPredlogDays[index] : { date, entries: {} };
  if (auditStatuses.has(existingDay.audit?.status)
      && Number.isFinite(Date.parse(existingDay.audit?.checkedAt))
      && typeof existingDay.audit?.note === 'string' && existingDay.audit.note.trim()) {
    continue;
  }
  const entries = Object.values(existingDay.entries || {});
  const scoredCount = entries.filter((entry) => (
    Number.isFinite(entry?.actualClosePct) && typeof entry?.dirHit === 'boolean'
  )).length;
  const fullyScored = entries.length > 0 && scoredCount === entries.length;
  const sameDayPredictions = news.date === date ? Object.keys(news.aiPredictions || {}) : [];
  const status = fullyScored
    ? 'scored'
    : entries.length > 0
      ? 'partial'
    : news.date === date && sameDayPredictions.length === 0
      ? 'no-predictions'
      : 'missed-source';
  const audit = {
    status,
    checkedAt: now.toISOString(),
    note: status === 'scored'
      ? `${scoredCount} prediction(s) have an explicit directional result.`
      : status === 'partial'
        ? `${scoredCount} of ${entries.length} prediction(s) have complete close-direction results; unchecked entries remain explicit.`
        : status === 'no-predictions'
        ? 'The preserved pre-market source explicitly contained no predictions.'
        : 'No same-session preserved prediction source and complete actuals were available; no score was inferred.',
  };
  const auditedDay = { ...existingDay, entries: existingDay.entries || {}, audit };
  if (index >= 0) nextPredlogDays[index] = auditedDay;
  else nextPredlogDays.push(auditedDay);
}
nextPredlogDays.sort((a, b) => a.date.localeCompare(b.date));
let completelyAuditedThrough = '';
for (const day of nextPredlogDays) {
  if (day.date > throughDate || !day.audit?.status) continue;
  if (day.audit.status === 'partial') break;
  completelyAuditedThrough = day.date;
}
if (!completelyAuditedThrough) {
  fail('prediction audit has no fully classified session before the first partial result');
}
const nextPredlog = {
  ...predlog,
  updated: now.toISOString(),
  // checkedThrough means complete scoring/classification, while the pipeline
  // freshness value below uses the latest explicit audit date. This prevents
  // a partial score from being called complete without blocking settlement.
  checkedThrough: completelyAuditedThrough,
  days: nextPredlogDays.slice(-60),
};

function prepareValidatedCatchUp() {
  const validations = [
    ['arena-ledger.json', validateArenaLedger(nextLedger)],
    ['arena-runlog.json', validateArenaRunlog(nextRunlog)],
    ['arena-daily-digest.json', validateArenaDigest(digest)],
    ['arena-predlog.json', validateArenaPredlog(nextPredlog)],
  ];
  for (const [label, validation] of validations) {
    if (!validation.ok) throw new Error(`${label}: ${validation.errors.join('; ')}`);
  }
  return [
    { path: paths.ledger, data: nextLedger },
    { path: paths.runlog, data: nextRunlog },
    { path: paths.digest, data: digest },
    { path: paths.predlog, data: nextPredlog },
  ];
}

if (outputDirectory) {
  let prepared;
  try { prepared = prepareValidatedCatchUp(); } catch (error) { fail(error.message); }
  mkdirSync(outputDirectory, { recursive: true });
  for (const entry of prepared) {
    writeFileSync(resolve(outputDirectory, basename(entry.path)), `${JSON.stringify(entry.data, null, 2)}\n`);
  }
} else if (dryRun) {
  try { prepareValidatedCatchUp(); } catch (error) { fail(error.message); }
}
console.log(JSON.stringify({
  dryRun,
  candidateOnly: Boolean(outputDirectory),
  outputDirectory,
  sinceDate,
  throughDate,
  targetThroughDate,
  currentSettlementDate,
  latestCatchUpDate,
  postmarketDue: postmarketGate.due,
  historyOutputsize: outputsize,
  historyRequestCount: requestedSymbols.length,
  historyRequestsInLastBatch: requestedSymbols.length
    ? ((requestedSymbols.length - 1) % HISTORY_BATCH_SIZE) + 1
    : 0,
  lastValuationDates,
  recoveredSessions: recoveryDates,
  recoveredByBook: recoveryDatesByModel,
  heldSymbols,
  ledgerDay: nextLedger.day,
}, null, 2));
