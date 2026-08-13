import { newYorkTimestampParts } from './arenaDecisionProvenance.js';
import {
  ARENA_MODEL_EXECUTION_WINDOWS,
  validateArenaExecutionQuoteReceipt,
} from './arenaExecution.js';
import {
  LIMITS,
  checkDailyCircuitBreaker,
  computeMetrics,
  simulateFill,
  validateOrder,
} from './arenaRules.js';
import { easternTimeParts, isNyseSession } from './marketSession.js';
import { buildPredlogDay } from './predlogEntry.js';
import { arenaExecutionWindowName, assessArenaWindow, isEarlyCloseSession } from './arenaWindowGate.js';

export { ARENA_MODEL_EXECUTION_WINDOWS };

const BOOKS = Object.freeze(Object.keys(ARENA_MODEL_EXECUTION_WINDOWS));
const APPEND_ONLY_HISTORY_FIELDS = Object.freeze(['trades', 'rejections']);
const TERMINAL_STATUSES = new Set(['done', 'missed']);
const RECEIPT_FIELDS = Object.freeze(['proposalId', 'decisionHash', 'sourceHash', 'decidedAt']);
const EXECUTION_TYPES = new Set(['proposal', 'stop-loss', 'exitBy']);
const WINDOW_ORDER = Object.freeze({ 'open-window': 1, 'late-window': 2, 'post-market': 3 });

function runKey(run) {
  return `${run?.date}|${run?.window}|${run?.model}`;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
}

function indexRuns(runs, label, errors) {
  const index = new Map();
  for (const [position, run] of runs.entries()) {
    const key = runKey(run);
    if (index.has(key)) errors.push(`${label}.runs[${position}]: duplicate run identity ${key}`);
    else index.set(key, run);
  }
  return index;
}

function executionWindowAllowed(model, window) {
  return ARENA_MODEL_EXECUTION_WINDOWS[model]?.includes(window) === true;
}

function executionClockState(run, now) {
  let windowName;
  try {
    windowName = arenaExecutionWindowName(run.window);
  } catch {
    return 'invalid';
  }
  const assessment = assessArenaWindow(windowName, now);
  if (assessment.date > run.date) return 'expired';
  if (assessment.date < run.date) return 'pending';
  if (assessment.due) return 'due';
  if (assessment.reason === 'after-window' || assessment.reason === 'not-nyse-session') return 'expired';
  return 'pending';
}

function pipelineOwnsRun(pipelineId, run) {
  if (pipelineId === 'arena-open') return run?.window === 'open-window' && ['S', 'P'].includes(run?.model);
  if (pipelineId === 'arena-late') return run?.window === 'late-window' && ['S', 'P'].includes(run?.model);
  if (pipelineId === 'arena-postmarket') return run?.window === 'post-market';
  return false;
}

function hasPremarketExecutionWitness(baselineRuns, run) {
  return ['pre-market-gather', 'picks-publish'].every((window) => baselineRuns.some((entry) => (
    entry.date === run.date
    && entry.window === window
    && entry.model === 'gatherer'
    && entry.status === 'done'
  )));
}

function hasExecutableSnapshot(publishedPicks, baselineRuns, run) {
  return publishedPicks?.date === run?.date
    && publishedPicks?.executable !== false
    && publishedPicks?.decisionStatus !== 'missed'
    && Array.isArray(publishedPicks?.models?.[run?.model])
    && hasPremarketExecutionWitness(baselineRuns, run);
}

function isCurrentMissedDecision(run, publishedPicks, baselineRuns, now) {
  return BOOKS.includes(run?.model)
    && run?.decisionMissed === true
    && run?.status === 'missed'
    && Number(run?.ordersProposed || 0) === 0
    && Number(run?.ordersFilled || 0) === 0
    && executionClockState(run, now) === 'due'
    && !hasExecutableSnapshot(publishedPicks, baselineRuns, run);
}

function isRecoveryRun(run) {
  return run?.late === true || run?.valuationRecovered === true;
}

function isChangedRun(run, baselineIndex) {
  const baseline = baselineIndex.get(runKey(run));
  return !baseline || !deepEqual(baseline, run);
}

function sameExcept(left, right, allowedDifferences) {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  for (const key of keys) {
    if (!allowedDifferences.has(key) && !deepEqual(left?.[key], right?.[key])) return false;
  }
  return true;
}

function isPriorRecovery(run, pipelineId, now) {
  const nowEt = easternTimeParts(now);
  return pipelineId === 'arena-postmarket'
    && run?.window === 'post-market'
    && typeof run?.date === 'string'
    && run.date < nowEt.date;
}

function controlledTerminalMigration(baseline, candidate, { pipelineId, now }) {
  if (!baseline || !candidate) return null;
  if (!isPriorRecovery(candidate, pipelineId, now)) return null;
  const auditFields = new Set([
    'status', 'ordersFilled', 'note', 'late', 'valuationRecovered', 'valuationOrdersFilled', 'historyReceipts',
  ]);

  if (
    baseline.model === 'T'
    && baseline.window === 'post-market'
    && baseline.status === 'done'
    && baseline.late === true
    && baseline.valuationRecovered !== true
    && candidate.status === 'missed'
    && candidate.late === true
    && candidate.valuationRecovered === true
    && candidate.ordersProposed === baseline.ordersProposed
    && candidate.ordersFilled === 0
    && candidate.valuationOrdersFilled === (Number.isInteger(baseline.ordersFilled) ? baseline.ordersFilled : 0)
    && sameExcept(baseline, candidate, auditFields)
  ) return 'legacy-late-t';

  if (
    baseline.model === 'T'
    && baseline.window === 'post-market'
    && baseline.status === 'missed'
    && baseline.valuationRecovered !== true
    && candidate.status === 'missed'
    && candidate.late === true
    && candidate.valuationRecovered === true
    && candidate.ordersProposed === baseline.ordersProposed
    && candidate.ordersFilled === 0
    && deepEqual(candidate.proposalIds || [], baseline.proposalIds || [])
    && sameExcept(baseline, candidate, auditFields)
  ) return 'missed-t-valuation';

  if (
    baseline.model === 'reviewer'
    && baseline.window === 'post-market'
    && baseline.status === 'missed'
    && candidate.status === 'done'
    && candidate.late === true
    && Number(candidate.ordersProposed || 0) === 0
    && Number(candidate.ordersFilled || 0) === 0
    && sameExcept(baseline, candidate, new Set(['status', 'note', 'late']))
  ) return 'late-review';

  return null;
}

function validateAppendOnlyPrefix(baselineHistory, candidateHistory, tag, errors) {
  if (!Array.isArray(baselineHistory) || !Array.isArray(candidateHistory)) {
    errors.push(`${tag}: baseline and candidate must be arrays`);
    return;
  }
  if (candidateHistory.length < baselineHistory.length) {
    errors.push(`${tag}: candidate deleted historical entries`);
    return;
  }
  for (let index = 0; index < baselineHistory.length; index += 1) {
    if (!deepEqual(baselineHistory[index], candidateHistory[index])) {
      errors.push(`${tag}[${index}]: historical prefix was modified`);
      break;
    }
  }
}

