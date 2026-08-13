/* ============================================================
   ARENA OPEN/LATE COMPLETE CANDIDATE PLANNING

   Pure orchestration for the two S/P execution groups. File I/O, live quote
   fetching and the second wall-clock gate remain in their existing CLIs;
   this module decides whether each book may consume the published sealed
   snapshot or must leave an honest missed decision identity.
   ============================================================ */
import { newYorkTimestampParts } from './arenaDecisionProvenance.js';
import { consumedArenaProposalIdsFromLedger } from './arenaExecution.js';
import { assessArenaWindow } from './arenaWindowGate.js';
import { isNyseSession } from './marketSession.js';

export const ARENA_INTRADAY_CANDIDATE_WINDOWS = Object.freeze({
  open: 'open-window',
  late: 'late-window',
});

const MODELS = Object.freeze(['S', 'P']);
const TERMINAL = new Set(['done', 'missed']);

function runKey(date, runlogWindow, model) {
  return `${date}|${runlogWindow}|${model}`;
}

function findRun(runlog, date, runlogWindow, model) {
  const key = runKey(date, runlogWindow, model);
  return (Array.isArray(runlog?.runs) ? runlog.runs : [])
    .find((run) => runKey(run?.date, run?.window, run?.model) === key);
}

function hasPremarketWitness(runlog, sessionDate) {
  const runs = Array.isArray(runlog?.runs) ? runlog.runs : [];
  return [
    ['pre-market-gather', 'done'],
    ['picks-publish', 'done'],
  ].every(([window, status]) => runs.some((run) => (
    run.date === sessionDate
    && run.window === window
    && run.model === 'gatherer'
    && run.status === status
  )));
}

function assertCurrentWindow(windowName, sessionDate, nowIso) {
  const runlogWindow = ARENA_INTRADAY_CANDIDATE_WINDOWS[windowName];
  if (!runlogWindow) throw new Error('window must be open or late');
  const timestamp = newYorkTimestampParts(nowIso);
  if (!timestamp || timestamp.date !== sessionDate) {
    throw new Error('candidate planning requires the real current New York session');
  }
  const gate = assessArenaWindow(windowName, new Date(timestamp.timestamp));
  if (!gate.session || !gate.due || gate.date !== sessionDate) {
    throw new Error(`real New York ${windowName} window is not due (${gate.reason})`);
  }
  return { runlogWindow, timestamp };
}

function currentDecisionAvailable(picks, runlog, sessionDate) {
  return picks?.date === sessionDate
    && picks?.decisionStatus === 'sealed'
    && picks?.executable === true
    && hasPremarketWitness(runlog, sessionDate);
}

function previousNyseSession(sessionDate) {
  const cursor = new Date(`${sessionDate}T12:00:00Z`);
  for (let guard = 0; guard < 10; guard += 1) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const candidate = cursor.toISOString().slice(0, 10);
    if (isNyseSession(candidate)) return candidate;
  }
  throw new Error(`could not resolve the NYSE session before ${sessionDate}`);
}

export function assertPriorArenaValuationsComplete(ledger, sessionDate) {
  const priorSession = previousNyseSession(sessionDate);
  const staleBooks = ['S', 'P', 'T'].filter((model) => (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(ledger?.models?.[model]?.lastValuationDate || ''))
      || ledger.models[model].lastValuationDate < priorSession
  ));
  if (staleBooks.length) {
    throw new Error(
      `prior-session catch-up is incomplete through ${priorSession} for ${staleBooks.join('/')}; `
      + 'refusing to advance current-session execution state before historical valuation recovery',
    );
  }
  return priorSession;
}

export function selectArenaWindowProposalIntents({
  picks,
  ledger,
  runlog,
  model,
  window,
  sessionDate,
  nowIso,
} = {}) {
  if (!MODELS.includes(model)) throw new Error('model must be S or P');
  const { runlogWindow, timestamp } = assertCurrentWindow(window, sessionDate, nowIso);
  if (!currentDecisionAvailable(picks, runlog, sessionDate)) return [];
  const consumed = new Set(consumedArenaProposalIdsFromLedger(ledger));
  const intents = [];
  for (const [index, pick] of (picks?.models?.[model] || []).entries()) {
    if (pick?.sessionDate !== sessionDate) continue;
    if (!pick.allowedExecutionWindows?.includes(runlogWindow)) continue;
    const decided = newYorkTimestampParts(pick.decidedAt);
    const expires = newYorkTimestampParts(pick.expiresAt);
    if (!decided || !expires || timestamp.timestamp < decided.timestamp || timestamp.timestamp > expires.timestamp) continue;
    if (typeof pick.proposalId !== 'string' || !pick.proposalId) {
      throw new Error(`models.${model}[${index}] is eligible but has no proposalId`);
    }
    if (!consumed.has(pick.proposalId)) intents.push({ proposalId: pick.proposalId });
  }
  return intents;
}

