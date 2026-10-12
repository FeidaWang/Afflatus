/**
 * Deterministic, long-only USD paper ledger. No broker and no network access.
 * Persist the entire ledger in a transaction and serialize every mutation per id.
 * See docs/engine-contract.md for execution and accounting assumptions.
 */

export const DEFAULT_RISK = Object.freeze({
  maxPositionWeight: 0.25,
  maxSectorWeight: 0.45,
  maxGrossWeight: 0.95,
  maxQuoteAgeMs: 90_000,
  feeBps: 1,
  slippageBps: 5,
});

const MONEY_SCALE = 1_000_000;
const QUANTITY_SCALE = 100_000_000;
const ZERO_HASH = '0'.repeat(64);
const busyLedgers = new WeakSet();
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const clone = (value) => structuredClone(value);
const error = (code, message, details) => ({ code, message, ...(details ? { details } : {}) });
const reject = (...errors) => ({ ok: false, status: 'rejected', errors });

function micros(value) {
  const result = Math.round(value * MONEY_SCALE);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result)) {
    throw new RangeError('Amount exceeds the supported USD micro-unit range.');
  }
  return result;
}

const money = (value) => micros(value) / MONEY_SCALE;
const sumMoney = (...values) => {
  const result = values.reduce((sum, value) => sum + micros(value), 0);
  if (!Number.isSafeInteger(result)) throw new RangeError('Amount exceeds the supported USD range.');
  return result / MONEY_SCALE;
};
const quantity = (value) => Math.round(value * QUANTITY_SCALE) / QUANTITY_SCALE;
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const iso = (value) => new Date(value).toISOString();
const time = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const validKey = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const symbolOf = (value) => typeof value === 'string' ? value.trim().toUpperCase() : '';
const validSymbol = (value) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(value);
const sectorOf = (value) => typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'UNKNOWN';

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite numbers cannot be audited.');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Only JSON values can be audited.');
}

async function digest(value) {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is required (Node 22+ or Cloudflare Workers).');
  const bytes = new TextEncoder().encode(canonical(value));
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stateForHash(ledger) {
  const { audit, ...state } = ledger;
  return state;
}

async function appendAudit(ledger, at, type, payload) {
  const body = {
    version: 1,
    sequence: ledger.audit.length + 1,
    at,
    type,
    payload: clone(payload),
    previousHash: ledger.audit.at(-1)?.hash ?? ZERO_HASH,
    stateHash: await digest(stateForHash(ledger)),
  };
  ledger.audit.push({ ...body, hash: await digest(body) });
}

async function mutate(ledger, operation) {
  if (busyLedgers.has(ledger)) {
    return reject(error('CONCURRENT_MUTATION', 'Serialize ledger writes and retry with the same idempotency key.'));
  }
  busyLedgers.add(ledger);
  try {
    const draft = clone(ledger);
    const result = await operation(draft);
    // Commit only after all validation and hashing succeeds. Storage transactions remain the caller's job.
    for (const key of Object.keys(ledger)) if (!own(draft, key)) delete ledger[key];
    Object.assign(ledger, draft);
    return clone(result);
  } finally {
    busyLedgers.delete(ledger);
  }
}

function validateRisk(risk) {
  for (const name of ['maxPositionWeight', 'maxSectorWeight', 'maxGrossWeight']) {
    if (!finite(risk[name]) || risk[name] <= 0 || risk[name] > 1) throw new RangeError(`${name} must be in (0, 1].`);
  }
  if (!finite(risk.maxQuoteAgeMs) || risk.maxQuoteAgeMs < 0 || risk.maxQuoteAgeMs > 86_400_000) {
    throw new RangeError('maxQuoteAgeMs must be between 0 and one day.');
  }
  for (const name of ['feeBps', 'slippageBps']) {
    if (!finite(risk[name]) || risk[name] < 0 || risk[name] > 1_000) throw new RangeError(`${name} must be between 0 and 1,000.`);
  }
}

export function createLedger({ id = 'paper', initialCash = 10_000, now = new Date().toISOString(), risk = {} } = {}) {
  if (!validKey(id)) throw new TypeError('Ledger id must be a safe identifier of 1–128 characters.');
  if (!positive(initialCash) || money(initialCash) <= 0) throw new RangeError('initialCash must be a positive supported USD amount.');
  if (!Number.isFinite(time(now))) throw new TypeError('now must be an ISO timestamp.');
  const policy = { ...DEFAULT_RISK, ...risk };
  if (Object.keys(policy).some((name) => !own(DEFAULT_RISK, name))) throw new TypeError('Unknown risk policy field.');
  validateRisk(policy);
  return {
    schemaVersion: 1,
    id,
    currency: 'USD',
    mode: 'paper',
    initialCash: money(initialCash),
    cash: money(initialCash),
    createdAt: iso(now),
    updatedAt: iso(now),
    risk: policy,
    paused: false,
    containsDemoData: false,
    realizedPnl: 0,
    feesPaid: 0,
    dividendIncome: 0,
    positions: {},
    orders: [],
    fills: [],
    journal: [],
    audit: [],
    idempotency: {},
    corporateActions: {},
    nextOrderSequence: 1,
    nextFillSequence: 1,
  };
}

function contextErrors(ledger, context = {}) {
  if (!Number.isFinite(time(context.now))) return [error('INVALID_TIME', 'A server-owned ISO context.now is required.')];
  if (time(context.now) < time(ledger.updatedAt)) {
    return [error('TIME_REVERSAL', 'Mutation time cannot precede the last committed ledger event.')];
  }
  return [];
}

function normalizeEvidence(evidence) {
  if (evidence === undefined) return [];
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array.');
  if (evidence.length > 100) throw new RangeError('At most 100 evidence references are supported per order.');
  return evidence.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.source !== 'string' || !item.source.trim() || !Number.isFinite(time(item.asOf))) {
      throw new TypeError('Each evidence reference requires id, source and a valid asOf.');
    }
    return {
      id: item.id.slice(0, 256),
      source: item.source.slice(0, 512),
      asOf: iso(item.asOf),
      ...(typeof item.url === 'string' ? { url: item.url.slice(0, 2_048) } : {}),
    };
  });
}