function validateEquityHistory({ baselineLedger, candidateLedger, model, errors }) {
  const baseline = baselineLedger?.models?.[model]?.equityHistory;
  const candidate = candidateLedger?.models?.[model]?.equityHistory;
  const tag = `ledger.models.${model}.equityHistory`;
  if (!Array.isArray(baseline) || !Array.isArray(candidate)) {
    errors.push(`${tag}: baseline and candidate must be arrays`);
    return;
  }
  if (candidate.length < baseline.length) {
    errors.push(`${tag}: candidate deleted historical entries`);
    return;
  }

  const mayUpdateCurrentTail = baseline.length > 0
    && baselineLedger?.day === candidateLedger?.day
    && baseline.at(-1)?.day === baselineLedger?.day
    && candidate[baseline.length - 1]?.day === candidateLedger?.day;
  for (let index = 0; index < baseline.length; index += 1) {
    if (deepEqual(baseline[index], candidate[index])) continue;
    if (
      mayUpdateCurrentTail
      && index === baseline.length - 1
      && baseline[index]?.day === candidate[index]?.day
      && Object.keys(baseline[index] || {}).every((field) => field === 'equity' || deepEqual(baseline[index][field], candidate[index][field]))
      && Object.keys(candidate[index] || {}).every((field) => field === 'equity' || deepEqual(baseline[index]?.[field], candidate[index][field]))
    ) continue;
    errors.push(`${tag}[${index}]: historical point was modified outside the current ledger day tail`);
    break;
  }

  let previousDay = -Infinity;
  for (const [index, point] of candidate.entries()) {
    if (!Number.isInteger(point?.day) || point.day < previousDay) {
      errors.push(`${tag}[${index}]: day must be a non-decreasing integer`);
      break;
    }
    previousDay = point.day;
  }
  if (candidate.length && candidate.at(-1)?.equity !== candidateLedger?.models?.[model]?.equity) {
    errors.push(`${tag}: final point must equal the candidate book equity`);
  }
}

function validateHistoryPrefixes(baselineLedger, candidateLedger, errors) {
  const additions = [];
  for (const model of BOOKS) {
    const baselineBook = baselineLedger?.models?.[model];
    const candidateBook = candidateLedger?.models?.[model];
    if (!baselineBook || !candidateBook) {
      errors.push(`ledger.models.${model}: missing from baseline or candidate`);
      continue;
    }
    for (const field of APPEND_ONLY_HISTORY_FIELDS) {
      validateAppendOnlyPrefix(
        baselineBook[field], candidateBook[field], `ledger.models.${model}.${field}`, errors,
      );
    }
    validateEquityHistory({ baselineLedger, candidateLedger, model, errors });
    if (Array.isArray(baselineBook.trades) && Array.isArray(candidateBook.trades)) {
      for (let index = baselineBook.trades.length; index < candidateBook.trades.length; index += 1) {
        additions.push({ model, trade: candidateBook.trades[index], index });
      }
    }
  }
  return additions;
}

function validateRunTransitions({
  baselineRuns, candidateRuns, baselineIndex, candidateIndex, publishedPicks, pipelineId, now, errors,
}) {
  for (const baseline of baselineRuns) {
    const key = runKey(baseline);
    const candidate = candidateIndex.get(key);
    if (!candidate) {
      errors.push(`runlog ${key}: candidate deleted a baseline entry`);
      continue;
    }
    if (TERMINAL_STATUSES.has(baseline.status)) {
      if (!deepEqual(baseline, candidate) && !controlledTerminalMigration(baseline, candidate, { pipelineId, now })) {
        errors.push(`runlog ${key}: terminal ${baseline.status} entry is immutable`);
      }
      continue;
    }
    if (baseline.status !== 'queued') {
      errors.push(`runlog ${key}: unsupported baseline status ${JSON.stringify(baseline.status)}`);
      continue;
    }

    if (!pipelineOwnsRun(pipelineId, baseline) && deepEqual(baseline, candidate)) continue;

    const state = executionClockState(baseline, now);
    if (candidate.status === 'queued') {
      if (!deepEqual(baseline, candidate)) errors.push(`runlog ${key}: queued entry changed without a terminal transition`);
      if (state === 'expired') errors.push(`runlog ${key}: expired queued entry must transition to missed`);
    } else if (candidate.status === 'done') {
      if (state !== 'due') errors.push(`runlog ${key}: queued may transition to done only inside its real matching window`);
      if (isRecoveryRun(candidate)) errors.push(`runlog ${key}: queued real-time settlement cannot be marked late/recovered`);
    } else if (candidate.status === 'missed') {
      if (state !== 'expired' && !isCurrentMissedDecision(candidate, publishedPicks, baselineRuns, now)) {
        errors.push(`runlog ${key}: queued may transition to missed only after expiry or a witnessed absent decision`);
      }
    } else {
      errors.push(`runlog ${key}: queued entry has invalid transition to ${JSON.stringify(candidate.status)}`);
    }
  }

  for (const candidate of candidateRuns) {
    if (baselineIndex.has(runKey(candidate))) continue;
    if (!BOOKS.includes(candidate.model)) continue;
    if (!pipelineOwnsRun(pipelineId, candidate)) continue;
    const key = runKey(candidate);
    const recovery = isRecoveryRun(candidate);
    const currentMissedDecisionValuation = isCurrentMissedDecision(candidate, publishedPicks, baselineRuns, now);
    const state = executionClockState(candidate, now);
    if (candidate.status === 'done' && !recovery && state !== 'due') {
      errors.push(`runlog ${key}: new done entry is outside its real matching window`);
    }
    if (candidate.status === 'missed' && state !== 'expired' && !currentMissedDecisionValuation) {
      errors.push(`runlog ${key}: new missed entry was recorded before the window expired`);
    }
    if (candidate.status === 'queued' && state === 'expired') {
      errors.push(`runlog ${key}: new queued entry is already expired`);
    }
  }
}

function validateChangedRunSemantics(candidateRuns, baselineRuns, baselineIndex, publishedPicks, { pipelineId, now }, errors) {
  for (const run of candidateRuns) {
    if (!BOOKS.includes(run.model) || !isChangedRun(run, baselineIndex)) continue;
    const key = runKey(run);
    const recovery = isRecoveryRun(run);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(run.date || '')) || !isNyseSession(run.date)) {
      errors.push(`runlog ${key}: changed execution/valuation date is not an NYSE session`);
    }
    if (!pipelineOwnsRun(pipelineId, run)) {
      errors.push(`runlog ${key}: changed run is outside ${pipelineId}'s owned execution window`);
      continue;
    }
    const valuationOnly = run.valuationOnly === true;
    const currentMissed = isCurrentMissedDecision(run, publishedPicks, baselineRuns, now);
    const currentValuation = executionClockState(run, now) === 'due'
      && valuationOnly
      && ((pipelineId === 'arena-postmarket' && run.window === 'post-market'
        && ((['S', 'P'].includes(run.model) && run.status === 'done')
          || (run.model === 'T' && currentMissed)))
        || (['arena-open', 'arena-late'].includes(pipelineId)
          && ['S', 'P'].includes(run.model)
          && currentMissed));
    if (recovery && !isPriorRecovery(run, pipelineId, now)) {
      errors.push(`runlog ${key}: late/valuationRecovered is allowed only for a prior session in arena-postmarket`);
    }
    if (valuationOnly && !currentValuation) {
      errors.push(`runlog ${key}: valuationOnly is limited to a witnessed current-session valuation or missed decision`);
    }
    if (!executionWindowAllowed(run.model, run.window) && !recovery && !currentValuation) {
      errors.push(`runlog ${key}: model/window violates S/P=open|late, T=post matrix`);
    }
    if (run.status !== 'done' && Number(run.ordersFilled || 0) !== 0) {
      errors.push(`runlog ${key}: non-done entry cannot report filled orders`);
    }
    if (recovery && Number(run.ordersFilled || 0) !== 0) {
      errors.push(`runlog ${key}: late/valuationRecovered entry cannot report new fills`);
    }
    const terminalMigration = controlledTerminalMigration(baselineIndex.get(key), run, { pipelineId, now });
    if ((currentValuation || (recovery && !terminalMigration)) && (
      Number(run.ordersProposed || 0) !== 0
      || Number(run.ordersFilled || 0) !== 0
      || (Array.isArray(run.proposalIds) && run.proposalIds.length > 0)
    )) {
      errors.push(`runlog ${key}: new valuation/recovery entries must contain zero proposals and fills`);
    }
    const proposalIds = Array.isArray(run.proposalIds) ? run.proposalIds : [];
    if (run.status === 'done' && !recovery && !currentValuation) {
      if (!Number.isInteger(run.ordersProposed) || run.ordersProposed !== proposalIds.length) {
        errors.push(`runlog ${key}: ordersProposed must equal the explicit proposalIds count`);
      }
      if (new Set(proposalIds).size !== proposalIds.length) {
        errors.push(`runlog ${key}: proposalIds must be unique within a run`);
      }
    }
  }
}

