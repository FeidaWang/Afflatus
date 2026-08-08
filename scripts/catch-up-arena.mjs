#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runArenaLedger } from '../src/lib/arenaRun.js';
import {
  buildLateMarkToMarketNote,
  buildMissedEntry,
  findMissingRuns,
  needsLateMarkToMarket,
  tradingDaysBetween,
  upsertRunlogEntry,
} from '../src/lib/arenaReconcile.js';
import { expectedMarketSnapshotDate } from '../src/lib/marketFreshness.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { runAtomicPublishTransaction } from './lib/publish-transaction.mjs';
import { SITE_GENERATE_COMMAND, SITE_PUBLISH_ARTIFACTS } from './lib/site-publish-artifacts.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const paths = {
  ledger: resolve(ROOT, 'public/arena-ledger.json'),
  runlog: resolve(ROOT, 'public/arena-runlog.json'),
  digest: resolve(ROOT, 'public/arena-daily-digest.json'),
  predlog: resolve(ROOT, 'public/arena-predlog.json'),
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

async function fetchHistory(baseUrl, symbol, outputsize) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL('/api/history', baseUrl);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', '1day');
    url.searchParams.set('outputsize', String(outputsize));
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data?.status !== 'ok' || !Array.isArray(data.values)) throw new Error('invalid upstream schema');
    return new Map(data.values.map((row) => [row.datetime, Number(row.close)]));
  } finally {
    clearTimeout(timer);
  }
}

function percentChange(current, previous) {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
}

const now = new Date(option('now', new Date().toISOString()));
if (Number.isNaN(now.getTime())) fail('invalid --now timestamp');
const baseUrl = option('base-url', 'https://feida.au');
const dryRun = process.argv.includes('--dry-run');
const holidays = readJson(paths.holidays).holidays || [];
const holidayDates = holidays.map((holiday) => holiday.date);
const throughDate = option('through', expectedMarketSnapshotDate(now, {
  availableFromMinutes: 16 * 60 + 30,
  extraHolidays: holidayDates,
}));

const ledger = readJson(paths.ledger);
const runlog = readJson(paths.runlog);
const predlog = readJson(paths.predlog);
const picks = readJson(paths.picks);
const universe = readJson(paths.universe).symbols.map((item) => item.sym);
const knownDates = (runlog.runs || []).map((run) => run.date).filter(Boolean);
if (!knownDates.length) fail('arena-runlog.json has no baseline date');
const sinceDate = ledger.lastRunDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sinceDate || ''))) {
  fail('arena-ledger.json lastRunDate must identify the latest settled session');
}
const tradingDays = tradingDaysBetween(sinceDate, throughDate, holidays);

if (!tradingDays.length) {
  console.log(`[catch-up-arena] no closed sessions after ${sinceDate}; nothing to do`);
  process.exit(0);
}

const heldSymbols = [...new Set(Object.values(ledger.models)
  .flatMap((model) => model.positions || [])
  .map((position) => position.sym))];
const requestedSymbols = [...new Set([...heldSymbols, 'SPY', 'SMH'])];
const outputsize = Math.max(30, tradingDays.length + 10);
let histories;
try {
  histories = new Map(await Promise.all(requestedSymbols.map(async (symbol) => [
    symbol,
    await fetchHistory(baseUrl, symbol, outputsize),
  ])));
} catch (error) {
  fail(`market history fetch failed: ${error.message}`);
}

for (const date of tradingDays) {
  for (const symbol of heldSymbols) {
    if (!Number.isFinite(histories.get(symbol)?.get(date))) fail(`missing ${symbol} close for ${date}`);
  }
}

const seasonStartDate = knownDates.reduce((earliest, date) => (date < earliest ? date : earliest));
for (const symbol of ['SPY', 'SMH']) {
  if (!Number.isFinite(histories.get(symbol)?.get(seasonStartDate))) {
    fail(`missing ${symbol} benchmark baseline for ${seasonStartDate}`);
  }
}