function normalizedOrder(order) {
  if (!order || typeof order !== 'object') throw new TypeError('order must be an object.');
  const supported = new Set(['idempotencyKey', 'symbol', 'side', 'type', 'quantity', 'limitPrice', 'strategyId', 'decisionId', 'snapshotId', 'decisionAsOf', 'evidence']);
  if (Object.keys(order).some((key) => !supported.has(key))) throw new TypeError('Order includes an unsupported field.');
  return {
    idempotencyKey: order.idempotencyKey,
    symbol: symbolOf(order.symbol),
    side: order.side,
    type: order.type,
    quantity: order.quantity,
    ...(order.limitPrice !== undefined ? { limitPrice: order.limitPrice } : {}),
    ...(order.strategyId !== undefined ? { strategyId: order.strategyId } : {}),
    ...(order.decisionId !== undefined ? { decisionId: order.decisionId } : {}),
    ...(order.snapshotId !== undefined ? { snapshotId: order.snapshotId } : {}),
    ...(order.decisionAsOf !== undefined ? { decisionAsOf: order.decisionAsOf } : {}),
    evidence: normalizeEvidence(order.evidence),
  };
}

function orderErrors(order, now) {
  const errors = [];
  if (!validKey(order.idempotencyKey)) errors.push(error('INVALID_IDEMPOTENCY_KEY', 'A safe idempotencyKey of 1–128 characters is required.'));
  if (!validSymbol(order.symbol)) errors.push(error('INVALID_SYMBOL', 'A supported equity or ETF symbol is required.'));
  if (!['buy', 'sell'].includes(order.side)) errors.push(error('INVALID_SIDE', 'side must be buy or sell.'));
  if (!['market', 'limit'].includes(order.type)) errors.push(error('INVALID_ORDER_TYPE', 'type must be market or limit.'));
  if (!positive(order.quantity) || !Number.isSafeInteger(Math.round(order.quantity * QUANTITY_SCALE))
    || Math.abs(order.quantity - quantity(order.quantity)) > 1e-10 || quantity(order.quantity) === 0) {
    errors.push(error('INVALID_QUANTITY', 'quantity must be positive with at most eight decimal places.'));
  }
  if (order.type === 'limit' && (!positive(order.limitPrice) || order.limitPrice < 1 / MONEY_SCALE)) {
    errors.push(error('INVALID_LIMIT', 'A positive USD limitPrice of at least one micro-dollar is required.'));
  }
  if (order.type === 'market' && own(order, 'limitPrice')) errors.push(error('UNEXPECTED_LIMIT', 'Market orders cannot carry a limitPrice.'));
  for (const name of ['strategyId', 'decisionId', 'snapshotId']) {
    if (own(order, name) && (typeof order[name] !== 'string' || !order[name].trim() || order[name].length > 256)) {
      errors.push(error('INVALID_METADATA', `${name} must be a nonempty string up to 256 characters.`));
    }
  }
  if (own(order, 'decisionAsOf') && (!Number.isFinite(time(order.decisionAsOf)) || time(order.decisionAsOf) > time(now))) {
    errors.push(error('FUTURE_DECISION', 'decisionAsOf must be valid and cannot be after execution time.'));
  }
  if (order.evidence.some((item) => time(item.asOf) > time(now))) errors.push(error('FUTURE_EVIDENCE', 'Evidence cannot be dated after decision or execution time.'));
  if (order.decisionAsOf && order.evidence.some((item) => time(item.asOf) > time(order.decisionAsOf))) {
    errors.push(error('EVIDENCE_AFTER_DECISION', 'Decision evidence must already have existed at decisionAsOf.'));
  }
  return errors;
}

function getQuote(quotes, symbol) {
  if (quotes instanceof Map) return quotes.get(symbol);
  if (Array.isArray(quotes)) return quotes.find((quote) => symbolOf(quote?.symbol) === symbol);
  return quotes && own(quotes, symbol) ? quotes[symbol] : undefined;
}

function minimumQuoteTime(ledger, symbol) {
  let minimum = time(ledger.positions[symbol]?.minQuoteAsOf);
  for (const entry of Object.values(ledger.corporateActions ?? {})) {
    if (entry.action?.symbol !== symbol) continue;
    const effective = time(entry.action.effectiveAt);
    if (Number.isFinite(effective) && (!Number.isFinite(minimum) || effective > minimum)) minimum = effective;
  }
  return minimum;
}