function buildPickIndex(publishedPicks, errors) {
  const byModel = new Map();
  for (const model of BOOKS) {
    const index = new Map();
    const picks = publishedPicks?.models?.[model];
    if (!Array.isArray(picks)) {
      errors.push(`published picks: missing model ${model}`);
      byModel.set(model, index);
      continue;
    }
    for (const pick of picks) {
      if (index.has(pick?.proposalId)) errors.push(`published picks: duplicate proposal ${pick?.proposalId} in model ${model}`);
      else index.set(pick?.proposalId, pick);
    }
    byModel.set(model, index);
  }
  return byModel;
}

function validateLiveQuoteReceipt(receipt, { symbol, run, executedAt }, errors, tag) {
  const validation = validateArenaExecutionQuoteReceipt(receipt, {
    symbol,
    refPx: receipt?.refPx,
    executedAt: executedAt || receipt?.observedAt,
  });
  if (!validation.ok) {
    errors.push(`${tag}: ${validation.error}`);
    return false;
  }
  const observed = newYorkTimestampParts(receipt.observedAt);
  const provider = newYorkTimestampParts(receipt.providerTimestamp);
  if (!observed || observed.date !== run.date) {
    errors.push(`${tag}: observation must be in the run's New York session`);
    return false;
  }
  const gate = assessArenaWindow(arenaExecutionWindowName(run.window), new Date(observed.timestamp));
  if (!gate.due || gate.date !== run.date) {
    errors.push(`${tag}: observation is outside the run's execution/valuation window`);
    return false;
  }
  if (!provider) {
    errors.push(`${tag}: providerTimestamp is invalid`);
    return false;
  }
  if (run.window === 'post-market') {
    const closeMinutes = isEarlyCloseSession(run.date) ? 13 * 60 : 16 * 60;
    if (provider.date !== run.date || provider.minutes < closeMinutes - 5) {
      errors.push(`${tag}: postmarket provider print is not from the current session close`);
      return false;
    }
  } else if (observed.timestamp - provider.timestamp > 5 * 60 * 1000) {
    errors.push(`${tag}: open/late provider quote is older than five minutes`);
    return false;
  }
  return true;
}

function validateRunQuoteReceipts(candidateRuns, baselineIndex, errors) {
  for (const run of candidateRuns) {
    if (!BOOKS.includes(run.model) || !isChangedRun(run, baselineIndex) || isRecoveryRun(run)) continue;
    if (run.status !== 'done' && run.valuationOnly !== true) continue;
    const receipts = run.quoteReceipts;
    if (!receipts || typeof receipts !== 'object' || Array.isArray(receipts)) {
      errors.push(`runlog ${runKey(run)}: current execution/valuation requires quoteReceipts`);
      continue;
    }
    for (const [symbol, receipt] of Object.entries(receipts)) {
      validateLiveQuoteReceipt(receipt, { symbol, run }, errors, `runlog ${runKey(run)}.quoteReceipts.${symbol}`);
    }
  }
}

function validateRunCoverage({
  baselineLedger, candidateLedger, candidateRuns, baselineIndex, publishedPicks, errors,
}) {
  for (const run of candidateRuns) {
    if (!BOOKS.includes(run.model) || !isChangedRun(run, baselineIndex) || isRecoveryRun(run)) continue;
    const requiredSymbols = new Set((baselineLedger?.models?.[run.model]?.positions || []).map((position) => position.sym));
    const proposalIds = Array.isArray(run.proposalIds) ? run.proposalIds : [];
    for (const proposalId of proposalIds) {
      const pick = (publishedPicks?.models?.[run.model] || []).find((entry) => entry?.proposalId === proposalId);
      if (pick?.sym) requiredSymbols.add(pick.sym);
    }
    for (const symbol of requiredSymbols) {
      if (!Object.hasOwn(run.quoteReceipts || {}, symbol)) {
        errors.push(`runlog ${runKey(run)}.quoteReceipts: missing evaluated symbol ${symbol}`);
      }
    }
    const additions = (candidateLedger?.models?.[run.model]?.rejections || []).slice(
      (baselineLedger?.models?.[run.model]?.rejections || []).length,
    );
    const outcomes = new Set([
      ...(candidateLedger?.models?.[run.model]?.trades || [])
        .slice((baselineLedger?.models?.[run.model]?.trades || []).length)
        .map((trade) => trade.proposalId),
      ...(Array.isArray(run.skippedProposals) ? run.skippedProposals : []).map((skip) => skip?.proposalId),
      ...additions.map((rejection) => rejection?.order?.proposalId),
    ].filter(Boolean));
    for (const proposalId of proposalIds) {
      if (!outcomes.has(proposalId)) {
        errors.push(`runlog ${runKey(run)}: proposal ${proposalId} has no fill, threshold skip, or risk rejection outcome`);
      }
    }
    if (Number(run.ordersSkipped || 0) !== (run.skippedProposals || []).length) {
      errors.push(`runlog ${runKey(run)}: ordersSkipped must equal skippedProposals length`);
    }
    for (const [index, skipped] of (run.skippedProposals || []).entries()) {
      const tag = `runlog ${runKey(run)}.skippedProposals[${index}]`;
      const pick = (publishedPicks?.models?.[run.model] || [])
        .find((entry) => entry?.proposalId === skipped?.proposalId);
      const receipt = run.quoteReceipts?.[pick?.sym];
      if (!pick || !receipt) continue;
      const projectedFill = simulateFill({
        side: pick.order?.side,
        qty: pick.order?.qty,
        refPx: receipt.refPx,
      }, run.model);
      let expectedReason = null;
      if (pick.order?.side === 'buy' && receipt.refPx > pick.entry) {
        expectedReason = `live reference price ${receipt.refPx} exceeds signed maximum entry ${pick.entry}`;
      } else if (pick.order?.side === 'buy' && projectedFill.execPx > pick.entry) {
        expectedReason = `projected execution price ${projectedFill.execPx} exceeds signed maximum entry ${pick.entry}`;
      }
      if (!expectedReason) {
        errors.push(`${tag}: signed proposal and quote do not mechanically produce an entry-threshold skip`);
      } else if (
        skipped.sym !== pick.sym
        || skipped.reason !== expectedReason
        || !deepEqual(skipped.executionQuote, receipt)
      ) {
        errors.push(`${tag}: threshold skip does not reproduce from the signed proposal and quote receipt`);
      }
    }
  }
}

