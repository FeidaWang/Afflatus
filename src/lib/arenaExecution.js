/* ============================================================
   ARENA LIVE EXECUTION GATE + QUOTE RECEIPTS

   The unattended execution CLI is allowed to create a candidate settlement
   only for the real, currently-open New York window.  This module keeps the
   policy and quote parsing pure/injectable for tests; the production CLI never
   exposes a clock override and always supplies `new Date()` itself.
   ============================================================ */
import { assessArenaWindow, arenaExecutionWindowName, isEarlyCloseSession } from './arenaWindowGate.js';
import { easternTimeParts } from './marketSession.js';

export const ARENA_MODEL_EXECUTION_WINDOWS = Object.freeze({
  S: Object.freeze(['open-window', 'late-window']),
  P: Object.freeze(['open-window', 'late-window']),
  T: Object.freeze(['post-market']),
});

const TERMINAL_RUN_STATUSES = new Set(['done', 'missed']);
const QUOTE_FUTURE_TOLERANCE_MS = 2 * 60 * 1000;
const QUOTE_MAX_AGE_MS = Object.freeze({
  'open-window': 5 * 60 * 1000,
  'late-window': 5 * 60 * 1000,
  // A post-market quote may legitimately be the 16:00 closing print while
  // the settlement window remains open through 17:15 ET.
  'post-market': 90 * 60 * 1000,
});

function runIdentity(run) {
  return `${run?.date}|${run?.window}|${run?.model}`;
}

export function assessArenaExecutionInvocation({
  book,
  window,
  etDateStr,
  runlog,
  wallNow,
  valuationOnly = false,
  decisionMissed = false,
} = {}) {
  const allowed = ARENA_MODEL_EXECUTION_WINDOWS[book];
  if (!allowed) throw new Error(`book must be one of ${Object.keys(ARENA_MODEL_EXECUTION_WINDOWS).join('/')}`);
  const currentDecisionMissedValuation = valuationOnly && decisionMissed
    && ['S', 'P'].includes(book) && ['open-window', 'late-window'].includes(window);
  const currentPostmarketValuation = valuationOnly && window === 'post-market';
  if (valuationOnly && !currentPostmarketValuation && !currentDecisionMissedValuation) {
    throw new Error('valuationOnly is permitted only for current post-market or witnessed missed S/P windows');
  }
  if (!currentPostmarketValuation && !currentDecisionMissedValuation && !allowed.includes(window)) {
    throw new Error(`Model ${book} cannot execute in ${JSON.stringify(window)}; allowed windows: ${allowed.join('/')}`);
  }
  const now = wallNow instanceof Date ? wallNow : new Date(wallNow);
  if (Number.isNaN(now.getTime())) throw new Error('real execution clock is invalid');
  const gate = assessArenaWindow(arenaExecutionWindowName(window), now);
  if (gate.date !== etDateStr) {
    throw new Error(`etDateStr ${JSON.stringify(etDateStr)} is not the current America/New_York date ${gate.date}`);
  }
  if (!gate.session) throw new Error(`${etDateStr} is not an NYSE session`);
  if (!gate.due) throw new Error(`real execution clock is ${gate.reason} for ${window}`);

  const identity = `${etDateStr}|${window}|${book}`;
  const existing = (Array.isArray(runlog?.runs) ? runlog.runs : [])
    .find((run) => runIdentity(run) === identity);
  if (existing && TERMINAL_RUN_STATUSES.has(existing.status)) {
    throw new Error(`run identity ${identity} is terminal (${existing.status}) and cannot be overwritten`);
  }
  if (existing && existing.status !== 'queued') {
    throw new Error(`run identity ${identity} has unsupported status ${JSON.stringify(existing.status)}`);
  }
  return {
    nowIso: now.toISOString(), gate, existingStatus: existing?.status || null,
    mode: currentPostmarketValuation
      ? 'current-postmarket-valuation'
      : currentDecisionMissedValuation ? 'current-missed-valuation' : 'live-execution',
  };
}

export function collectArenaExecutionSymbols(ledger, snapshot, book, proposedOrders = []) {
  const symbols = new Set();
  for (const position of ledger?.models?.[book]?.positions || []) {
    if (typeof position?.sym === 'string' && position.sym) symbols.add(position.sym);
  }

  const picks = snapshot?.models?.[book];
  const byProposal = new Map(Array.isArray(picks)
    ? picks.map((pick) => [pick?.proposalId, pick])
    : []);
  for (const [index, intent] of proposedOrders.entries()) {
    const pick = byProposal.get(intent?.proposalId);
    if (!pick?.sym) {
      throw new Error(`proposedOrders[${index}] does not identify a published Model ${book} proposal`);
    }
    symbols.add(pick.sym);
  }
  return [...symbols].sort();
}

export function consumedArenaProposalIdsFromLedger(ledger) {
  return Object.values(ledger?.models || {}).flatMap((model) => (
    Array.isArray(model?.trades)
      ? model.trades.map((trade) => trade?.proposalId).filter((proposalId) => typeof proposalId === 'string' && proposalId)
      : []
  ));
}

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) || headers.get(name.toLowerCase());
  if (!headers || typeof headers !== 'object') return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

function normalizedBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`invalid quote base URL ${JSON.stringify(baseUrl)}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('quote base URL must use http or https');
  }
  return parsed.href.replace(/\/$/, '');
}

async function fetchOneQuote({ symbol, baseUrl, window, fetchImpl, now, timeoutMs }) {
  const sourceUrl = `${baseUrl}/api/quote?symbol=${encodeURIComponent(symbol)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetchImpl(sourceUrl, { signal: controller.signal });
    if (!response?.ok) throw new Error(`HTTP ${response?.status ?? 'unknown'}`);
    const payload = await response.json();
    const refPx = Number(payload?.c);
    if (!(Number.isFinite(refPx) && refPx > 0)) throw new Error('response c must be finite and positive');
    const requestId = String(headerValue(response.headers, 'X-Request-Id') || '').trim();
    if (!requestId) throw new Error('response is missing X-Request-Id');

    const observed = now();
    const observedAt = (observed instanceof Date ? observed : new Date(observed));
    if (Number.isNaN(observedAt.getTime())) throw new Error('quote observation clock is invalid');
    const providerSeconds = Number(payload?.t);
    if (!(Number.isFinite(providerSeconds) && providerSeconds > 0)) {
      throw new Error('response t must be a positive provider timestamp');
    }
    const providerMs = providerSeconds * 1000;
    const ageMs = observedAt.getTime() - providerMs;
    if (ageMs < -QUOTE_FUTURE_TOLERANCE_MS) throw new Error('provider timestamp is in the future');
    if (ageMs > QUOTE_MAX_AGE_MS[window]) {
      throw new Error(`provider quote is stale by ${Math.round(ageMs / 1000)} seconds`);
    }
    if (window === 'post-market') {
      const observedEt = easternTimeParts(observedAt);
      const providerEt = easternTimeParts(new Date(providerMs));
      const closeMinutes = isEarlyCloseSession(observedEt.date) ? 13 * 60 : 16 * 60;
      if (providerEt.date !== observedEt.date || providerEt.minutes < closeMinutes - 5) {
        throw new Error('provider timestamp is not a current-session closing-near print');
      }
    }

    return {
      symbol,
      receipt: {
        sourceUrl,
        requestId,
        observedAt: observedAt.toISOString(),
        providerTimestamp: new Date(providerMs).toISOString(),
        refPx,
      },
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${symbol}: quote request exceeded ${timeoutMs}ms`);
    throw new Error(`${symbol}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchArenaExecutionQuotes({
  symbols,
  window,
  baseUrl = 'https://feida.au',
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = 12_000,
} = {}) {
  if (!ARENA_MODEL_EXECUTION_WINDOWS.S.includes(window) && window !== 'post-market') {
    throw new Error(`unsupported execution window ${JSON.stringify(window)}`);
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  if (!(Number.isFinite(timeoutMs) && timeoutMs > 0)) throw new Error('quote timeout must be positive');
  const unique = [...new Set((symbols || []).map((symbol) => String(symbol).trim()).filter(Boolean))].sort();
  const origin = normalizedBaseUrl(baseUrl);
  const results = await Promise.allSettled(unique.map((symbol) => fetchOneQuote({
    symbol, baseUrl: origin, window, fetchImpl, now, timeoutMs,
  })));
  const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
  if (failures.length) throw new Error(`execution quote batch incomplete: ${failures.join('; ')}`);

  const receipts = Object.fromEntries(results.map((result) => [result.value.symbol, result.value.receipt]));
  const priceMap = Object.fromEntries(Object.entries(receipts).map(([symbol, receipt]) => [symbol, receipt.refPx]));
  return { priceMap, receipts };
}

/** Shared live-settlement receipt validator used by the rules runner and publisher. */
export function validateArenaExecutionQuoteReceipt(receipt, {
  symbol,
  refPx,
  executedAt,
  maxObservationLagMs = 30_000,
} = {}) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, error: 'execution quote receipt must be an object' };
  }
  const expectedUrl = `https://feida.au/api/quote?symbol=${encodeURIComponent(symbol)}`;
  if (receipt.sourceUrl !== expectedUrl) {
    return { ok: false, error: `execution quote source must be ${expectedUrl}` };
  }
  if (typeof receipt.requestId !== 'string' || !receipt.requestId.trim()) {
    return { ok: false, error: 'execution quote requestId must be non-empty' };
  }
  if (!(typeof receipt.refPx === 'number' && Number.isFinite(receipt.refPx) && receipt.refPx > 0)) {
    return { ok: false, error: 'execution quote refPx must be finite and positive' };
  }
  if (receipt.refPx !== refPx) return { ok: false, error: 'execution quote refPx does not match settlement priceMap' };
  const observedMs = Date.parse(receipt.observedAt);
  const providerMs = Date.parse(receipt.providerTimestamp);
  const executedMs = Date.parse(executedAt);
  if (!Number.isFinite(observedMs) || !Number.isFinite(providerMs) || !Number.isFinite(executedMs)) {
    return { ok: false, error: 'execution quote timestamps must be valid ISO timestamps' };
  }
  if (observedMs > executedMs) return { ok: false, error: 'execution quote cannot be observed after trade execution' };
  if (executedMs - observedMs > maxObservationLagMs) {
    return { ok: false, error: 'execution quote observation is too far from trade execution' };
  }
  if (providerMs > observedMs + QUOTE_FUTURE_TOLERANCE_MS) {
    return { ok: false, error: 'execution quote provider timestamp is in the future' };
  }
  return { ok: true, error: null };
}