function quoteErrors(ledger, quote, symbol, context, execution = true) {
  if (!quote || typeof quote !== 'object') return [error('MISSING_QUOTE', `A quote is required for ${symbol}.`, { symbol })];
  const errors = [];
  if (symbolOf(quote.symbol) !== symbol) errors.push(error('SYMBOL_MISMATCH', 'The quote symbol does not match the order.'));
  if (quote.currency !== 'USD') errors.push(error('CURRENCY_MISMATCH', 'Only explicitly USD-denominated quotes are supported.'));
  if (!positive(quote.price)) errors.push(error('INVALID_PRICE', 'Quote price must be a positive finite number.'));
  else {
    try { if (money(quote.price) <= 0) errors.push(error('INVALID_PRICE', 'Quote price is below supported precision.')); }
    catch { errors.push(error('INVALID_PRICE', 'Quote price exceeds supported precision.')); }
  }
  if (quote.bid !== undefined && !positive(quote.bid)) errors.push(error('INVALID_BID', 'bid must be a positive finite number.'));
  if (quote.ask !== undefined && !positive(quote.ask)) errors.push(error('INVALID_ASK', 'ask must be a positive finite number.'));
  if (positive(quote.bid) && positive(quote.ask) && quote.bid > quote.ask) errors.push(error('CROSSED_QUOTE', 'bid cannot exceed ask.'));
  if (typeof quote.source !== 'string' || !quote.source.trim()) errors.push(error('MISSING_SOURCE', 'The quote requires a named source.'));
  if (!Number.isFinite(time(quote.asOf))) errors.push(error('INVALID_QUOTE_TIME', 'Quote asOf must be a valid timestamp.'));
  else {
    if (time(quote.asOf) > time(context.now)) errors.push(error('FUTURE_QUOTE', 'A future-dated quote cannot be used.'));
    if (execution && time(context.now) - time(quote.asOf) > ledger.risk.maxQuoteAgeMs) errors.push(error('STALE_QUOTE', 'The quote is too old for execution.'));
    const minQuoteAsOf = minimumQuoteTime(ledger, symbol);
    if (Number.isFinite(minQuoteAsOf) && time(quote.asOf) < minQuoteAsOf) {
      errors.push(error('PRE_CORPORATE_ACTION_QUOTE', 'A post-corporate-action quote is required for the new share basis.'));
    }
  }
  if (quote.quality === 'demo' && context.allowDemo !== true) errors.push(error('DEMO_NOT_AUTHORIZED', 'Synthetic demo data requires explicit server authorization.'));
  const executable = quote.quality === 'realtime' || (quote.quality === 'demo' && context.allowDemo === true);
  const markable = ['realtime', 'delayed', 'eod', 'stale'].includes(quote.quality)
    || (quote.quality === 'demo' && context.allowDemo === true);
  if (execution ? !executable : !markable) {
    errors.push(error('QUOTE_QUALITY', execution ? 'Only realtime or explicitly authorized demo quotes can execute.' : 'This quote cannot be used for valuation.'));
  }
  return errors;
}

function quoteSnapshot(quote) {
  return {
    symbol: symbolOf(quote.symbol),
    price: quote.price,
    ...(quote.bid !== undefined ? { bid: quote.bid } : {}),
    ...(quote.ask !== undefined ? { ask: quote.ask } : {}),
    asOf: iso(quote.asOf),
    source: quote.source,
    quality: quote.quality,
    currency: quote.currency,
    sector: sectorOf(quote.sector),
    ...(quote.snapshotId !== undefined ? { snapshotId: quote.snapshotId } : {}),
  };
}

function pendingReservations(ledger, excludeOrderId = null) {
  const result = { cash: 0, fees: 0, buys: [], sellQuantities: {} };
  for (const order of ledger.orders) {
    if (order.status !== 'pending' || order.id === excludeOrderId) continue;
    if (order.side === 'buy') {
      result.cash = sumMoney(result.cash, order.reservedCash);
      result.fees = sumMoney(result.fees, order.reservedFee);
      result.buys.push(order);
    } else {
      result.sellQuantities[order.symbol] = quantity((result.sellQuantities[order.symbol] ?? 0) + order.quantity);
    }
  }
  return result;
}