function validateHistoryReceipt(receipt, { symbol, run }, errors, tag) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    errors.push(`${tag}: history receipt must be an object`);
    return false;
  }
  let source;
  try { source = new URL(receipt.sourceUrl); } catch { source = null; }
  if (
    !source
    || source.origin !== 'https://feida.au'
    || source.pathname !== '/api/history'
    || source.searchParams.get('symbol') !== symbol
    || source.searchParams.get('interval') !== '1day'
    || !(Number(source.searchParams.get('outputsize')) > 0)
  ) {
    errors.push(`${tag}: history source must be the trusted production daily-history endpoint for ${symbol}`);
  }
  if (typeof receipt.requestId !== 'string' || !receipt.requestId.trim()) errors.push(`${tag}: requestId must be non-empty`);
  if (!Number.isFinite(Date.parse(receipt.observedAt))) errors.push(`${tag}: observedAt must be an ISO timestamp`);
  if (receipt.session !== run.date) errors.push(`${tag}: session must equal the recovered run date`);
  if (!(typeof receipt.close === 'number' && Number.isFinite(receipt.close) && receipt.close > 0)) {
    errors.push(`${tag}: close must be finite and positive`);
  }
  if (['SPY', 'SMH'].includes(symbol)
    && !(typeof receipt.seasonStartClose === 'number' && Number.isFinite(receipt.seasonStartClose) && receipt.seasonStartClose > 0)) {
    errors.push(`${tag}: benchmark receipt requires a finite positive seasonStartClose`);
  }
  return true;
}

function validateRecoveryReceipts({ candidateRuns, baselineIndex, baselineLedger, pipelineId, now, errors }) {
  for (const run of candidateRuns) {
    if (!BOOKS.includes(run.model) || !isChangedRun(run, baselineIndex) || !isRecoveryRun(run)) continue;
    const baseline = baselineIndex.get(runKey(run));
    const receipts = run.historyReceipts;
    if (!receipts || typeof receipts !== 'object' || Array.isArray(receipts)) {
      errors.push(`runlog ${runKey(run)}: recovered valuation requires historyReceipts`);
      continue;
    }
    const required = new Set([
      ...(baselineLedger?.models?.[run.model]?.positions || []).map((position) => position.sym),
      'SPY',
      'SMH',
    ]);
    for (const symbol of required) {
      if (!Object.hasOwn(receipts, symbol)) errors.push(`runlog ${runKey(run)}.historyReceipts: missing ${symbol}`);
    }
    for (const [symbol, receipt] of Object.entries(receipts)) {
      validateHistoryReceipt(receipt, { symbol, run }, errors, `runlog ${runKey(run)}.historyReceipts.${symbol}`);
    }
  }
}

function mapTradeToRun({ model, trade, baselineIndex, candidateIndex, errors, tag }) {
  const timestamp = newYorkTimestampParts(trade?.ts);
  if (!timestamp) {
    errors.push(`${tag}.ts: invalid execution timestamp`);
    return null;
  }
  const matches = [];
  for (const window of ARENA_MODEL_EXECUTION_WINDOWS[model]) {
    const assessment = assessArenaWindow(arenaExecutionWindowName(window), new Date(timestamp.timestamp));
    if (!assessment.due || assessment.date !== timestamp.date) continue;
    const run = candidateIndex.get(`${timestamp.date}|${window}|${model}`);
    if (run?.status === 'done' && !isRecoveryRun(run) && isChangedRun(run, baselineIndex)) matches.push(run);
  }
  if (matches.length !== 1) {
    errors.push(`${tag}: execution must map to exactly one non-late done run in the model/window matrix`);
    return null;
  }
  return { run: matches[0], timestamp };
}

function validatePublishedProposal({ model, trade, run, timestamp, pickIndex, publishedPicks, errors, tag }) {
  for (const field of RECEIPT_FIELDS) {
    if (typeof trade?.[field] !== 'string' || !trade[field]) errors.push(`${tag}.${field}: required for a subjective trade`);
  }
  if (RECEIPT_FIELDS.some((field) => typeof trade?.[field] !== 'string' || !trade[field])) return;

  const pick = pickIndex.get(model)?.get(trade.proposalId);
  if (!pick) {
    errors.push(`${tag}: proposal ${trade.proposalId} is absent from the published model ${model} picks`);
    return;
  }
  if (publishedPicks?.date !== timestamp.date || pick.sessionDate !== timestamp.date || run.date !== timestamp.date) {
    errors.push(`${tag}: proposal, pick snapshot, run, and execution must identify the same NY session`);
  }
  for (const field of ['decisionHash', 'sourceHash', 'decidedAt']) {
    if (trade[field] !== pick[field]) errors.push(`${tag}.${field}: does not exactly match the published pick`);
  }
  if (trade.sym !== pick.sym || trade.side !== pick.order?.side || trade.qty !== pick.order?.qty) {
    errors.push(`${tag}: symbol/side/quantity do not match the published order`);
  }
  if (trade.side === 'buy' && trade.executionQuote?.refPx > pick.entry) {
    errors.push(`${tag}: live reference price exceeds the signed maximum entry`);
  }
  if (!Array.isArray(pick.allowedExecutionWindows) || !pick.allowedExecutionWindows.includes(run.window)) {
    errors.push(`${tag}: published pick does not authorize ${run.window}`);
  }
  const decided = newYorkTimestampParts(pick.decidedAt);
  const expires = newYorkTimestampParts(pick.expiresAt);
  if (!decided || timestamp.timestamp < decided.timestamp) errors.push(`${tag}: execution predates the published decision`);
  if (!expires || timestamp.timestamp > expires.timestamp) errors.push(`${tag}: execution occurred after the published proposal expired`);
  if (!Array.isArray(run.proposalIds) || !run.proposalIds.includes(trade.proposalId)) {
    errors.push(`${tag}: candidate runlog proposalIds does not include the filled proposal`);
  }
}

function validateTradeAdditions({
  additions, baselineLedger, baselineRuns, baselineIndex, candidateIndex, publishedPicks, errors,
}) {
  const pickIndex = buildPickIndex(publishedPicks, errors);
  const consumed = new Set();
  for (const model of BOOKS) {
    for (const trade of baselineLedger?.models?.[model]?.trades || []) {
      if (typeof trade?.proposalId === 'string' && trade.proposalId) consumed.add(trade.proposalId);
    }
  }
  const filledByRun = new Map();
  const mappedTrades = [];

  for (const { model, trade, index } of additions) {
    const tag = `ledger.models.${model}.trades[${index}]`;
    if (!trade || typeof trade !== 'object') {
      errors.push(`${tag}: must be an object`);
      continue;
    }
    if (!['buy', 'sell'].includes(trade.side) || !(typeof trade.qty === 'number' && Number.isFinite(trade.qty) && trade.qty > 0)) {
      errors.push(`${tag}: needs buy/sell side and positive finite quantity`);
    }
    const mapped = mapTradeToRun({ model, trade, baselineIndex, candidateIndex, errors, tag });
    if (mapped) {
      const key = runKey(mapped.run);
      filledByRun.set(key, (filledByRun.get(key) || 0) + 1);
      mappedTrades.push({ model, trade, index, tag, ...mapped });
    }

    if (!EXECUTION_TYPES.has(trade.executionType)) {
      errors.push(`${tag}.executionType: must be proposal, stop-loss, or exitBy`);
    }
    if (mapped) {
      const runReceipt = mapped.run.quoteReceipts?.[trade.sym];
      if (!deepEqual(trade.executionQuote, runReceipt)) {
        errors.push(`${tag}.executionQuote: must exactly match the candidate runlog quote receipt`);
      } else {
        validateLiveQuoteReceipt(
          trade.executionQuote,
          { symbol: trade.sym, run: mapped.run, executedAt: trade.ts },
          errors,
          `${tag}.executionQuote`,
        );
      }
    }
    if (trade.executionType !== 'proposal') {
      if (RECEIPT_FIELDS.some((field) => trade[field] != null)) {
        errors.push(`${tag}: forced execution cannot carry subjective proposal receipts`);
      }
      if (trade.side !== 'sell') errors.push(`${tag}: forced execution must be a sell`);
      if (typeof trade.executionReason !== 'string' || !trade.executionReason.trim()) {
        errors.push(`${tag}.executionReason: required for a forced execution`);
      }
      continue;
    }
    if (!mapped) continue;

    if (typeof trade.proposalId === 'string' && trade.proposalId) {
      if (consumed.has(trade.proposalId)) errors.push(`${tag}: proposal ${trade.proposalId} was consumed more than once`);
      consumed.add(trade.proposalId);
    }
    validatePublishedProposal({
      model,
      trade,
      run: mapped.run,
      timestamp: mapped.timestamp,
      pickIndex,
      publishedPicks,
      errors,
      tag,
    });
  }
  return { filledByRun, mappedTrades };
}