let nextLedger = ledger;
let nextRunlog = runlog;
const daily = new Map();
for (const date of tradingDays) {
  const missing = findMissingRuns(nextRunlog, [date]);
  for (const gap of missing) nextRunlog = upsertRunlogEntry(nextRunlog, buildMissedEntry(gap));

  const before = Object.fromEntries(['S', 'P', 'T'].map((model) => [model, nextLedger.models[model].equity]));
  const summaries = [];
  for (const model of ['S', 'P', 'T']) {
    if (!needsLateMarkToMarket(nextRunlog, model, date, holidays)) continue;
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
      universe,
      benchPct: {
        spyPct: percentChange(histories.get('SPY').get(date), spyStart),
        smhPct: percentChange(histories.get('SMH').get(date), smhStart),
      },
    });
    nextLedger = result.ledger;
    summaries.push(result.summary);
    nextRunlog = upsertRunlogEntry(nextRunlog, {
      date,
      window: 'post-market',
      model,
      status: 'done',
      ordersProposed: 0,
      ordersFilled: result.summary.filled.length,
      note: buildLateMarkToMarketNote(date),
      late: true,
    });
  }
  daily.set(date, { before, summaries });
}

const latest = daily.get(throughDate);
for (const model of ['S', 'P', 'T']) {
  const symbols = (nextLedger.models[model].positions || []).map((position) => position.sym);
  const positionEn = symbols.length ? `Open positions (${symbols.join(', ')}) were marked` : 'The empty book was marked';
  const positionZh = symbols.length ? `现有持仓（${symbols.join('、')}）已完成估值` : '空仓账本已完成核对';
  nextLedger.models[model].review = {
    en: `${positionEn} through the ${throughDate} provider close during late recovery. Missed proposal windows remain missed and no discretionary or hindsight order was added.`,
    zh: `${positionZh}至 ${throughDate} 行情供应商收盘价。错过的提案窗口仍保留为 missed，未新增主观或事后订单。`,
  };
}
const digest = {
  date: throughDate,
  generatedAt: now.toISOString(),
  note_en: `Recovered ${tradingDays.length} missed market session${tradingDays.length === 1 ? '' : 's'} with provider closing prices. Missed proposal windows remain marked missed; no hindsight trades were created.`,
  note_zh: `已使用行情供应商收盘价恢复 ${tradingDays.length} 个漏跑交易日。错过的提案窗口仍标记为 missed，未创建任何事后交易。`,
  books: ['S', 'P', 'T'].map((model) => {
    const current = nextLedger.models[model];
    const summary = latest.summaries.find((item) => item.book === model);
    const fills = summary?.filled?.length || 0;
    return {
      model,
      pnlPct: percentChange(current.equity, latest.before[model]),
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
  delayed: ['S', 'P', 'T'].map((model) => ({
    date: throughDate,
    window: 'post-market',
    model,
    note_en: `Late mark-to-market recovery completed after ${tradingDays.length} missed session(s).`,
    note_zh: `在漏跑 ${tradingDays.length} 个交易日后完成迟到的按市值计价恢复。`,
  })),
};
const nextPredlog = { ...predlog, checkedThrough: throughDate };

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

if (dryRun) {
  try { prepareValidatedCatchUp(); } catch (error) { fail(error.message); }
} else {
  try {
    runAtomicPublishTransaction({
      repoRoot: ROOT,
      pipelineId: 'arena-catch-up',
      prepare: prepareValidatedCatchUp,
      commitMessage: option('message', `data: recover Arena through ${throughDate}`),
      deriveCommand: SITE_GENERATE_COMMAND,
      derivedPaths: SITE_PUBLISH_ARTIFACTS,
    });
  } catch (error) {
    fail(`${error.phase || 'publish'}: ${error.message}`);
  }
}
console.log(JSON.stringify({
  dryRun,
  sinceDate,
  throughDate,
  recoveredSessions: tradingDays,
  heldSymbols,
  ledgerDay: nextLedger.day,
}, null, 2));