function evaluateNormalized(ledger, order, quote, context, pendingRecord = null) {
  const early = [...contextErrors(ledger, context), ...orderErrors(order, context?.now)];
  if (early.length) return reject(...early);
  if (context.marketOpen !== true) return reject(error('MARKET_CLOSED', 'Execution requires a server-verified open market.'));
  if (order.side === 'buy' && ledger.paused) return reject(error('TRADING_PAUSED', 'The kill switch blocks new exposure; sells remain available.'));
  const invalidQuote = quoteErrors(ledger, quote, order.symbol, context, true);
  if (invalidQuote.length) return reject(...invalidQuote);
  if (!pendingRecord && order.snapshotId !== undefined && order.snapshotId !== quote.snapshotId) {
    return reject(error('SNAPSHOT_MISMATCH', 'The decision snapshotId does not match the submitted quote.'));
  }
  if (pendingRecord && (time(quote.asOf) < time(pendingRecord.createdAt)
    || time(quote.asOf) <= time(pendingRecord.submittedQuote.asOf))) {
    return reject(error('NO_NEW_QUOTE', 'A resting order needs a newer quote at or after order creation.'));
  }
  const basePrice = order.side === 'buy' ? quote.ask ?? quote.price : quote.bid ?? quote.price;
  const signedSlippage = (order.side === 'buy' ? 1 : -1) * ledger.risk.slippageBps / 10_000;
  const executionPrice = money(basePrice * (1 + signedSlippage));
  if (!positive(executionPrice)) return reject(error('ORDER_TOO_SMALL', 'Execution price is below the supported monetary precision.'));
  const fillable = order.type === 'market' || (order.side === 'buy' ? executionPrice <= order.limitPrice : executionPrice >= order.limitPrice);
  const reservationPrice = fillable ? executionPrice : order.limitPrice;
  const notional = money(order.quantity * executionPrice);
  const fee = money(notional * ledger.risk.feeBps / 10_000);
  const reservedNotional = money(order.quantity * reservationPrice);
  const reservedFee = money(reservedNotional * ledger.risk.feeBps / 10_000);
  const requiredCash = sumMoney(reservedNotional, reservedFee);
  if (notional <= 0 || reservedNotional <= 0) return reject(error('ORDER_TOO_SMALL', 'Notional is below one USD micro-unit.'));
  const reservations = pendingReservations(ledger, pendingRecord?.id);
  const availableCash = sumMoney(ledger.cash, -reservations.cash);
  const position = own(ledger.positions, order.symbol) ? ledger.positions[order.symbol] : undefined;
  const sector = position?.sector ?? sectorOf(quote.sector);
  if (position && sectorOf(quote.sector) !== 'UNKNOWN' && sector !== 'UNKNOWN' && sectorOf(quote.sector) !== sector) {
    return reject(error('SECTOR_MISMATCH', 'The quote sector conflicts with the existing position classification.'));
  }
  if (order.side === 'sell') {
    const availableQuantity = quantity((position?.quantity ?? 0) - (reservations.sellQuantities[order.symbol] ?? 0));
    if (quantity(order.quantity) > availableQuantity) {
      return reject(error('INSUFFICIENT_POSITION', 'Short selling and selling reserved shares are disabled.', { availableQuantity }));
    }
  } else {
    if (!Number.isSafeInteger(Math.round(((position?.quantity ?? 0) + order.quantity) * QUANTITY_SCALE))) {
      return reject(error('POSITION_QUANTITY_RANGE', 'The resulting position exceeds the supported share precision.'));
    }
    if (micros(requiredCash) > micros(availableCash)) return reject(error('INSUFFICIENT_CASH', 'Order plus fees exceeds unreserved cash.', { availableCash, requiredCash }));
    const exposures = {};
    const sectors = {};
    let currentMarketValue = 0;
    for (const held of Object.values(ledger.positions)) {
      const mark = held.symbol === order.symbol ? quote : getQuote(context.quotes, held.symbol);
      const invalidMark = quoteErrors(ledger, mark, held.symbol, context, true);
      if (invalidMark.length) return reject(error('MISSING_FRESH_PORTFOLIO_MARK', 'Every held position needs a fresh executable-quality mark before a buy.', { symbol: held.symbol, reasons: invalidMark }));
      const marketValue = money(held.quantity * mark.price);
      exposures[held.symbol] = { value: marketValue, sector: held.sector };
      currentMarketValue = sumMoney(currentMarketValue, marketValue);
    }
    for (const pending of reservations.buys) {
      const existing = exposures[pending.symbol] ?? { value: 0, sector: pending.sector };
      exposures[pending.symbol] = { value: sumMoney(existing.value, pending.reservedNotional), sector: existing.sector };
    }
    const addedExposure = fillable ? money(order.quantity * quote.price) : reservedNotional;
    const existing = exposures[order.symbol] ?? { value: 0, sector };
    exposures[order.symbol] = { value: sumMoney(existing.value, addedExposure), sector: existing.sector };
    const executionMarkDifference = fillable ? money(order.quantity * (executionPrice - quote.price)) : 0;
    const projectedNav = sumMoney(ledger.cash, currentMarketValue, -reservations.fees, -reservedFee, -executionMarkDifference);
    if (projectedNav <= 0) return reject(error('NONPOSITIVE_NAV', 'Projected equity must remain positive.'));
    let gross = 0;
    for (const exposure of Object.values(exposures)) {
      gross = sumMoney(gross, exposure.value);
      sectors[exposure.sector] = sumMoney(sectors[exposure.sector] ?? 0, exposure.value);
    }
    const constraints = [
      ['MAX_POSITION_WEIGHT', exposures[order.symbol].value / projectedNav, ledger.risk.maxPositionWeight],
      ['MAX_SECTOR_WEIGHT', sectors[sector] / projectedNav, ledger.risk.maxSectorWeight],
      ['MAX_GROSS_WEIGHT', gross / projectedNav, ledger.risk.maxGrossWeight],
    ];
    const breaches = constraints.filter(([, actual, maximum]) => actual > maximum + 1e-12)
      .map(([code, actual, maximum]) => error(code, 'Projected exposure including pending buy reservations exceeds the risk policy.', { actual, maximum }));
    if (breaches.length) return reject(...breaches);
  }
  return {
    ok: true,
    status: fillable ? 'fillable' : 'pending',
    errors: [],
    sector,
    availableCash,
    execution: {
      price: executionPrice,
      basePrice,
      quantity: quantity(order.quantity),
      notional,
      fee,
      slippage: money(Math.abs(executionPrice - basePrice) * order.quantity),
      feeBps: ledger.risk.feeBps,
      slippageBps: ledger.risk.slippageBps,
      cashDelta: order.side === 'buy' ? -sumMoney(notional, fee) : sumMoney(notional, -fee),
    },
    reservation: {
      notional: reservedNotional,
      fee: reservedFee,
      cash: order.side === 'buy' ? requiredCash : 0,
      quantity: order.side === 'sell' ? quantity(order.quantity) : 0,
    },
    provenance: {
      asOf: iso(quote.asOf),
      observedAt: iso(context.now),
      source: quote.source,
      quality: quote.quality,
      demo: quote.quality === 'demo',
      paper: true,
      ...(quote.snapshotId !== undefined ? { snapshotId: quote.snapshotId } : {}),
      evidence: clone(order.evidence),
    },
  };
}

/** Pure preflight; submitOrder always validates again before booking. */
export function evaluateOrder(ledger, order, quote, context = {}) {
  try {
    return evaluateNormalized(ledger, normalizedOrder(order), quote, context);
  } catch (cause) {
    return reject(error('INVALID_INPUT', cause.message));
  }
}

function addJournal(ledger, entry) {
  ledger.journal.push({ id: `${ledger.id}:journal:${ledger.journal.length + 1}`, ...entry });
}