function validateRunProposalIds({ candidateRuns, baselineIndex, publishedPicks, errors }) {
  for (const run of candidateRuns) {
    const ids = Array.isArray(run.proposalIds) ? run.proposalIds : [];
    if (!isChangedRun(run, baselineIndex) || run.status !== 'done' || isRecoveryRun(run)) continue;
    for (const proposalId of ids) {
      const pick = (publishedPicks?.models?.[run.model] || []).find((entry) => entry?.proposalId === proposalId);
      if (!pick) errors.push(`runlog ${runKey(run)}: proposal ${proposalId} is absent from published model ${run.model} picks`);
      else if (publishedPicks.date !== run.date || pick.sessionDate !== run.date) {
        errors.push(`runlog ${runKey(run)}: proposal ${proposalId} is not from the same published session`);
      } else if (!pick.allowedExecutionWindows?.includes(run.window)) {
        errors.push(`runlog ${runKey(run)}: proposal ${proposalId} does not authorize this window`);
      }
    }
  }
}

function validateFilledCounts(candidateRuns, baselineIndex, filledByRun, errors) {
  for (const run of candidateRuns) {
    if (!BOOKS.includes(run.model) || !isChangedRun(run, baselineIndex)) continue;
    const expected = filledByRun.get(runKey(run)) || 0;
    const actual = Number.isInteger(run.ordersFilled) ? run.ordersFilled : 0;
    if (run.status === 'done' && !isRecoveryRun(run) && actual !== expected) {
      errors.push(`runlog ${runKey(run)}: ordersFilled=${actual} but candidate ledger added ${expected} matching trade(s)`);
    }
  }
}

function valuationTimelineForModel({ model, candidateRuns, baselineIndex, pipelineId, now }) {
  return candidateRuns.filter((run) => {
    if (run.model !== model || !isChangedRun(run, baselineIndex)) return false;
    const migration = controlledTerminalMigration(baselineIndex.get(runKey(run)), run, { pipelineId, now });
    if (migration === 'legacy-late-t') return false;
    if (isRecoveryRun(run)) return true;
    if (run.valuationOnly === true) return true;
    return run.status === 'done';
  }).sort((left, right) => (
    left.date.localeCompare(right.date)
    || (WINDOW_ORDER[left.window] || 99) - (WINDOW_ORDER[right.window] || 99)
  ));
}

function clonePositions(positions) {
  return (positions || []).map((position) => ({ ...position }));
}

function markReplayPositions(state, run, errors) {
  const receipts = isRecoveryRun(run) ? run.historyReceipts : run.quoteReceipts;
  for (const [index, position] of state.positions.entries()) {
    const receipt = receipts?.[position.sym];
    const mark = isRecoveryRun(run) ? receipt?.close : receipt?.refPx;
    if (!(typeof mark === 'number' && Number.isFinite(mark) && mark > 0)) {
      errors.push(`runlog ${runKey(run)}: missing finite valuation receipt for held ${position.sym}`);
      continue;
    }
    state.positions[index] = { ...position, mkPx: mark };
  }
}

function expectedForcedTrades(state, model, run) {
  const expected = [];
  for (const position of state.positions) {
    const stopPct = LIMITS.PER_MODEL?.[model]?.STOP_LOSS ?? LIMITS.STOP_LOSS[model] ?? 0.08;
    const drawdown = (position.mkPx - position.avgPx) / position.avgPx;
    if (drawdown <= -stopPct) {
      expected.push({ sym: position.sym, type: 'stop-loss' });
    } else if (model === 'P' && position.exitBy && position.exitBy <= run.date) {
      expected.push({ sym: position.sym, type: 'exitBy' });
    }
  }
  return expected;
}

function expectedForcedReason(model, trade, position, sessionDate) {
  if (trade.executionType === 'exitBy') {
    if (model !== 'P' || !position?.exitBy || position.exitBy > sessionDate) return null;
    return `exitBy ${position.exitBy} reached`;
  }
  const stopPct = LIMITS.PER_MODEL?.[model]?.STOP_LOSS ?? LIMITS.STOP_LOSS[model] ?? 0.08;
  const drawdown = position ? (position.mkPx - position.avgPx) / position.avgPx : Infinity;
  if (!position || drawdown > -stopPct) return null;
  return `stop-loss ${(drawdown * 100).toFixed(1)}% <= -${stopPct * 100}%`;
}

function applyReplayTrade({ state, mapped, publishedPicks, errors }) {
  const { model, trade, tag, run } = mapped;
  const receipt = trade.executionQuote;
  if (!(receipt && typeof receipt.refPx === 'number')) return;
  const expectedFill = simulateFill({ side: trade.side, qty: trade.qty, refPx: receipt.refPx }, model);
  if (trade.px !== expectedFill.execPx || trade.fee !== expectedFill.fee || trade.slipBps !== expectedFill.slipBps) {
    errors.push(`${tag}: price, fee, and slippage do not reproduce the deterministic fill from executionQuote.refPx`);
  }

  const positionIndex = state.positions.findIndex((position) => position.sym === trade.sym);
  const existing = positionIndex >= 0 ? state.positions[positionIndex] : null;
  if (trade.executionType === 'stop-loss' || trade.executionType === 'exitBy') {
    const reason = expectedForcedReason(model, trade, existing, run.date);
    if (!reason || trade.executionReason !== reason || !existing || trade.qty !== existing.qty) {
      errors.push(`${tag}: forced execution does not reproduce the full mechanical ${trade.executionType} exit`);
    }
  }

  if (trade.executionType === 'proposal') {
    const pick = (publishedPicks?.models?.[model] || []).find((entry) => entry.proposalId === trade.proposalId);
    const replayLedger = {
      cash: state.cash,
      equity: Number((state.cash + state.positions.reduce((sum, position) => sum + position.qty * position.mkPx, 0)).toFixed(4)),
      positions: clonePositions(state.positions),
      trades: state.trades || [],
    };
    const riskLocked = checkDailyCircuitBreaker(state.dayStartEquity, replayLedger.equity);
    if (riskLocked && trade.side === 'buy') {
      errors.push(`${tag}: buy violates the daily loss circuit breaker during replay`);
    }
    const order = {
      sym: trade.sym,
      side: trade.side,
      qty: trade.qty,
      refPx: receipt.refPx,
      confidence: pick?.confidence,
      signals: pick?.signals,
      exitBy: pick?.exitBy,
    };
    const validation = validateOrder(order, replayLedger, {
      model,
      universe: state.universe,
      weekday: new Date(`${run.date}T12:00:00Z`).getUTCDay(),
      etDateStr: run.date,
      weeklyTradeCount: state.weeklyTradeCount,
    });
    if (!validation.ok) errors.push(`${tag}: mechanical order gate rejects published fill: ${validation.reason}`);
    state.weeklyTradeCount += 1;
    state.trades.push(trade);
  }

  if (trade.side === 'buy') {
    const cost = trade.px * trade.qty + trade.fee;
    state.cash = Number((state.cash - cost).toFixed(4));
    const pick = (publishedPicks?.models?.[model] || []).find((entry) => entry.proposalId === trade.proposalId);
    if (existing) {
      const quantity = existing.qty + trade.qty;
      const avgPx = Number(((existing.avgPx * existing.qty + trade.px * trade.qty) / quantity).toFixed(4));
      state.positions[positionIndex] = {
        ...existing,
        qty: quantity,
        avgPx,
        ...(pick?.exitBy ? {
          exitBy: existing.exitBy && existing.exitBy < pick.exitBy ? existing.exitBy : pick.exitBy,
        } : {}),
      };
    } else {
      state.positions.push({
        sym: trade.sym,
        qty: trade.qty,
        avgPx: trade.px,
        mkPx: trade.px,
        ...(pick?.exitBy ? { exitBy: pick.exitBy } : {}),
      });
    }
    if (trade.realizedPnl !== null) errors.push(`${tag}.realizedPnl: buy must record null`);
    return;
  }

  if (!existing || existing.qty < trade.qty) {
    errors.push(`${tag}: sell exceeds the mechanically replayed long position`);
    return;
  }
  state.cash = Number((state.cash + trade.px * trade.qty - trade.fee).toFixed(4));
  const expectedRealized = Number(((trade.px - existing.avgPx) * trade.qty - trade.fee).toFixed(4));
  if (trade.realizedPnl !== expectedRealized) errors.push(`${tag}.realizedPnl: does not reproduce from cost basis`);
  if (trade.qty === existing.qty) state.positions.splice(positionIndex, 1);
  else state.positions[positionIndex] = { ...existing, qty: existing.qty - trade.qty };
}

