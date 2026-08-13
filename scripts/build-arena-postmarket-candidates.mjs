#!/usr/bin/env node
/* Build the complete arena-postmarket four-file candidate group in one
 * deterministic command. This command never publishes, commits, or pushes.
 *
 * Usage:
 *   node scripts/build-arena-postmarket-candidates.mjs --output=<outside-repo-dir>
 *
 * Fixed flow:
 *   prior-session catch-up -> S valuation-only -> P valuation-only ->
 *   T sealed proposal/zero-order -> reviewer + digest + predlog -> validation.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assessArenaWindow } from '../src/lib/arenaWindowGate.js';
import { isNyseSession } from '../src/lib/marketSession.js';
import {
  finalizeArenaPostmarketCandidates,
  planCurrentTPostmarketSettlement,
} from '../src/lib/arenaPostmarketCandidates.js';
import { validateArenaDigest } from '../src/lib/validateArenaDigest.js';
import { validateArenaLedger } from '../src/lib/validateArenaLedger.js';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';
import { validateArenaPredlog } from '../src/lib/validateArenaPredlog.js';
import { validateArenaRunlog } from '../src/lib/validateArenaRunlog.js';
import { validateArenaSettlementPublication } from '../src/lib/arenaSettlementPublicationContract.js';

const ROOT = resolve(import.meta.dirname, '..');
const TRUSTED_BASE_URL = 'https://feida.au';
const GROUP = Object.freeze({
  ledger: 'arena-ledger.json',
  runlog: 'arena-runlog.json',
  digest: 'arena-daily-digest.json',
  predlog: 'arena-predlog.json',
});
const PUBLIC = Object.fromEntries(Object.entries(GROUP)
  .map(([key, file]) => [key, resolve(ROOT, 'public', file)]));
const PICKS_PATH = resolve(ROOT, 'public/arena-picks.json');
const NEWS_PATH = resolve(ROOT, 'public/arena-news.json');
const UNIVERSE_PATH = resolve(ROOT, 'public/arena-universe.json');
const HOLIDAYS_PATH = resolve(ROOT, 'public/nyse-holidays-2026.json');
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);

function fail(message) {
  console.error(`[arena-postmarket-candidates] ERROR: ${message}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function previousSession(date, extraHolidays) {
  const cursor = new Date(`${date}T12:00:00.000Z`);
  for (let guard = 0; guard < 10; guard += 1) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const candidate = cursor.toISOString().slice(0, 10);
    if (isNyseSession(candidate, extraHolidays)) return candidate;
  }
  throw new Error(`could not resolve NYSE session preceding ${date}`);
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [resolve(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${script} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

function writeRunInput(directory, name, data) {
  const path = resolve(directory, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}

function requestId(response) {
  return String(response?.headers?.get?.('X-Request-Id') || response?.headers?.get?.('x-request-id') || '').trim();
}

export function planHistoryRequestBatches(symbols, {
  requestsAlreadyUsed = 0,
  maxRequestsPerBatch = 18,
} = {}) {
  if (!Array.isArray(symbols) || !Number.isInteger(requestsAlreadyUsed)
      || requestsAlreadyUsed < 0 || requestsAlreadyUsed > maxRequestsPerBatch
      || !Number.isInteger(maxRequestsPerBatch) || maxRequestsPerBatch < 1) {
    throw new TypeError('invalid history request budget');
  }
  const batches = [];
  let index = 0;
  let remaining = maxRequestsPerBatch - requestsAlreadyUsed;
  if (symbols.length && remaining === 0) remaining = maxRequestsPerBatch;
  while (index < symbols.length) {
    const count = Math.min(remaining, symbols.length - index);
    batches.push({
      waitBefore: index === 0 ? requestsAlreadyUsed === maxRequestsPerBatch : true,
      symbols: symbols.slice(index, index + count),
    });
    index += count;
    remaining = maxRequestsPerBatch;
  }
  return batches;
}

async function fetchPredictionActual(symbol, sessionDate) {
  const url = new URL('/api/history', TRUSTED_BASE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', '1day');
  url.searchParams.set('outputsize', '10');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  timer.unref?.();
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.status !== 'ok' || !Array.isArray(payload.values)) throw new Error('invalid history schema');
    const row = payload.values.find((entry) => String(entry?.datetime || '').slice(0, 10) === sessionDate);
    const open = Number(row?.open);
    const close = Number(row?.close);
    if (!(Number.isFinite(open) && open > 0 && Number.isFinite(close) && close > 0)) {
      throw new Error(`missing positive ${sessionDate} open/close`);
    }
    const id = requestId(response);
    if (!id) throw new Error('missing X-Request-Id');
    return {
      actual: { open, close },
      evidence: {
        sourceUrl: url.href,
        requestId: id,
        observedAt: new Date().toISOString(),
        session: sessionDate,
        open,
        close,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPredictionActuals(news, sessionDate, {
  requestsAlreadyUsed = 0,
  maxRequestsPerBatch = 18,
} = {}) {
  if (news?.date !== sessionDate) return { actuals: {}, evidence: {} };
  const symbols = Object.keys(news.aiPredictions || {}).sort();
  const settled = [];
  for (const batch of planHistoryRequestBatches(symbols, { requestsAlreadyUsed, maxRequestsPerBatch })) {
    if (batch.waitBefore) await new Promise((resolveDelay) => setTimeout(resolveDelay, 61_000));
    settled.push(...await Promise.allSettled(batch.symbols.map(async (symbol) => [
      symbol,
      await fetchPredictionActual(symbol, sessionDate),
    ])));
  }
  const actuals = {};
  const evidence = {};
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const symbol = symbols[index];
    if (result.status === 'fulfilled') {
      actuals[symbol] = result.value[1].actual;
      evidence[symbol] = result.value[1].evidence;
    } else {
      evidence[symbol] = { error: result.reason?.message || 'history fetch failed' };
    }
  }
  return { actuals, evidence };
}

async function main() {
  const outputValue = option('output');
  if (!outputValue) fail('usage: build-arena-postmarket-candidates.mjs --output=<outside-repo-dir>');
  const outputDirectory = resolve(outputValue);
  if (!relative(ROOT, outputDirectory).startsWith('..')) fail('--output must be outside the repository');
  if (existsSync(outputDirectory) && readdirSync(outputDirectory).length > 0) fail('--output must be absent or empty');

  const initialNow = new Date();
  const initialGate = assessArenaWindow('postmarket', initialNow);
  if (!initialGate.session || !initialGate.due) fail(`real New York post-market window is not due (${initialGate.reason})`);
  const sessionDate = initialGate.date;
  const holidays = (readJson(HOLIDAYS_PATH).holidays || []).map((holiday) => holiday.date);
  const catchupThrough = previousSession(sessionDate, holidays);
  const baselineLedger = readJson(PUBLIC.ledger);
  const baselineRunlog = readJson(PUBLIC.runlog);
  const picks = readJson(PICKS_PATH);
  const news = readJson(NEWS_PATH);
  const universe = (readJson(UNIVERSE_PATH).symbols || []).map((entry) => entry.sym);
  const picksValidation = validateArenaPicks(picks);
  if (!picksValidation.ok) fail(`arena-picks.json: ${picksValidation.errors.join('; ')}`);
  const currentDecisionAvailable = picks.date === sessionDate
    && picks.decisionStatus === 'sealed'
    && picks.executable === true;

  const staging = mkdtempSync(resolve(tmpdir(), 'afflatus-arena-postmarket-'));
  const work = mkdtempSync(resolve(tmpdir(), 'afflatus-arena-postmarket-inputs-'));
  let orchestrationError = null;
  try {
  for (const [key, filename] of Object.entries(GROUP)) copyFileSync(PUBLIC[key], resolve(staging, filename));

  const catchupReport = JSON.parse(runNode('catch-up-arena.mjs', [
    `--through=${catchupThrough}`,
    `--output=${staging}`,
  ]));
  const beforeCurrentLedger = readJson(resolve(staging, GROUP.ledger));

  for (const model of ['S', 'P']) {
    const input = writeRunInput(work, `${model}-valuation`, {
      book: model,
      window: 'post-market',
      etDateStr: sessionDate,
      proposedOrders: [],
      valuationOnly: true,
      reviewEn: `Current-session ${sessionDate} post-market valuation completed with trusted quote evidence; no order or retroactive risk exit was permitted.`,
      reviewZh: `${sessionDate} 当日盘后已使用可信行情证据完成估值；不允许订单或事后风险退出。`,
    });
    runNode('apply-arena-run.mjs', [input, `--output=${staging}`]);
  }

  const tPlan = planCurrentTPostmarketSettlement(picks, sessionDate, new Date().toISOString());
  const tIntents = tPlan.proposedOrders;
  const tInput = writeRunInput(work, 'T-settlement', {
    ...tPlan,
    reviewEn: tIntents.length
      ? `${tIntents.length} eligible sealed pre-market T proposal(s) were mechanically evaluated in the real post-market window.`
      : currentDecisionAvailable
        ? 'No eligible sealed T proposal existed; a truthful zero-order post-market completion was recorded.'
        : 'The pre-market decision window was missed; T was valued with zero orders and its proposal identity remains missed.',
    reviewZh: tIntents.length
      ? `在真实盘后窗口机械评估了 ${tIntents.length} 个有效的盘前封存 T 提案。`
      : currentDecisionAvailable
        ? '没有有效的盘前封存 T 提案；已如实记录零订单盘后完成。'
        : '盘前决策窗口已错过；T 仅完成零订单估值，提案身份保持 missed。',
  });
  runNode('apply-arena-run.mjs', [tInput, `--output=${staging}`]);

  const finalGateNow = new Date();
  const finalGate = assessArenaWindow('postmarket', finalGateNow);
  if (!finalGate.due || finalGate.date !== sessionDate) {
    throw new Error(`post-market window closed before group finalization (${finalGate.reason})`);
  }
  const { actuals, evidence } = await fetchPredictionActuals(news, sessionDate, {
    requestsAlreadyUsed: catchupReport.historyRequestsInLastBatch || 0,
  });
  const group = finalizeArenaPostmarketCandidates({
    beforeLedger: beforeCurrentLedger,
    settledLedger: readJson(resolve(staging, GROUP.ledger)),
    settledRunlog: readJson(resolve(staging, GROUP.runlog)),
    predlog: readJson(resolve(staging, GROUP.predlog)),
    news,
    picks,
    sessionDate,
    nowIso: finalGateNow.toISOString(),
    actuals,
    predictionEvidence: evidence,
  });

  const validations = [
    [GROUP.ledger, validateArenaLedger(group.ledger)],
    [GROUP.runlog, validateArenaRunlog(group.runlog)],
    [GROUP.digest, validateArenaDigest(group.digest)],
    [GROUP.predlog, validateArenaPredlog(group.predlog)],
    ['Arena settlement delta', validateArenaSettlementPublication({
      baselineLedger,
      baselineRunlog,
      candidateLedger: group.ledger,
      candidateRunlog: group.runlog,
      publishedPicks: picks,
      publishedNews: news,
      universe,
      baselinePredlog: readJson(PUBLIC.predlog),
      candidatePredlog: group.predlog,
      pipelineId: 'arena-postmarket',
      now: finalGateNow,
    })],
  ];
  for (const [label, validation] of validations) {
    if (!validation.ok) throw new Error(`${label}: ${validation.errors.join('; ')}`);
  }

  const byKey = {
    ledger: group.ledger,
    runlog: group.runlog,
    digest: group.digest,
    predlog: group.predlog,
  };
  mkdirSync(outputDirectory, { recursive: true });
  for (const [key, filename] of Object.entries(GROUP)) {
    writeFileSync(resolve(outputDirectory, filename), `${JSON.stringify(byKey[key], null, 2)}\n`);
  }
  console.log(JSON.stringify({
    candidateOnly: true,
    pipelineId: 'arena-postmarket',
    sessionDate,
    catchupThrough,
    tProposalsEvaluated: tIntents.length,
    predictionActuals: Object.keys(actuals).length,
    outputs: Object.values(GROUP).map((file) => resolve(outputDirectory, file)),
  }, null, 2));
  } catch (error) {
    orchestrationError = error;
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
  if (orchestrationError) fail(orchestrationError.message);
}

if (isMain) await main();