function bookFill(ledger, record, evaluation, quote, at, snapshotHash) {
  const { execution } = evaluation;
  const old = own(ledger.positions, record.symbol) ? ledger.positions[record.symbol] : undefined;
  let costBasisDelta;
  let realizedPnlDelta = 0;
  if (record.side === 'buy') {
    costBasisDelta = sumMoney(execution.notional, execution.fee);
    const heldQuantity = quantity((old?.quantity ?? 0) + record.quantity);
    const costBasis = sumMoney(old?.costBasis ?? 0, costBasisDelta);
    ledger.positions[record.symbol] = {
      symbol: record.symbol,
      quantity: heldQuantity,
      costBasis,
      averageCost: costBasis / heldQuantity,
      sector: old?.sector ?? evaluation.sector,
      ...(old?.minQuoteAsOf ? { minQuoteAsOf: old.minQuoteAsOf } : {}),
    };
  } else {
    const closing = quantity(record.quantity) === quantity(old.quantity);
    costBasisDelta = -(closing ? old.costBasis : money(old.costBasis * record.quantity / old.quantity));
    realizedPnlDelta = sumMoney(execution.notional, -execution.fee, costBasisDelta);
    if (closing) delete ledger.positions[record.symbol];
    else {
      const heldQuantity = quantity(old.quantity - record.quantity);
      const costBasis = sumMoney(old.costBasis, costBasisDelta);
      ledger.positions[record.symbol] = { ...old, quantity: heldQuantity, costBasis, averageCost: costBasis / heldQuantity };
    }
  }
  ledger.cash = sumMoney(ledger.cash, execution.cashDelta);
  ledger.realizedPnl = sumMoney(ledger.realizedPnl, realizedPnlDelta);
  ledger.feesPaid = sumMoney(ledger.feesPaid, execution.fee);
  ledger.containsDemoData ||= quote.quality === 'demo';
  const fill = {
    id: `${ledger.id}:fill:${ledger.nextFillSequence++}`,
    orderId: record.id,
    symbol: record.symbol,
    side: record.side,
    at,
    ...execution,
    costBasisDelta,
    realizedPnl: realizedPnlDelta,
    snapshotHash,
    quote: quoteSnapshot(quote),
    provenance: clone(evaluation.provenance),
  };
  ledger.fills.push(fill);
  addJournal(ledger, {
    at,
    type: 'trade',
    symbol: record.symbol,
    orderId: record.id,
    fillId: fill.id,
    cashDelta: execution.cashDelta,
    quantityDelta: record.side === 'buy' ? record.quantity : -record.quantity,
    costBasisDelta,
    realizedPnlDelta,
    fee: execution.fee,
    dividendIncomeDelta: 0,
  });
  Object.assign(record, { status: 'filled', updatedAt: at, filledAt: at, fillId: fill.id, reservedCash: 0, reservedFee: 0, reservedNotional: 0 });
  return fill;
}

function preflightIdempotency(ledger, order) {
  let normalized;
  let fingerprint;
  try {
    normalized = normalizedOrder(order);
    fingerprint = canonical(normalized);
  } catch (cause) {
    return { result: reject(error('INVALID_INPUT', cause.message)) };
  }
  if (!validKey(normalized.idempotencyKey)) return { result: reject(error('INVALID_IDEMPOTENCY_KEY', 'A safe idempotency key is required.')) };
  const existing = own(ledger.idempotency, normalized.idempotencyKey) ? ledger.idempotency[normalized.idempotencyKey] : undefined;
  if (existing) {
    return { result: existing.fingerprint === fingerprint
      ? { ...clone(existing.response), replayed: true }
      : reject(error('IDEMPOTENCY_CONFLICT', 'This idempotency key has already been used for a different order payload.')) };
  }
  return { normalized, fingerprint };
}

export async function submitOrder(ledger, order, quote, context = {}) {
  // Copy external inputs before the first await so a caller cannot change a quote
  // between validation, hashing and booking the fill.
  try { order = clone(order); quote = clone(quote); context = clone(context); }
  catch (cause) { return reject(error('INVALID_INPUT', cause.message)); }
  return mutate(ledger, async (draft) => {
    const prepared = preflightIdempotency(draft, order);
    if (prepared.result) return prepared.result;
    const { normalized, fingerprint } = prepared;
    // Invalid/retrograde event clocks cannot be appended to a valid chronological chain.
    const clockErrors = contextErrors(draft, context);
    if (clockErrors.length) return reject(...clockErrors);
    let evaluation;
    try { evaluation = evaluateNormalized(draft, normalized, quote, context); }
    catch (cause) { evaluation = reject(error('INVALID_INPUT', cause.message)); }
    const at = iso(context.now);
    const id = `${draft.id}:order:${draft.nextOrderSequence++}`;
    const record = {
      id,
      ...normalized,
      createdAt: at,
      updatedAt: at,
      status: evaluation.ok ? 'pending' : 'rejected',
      reservedCash: 0,
      reservedFee: 0,
      reservedNotional: 0,
      errors: clone(evaluation.errors),
    };
    let fill;
    if (evaluation.ok) {
      const snapshot = quoteSnapshot(quote);
      const snapshotHash = await digest({ quote: snapshot, decisionAsOf: normalized.decisionAsOf ?? at, evidence: normalized.evidence });
      Object.assign(record, {
        sector: evaluation.sector,
        submittedQuote: snapshot,
        snapshotHash,
        provenance: clone(evaluation.provenance),
        reservedCash: evaluation.reservation.cash,
        reservedFee: normalized.side === 'buy' ? evaluation.reservation.fee : 0,
        reservedNotional: normalized.side === 'buy' ? evaluation.reservation.notional : 0,
      });
      draft.containsDemoData ||= quote.quality === 'demo';
      if (evaluation.status === 'fillable') fill = bookFill(draft, record, evaluation, quote, at, snapshotHash);
    }
    draft.orders.push(record);
    draft.updatedAt = at;
    const response = {
      ok: evaluation.ok,
      status: record.status,
      orderId: id,
      order: clone(record),
      ...(fill ? { fill: clone(fill) } : {}),
      errors: clone(evaluation.errors),
      replayed: false,
    };
    draft.idempotency[normalized.idempotencyKey] = { fingerprint, response: clone(response) };
    await appendAudit(draft, at, evaluation.ok ? (fill ? 'ORDER_FILLED' : 'ORDER_ACCEPTED') : 'ORDER_REJECTED', {
      orderId: id,
      idempotencyKey: normalized.idempotencyKey,
      ...(record.snapshotHash ? { snapshotHash: record.snapshotHash } : {}),
      ...(fill ? { fillId: fill.id, cashDelta: fill.cashDelta } : {}),
      errors: evaluation.errors,
    });
    return response;
  });
}