function validateValuationAudits({ baselineBook, candidateBook, liveRuns, errors, model }) {
  const baseline = Array.isArray(baselineBook.valuationAudits) ? baselineBook.valuationAudits : [];
  const candidate = Array.isArray(candidateBook.valuationAudits) ? candidateBook.valuationAudits : [];
  validateAppendOnlyPrefix(baseline, candidate, `ledger.models.${model}.valuationAudits`, errors);
  const additions = candidate.slice(baseline.length);
  if (additions.length !== liveRuns.length) {
    errors.push(`ledger.models.${model}.valuationAudits: expected ${liveRuns.length} new live valuation witness(es), got ${additions.length}`);
    return;
  }
  additions.forEach((audit, index) => {
    const run = liveRuns[index];
    const expectedMode = run.valuationOnly === true ? 'valuation-only' : 'live-execution';
    if (
      audit?.date !== run.date
      || audit?.window !== run.window
      || audit?.mode !== expectedMode
      || !deepEqual(audit?.quoteReceipts, run.quoteReceipts)
    ) errors.push(`ledger.models.${model}.valuationAudits[${baseline.length + index}]: does not match runlog ${runKey(run)}`);
    const recorded = newYorkTimestampParts(audit?.recordedAt);
    if (!recorded || recorded.date !== run.date || !assessArenaWindow(arenaExecutionWindowName(run.window), new Date(recorded.timestamp)).due) {
      errors.push(`ledger.models.${model}.valuationAudits[${baseline.length + index}].recordedAt: outside the matching real window`);
    }
  });
}

function validateLedgerReplay({
  baselineLedger,
  candidateLedger,
  candidateRuns,
  baselineIndex,
  mappedTrades,
  publishedPicks,
  universe,
  pipelineId,
  now,
  errors,
}) {
  const futureSessionDates = [...new Set(candidateRuns.filter((run) => (
    BOOKS.includes(run.model)
    && isChangedRun(run, baselineIndex)
    && (run.status === 'done' || run.valuationOnly === true || isRecoveryRun(run))
    && run.date > baselineLedger.lastRunDate
  )).map((run) => run.date))].sort();
  const ledgerDayForDate = new Map(futureSessionDates.map((date, index) => (
    [date, baselineLedger.day + index + 1]
  )));
  for (const model of BOOKS) {
    const baselineBook = baselineLedger?.models?.[model];
    const candidateBook = candidateLedger?.models?.[model];
    if (!baselineBook || !candidateBook) continue;
    const timeline = valuationTimelineForModel({ model, candidateRuns, baselineIndex, pipelineId, now });
    const liveRuns = timeline.filter((run) => !isRecoveryRun(run));
    validateValuationAudits({ baselineBook, candidateBook, liveRuns, errors, model });
    const state = {
      cash: baselineBook.cash,
      positions: clonePositions(baselineBook.positions),
      dayStartEquity: baselineBook.dayStartEquity ?? baselineBook.equity,
      weeklyTradeCount: (baselineBook.trades || []).filter((trade) => {
        const timestamp = Date.parse(trade.ts);
        const end = Date.parse(`${candidateLedger.lastRunDate}T23:59:59Z`);
        return Number.isFinite(timestamp) && timestamp >= end - 6 * 86400000 && timestamp <= end;
      }).length,
      trades: [...(baselineBook.trades || [])],
      universe,
    };
    const witnessedBookDays = new Set((baselineBook.equityHistory || []).map((point) => point.day));
    let expectedStoredDayStartEquity = baselineBook.dayStartEquity;
    const valuationEquities = [];

    for (const run of timeline) {
      markReplayPositions(state, run, errors);
      const runLedgerDay = ledgerDayForDate.get(run.date) ?? baselineLedger.day;
      if (!witnessedBookDays.has(runLedgerDay)) {
        state.dayStartEquity = Number((state.cash + state.positions.reduce(
          (sum, position) => sum + position.qty * position.mkPx, 0,
        )).toFixed(4));
        expectedStoredDayStartEquity = state.dayStartEquity;
        witnessedBookDays.add(runLedgerDay);
      }
      const runTrades = mappedTrades.filter((entry) => entry.model === model && runKey(entry.run) === runKey(run));
      if (!run.valuationOnly && !isRecoveryRun(run)) {
        for (const expected of expectedForcedTrades(state, model, run)) {
          if (!runTrades.some((entry) => entry.trade.sym === expected.sym && entry.trade.executionType === expected.type)) {
            errors.push(`runlog ${runKey(run)}: missing mandatory ${expected.type} for ${expected.sym}`);
          }
        }
      }
      for (const mapped of runTrades) {
        applyReplayTrade({ state, mapped, publishedPicks, errors });
      }
      markReplayPositions(state, run, errors);
      valuationEquities.push(Number((state.cash + state.positions.reduce((sum, position) => sum + position.qty * position.mkPx, 0)).toFixed(4)));
    }

    if (timeline.length === 0) {
      if (candidateBook.cash !== baselineBook.cash || !deepEqual(candidateBook.positions, baselineBook.positions) || candidateBook.equity !== baselineBook.equity) {
        errors.push(`ledger.models.${model}: cash/positions/equity changed without a witnessed valuation or execution run`);
      }
      continue;
    }
    if (candidateBook.cash !== state.cash) errors.push(`ledger.models.${model}.cash: does not reproduce from baseline plus candidate trades`);
    if (!deepEqual(candidateBook.positions, state.positions)) {
      errors.push(`ledger.models.${model}.positions: do not reproduce from baseline, receipts, and candidate trades`);
    }
    const expectedEquity = valuationEquities.at(-1);
    if (candidateBook.equity !== expectedEquity) errors.push(`ledger.models.${model}.equity: expected ${expectedEquity} from replay`);
    if (!deepEqual(candidateBook.dayStartEquity, expectedStoredDayStartEquity)) {
      errors.push(`ledger.models.${model}.dayStartEquity: expected ${expectedStoredDayStartEquity} from the witnessed session replay`);
    }

    const baselineHistory = baselineBook.equityHistory || [];
    const candidateHistory = candidateBook.equityHistory || [];
    const tailReplaced = baselineHistory.length > 0
      && baselineLedger.day === candidateLedger.day
      && !deepEqual(baselineHistory.at(-1), candidateHistory[baselineHistory.length - 1]);
    const changedPoints = [
      ...(tailReplaced ? [candidateHistory[baselineHistory.length - 1]] : []),
      ...candidateHistory.slice(baselineHistory.length),
    ];
    const invisibleSameDayMarks = valuationEquities.length - changedPoints.length;
    if (
      invisibleSameDayMarks < 0
      || (invisibleSameDayMarks > 0 && baselineLedger.day !== candidateLedger.day)
    ) {
      errors.push(`ledger.models.${model}.equityHistory: cannot reconcile ${changedPoints.length} changed point(s) with ${valuationEquities.length} witnessed valuation(s)`);
    } else {
      const visibleEquities = valuationEquities.slice(invisibleSameDayMarks);
      changedPoints.forEach((point, index) => {
        if (point?.equity !== visibleEquities[index]) {
          errors.push(`ledger.models.${model}.equityHistory: valuation point ${index} does not match receipt replay`);
        }
      });
    }
  }
}

