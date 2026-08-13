/* ============================================================
   ARENA POST-MARKET GROUP FINALIZATION

   Pure helpers for the one-shot post-market candidate orchestrator. The
   network/child-process wrapper lives in scripts/build-arena-postmarket-
   candidates.mjs; this module deterministically selects T intents and turns
   the accumulated ledger/runlog into the reviewer, digest and prediction
   audit outputs required by the atomic four-file publication group.
   ============================================================ */
import { newYorkTimestampParts } from './arenaDecisionProvenance.js';
import { appendPredlogDay, buildPredlogDay } from './predlogEntry.js';

const BOOKS = Object.freeze(['S', 'P', 'T']);
const REVIEWER_KEY = (date) => `${date}|post-market|reviewer`;

function percentChange(current, previous) {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
}

function runKey(run) {
  return `${run?.date}|${run?.window}|${run?.model}`;
}

function tradeCount(ledger, model) {
  return Array.isArray(ledger?.models?.[model]?.trades) ? ledger.models[model].trades.length : 0;
}

export function selectCurrentTProposalIntents(picks, sessionDate, nowIso) {
  const now = newYorkTimestampParts(nowIso);
  if (!now || now.date !== sessionDate) throw new Error('T intent selection requires the real current New York session');
  if (picks?.date !== sessionDate || picks?.decisionStatus !== 'sealed' || picks?.executable !== true) return [];
  const intents = [];
  for (const [index, pick] of (picks.models?.T || []).entries()) {
    if (pick?.sessionDate !== sessionDate) continue;
    if (!pick.allowedExecutionWindows?.includes('post-market')) continue;
    const decided = newYorkTimestampParts(pick.decidedAt);
    const expires = newYorkTimestampParts(pick.expiresAt);
    if (!decided || !expires || now.timestamp < decided.timestamp || now.timestamp > expires.timestamp) continue;
    if (typeof pick.proposalId !== 'string' || !pick.proposalId) {
      throw new Error(`models.T[${index}] is eligible but has no proposalId`);
    }
    intents.push({ proposalId: pick.proposalId });
  }
  return intents;
}

export function planCurrentTPostmarketSettlement(picks, sessionDate, nowIso) {
  const currentDecisionAvailable = picks?.date === sessionDate
    && picks?.decisionStatus === 'sealed'
    && picks?.executable === true;
  const proposedOrders = selectCurrentTProposalIntents(picks, sessionDate, nowIso);
  return {
    book: 'T',
    window: 'post-market',
    etDateStr: sessionDate,
    proposedOrders,
    ...(!currentDecisionAvailable ? { valuationOnly: true, decisionMissed: true } : {}),
  };
}

function buildPredictionAudit({ predlog, news, sessionDate, nowIso, actuals, evidence }) {
  let dayEntry;
  let status;
  let note;
  if (news?.date !== sessionDate) {
    dayEntry = { date: sessionDate, entries: {} };
    status = 'missed-source';
    note = 'No same-session preserved pre-market prediction source was available; no score was inferred.';
  } else {
    const previousCloses = Object.fromEntries(Object.entries(news.prices || {})
      .map(([symbol, price]) => [symbol, price?.prevClose]));
    dayEntry = buildPredlogDay(sessionDate, news.aiPredictions || {}, previousCloses, actuals || {});
    const entries = Object.values(dayEntry.entries);
    const complete = entries.filter((entry) => (
      Number.isFinite(entry.actualClosePct) && typeof entry.dirHit === 'boolean'
    )).length;
    status = entries.length === 0 ? 'no-predictions' : complete === entries.length ? 'scored' : 'partial';
    note = status === 'scored'
      ? `${complete} prediction(s) have complete provider open/close directional results.`
      : status === 'partial'
        ? `${complete} of ${entries.length} prediction(s) have complete provider results; missing actuals remain explicit.`
        : 'The preserved pre-market source explicitly contained no predictions.';
  }
  const auditedDay = {
    ...dayEntry,
    audit: {
      status,
      checkedAt: nowIso,
      note,
      ...(evidence && Object.keys(evidence).length ? { evidence } : {}),
    },
  };
  const days = appendPredlogDay(predlog?.days || [], auditedDay, 60);
  return {
    ...predlog,
    version: predlog?.version || 1,
    updated: nowIso,
    checkedThrough: status === 'partial'
      ? predlog?.checkedThrough
      : (!predlog?.checkedThrough || sessionDate > predlog.checkedThrough ? sessionDate : predlog.checkedThrough),
    days,
  };
}