export async function processPendingOrders(ledger, quotes, context = {}) {
  try { quotes = clone(quotes); context = clone(context); }
  catch (cause) { return { ...reject(error('INVALID_INPUT', cause.message)), results: [] }; }
  return mutate(ledger, async (draft) => {
    const clockErrors = contextErrors(draft, context);
    if (clockErrors.length) return { ...reject(...clockErrors), results: [] };
    const at = iso(context.now);
    const results = [];
    // FIFO is deterministic. Existing reservations are included and the current order's are excluded.
    for (const record of draft.orders.filter((item) => item.status === 'pending')) {
      const quote = getQuote(quotes, record.symbol);
      let evaluation;
      try { evaluation = evaluateNormalized(draft, record, quote, { ...context, quotes }, record); }
      catch (cause) { evaluation = reject(error('INVALID_INPUT', cause.message)); }
      if (!evaluation.ok || evaluation.status !== 'fillable') {
        results.push({ orderId: record.id, ok: evaluation.ok, status: 'pending', errors: evaluation.errors });
        continue;
      }
      const snapshotHash = await digest({ quote: quoteSnapshot(quote), decisionAsOf: record.decisionAsOf ?? record.createdAt, evidence: record.evidence });
      const fill = bookFill(draft, record, evaluation, quote, at, snapshotHash);
      draft.updatedAt = at;
      await appendAudit(draft, at, 'PENDING_ORDER_FILLED', { orderId: record.id, fillId: fill.id, snapshotHash, cashDelta: fill.cashDelta });
      results.push({ orderId: record.id, ok: true, status: 'filled', fill: clone(fill), errors: [] });
    }
    return { ok: true, status: 'processed', results, fills: results.filter((item) => item.status === 'filled').map((item) => item.fill) };
  });
}

export async function cancelOrder(ledger, orderId, context = {}) {
  return mutate(ledger, async (draft) => {
    const record = draft.orders.find((item) => item.id === orderId);
    if (!record) return reject(error('ORDER_NOT_FOUND', 'The order does not exist.'));
    if (record.status === 'cancelled') return { ok: true, status: 'cancelled', orderId, replayed: true };
    if (record.status !== 'pending') return reject(error('ORDER_NOT_PENDING', 'Only resting limit orders can be cancelled.'));
    const errors = contextErrors(draft, context);
    if (errors.length) return reject(...errors);
    const at = iso(context.now);
    Object.assign(record, { status: 'cancelled', updatedAt: at, cancelledAt: at, reservedCash: 0, reservedFee: 0, reservedNotional: 0 });
    draft.updatedAt = at;
    await appendAudit(draft, at, 'ORDER_CANCELLED', { orderId });
    return { ok: true, status: 'cancelled', orderId, replayed: false };
  });
}

export async function setTradingPaused(ledger, paused, context = {}) {
  if (typeof paused !== 'boolean') return reject(error('INVALID_PAUSE_VALUE', 'paused must be boolean.'));
  return mutate(ledger, async (draft) => {
    const errors = contextErrors(draft, context);
    if (errors.length) return reject(...errors);
    if (draft.paused === paused) return { ok: true, status: 'unchanged', paused, replayed: true };
    draft.paused = paused;
    draft.updatedAt = iso(context.now);
    await appendAudit(draft, draft.updatedAt, paused ? 'TRADING_PAUSED' : 'TRADING_RESUMED', {
      paused,
      ...(typeof context.reason === 'string' ? { reason: context.reason.slice(0, 1_024) } : {}),
    });
    return { ok: true, status: paused ? 'paused' : 'resumed', paused, replayed: false };
  });
}

/** Pure, explicitly quality-labelled valuation. Missing marks yield null NAV, never zero prices. */
export function markToMarket(ledger, quotes, context = {}) {
  const errors = [];
  const warnings = [];
  if (!Number.isFinite(time(context.now))) errors.push(error('INVALID_TIME', 'A valuation timestamp is required.'));
  if (time(context.now) < time(ledger.updatedAt)) errors.push(error('HISTORICAL_STATE_UNAVAILABLE', 'Current holdings cannot be valued at a time before their last ledger event.'));
  const positions = [];
  let marketValue = 0;
  let unrealizedPnl = 0;
  let fresh = true;
  for (const held of Object.values(ledger.positions)) {
    const quote = getQuote(quotes, held.symbol);
    const invalid = quoteErrors(ledger, quote, held.symbol, context, false);
    if (invalid.length) {
      errors.push(...invalid.map((item) => ({ ...item, symbol: held.symbol })));
      positions.push({ ...clone(held), price: null, marketValue: null, unrealizedPnl: null, quality: quote?.quality ?? 'unavailable' });
      fresh = false;
      continue;
    }
    let value;
    try { value = money(held.quantity * quote.price); }
    catch (cause) {
      errors.push(error('INVALID_MARK_VALUE', cause.message, { symbol: held.symbol }));
      positions.push({ ...clone(held), price: quote.price, marketValue: null, unrealizedPnl: null, quality: quote.quality });
      fresh = false;
      continue;
    }
    const pnl = sumMoney(value, -held.costBasis);
    const executionErrors = quoteErrors(ledger, quote, held.symbol, context, true);
    if (executionErrors.length) {
      fresh = false;
      warnings.push({ code: 'INDICATIVE_VALUATION', symbol: held.symbol, quality: quote.quality, ageMs: time(context.now) - time(quote.asOf) });
    }
    marketValue = sumMoney(marketValue, value);
    unrealizedPnl = sumMoney(unrealizedPnl, pnl);
    positions.push({
      ...clone(held), price: quote.price, marketValue: value, unrealizedPnl: pnl,
      quality: quote.quality, asOf: iso(quote.asOf), source: quote.source,
      demo: quote.quality === 'demo', executableMark: executionErrors.length === 0,
    });
  }
  const complete = errors.length === 0;
  const nav = complete ? sumMoney(ledger.cash, marketValue) : null;
  const reservations = pendingReservations(ledger);
  return {
    asOf: Number.isFinite(time(context.now)) ? iso(context.now) : null,
    currency: 'USD', mode: 'paper', containsDemoData: ledger.containsDemoData || positions.some((item) => item.demo),
    cash: ledger.cash, availableCash: sumMoney(ledger.cash, -reservations.cash), reservedCash: reservations.cash,
    costBasis: sumMoney(...Object.values(ledger.positions).map((item) => item.costBasis)),
    marketValue: complete ? marketValue : null, nav,
    unrealizedPnl: complete ? unrealizedPnl : null,
    realizedPnl: ledger.realizedPnl, dividendIncome: ledger.dividendIncome, feesPaid: ledger.feesPaid,
    totalPnl: complete ? sumMoney(nav, -ledger.initialCash) : null,
    totalReturn: complete ? nav / ledger.initialCash - 1 : null,
    grossWeight: complete && nav > 0 ? marketValue / nav : null,
    complete, fresh: complete && fresh, positions, errors, warnings,
  };
}