function validCurrentPredictionTransition(baselineEntries, candidateEntries) {
  if (!baselineEntries || !candidateEntries) return false;
  if (!deepEqual(Object.keys(baselineEntries).sort(), Object.keys(candidateEntries).sort())) return false;
  for (const symbol of Object.keys(baselineEntries)) {
    const baseline = baselineEntries[symbol];
    const candidate = candidateEntries[symbol];
    for (const field of ['predOpenPct', 'predClosePct']) {
      if (!deepEqual(baseline?.[field], candidate?.[field])) return false;
    }
    for (const field of ['actualOpenPct', 'actualClosePct', 'dirHit']) {
      if (baseline?.[field] != null && !deepEqual(baseline[field], candidate?.[field])) return false;
    }
  }
  return true;
}

function validatePredictionEvidence(day, news, errors) {
  if (!day || !news || day.date !== news.date) return;
  const evidence = day.audit?.evidence || {};
  const predictions = news.aiPredictions || {};
  const expectedSymbols = Object.keys(predictions).sort();
  if (!deepEqual(Object.keys(day.entries || {}).sort(), expectedSymbols)) {
    errors.push(`arena-predlog ${day.date}: symbols must exactly match preserved arena-news predictions`);
    return;
  }
  const actuals = {};
  for (const symbol of expectedSymbols) {
    const receipt = evidence[symbol];
    if (!receipt || receipt.error) continue;
    let source;
    try { source = new URL(receipt.sourceUrl); } catch { source = null; }
    const open = Number(receipt.open);
    const close = Number(receipt.close);
    if (!source || source.origin !== 'https://feida.au' || source.pathname !== '/api/history'
      || source.searchParams.get('symbol') !== symbol || typeof receipt.requestId !== 'string'
      || !receipt.requestId.trim() || !(open > 0) || !(close > 0) || receipt.session !== day.date) {
      errors.push(`arena-predlog ${day.date}: invalid trusted history evidence for ${symbol}`);
      continue;
    }
    actuals[symbol] = { open, close };
  }
  const prevCloseMap = Object.fromEntries(Object.entries(news.prices || {})
    .map(([symbol, price]) => [symbol, price?.prevClose]));
  const expected = buildPredlogDay(day.date, predictions, prevCloseMap, actuals);
  if (!deepEqual(day.entries, expected.entries)) {
    errors.push(`arena-predlog ${day.date}: scores do not reproduce from preserved predictions and history evidence`);
  }
}

export function validateArenaPredlogPublicationDelta(
  baselinePredlog,
  candidatePredlog,
  { currentDate = null, publishedNews = null } = {},
) {
  const errors = [];
  const baselineDays = Array.isArray(baselinePredlog?.days) ? baselinePredlog.days : [];
  const candidateDays = Array.isArray(candidatePredlog?.days) ? candidatePredlog.days : [];
  if (!Array.isArray(baselinePredlog?.days) || !Array.isArray(candidatePredlog?.days)) {
    return { ok: false, errors: ['predlog days must be arrays in baseline and candidate'] };
  }
  const baselineByDate = new Map(baselineDays.map((day, index) => [day.date, { day, index }]));
  const candidateByDate = new Map(candidateDays.map((day, index) => [day.date, { day, index }]));
  const retained = baselineDays.filter((day) => candidateByDate.has(day.date));
  if (baselineDays.length > 0 && retained.length === 0) {
    errors.push('arena-predlog: candidate replaced the entire immutable baseline history');
  }
  const firstRetainedIndex = retained.length ? baselineByDate.get(retained[0].date).index : baselineDays.length;
  const missingAfterRetainedStart = baselineDays.slice(firstRetainedIndex).filter((day) => !candidateByDate.has(day.date));
  if (missingAfterRetainedStart.length) {
    errors.push(`arena-predlog: candidate deleted non-leading baseline day ${missingAfterRetainedStart[0].date}`);
  }
  if (firstRetainedIndex > 0 && candidateDays.length < 60) {
    errors.push('arena-predlog: leading history may be pruned only at the 60-day retention cap');
  }

  let previousBaselineIndex = -1;
  for (const candidate of candidateDays) {
    const existing = baselineByDate.get(candidate.date);
    if (!existing) continue;
    if (existing.index <= previousBaselineIndex) errors.push('arena-predlog: baseline days were reordered');
    previousBaselineIndex = existing.index;
    const baseline = existing.day;
    const currentTransition = candidate.date === currentDate
      && validCurrentPredictionTransition(baseline.entries, candidate.entries);
    if (!deepEqual(candidate.entries, baseline.entries) && !currentTransition) {
      errors.push(`arena-predlog ${candidate.date}: terminal prediction entries/scores were rewritten`);
    }
    const baselineWithoutAudit = { ...baseline };
    const candidateWithoutAudit = { ...candidate };
    delete baselineWithoutAudit.audit;
    delete candidateWithoutAudit.audit;
    delete baselineWithoutAudit.entries;
    delete candidateWithoutAudit.entries;
    if (!deepEqual(baselineWithoutAudit, candidateWithoutAudit)) {
      errors.push(`arena-predlog ${candidate.date}: baseline day fields were rewritten`);
    }
    const currentAuditMayAdvance = candidate.date === currentDate
      && baseline.audit?.status === 'partial'
      && ['partial', 'scored'].includes(candidate.audit?.status);
    if (baseline.audit != null && !deepEqual(candidate.audit, baseline.audit) && !currentAuditMayAdvance) {
      errors.push(`arena-predlog ${candidate.date}: terminal audit was rewritten`);
    }
  }

  const retainedLastDate = retained.at(-1)?.date || '';
  for (const day of candidateDays) {
    if (baselineByDate.has(day.date)) continue;
    if (retainedLastDate && day.date <= retainedLastDate) {
      errors.push(`arena-predlog ${day.date}: new day was inserted into immutable history`);
      continue;
    }
    if (day.date !== currentDate && (
      Object.keys(day.entries || {}).length > 0
      || !['missed-source', 'no-predictions'].includes(day.audit?.status)
    )) {
      errors.push(`arena-predlog ${day.date}: historical catch-up may add only an empty missed-source/no-predictions audit day`);
    }
  }
  if (currentDate) {
    const current = candidateByDate.get(currentDate)?.day;
    if (!current) errors.push(`arena-predlog: missing current reviewer day ${currentDate}`);
    else if (publishedNews?.date === currentDate) validatePredictionEvidence(current, publishedNews, errors);
    else if (Object.keys(current.entries || {}).length || current.audit?.status !== 'missed-source') {
      errors.push(`arena-predlog ${currentDate}: absent same-session news requires empty missed-source audit`);
    }
  }
  if (
    typeof baselinePredlog?.checkedThrough === 'string'
    && typeof candidatePredlog?.checkedThrough === 'string'
    && candidatePredlog.checkedThrough < baselinePredlog.checkedThrough
  ) errors.push('arena-predlog: checkedThrough cannot move backward');
  return { ok: errors.length === 0, errors };
}