export function finalizeArenaPostmarketCandidates({
  beforeLedger,
  settledLedger,
  settledRunlog,
  predlog,
  news,
  picks,
  sessionDate,
  nowIso,
  actuals = {},
  predictionEvidence = {},
} = {}) {
  const timestamp = newYorkTimestampParts(nowIso);
  if (!timestamp || timestamp.date !== sessionDate) throw new Error('post-market finalization requires a same-session New York timestamp');
  const runs = Array.isArray(settledRunlog?.runs) ? settledRunlog.runs : [];
  const reviewer = runs.find((run) => runKey(run) === REVIEWER_KEY(sessionDate));
  if (reviewer) throw new Error(`reviewer identity ${REVIEWER_KEY(sessionDate)} is already terminal or queued; refusing to rewrite it`);
  for (const model of BOOKS) {
    const run = runs.find((entry) => (
      entry.date === sessionDate && entry.window === 'post-market' && entry.model === model
    ));
    const validStatus = model === 'T' ? ['done', 'missed'].includes(run?.status) : run?.status === 'done';
    if (!validStatus) throw new Error(`post-market ${model} run must be done (or honestly missed for T) before reviewer finalization`);
    if ((model === 'S' || model === 'P') && run.valuationOnly !== true) {
      throw new Error(`post-market ${model} run must be marked valuationOnly`);
    }
  }

  const nextRunlog = {
    ...settledRunlog,
    runs: [...runs, {
      date: sessionDate,
      window: 'post-market',
      model: 'reviewer',
      status: 'done',
      ordersProposed: 0,
      ordersFilled: 0,
      note: 'Deterministic reviewer completed after S/P/T current-session settlement and prediction audit.',
    }],
  };

  const books = BOOKS.map((model) => {
    const before = beforeLedger?.models?.[model]?.equity;
    const after = settledLedger?.models?.[model]?.equity;
    const newTrades = Math.max(0, tradeCount(settledLedger, model) - tradeCount(beforeLedger, model));
    return {
      model,
      pnlPct: percentChange(after, before),
      tradesCount: newTrades,
      note_en: newTrades
        ? `${newTrades} mechanically authorized trade(s) settled; the book was marked with trusted current-session quote evidence.`
        : 'No trade settled; the book was marked with trusted current-session quote evidence.',
      note_zh: newTrades
        ? `完成 ${newTrades} 笔机械授权交易，并使用可信的当日行情证据完成估值。`
        : '未成交；已使用可信的当日行情证据完成估值。',
    };
  });
  const digest = {
    date: sessionDate,
    generatedAt: nowIso,
    note_en: 'Current-session post-market settlement completed mechanically. S/P were valuation-only; T used only an eligible sealed pre-market proposal or recorded a truthful zero-order completion.',
    note_zh: '当日盘后结算已机械完成。S/P 仅估值；T 仅执行有效的盘前封存提案，否则如实记录零订单完成。',
    books,
    tomorrowPicksCount: picks?.date > sessionDate
      ? Object.values(picks.models || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
      : 0,
    delayed: [],
  };
  const nextPredlog = buildPredictionAudit({
    predlog, news, sessionDate, nowIso, actuals, evidence: predictionEvidence,
  });
  return { ledger: settledLedger, runlog: nextRunlog, digest, predlog: nextPredlog };
}