function normalizeAction(action) {
  if (!action || typeof action !== 'object') throw new TypeError('Corporate action must be an object.');
  const normalized = {
    idempotencyKey: action.idempotencyKey,
    symbol: symbolOf(action.symbol),
    type: action.type,
    effectiveAt: action.effectiveAt,
    source: action.source,
    ...(action.ratio !== undefined ? { ratio: action.ratio } : {}),
    ...(action.amountPerShare !== undefined ? { amountPerShare: action.amountPerShare } : {}),
    evidence: normalizeEvidence(action.evidence),
  };
  return normalized;
}

export async function applyCorporateAction(ledger, action, context = {}) {
  return mutate(ledger, async (draft) => {
    let normalized;
    let fingerprint;
    try { normalized = normalizeAction(action); fingerprint = canonical(normalized); }
    catch (cause) { return reject(error('INVALID_ACTION', cause.message)); }
    if (!validKey(normalized.idempotencyKey)) return reject(error('INVALID_IDEMPOTENCY_KEY', 'Corporate actions require a safe provider-stable idempotency key.'));
    const previous = own(draft.corporateActions, normalized.idempotencyKey) ? draft.corporateActions[normalized.idempotencyKey] : undefined;
    if (previous) return previous.fingerprint === fingerprint
      ? { ...clone(previous.response), replayed: true }
      : reject(error('IDEMPOTENCY_CONFLICT', 'Corporate action key was used for a different payload.'));
    const errors = contextErrors(draft, context);
    if (!validSymbol(normalized.symbol)) errors.push(error('INVALID_SYMBOL', 'Corporate action symbol is invalid.'));
    if (!['split', 'dividend'].includes(normalized.type)) errors.push(error('INVALID_ACTION_TYPE', 'Only splits and ex-date cash dividends are supported.'));
    if (typeof normalized.source !== 'string' || !normalized.source.trim()) errors.push(error('MISSING_SOURCE', 'Corporate actions require an authoritative source.'));
    if (!Number.isFinite(time(normalized.effectiveAt)) || time(normalized.effectiveAt) > time(context.now)) errors.push(error('FUTURE_ACTION', 'effectiveAt must be valid and cannot be in the future.'));
    if (time(normalized.effectiveAt) < time(draft.updatedAt)) errors.push(error('RETROACTIVE_ACTION', 'Replay events in time order; do not apply an action after later holdings changes.'));
    if (normalized.evidence.some((item) => time(item.asOf) > time(context.now))) errors.push(error('FUTURE_EVIDENCE', 'Corporate action evidence cannot be future-dated.'));
    if (normalized.type === 'split' && (!positive(normalized.ratio) || normalized.ratio > 1_000_000)) errors.push(error('INVALID_RATIO', 'split ratio must be positive and supported.'));
    if (normalized.type === 'dividend' && !positive(normalized.amountPerShare)) errors.push(error('INVALID_DIVIDEND', 'amountPerShare must be positive.'));
    if (errors.length) return reject(...errors);
    const at = iso(context.now);
    const effectiveAt = iso(normalized.effectiveAt);
    const held = own(draft.positions, normalized.symbol) ? draft.positions[normalized.symbol] : undefined;
    const entitledQuantity = held?.quantity ?? 0;
    let cashDelta = 0;
    let quantityDelta = 0;
    if (normalized.type === 'split' && held) {
      const newQuantity = quantity(held.quantity * normalized.ratio);
      if (!positive(newQuantity) || !Number.isSafeInteger(Math.round(newQuantity * QUANTITY_SCALE))
        || Math.abs(newQuantity - held.quantity * normalized.ratio) > 1e-10) {
        return reject(error('UNSUPPORTED_SPLIT_PRECISION', 'Fractional shares exceed the supported precision; explicit cash-in-lieu handling is required.'));
      }
      quantityDelta = quantity(newQuantity - held.quantity);
      Object.assign(held, { quantity: newQuantity, averageCost: held.costBasis / newQuantity, minQuoteAsOf: effectiveAt });
    }
    if (normalized.type === 'dividend') {
      try { cashDelta = money(entitledQuantity * normalized.amountPerShare); }
      catch (cause) { return reject(error('INVALID_DIVIDEND', cause.message)); }
      draft.cash = sumMoney(draft.cash, cashDelta);
      draft.dividendIncome = sumMoney(draft.dividendIncome, cashDelta);
      if (held) held.minQuoteAsOf = effectiveAt;
    }
    const cancelledOrderIds = [];
    for (const order of draft.orders) {
      if (order.status === 'pending' && order.symbol === normalized.symbol) {
        Object.assign(order, { status: 'cancelled', updatedAt: at, cancelledAt: at, cancelReason: 'corporate_action', reservedCash: 0, reservedFee: 0, reservedNotional: 0 });
        cancelledOrderIds.push(order.id);
      }
    }
    addJournal(draft, {
      at: effectiveAt,
      recordedAt: at,
      type: normalized.type,
      symbol: normalized.symbol,
      actionKey: normalized.idempotencyKey,
      cashDelta,
      quantityDelta,
      costBasisDelta: 0,
      realizedPnlDelta: 0,
      fee: 0,
      dividendIncomeDelta: normalized.type === 'dividend' ? cashDelta : 0,
    });
    draft.updatedAt = at;
    const response = { ok: true, status: 'applied', type: normalized.type, symbol: normalized.symbol, effectiveAt, cashDelta, quantityDelta, entitledQuantity, cancelledOrderIds, replayed: false };
    draft.corporateActions[normalized.idempotencyKey] = { fingerprint, action: clone(normalized), response: clone(response) };
    await appendAudit(draft, at, 'CORPORATE_ACTION_APPLIED', { ...response, source: normalized.source, evidence: normalized.evidence });
    return response;
  });
}