/**
 * Validate the immutable publication boundary between the currently public
 * Arena ledger/runlog and one grouped settlement candidate. This function is
 * pure: callers supply the real wall clock and already-published pick snapshot.
 */
export function validateArenaSettlementPublication({
  baselineLedger,
  baselineRunlog,
  candidateLedger,
  candidateRunlog,
  publishedPicks,
  baselinePredlog,
  candidatePredlog,
  publishedNews,
  universe = null,
  pipelineId,
  now = new Date(),
} = {}) {
  const errors = [];
  const wallNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(wallNow.getTime())) return { ok: false, errors: ['now: invalid wall-clock timestamp'] };
  const baselineRuns = Array.isArray(baselineRunlog?.runs) ? baselineRunlog.runs : [];
  const candidateRuns = Array.isArray(candidateRunlog?.runs) ? candidateRunlog.runs : [];
  if (!Array.isArray(baselineRunlog?.runs)) errors.push('baseline runlog.runs must be an array');
  if (!Array.isArray(candidateRunlog?.runs)) errors.push('candidate runlog.runs must be an array');

  const baselineIndex = indexRuns(baselineRuns, 'baseline runlog', errors);
  const candidateIndex = indexRuns(candidateRuns, 'candidate runlog', errors);
  const additions = validateHistoryPrefixes(baselineLedger, candidateLedger, errors);
  const immutableTopFields = ['version', 'season', 'note_en', 'note_zh'];
  for (const field of immutableTopFields) {
    if (!deepEqual(baselineLedger?.[field], candidateLedger?.[field])) {
      errors.push(`ledger.${field}: immutable settlement metadata changed`);
    }
  }
  validateRunTransitions({
    baselineRuns,
    candidateRuns,
    baselineIndex,
    candidateIndex,
    publishedPicks,
    universe,
    pipelineId,
    now: wallNow,
    errors,
  });
  validateChangedRunSemantics(
    candidateRuns,
    baselineRuns,
    baselineIndex,
    publishedPicks,
    { pipelineId, now: wallNow },
    errors,
  );
  validateRunQuoteReceipts(candidateRuns, baselineIndex, errors);
  validateRunCoverage({
    baselineLedger, candidateLedger, candidateRuns, baselineIndex, publishedPicks, errors,
  });
  validateRecoveryReceipts({
    candidateRuns, baselineIndex, baselineLedger, pipelineId, now: wallNow, errors,
  });

  const { filledByRun, mappedTrades } = validateTradeAdditions({
    additions,
    baselineLedger,
    baselineRuns,
    baselineIndex,
    candidateIndex,
    publishedPicks,
    errors,
  });
  validateRunProposalIds({ candidateRuns, baselineIndex, publishedPicks, errors });
  validateFilledCounts(candidateRuns, baselineIndex, filledByRun, errors);
  validateLedgerReplay({
    baselineLedger,
    candidateLedger,
    candidateRuns,
    baselineIndex,
    mappedTrades,
    publishedPicks,
    universe,
    pipelineId,
    now: wallNow,
    errors,
  });

  const changedBookRuns = BOOKS.flatMap((model) => candidateRuns.filter((run) => (
    run.model === model && isChangedRun(run, baselineIndex)
  )));
  const valuationRuns = changedBookRuns.filter((run) => (
    run.status === 'done' || run.valuationOnly === true || isRecoveryRun(run)
  ));
  const expectedLastRunDate = valuationRuns.map((run) => run.date).sort().at(-1) || baselineLedger?.lastRunDate;
  if (valuationRuns.length > 0) {
    if (candidateLedger?.lastRunDate !== expectedLastRunDate || candidateLedger?.updated !== expectedLastRunDate) {
      errors.push(`ledger lastRunDate/updated must equal the latest witnessed settlement date ${expectedLastRunDate}`);
    }
    const recoveredSessions = new Set(valuationRuns
      .map((run) => run.date)
      .filter((date) => date > baselineLedger?.lastRunDate));
    const expectedDay = baselineLedger.day + recoveredSessions.size;
    if (candidateLedger?.day !== expectedDay) errors.push(`ledger.day: expected ${expectedDay} from the witnessed session transition`);
  } else if (
    candidateLedger?.lastRunDate !== baselineLedger?.lastRunDate
    || candidateLedger?.updated !== baselineLedger?.updated
    || candidateLedger?.day !== baselineLedger?.day
  ) {
    errors.push('ledger day/lastRunDate/updated changed without a witnessed valuation');
  }
  for (const model of BOOKS) {
    const baselineBook = baselineLedger?.models?.[model];
    const candidateBook = candidateLedger?.models?.[model];
    if (!baselineBook || !candidateBook) continue;
    for (const field of ['promptVersion', 'startEquity']) {
      if (!deepEqual(baselineBook[field], candidateBook[field])) errors.push(`ledger.models.${model}.${field}: immutable outside a real season reset`);
    }
    const modelRuns = valuationRuns.filter((run) => run.model === model);
    const expectedValuationDate = modelRuns.map((run) => run.date).sort().at(-1)
      || baselineBook.lastValuationDate;
    if (!deepEqual(candidateBook.lastValuationDate, expectedValuationDate)) {
      errors.push(`ledger.models.${model}.lastValuationDate: must equal the latest witnessed valuation ${expectedValuationDate}`);
    }
    if (modelRuns.length > 0) {
      const expectedMetrics = computeMetrics(candidateBook);
      if (!deepEqual(candidateBook.metrics, expectedMetrics)) errors.push(`ledger.models.${model}.metrics: do not reproduce from the candidate book`);
    } else if (!deepEqual(candidateBook.metrics, baselineBook.metrics)) {
      errors.push(`ledger.models.${model}.metrics: changed without a model valuation`);
    }
    if (modelRuns.length === 0 && !deepEqual(candidateBook.dayStartEquity, baselineBook.dayStartEquity)) {
      errors.push(`ledger.models.${model}.dayStartEquity: changed without a model valuation`);
    }
  }

  const latestBenchRun = candidateRuns.filter((run) => (
    isChangedRun(run, baselineIndex) && isRecoveryRun(run) && run.historyReceipts?.SPY && run.historyReceipts?.SMH
  )).sort((left, right) => left.date.localeCompare(right.date)).at(-1);
  if (!deepEqual(baselineLedger?.bench, candidateLedger?.bench)) {
    const spy = latestBenchRun?.historyReceipts?.SPY;
    const smh = latestBenchRun?.historyReceipts?.SMH;
    const pct = (close, start) => Number((((close - start) / start) * 100).toFixed(2));
    const expected = spy?.seasonStartClose > 0 && smh?.seasonStartClose > 0
      ? { spyPct: pct(spy.close, spy.seasonStartClose), smhPct: pct(smh.close, smh.seasonStartClose) }
      : null;
    if (!expected || !deepEqual(candidateLedger.bench, expected)) {
      errors.push('ledger.bench: does not reproduce from trusted SPY/SMH recovery baselines and closes');
    }
  }
  if (baselinePredlog != null || candidatePredlog != null) {
    const currentPredlogDate = candidateRuns
      .filter((run) => run.model === 'reviewer' && run.status === 'done' && run.late !== true && isChangedRun(run, baselineIndex))
      .map((run) => run.date)
      .sort()
      .at(-1) || null;
    const predlogValidation = validateArenaPredlogPublicationDelta(
      baselinePredlog,
      candidatePredlog,
      { currentDate: currentPredlogDate, publishedNews },
    );
    errors.push(...predlogValidation.errors);
  }

  return { ok: errors.length === 0, errors };
}
