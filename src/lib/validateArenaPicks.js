/* Pure validation for public/arena-picks.json (Part 4 SS18.1.1) -- the
   daily output of the Gatherer/Analyst/Reviewer pipeline (SS17.6) and the
   frontend's "Today's Recommended Trades" board (SS18.2.1). A scheduled
   task publishes this file unattended, so a structurally-broken write must
   fail loudly here rather than reach the page (same discipline as
   validateSignalEvents.js). */

import {
  PREMARKET_PROVENANCE_SCHEMA,
  PREMARKET_PROVENANCE_REQUIRED_FROM,
  PREMARKET_DECISION_WINDOW,
  EXECUTABLE_ARENA_WINDOWS,
  computeArenaSourceHash,
  computeArenaDecisionHash,
  computeArenaProposalId,
  newYorkTimestampParts,
} from './arenaDecisionProvenance.js';
import { addNyseSessions } from './marketSession.js';
import { ARENA_MODEL_EXECUTION_WINDOWS } from './arenaExecution.js';

const MODELS = ['S', 'P', 'T'];
const REGIMES = ['risk-on', 'neutral', 'risk-off'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ARENA_MAX_PROPOSALS_PER_MODEL = Object.freeze({ S: 4, P: 4, T: 3 });

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateDecisionProvenance(p, model, sessionDate, generatedAt, tag, errors) {
  if (p.provenanceSchema !== PREMARKET_PROVENANCE_SCHEMA) {
    errors.push(`${tag}.provenanceSchema: must be ${JSON.stringify(PREMARKET_PROVENANCE_SCHEMA)}`);
  }
  if (p.sessionDate !== sessionDate) errors.push(`${tag}.sessionDate: must equal top-level date ${sessionDate}`);
  if (p.decisionWindow !== PREMARKET_DECISION_WINDOW) errors.push(`${tag}.decisionWindow: must be "pre-market"`);

  const decided = newYorkTimestampParts(p.decidedAt);
  if (!decided) errors.push(`${tag}.decidedAt: must be an ISO timestamp`);
  else {
    if (decided.date !== sessionDate) errors.push(`${tag}.decidedAt: must fall on sessionDate in America/New_York`);
    if (decided.minutes >= 9 * 60 + 30) errors.push(`${tag}.decidedAt: must be before 09:30 America/New_York`);
  }
  const generated = newYorkTimestampParts(generatedAt);
  if (!generated) errors.push('generatedAt: must be an ISO timestamp');
  else {
    if (generated.date !== sessionDate) errors.push('generatedAt: executable picks must be published on the same New York session date');
    if (generated.minutes >= 9 * 60 + 30) errors.push('generatedAt: executable picks must be sealed before 09:30 America/New_York');
    if (decided && decided.timestamp > generated.timestamp) errors.push(`${tag}.decidedAt: cannot be after generatedAt`);
  }

  const expires = newYorkTimestampParts(p.expiresAt);
  if (!expires) errors.push(`${tag}.expiresAt: must be an ISO timestamp`);
  else {
    if (expires.date !== sessionDate) errors.push(`${tag}.expiresAt: must remain within sessionDate in America/New_York`);
    if (decided && expires.timestamp <= decided.timestamp) errors.push(`${tag}.expiresAt: must be after decidedAt`);
  }
  if (!Array.isArray(p.allowedExecutionWindows) || p.allowedExecutionWindows.length === 0) {
    errors.push(`${tag}.allowedExecutionWindows: must be a non-empty array`);
  } else {
    const unique = new Set(p.allowedExecutionWindows);
    if (unique.size !== p.allowedExecutionWindows.length || !p.allowedExecutionWindows.every((item) => EXECUTABLE_ARENA_WINDOWS.includes(item))) {
      errors.push(`${tag}.allowedExecutionWindows: entries must be unique members of ${EXECUTABLE_ARENA_WINDOWS.join('/')}`);
    }
    if (!p.allowedExecutionWindows.every((item) => ARENA_MODEL_EXECUTION_WINDOWS[model]?.includes(item))) {
      errors.push(`${tag}.allowedExecutionWindows: Model ${model} may use only ${ARENA_MODEL_EXECUTION_WINDOWS[model]?.join('/')}`);
    }
  }
  if (!p.order || typeof p.order !== 'object' || Array.isArray(p.order)) {
    errors.push(`${tag}.order: must contain the signed execution side and quantity`);
  } else {
    if (p.order.side !== 'buy' && p.order.side !== 'sell') errors.push(`${tag}.order.side: must be "buy" or "sell"`);
    if (!Number.isInteger(p.order.qty) || p.order.qty <= 0) errors.push(`${tag}.order.qty: must be a positive integer`);
  }
  if (model === 'P' && p.order?.side === 'buy') {
    if (!DATE_RE.test(String(p.exitBy || ''))) {
      errors.push(`${tag}.exitBy: Model P buys require YYYY-MM-DD`);
    } else {
      const earliestExit = addNyseSessions(sessionDate, 1);
      const latestExit = addNyseSessions(sessionDate, 2);
      if (p.exitBy < earliestExit || p.exitBy > latestExit) {
        errors.push(`${tag}.exitBy: Model P buys must exit between NYSE sessions ${earliestExit} and ${latestExit}`);
      }
    }
  }
  if (!Array.isArray(p.sourceRefs) || p.sourceRefs.length === 0 || !p.sourceRefs.every((ref) => isNonEmptyString(ref) && ref.length <= 512)) {
    errors.push(`${tag}.sourceRefs: must be a non-empty array of bounded source identifiers`);
  }

  // Only recompute after the payload has enough structure for the canonical
  // hash helpers. A malformed proposal should yield field errors, not throw.
  if (p.provenanceSchema === PREMARKET_PROVENANCE_SCHEMA
      && DATE_RE.test(String(p.sessionDate || ''))
      && p.order && (p.order.side === 'buy' || p.order.side === 'sell')
      && Number.isInteger(p.order.qty) && p.order.qty > 0
      && Array.isArray(p.allowedExecutionWindows)
      && Array.isArray(p.sourceRefs)) {
    const expectedSourceHash = computeArenaSourceHash(p);
    if (p.sourceHash !== expectedSourceHash) errors.push(`${tag}.sourceHash: does not match sourceRefs`);
    const expectedDecisionHash = computeArenaDecisionHash(model, p);
    if (p.decisionHash !== expectedDecisionHash) errors.push(`${tag}.decisionHash: does not match the sealed decision`);
    const expectedProposalId = computeArenaProposalId(model, p);
    if (p.proposalId !== expectedProposalId) errors.push(`${tag}.proposalId: does not match the decision-derived stable id`);
  }
}

function validatePick(p, model, sessionDate, generatedAt, requireProvenance, tag, errors) {
  if (!p || typeof p !== 'object') { errors.push(`${tag}: not an object`); return; }
  if (!isNonEmptyString(p.sym)) errors.push(`${tag}.sym: missing or empty`);
  // long-only cash account (arenaRules.js): a recommendation can only ever be a long.
  if (p.side !== 'long') errors.push(`${tag}.side: must be "long" (the system is long-only), got ${JSON.stringify(p.side)}`);
  if (!isFiniteNumber(p.confidence) || p.confidence < 0 || p.confidence > 1) errors.push(`${tag}.confidence: must be a number in [0,1]`);
  for (const f of ['entry', 'stop', 'target']) {
    if (!isFiniteNumber(p[f]) || p[f] <= 0) errors.push(`${tag}.${f}: must be a positive number`);
  }
  if (!isNonEmptyString(p.thesis_en)) errors.push(`${tag}.thesis_en: missing or empty`);
  if (!isNonEmptyString(p.thesis_zh)) errors.push(`${tag}.thesis_zh: missing or empty`);
  if (!Array.isArray(p.signals) || !p.signals.length || !p.signals.every(isNonEmptyString)) {
    errors.push(`${tag}.signals: must be a non-empty array of non-empty strings`);
  }
  if (requireProvenance) validateDecisionProvenance(p, model, sessionDate, generatedAt, tag, errors);
}

/** @param {unknown} data parsed JSON (caller must JSON.parse first). */
export function validateArenaPicks(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['top-level: must be an object'] };
  }
  if (!DATE_RE.test(String(data.date || ''))) errors.push('date: must be YYYY-MM-DD');
  if (!isNonEmptyString(data.generatedAt) || !Number.isFinite(Date.parse(data.generatedAt))) errors.push('generatedAt: must be an ISO timestamp');
  if (!REGIMES.includes(data.regime)) errors.push(`regime: must be one of ${REGIMES.join('/')}, got ${JSON.stringify(data.regime)}`);
  const requireProvenance = DATE_RE.test(String(data.date || '')) && data.date >= PREMARKET_PROVENANCE_REQUIRED_FROM;
  const missedDecision = requireProvenance && data.decisionStatus === 'missed';
  if (requireProvenance) {
    if (missedDecision) {
      if (data.executable !== false) errors.push('executable: a missed decision snapshot must be false');
    } else {
      if (data.decisionStatus !== 'sealed') errors.push('decisionStatus: executable decisions must be "sealed"');
      if (data.executable !== true) errors.push('executable: a sealed decision snapshot must be true');
    }
  }
  const proposalIds = new Set();
  if (!data.models || typeof data.models !== 'object') {
    errors.push('models: missing or not an object');
  } else {
    for (const key of MODELS) {
      const list = data.models[key];
      if (!Array.isArray(list)) { errors.push(`models.${key}: must be an array (empty is fine -- a model can propose nothing)`); continue; }
      if (list.length > ARENA_MAX_PROPOSALS_PER_MODEL[key]) {
        errors.push(`models.${key}: at most ${ARENA_MAX_PROPOSALS_PER_MODEL[key]} proposals are allowed per pre-market decision`);
      }
      if (missedDecision && list.length) errors.push(`models.${key}: a missed decision snapshot must be empty`);
      list.forEach((p, i) => {
        validatePick(p, key, data.date, data.generatedAt, requireProvenance && !missedDecision, `models.${key}[${i}]`, errors);
        if (requireProvenance && isNonEmptyString(p?.proposalId)) {
          if (proposalIds.has(p.proposalId)) errors.push(`models.${key}[${i}].proposalId: duplicate across snapshot`);
          proposalIds.add(p.proposalId);
        }
      });
    }
  }
  if (!Array.isArray(data.quoteAllowlist)) {
    errors.push('quoteAllowlist: must be an array');
  } else if (!data.quoteAllowlist.every(isNonEmptyString)) {
    errors.push('quoteAllowlist: every entry must be a non-empty string');
  }
  // the allowlist is the whole point of SS18.4 API gating -- every picked symbol
  // must actually be reachable without an admin key, or the picks board would
  // render cards the page can't fetch quotes for.
  if (data.models && typeof data.models === 'object' && Array.isArray(data.quoteAllowlist)) {
    const allow = new Set(data.quoteAllowlist);
    for (const key of MODELS) {
      for (const p of data.models[key] || []) {
        if (p && p.sym && !allow.has(p.sym)) errors.push(`quoteAllowlist: missing "${p.sym}" which models.${key} recommends`);
      }
    }
    if (requireProvenance) {
      for (const benchmark of ['SPY', 'QQQ', 'SMH']) {
        if (!allow.has(benchmark)) errors.push(`quoteAllowlist: missing required Arena benchmark ${benchmark}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Stricter write-time gate for the atomic publisher. The ordinary validator
 * intentionally remains capable of reading archived snapshots after 09:30;
 * publication must call this function with the real wall clock so a caller
 * cannot backfill a "pre-market" timestamp after seeing the session.
 */
export function validateArenaPicksForPublication(data, { now = new Date() } = {}) {
  const structural = validateArenaPicks(data);
  const errors = [...structural.errors];
  const picks = MODELS.flatMap((model) => Array.isArray(data?.models?.[model]) ? data.models[model] : []);
  // An empty recommendation is still a directional HOLD decision. Starting
  // with the provenance contract, it must have the same real pre-market Git
  // witness as a non-empty snapshot; otherwise a post-close empty file could
  // falsely turn a missed decision window into a completed one.
  if (!(DATE_RE.test(String(data?.date || '')) && data.date >= PREMARKET_PROVENANCE_REQUIRED_FROM)) {
    return { ok: errors.length === 0, errors };
  }

  const witness = newYorkTimestampParts(now instanceof Date ? now.toISOString() : now);
  const generated = newYorkTimestampParts(data?.generatedAt);
  const missedDecision = data?.decisionStatus === 'missed' && data?.executable === false;
  if (!witness) errors.push('publication clock: must be a valid timestamp');
  else {
    if (witness.date !== data.date) errors.push('publication clock: picks decisions may only publish during their New York session date');
    if (missedDecision) {
      if (witness.minutes < 9 * 60 + 30) errors.push('publication clock: a decision window cannot be marked missed before 09:30 America/New_York');
    } else if (witness.minutes >= 9 * 60 + 30) {
      errors.push('publication clock: picks decisions cannot publish at or after 09:30 America/New_York');
    }
  }
  if (witness && generated) {
    const generationSkewMs = witness.timestamp - generated.timestamp;
    if (generationSkewMs < -60_000) errors.push('generatedAt: cannot be ahead of the publisher wall clock');
    if (generationSkewMs > 5 * 60_000) errors.push('generatedAt: executable snapshot must be sealed within five minutes of publication');
  }
  for (const [index, pick] of picks.entries()) {
    const decided = newYorkTimestampParts(pick?.decidedAt);
    if (!decided || !witness || !generated) continue;
    if (decided.timestamp > witness.timestamp + 60_000) errors.push(`picks[${index}].decidedAt: cannot be ahead of the publisher wall clock`);
    if (generated.timestamp - decided.timestamp > 5 * 60_000) {
      errors.push(`picks[${index}].decidedAt: cannot predate this generated research snapshot by more than five minutes`);
    }
  }
  return { ok: errors.length === 0, errors };
}