/** Bookkeeping checks independent of quote movements; all errors are machine-readable. */
export function ledgerInvariantReport(ledger) {
  const errors = [];
  try {
    if (ledger.cash < 0) errors.push(error('NEGATIVE_CASH', 'Cash cannot be negative.'));
    const journalCash = sumMoney(ledger.initialCash, ...ledger.journal.map((entry) => entry.cashDelta));
    if (micros(journalCash) !== micros(ledger.cash)) errors.push(error('CASH_RECONCILIATION', 'Cash does not reconcile to the journal.'));
    const basisTotal = sumMoney(...Object.values(ledger.positions).map((position) => position.costBasis));
    if (micros(sumMoney(ledger.cash, basisTotal)) !== micros(sumMoney(ledger.initialCash, ledger.realizedPnl, ledger.dividendIncome))) {
      errors.push(error('CAPITAL_IDENTITY', 'Cash plus open cost basis must equal initial capital plus realized PnL plus dividend income.'));
    }
    for (const [name, entryField] of [['realizedPnl', 'realizedPnlDelta'], ['feesPaid', 'fee'], ['dividendIncome', 'dividendIncomeDelta']]) {
      if (micros(ledger[name]) !== micros(sumMoney(...ledger.journal.map((entry) => entry[entryField] ?? 0)))) {
        errors.push(error('JOURNAL_RECONCILIATION', `${name} does not reconcile to the journal.`));
      }
    }
    const symbols = new Set([...Object.keys(ledger.positions), ...ledger.journal.map((entry) => entry.symbol)]);
    for (const symbol of symbols) {
      const entries = ledger.journal.filter((entry) => entry.symbol === symbol);
      const held = ledger.positions[symbol];
      const journalQuantity = entries.reduce((sum, entry) => quantity(sum + entry.quantityDelta), 0);
      const journalBasis = sumMoney(...entries.map((entry) => entry.costBasisDelta));
      if (journalQuantity !== (held?.quantity ?? 0) || micros(journalBasis) !== micros(held?.costBasis ?? 0)) errors.push(error('POSITION_RECONCILIATION', `Position ${symbol} does not reconcile.`, { symbol }));
      if (held && (!positive(held.quantity) || held.costBasis < 0 || !finite(held.averageCost))) errors.push(error('INVALID_POSITION', `Position ${symbol} has invalid quantity or cost basis.`));
    }
    const reservations = pendingReservations(ledger);
    if (micros(reservations.cash) > micros(ledger.cash)) errors.push(error('CASH_OVERRESERVED', 'Pending buys over-reserve cash.'));
    for (const [symbol, reserved] of Object.entries(reservations.sellQuantities)) {
      if (reserved > (ledger.positions[symbol]?.quantity ?? 0)) errors.push(error('SHARES_OVERRESERVED', 'Pending sells over-reserve shares.', { symbol }));
    }
    if (new Set(ledger.fills.map((fill) => fill.orderId)).size !== ledger.fills.length) errors.push(error('DUPLICATE_FILL', 'A full-fill-only order cannot fill twice.'));
  } catch (cause) {
    errors.push(error('MALFORMED_LEDGER', cause.message));
  }
  return { valid: errors.length === 0, errors };
}

/** Hash integrity, final state integrity and accounting. It is not an external authenticity signature. */
export async function verifyAuditChain(ledger) {
  const errors = [];
  let previousHash = ZERO_HASH;
  let previousTime = time(ledger.createdAt);
  try {
    for (let index = 0; index < ledger.audit.length; index += 1) {
      const event = ledger.audit[index];
      const { hash, ...body } = event;
      if (event.sequence !== index + 1 || event.previousHash !== previousHash) errors.push(error('BROKEN_CHAIN', 'Audit sequence or previous hash is invalid.', { index }));
      if (!Number.isFinite(time(event.at)) || time(event.at) < previousTime) errors.push(error('AUDIT_TIME_REVERSAL', 'Audit timestamps must be chronological.', { index }));
      if (await digest(body) !== hash) errors.push(error('EVENT_HASH_MISMATCH', 'An audit event was changed.', { index }));
      previousHash = hash;
      previousTime = time(event.at);
    }
    if (ledger.audit.length) {
      if (await digest(stateForHash(ledger)) !== ledger.audit.at(-1).stateHash) errors.push(error('STATE_HASH_MISMATCH', 'The current ledger differs from its last audited state.'));
    } else {
      const initial = createLedger({ id: ledger.id, initialCash: ledger.initialCash, now: ledger.createdAt, risk: ledger.risk });
      if (canonical(stateForHash(ledger)) !== canonical(stateForHash(initial))) errors.push(error('UNAUDITED_STATE', 'An empty audit chain can only represent a new ledger.'));
    }
    errors.push(...ledgerInvariantReport(ledger).errors);
  } catch (cause) {
    errors.push(error('MALFORMED_AUDIT', cause.message));
  }
  return { valid: errors.length === 0, eventCount: ledger.audit?.length ?? 0, headHash: previousHash, errors };
}