export function planArenaWindowModel({
  picks,
  ledger,
  runlog,
  model,
  window,
  sessionDate,
  nowIso,
} = {}) {
  if (!MODELS.includes(model)) throw new Error('model must be S or P');
  const { runlogWindow } = assertCurrentWindow(window, sessionDate, nowIso);
  const existing = findRun(runlog, sessionDate, runlogWindow, model);
  if (existing && TERMINAL.has(existing.status)) {
    return { action: 'preserve', model, window: runlogWindow, existingStatus: existing.status };
  }
  if (existing && existing.status !== 'queued') {
    throw new Error(`run identity ${runKey(sessionDate, runlogWindow, model)} has unsupported status ${JSON.stringify(existing.status)}`);
  }
  if (!currentDecisionAvailable(picks, runlog, sessionDate)) {
    return {
      action: 'miss',
      model,
      window: runlogWindow,
      proposedOrders: [],
      reason: 'No same-session sealed executable pre-market decision with completed gather/publish witnesses exists.',
    };
  }
  return {
    action: 'settle',
    model,
    window: runlogWindow,
    proposedOrders: selectArenaWindowProposalIntents({
      picks, ledger, runlog, model, window, sessionDate, nowIso,
    }),
  };
}

export function recordMissedArenaWindow(runlog, {
  model,
  window,
  sessionDate,
  nowIso,
  reason,
} = {}) {
  if (!MODELS.includes(model)) throw new Error('model must be S or P');
  if (!Object.values(ARENA_INTRADAY_CANDIDATE_WINDOWS).includes(window)) {
    throw new Error('runlog window must be open-window or late-window');
  }
  const runs = Array.isArray(runlog?.runs) ? runlog.runs : [];
  const identity = runKey(sessionDate, window, model);
  const index = runs.findIndex((run) => runKey(run?.date, run?.window, run?.model) === identity);
  const existing = index >= 0 ? runs[index] : null;
  if (existing && TERMINAL.has(existing.status)) throw new Error(`run identity ${identity} is already terminal`);
  if (existing && existing.status !== 'queued') throw new Error(`run identity ${identity} has unsupported status`);
  const entry = {
    date: sessionDate,
    window,
    model,
    status: 'missed',
    ordersProposed: 0,
    ordersFilled: 0,
    ordersSkipped: 0,
    proposalIds: [],
    skippedProposals: [],
    decisionMissed: true,
    note: `${reason} No discretionary or retrospective trade was created.`,
    ...(existing ? {
      queuedAudit: {
        ordersProposed: Number.isInteger(existing.ordersProposed) ? existing.ordersProposed : 0,
        proposalIds: Array.isArray(existing.proposalIds) ? [...existing.proposalIds] : [],
        note: typeof existing.note === 'string' ? existing.note : '',
      },
    } : {}),
    recordedAt: nowIso,
  };
  const nextRuns = runs.slice();
  if (index >= 0) nextRuns[index] = entry;
  else nextRuns.push(entry);
  return { ...runlog, runs: nextRuns };
}

/**
 * Build one complete S/P candidate group. `settle` is an injected boundary
 * that must invoke the existing live execution CLI and return its accumulated
 * ledger/runlog candidates. It is intentionally called serially.
 */
export async function buildArenaWindowCandidates({
  baselineLedger,
  baselineRunlog,
  picks,
  window,
  sessionDate,
  now = () => new Date(),
  settle,
} = {}) {
  if (typeof settle !== 'function') throw new Error('settle callback is required');
  assertPriorArenaValuationsComplete(baselineLedger, sessionDate);
  let ledger = structuredClone(baselineLedger);
  let runlog = structuredClone(baselineRunlog);
  const results = [];

  for (const model of MODELS) {
    const wall = now();
    const wallDate = wall instanceof Date ? wall : new Date(wall);
    if (Number.isNaN(wallDate.getTime())) throw new Error('real wall clock is invalid');
    const plan = planArenaWindowModel({
      picks,
      ledger,
      runlog,
      model,
      window,
      sessionDate,
      nowIso: wallDate.toISOString(),
    });
    if (plan.action === 'settle') {
      const settled = await settle({
        ledger,
        runlog,
        input: {
          book: model,
          window: plan.window,
          etDateStr: sessionDate,
          proposedOrders: plan.proposedOrders,
          reviewEn: `${model} mechanically evaluated the same-session sealed pre-market decision in the real ${plan.window}.`,
          reviewZh: `${model} 已在真实 ${plan.window} 窗口机械评估当日盘前封存决策。`,
        },
      });
      if (!settled?.ledger || !settled?.runlog) throw new Error(`settle callback returned an incomplete ${model} candidate`);
      ledger = settled.ledger;
      runlog = settled.runlog;
    } else if (plan.action === 'miss') {
      const settled = await settle({
        ledger,
        runlog,
        input: {
          book: model,
          window: plan.window,
          etDateStr: sessionDate,
          proposedOrders: [],
          valuationOnly: true,
          decisionMissed: true,
          note: `${plan.reason} No discretionary or retrospective trade was created.`,
          reviewEn: `${model} received no witnessed same-session pre-market decision; the real window recorded valuation only and no trade.`,
          reviewZh: `${model} 未收到有见证的当日盘前决策；真实窗口仅记录估值，未成交。`,
        },
      });
      if (!settled?.ledger || !settled?.runlog) throw new Error(`settle callback returned an incomplete missed ${model} candidate`);
      ledger = settled.ledger;
      runlog = settled.runlog;
    }
    results.push(plan);
  }

  const changed = results.some((result) => result.action !== 'preserve');
  return { ledger, runlog, results, noOp: !changed };
}
