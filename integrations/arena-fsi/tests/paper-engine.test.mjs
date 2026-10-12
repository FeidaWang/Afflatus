import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLedger, evaluateOrder, submitOrder, processPendingOrders, cancelOrder,
  markToMarket, applyCorporateAction, setTradingPaused, verifyAuditChain, ledgerInvariantReport,
} from '../src/core/paper-engine.mjs';

const START = '2026-10-12T14:00:00.000Z';
const later = (seconds = 1) => new Date(Date.parse(START) + seconds * 1_000).toISOString();
const unrestricted = { maxPositionWeight: 1, maxSectorWeight: 1, maxGrossWeight: 1 };
const ledger = (risk = {}, cash = 10_000) => createLedger({ id: 'test', initialCash: cash, now: START, risk: { ...unrestricted, ...risk } });
const quote = (symbol = 'AAPL', price = 100, asOf = START, extra = {}) => ({ symbol, price, asOf, source: 'test-market', quality: 'realtime', currency: 'USD', sector: 'Technology', snapshotId: `${symbol}:${asOf}:${price}`, ...extra });
const context = (now = START, extra = {}) => ({ now, allowDemo: false, marketOpen: true, ...extra });
const order = (key = 'buy-1', extra = {}) => ({ idempotencyKey: key, symbol: 'AAPL', side: 'buy', type: 'market', quantity: 10, ...extra });
const hasError = (result, code) => result.errors.some((entry) => entry.code === code);
const near = (actual, expected, tolerance = 0.0000011) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);

test('initial ledger is auditable, uses USD and preserves cash identity', async () => {
  const account = createLedger({ now: START });
  assert.equal(account.cash, 10_000);
  assert.equal(account.currency, 'USD');
  assert.equal(account.risk.maxPositionWeight, 0.25);
  assert.equal((await verifyAuditChain(account)).valid, true);
  assert.equal(ledgerInvariantReport(account).valid, true);
});

test('preflight is pure and fee/spread/slippage enter cash, cost and realized PnL exactly once', async () => {
  const account = ledger();
  const before = structuredClone(account);
  const q = quote('AAPL', 100, START, { bid: 99.9, ask: 100 });
  const preflight = evaluateOrder(account, order(), q, context());
  assert.equal(preflight.status, 'fillable');
  assert.deepEqual(account, before);
  const buy = await submitOrder(account, order(), q, context());
  assert.equal(buy.status, 'filled');
  near(account.cash, 8999.39995);
  near(account.positions.AAPL.costBasis, 1000.60005);
  near(buy.fill.slippage, 0.5);
  const sellQuote = quote('AAPL', 110, later(), { bid: 109.9, ask: 110.1 });
  const sell = await submitOrder(account, order('sell-1', { side: 'sell', quantity: 4 }), sellQuote, context(later()));
  assert.equal(sell.status, 'filled');
  near(account.positions.AAPL.costBasis, 600.36003);
  near(account.realizedPnl, 39.096242);
  const mark = markToMarket(account, { AAPL: sellQuote }, context(later()));
  near(mark.totalPnl, mark.realizedPnl + mark.unrealizedPnl + mark.dividendIncome);
  assert.equal(mark.positions[0].quantity, 6);
  assert.equal(ledgerInvariantReport(account).valid, true);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('closing the entire position allocates all remaining cost basis with no rounding residue', async () => {
  const account = ledger();
  await submitOrder(account, order('fraction-buy', { quantity: 3.12345678 }), quote(), context());
  await submitOrder(account, order('fraction-sell', { side: 'sell', quantity: 1.12345678 }), quote('AAPL', 101, later()), context(later()));
  await submitOrder(account, order('close', { side: 'sell', quantity: 2 }), quote('AAPL', 102, later(2)), context(later(2)));
  assert.equal(account.positions.AAPL, undefined);
  near(account.cash - account.initialCash, account.realizedPnl);
  assert.equal(ledgerInvariantReport(account).valid, true);
});

test('separately valid buy quantities cannot overflow the supported combined position precision', async () => {
  const account = ledger({ feeBps: 0, slippageBps: 0 });
  const first = await submitOrder(account, order('large-share-count', { quantity: 90_000_000 }), quote('AAPL', 0.000001), context());
  assert.equal(first.status, 'filled');
  const second = await submitOrder(account, order('overflow-share-count', { quantity: 90_000_000 }), quote('AAPL', 0.000001, later()), context(later()));
  assert.equal(hasError(second, 'POSITION_QUANTITY_RANGE'), true);
  assert.equal(account.positions.AAPL.quantity, 90_000_000);
  assert.equal(ledgerInvariantReport(account).valid, true);
});

test('insufficient cash includes fees; short sales and overselling are rejected without money movement', async () => {
  const account = ledger();
  const oversized = await submitOrder(account, order('oversized', { quantity: 100 }), quote(), context());
  assert.equal(hasError(oversized, 'INSUFFICIENT_CASH'), true);
  const short = await submitOrder(account, order('short', { side: 'sell', quantity: 1 }), quote(), context());
  assert.equal(hasError(short, 'INSUFFICIENT_POSITION'), true);
  assert.equal(account.cash, 10_000);
  assert.equal(account.fills.length, 0);
  assert.equal(account.journal.length, 0);
  assert.equal(account.audit.length, 2);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('default position, sector and total exposure limits are enforced with fees in NAV', async () => {
  const positionAccount = createLedger({ id: 'position-risk', now: START });
  const position = await submitOrder(positionAccount, order('too-big', { quantity: 25 }), quote(), context());
  assert.equal(hasError(position, 'MAX_POSITION_WEIGHT'), true);
  const sectorAccount = ledger({ maxSectorWeight: 0.25 });
  await submitOrder(sectorAccount, order('first', { quantity: 15 }), quote(), context());
  const secondQuote = quote('MSFT', 100, later());
  const sector = await submitOrder(sectorAccount, order('second', { symbol: 'MSFT', quantity: 15 }), secondQuote,
    context(later(), { quotes: { AAPL: quote('AAPL', 100, later()) } }));
  assert.equal(hasError(sector, 'MAX_SECTOR_WEIGHT'), true);
  const grossAccount = ledger({ maxGrossWeight: 0.15 });
  const gross = await submitOrder(grossAccount, order('gross', { quantity: 20 }), quote(), context());
  assert.equal(hasError(gross, 'MAX_GROSS_WEIGHT'), true);
});

test('all current holdings need fresh marks for buying; risk-reducing sells need only their own fresh quote', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote(), context());
  const msft = quote('MSFT', 100, later());
  const noMark = await submitOrder(account, order('new', { symbol: 'MSFT' }), msft, context(later()));
  assert.equal(hasError(noMark, 'MISSING_FRESH_PORTFOLIO_MARK'), true);
  const delayedMark = await submitOrder(account, order('delayed-mark', { symbol: 'MSFT' }), msft,
    context(later(), { quotes: { AAPL: quote('AAPL', 100, later(), { quality: 'delayed' }) } }));
  assert.equal(hasError(delayedMark, 'MISSING_FRESH_PORTFOLIO_MARK'), true);
  const withMark = await submitOrder(account, order('with-mark', { symbol: 'MSFT' }), msft,
    context(later(), { quotes: { AAPL: quote('AAPL', 100, later()) } }));
  assert.equal(withMark.status, 'filled');
  const reduce = await submitOrder(account, order('reduce', { side: 'sell', quantity: 1 }), quote('AAPL', 100, later(2)), context(later(2)));
  assert.equal(reduce.status, 'filled');
});

for (const [name, modify, expected] of [
  ['stale timestamp', { asOf: '2026-10-12T13:58:29.000Z' }, 'STALE_QUOTE'],
  ['future timestamp', { asOf: later(1) }, 'FUTURE_QUOTE'],
  ['invalid price', { price: -1 }, 'INVALID_PRICE'],
  ['missing price', { price: null }, 'INVALID_PRICE'],
  ['extreme price', { price: 1e100 }, 'INVALID_PRICE'],
  ['delayed feed', { quality: 'delayed' }, 'QUOTE_QUALITY'],
  ['end of day feed', { quality: 'eod' }, 'QUOTE_QUALITY'],
  ['stale quality', { quality: 'stale' }, 'QUOTE_QUALITY'],
  ['unavailable feed', { quality: 'unavailable' }, 'QUOTE_QUALITY'],
  ['unauthorized demo', { quality: 'demo' }, 'DEMO_NOT_AUTHORIZED'],
  ['foreign currency', { currency: 'AUD' }, 'CURRENCY_MISMATCH'],
  ['crossed spread', { bid: 102, ask: 100 }, 'CROSSED_QUOTE'],
  ['missing source', { source: '' }, 'MISSING_SOURCE'],
  ['wrong symbol', { symbol: 'MSFT' }, 'SYMBOL_MISMATCH'],
  ['ambiguous local timestamp', { asOf: '2026-10-12T14:00:00' }, 'INVALID_QUOTE_TIME'],
]) {
  test(`execution rejects ${name}`, async () => {
    const account = ledger();
    const result = await submitOrder(account, order(), quote('AAPL', 100, START, modify), context());
    assert.equal(result.ok, false);
    assert.equal(hasError(result, expected), true, JSON.stringify(result.errors));
    assert.equal(account.cash, 10_000);
  });
}

test('authorized demo executions remain explicitly and permanently labeled synthetic', async () => {
  const account = ledger();
  const result = await submitOrder(account, order(), quote('AAPL', 100, START, { quality: 'demo' }), context(START, { allowDemo: true }));
  assert.equal(result.fill.provenance.demo, true);
  assert.equal(result.fill.provenance.paper, true);
  assert.equal(account.containsDemoData, true);
  await submitOrder(account, order('close', { side: 'sell' }), quote('AAPL', 101, later()), context(later()));
  const mark = markToMarket(account, {}, context(later()));
  assert.equal(mark.containsDemoData, true);
});

test('timestamp parsing preserves compatibility with explicit RFC3339 nanosecond market timestamps', async () => {
  const account = ledger();
  const result = await submitOrder(account, order(), quote('AAPL', 100, '2026-10-12T14:00:00.000000000Z'), context());
  assert.equal(result.status, 'filled');
  assert.equal(result.fill.quote.asOf, START);
});

test('idempotent replay never revalidates a changed market or books money twice; conflicting payload is rejected', async () => {
  const account = ledger();
  const request = order();
  const original = await submitOrder(account, request, quote(), context());
  const committed = structuredClone(account);
  const replay = await submitOrder(account, request, undefined, { now: 'invalid', marketOpen: false });
  assert.equal(replay.replayed, true);
  assert.deepEqual({ ...replay, replayed: false }, original);
  assert.deepEqual(account, committed);
  const conflict = await submitOrder(account, { ...request, quantity: 11 }, quote(), context());
  assert.equal(hasError(conflict, 'IDEMPOTENCY_CONFLICT'), true);
  assert.deepEqual(account, committed);
});

test('rejected trading attempts with valid keys are also idempotent', async () => {
  const account = ledger();
  const request = order('no-funds', { quantity: 500 });
  await submitOrder(account, request, quote(), context());
  const replay = await submitOrder(account, request, quote('AAPL', 1, later()), context(later()));
  assert.equal(replay.status, 'rejected');
  assert.equal(replay.replayed, true);
  assert.equal(account.orders.length, 1);
});

test('limit orders reserve cash and never execute beyond the limit after slippage', async () => {
  const account = ledger();
  const request = order('limit', { type: 'limit', quantity: 20, limitPrice: 90 });
  const submitted = await submitOrder(account, request, quote(), context());
  assert.equal(submitted.status, 'pending');
  assert.equal(account.cash, 10_000);
  near(markToMarket(account, {}, context()).reservedCash, 1800.18);
  const touch = await processPendingOrders(account, { AAPL: quote('AAPL', 90, later()) }, context(later()));
  assert.equal(touch.fills.length, 0, 'a quote at the limit with positive slippage should remain resting');
  const execution = await processPendingOrders(account, { AAPL: quote('AAPL', 89.9, later(2)) }, context(later(2)));
  assert.equal(execution.fills.length, 1);
  assert.ok(execution.fills[0].price <= 90);
  assert.equal(account.orders[0].reservedCash, 0);
  assert.equal(account.positions.AAPL.quantity, 20);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('sell limits never fill below their limit, and pending sells reserve shares', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote(), context());
  const limitSell = await submitOrder(account, order('limit-sell', { side: 'sell', type: 'limit', quantity: 7, limitPrice: 110 }), quote('AAPL', 100, later()), context(later()));
  assert.equal(limitSell.status, 'pending');
  const overreserved = await submitOrder(account, order('double-sell', { side: 'sell', quantity: 4 }), quote('AAPL', 100, later()), context(later()));
  assert.equal(hasError(overreserved, 'INSUFFICIENT_POSITION'), true);
  const touch = await processPendingOrders(account, { AAPL: quote('AAPL', 110, later(2)) }, context(later(2)));
  assert.equal(touch.fills.length, 0);
  const crossed = await processPendingOrders(account, { AAPL: quote('AAPL', 110.1, later(3)) }, context(later(3)));
  assert.equal(crossed.fills.length, 1);
  assert.ok(crossed.fills[0].price >= 110);
  assert.equal(account.positions.AAPL.quantity, 3);
});

test('pending cash and risk reservations prevent oversubscription and are released on cancellation', async () => {
  const account = ledger();
  const first = await submitOrder(account, order('reserve', { type: 'limit', quantity: 60, limitPrice: 90 }), quote(), context());
  const second = await submitOrder(account, order('oversubscribe', { type: 'limit', quantity: 60, limitPrice: 90 }), quote(), context());
  assert.equal(first.status, 'pending');
  assert.equal(hasError(second, 'INSUFFICIENT_CASH'), true);
  const cancelled = await cancelOrder(account, first.orderId, context(later()));
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(markToMarket(account, {}, context(later())).reservedCash, 0);
  assert.equal((await cancelOrder(account, first.orderId, context(later()))).replayed, true);
  assert.equal((await verifyAuditChain(account)).valid, true);
  const riskAccount = ledger({ maxPositionWeight: 0.25 });
  await submitOrder(riskAccount, order('reserve-risk', { type: 'limit', quantity: 20, limitPrice: 90 }), quote(), context());
  const position = await submitOrder(riskAccount, order('exceed-risk', { type: 'limit', quantity: 10, limitPrice: 90 }), quote(), context());
  assert.equal(hasError(position, 'MAX_POSITION_WEIGHT'), true);
});

test('resting orders cannot be filled from a quote published before their creation or from an unchanged snapshot time', async () => {
  const account = ledger();
  await submitOrder(account, order('resting', { type: 'limit', limitPrice: 90 }), quote(), context(later(10)));
  const retroactive = await processPendingOrders(account, { AAPL: quote('AAPL', 80, later(5)) }, context(later(11)));
  assert.equal(retroactive.fills.length, 0);
  assert.equal(hasError(retroactive.results[0], 'NO_NEW_QUOTE'), true);
  const unchanged = await processPendingOrders(account, { AAPL: quote('AAPL', 80, START) }, context(later(11)));
  assert.equal(unchanged.fills.length, 0);
  assert.equal(hasError(unchanged.results[0], 'NO_NEW_QUOTE'), true);
});

test('pending orders are re-risked against current portfolio prices before execution', async () => {
  const account = ledger({ maxPositionWeight: 0.25 });
  await submitOrder(account, order('held', { quantity: 15 }), quote(), context());
  const pending = await submitOrder(account, order('resting', { type: 'limit', quantity: 10, limitPrice: 90 }), quote('AAPL', 100, later()), context(later()));
  assert.equal(pending.status, 'pending');
  // A separate mark with a higher last trade and a lower executable ask makes projected marked exposure exceed the cap.
  const changed = await processPendingOrders(account, { AAPL: quote('AAPL', 150, later(2), { bid: 89.7, ask: 89.8 }) }, context(later(2)));
  assert.equal(changed.fills.length, 0);
  assert.equal(hasError(changed.results[0], 'MAX_POSITION_WEIGHT'), true);
});

test('kill switch prevents market and resting buys but permits selling and cancelling', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote(), context());
  const pending = await submitOrder(account, order('rest', { type: 'limit', limitPrice: 90 }), quote('AAPL', 100, later()), context(later()));
  await setTradingPaused(account, true, context(later(2), { reason: 'operator pause' }));
  const blocked = await submitOrder(account, order('blocked'), quote('AAPL', 89, later(3)), context(later(3)));
  assert.equal(hasError(blocked, 'TRADING_PAUSED'), true);
  const rest = await processPendingOrders(account, { AAPL: quote('AAPL', 89, later(3)) }, context(later(3)));
  assert.equal(rest.fills.length, 0);
  const reduce = await submitOrder(account, order('reduce', { side: 'sell', quantity: 1 }), quote('AAPL', 89, later(4)), context(later(4)));
  assert.equal(reduce.status, 'filled');
  assert.equal((await cancelOrder(account, pending.orderId, context(later(5)))).ok, true);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('market clock and decision evidence reject future information and ambiguous snapshots', async () => {
  const account = ledger();
  const marketClosed = await submitOrder(account, order('closed'), quote(), context(START, { marketOpen: false }));
  assert.equal(hasError(marketClosed, 'MARKET_CLOSED'), true);
  const snapshot = await submitOrder(account, order('snapshot', { snapshotId: 'other' }), quote(), context());
  assert.equal(hasError(snapshot, 'SNAPSHOT_MISMATCH'), true);
  const future = await submitOrder(account, order('evidence', { evidence: [{ id: 'filing', source: 'SEC', asOf: later() }] }), quote(), context());
  assert.equal(hasError(future, 'FUTURE_EVIDENCE'), true);
  const afterDecision = await submitOrder(account, order('late-evidence', { decisionAsOf: START, evidence: [{ id: 'filing', source: 'SEC', asOf: later() }] }), quote('AAPL', 100, later(2)), context(later(2)));
  assert.equal(hasError(afterDecision, 'EVIDENCE_AFTER_DECISION'), true);
  const reversed = await submitOrder(account, order('reversed'), quote(), context());
  assert.equal(hasError(reversed, 'TIME_REVERSAL'), true);
});

test('orders persist a reproducible input snapshot hash and evidence provenance', async () => {
  const account = ledger();
  const q = quote();
  const result = await submitOrder(account, order('provenance', {
    snapshotId: q.snapshotId,
    decisionId: 'decision-1',
    strategyId: 'quality',
    decisionAsOf: START,
    evidence: [{ id: '10-k', source: 'SEC', asOf: START, url: 'https://www.sec.gov/example' }],
  }), q, context());
  assert.match(result.order.snapshotHash, /^[a-f0-9]{64}$/);
  assert.equal(result.fill.snapshotHash, result.order.snapshotHash);
  assert.equal(result.fill.provenance.evidence[0].id, '10-k');
  assert.deepEqual(result.fill.quote.price, 100);
});

test('asynchronous hashing cannot introduce a quote or evidence change after preflight', async () => {
  const account = ledger();
  const q = quote();
  const request = order('immutable', { evidence: [{ id: 'filing', source: 'SEC', asOf: START }] });
  const submitted = submitOrder(account, request, q, context());
  q.price = 999;
  q.quality = 'demo';
  request.evidence[0].source = 'changed after dispatch';
  const result = await submitted;
  assert.equal(result.fill.quote.price, 100);
  assert.equal(result.fill.quote.quality, 'realtime');
  assert.equal(result.fill.provenance.evidence[0].source, 'SEC');
  assert.equal(account.containsDemoData, false);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('read-only marks label delayed/EOD/stale prices, but missing or future marks make NAV unavailable', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote(), context());
  for (const quality of ['delayed', 'eod', 'stale']) {
    const mark = markToMarket(account, { AAPL: quote('AAPL', 101, START, { quality }) }, context(later(300)));
    assert.equal(mark.complete, true);
    assert.equal(mark.fresh, false);
    assert.equal(mark.warnings[0].code, 'INDICATIVE_VALUATION');
  }
  const missing = markToMarket(account, {}, context(later()));
  assert.equal(missing.nav, null);
  assert.equal(missing.complete, false);
  const future = markToMarket(account, { AAPL: quote('AAPL', 101, later(2)) }, context(later()));
  assert.equal(future.nav, null);
  const historical = markToMarket(account, { AAPL: quote() }, context('2026-10-12T13:59:59.000Z'));
  assert.equal(historical.nav, null);
});

test('split preserves cost and adjusted NAV, rejects pre-split marks, cancels old limits and is idempotent', async () => {
  const account = ledger({ feeBps: 0, slippageBps: 0 });
  await submitOrder(account, order(), quote(), context());
  const pending = await submitOrder(account, order('resting', { type: 'limit', limitPrice: 90 }), quote('AAPL', 100, later()), context(later()));
  const action = { idempotencyKey: 'AAPL:split:2026', symbol: 'AAPL', type: 'split', ratio: 2, effectiveAt: later(2), source: 'issuer' };
  const applied = await applyCorporateAction(account, action, context(later(2)));
  assert.equal(applied.status, 'applied');
  assert.equal(account.positions.AAPL.quantity, 20);
  assert.equal(account.positions.AAPL.costBasis, 1000);
  assert.equal(account.positions.AAPL.averageCost, 50);
  assert.deepEqual(applied.cancelledOrderIds, [pending.orderId]);
  assert.equal(markToMarket(account, { AAPL: quote() }, context(later(2))).nav, null);
  assert.equal(markToMarket(account, { AAPL: quote('AAPL', 50, later(2)) }, context(later(2))).nav, 10_000);
  assert.equal((await applyCorporateAction(account, action, context(later(3)))).replayed, true);
  assert.equal(account.positions.AAPL.quantity, 20);
  assert.equal(ledgerInvariantReport(account).valid, true);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('ex-date dividend uses actual pre-action holdings, balances cash income and adjusted NAV, and never duplicates', async () => {
  const account = ledger({ feeBps: 0, slippageBps: 0 });
  await submitOrder(account, order(), quote(), context());
  const action = { idempotencyKey: 'AAPL:dividend:2026', symbol: 'AAPL', type: 'dividend', amountPerShare: 2, effectiveAt: later(), source: 'issuer' };
  const applied = await applyCorporateAction(account, action, context(later()));
  assert.equal(applied.entitledQuantity, 10);
  assert.equal(applied.cashDelta, 20);
  assert.equal(account.cash, 9020);
  assert.equal(account.dividendIncome, 20);
  assert.equal(account.positions.AAPL.costBasis, 1000);
  assert.equal(markToMarket(account, { AAPL: quote() }, context(later())).nav, null);
  const adjusted = markToMarket(account, { AAPL: quote('AAPL', 98, later()) }, context(later()));
  assert.equal(adjusted.nav, 10_000);
  near(adjusted.totalPnl, adjusted.realizedPnl + adjusted.unrealizedPnl + adjusted.dividendIncome);
  assert.equal((await applyCorporateAction(account, action, context(later(2)))).replayed, true);
  assert.equal(account.cash, 9020);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('corporate actions cannot invent historical entitlements, run before effective time, or change payload on retry', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote('AAPL', 100, later(10)), context(later(10)));
  const action = { idempotencyKey: 'dividend', symbol: 'AAPL', type: 'dividend', amountPerShare: 1, effectiveAt: later(5), source: 'issuer' };
  const retroactive = await applyCorporateAction(account, action, context(later(11)));
  assert.equal(hasError(retroactive, 'RETROACTIVE_ACTION'), true);
  const future = await applyCorporateAction(account, { ...action, effectiveAt: later(20) }, context(later(11)));
  assert.equal(hasError(future, 'FUTURE_ACTION'), true);
  const valid = { ...action, effectiveAt: later(12) };
  await applyCorporateAction(account, valid, context(later(12)));
  const conflict = await applyCorporateAction(account, { ...valid, amountPerShare: 2 }, context(later(12)));
  assert.equal(hasError(conflict, 'IDEMPOTENCY_CONFLICT'), true);
});

test('corporate action quote cutoff remains effective even when there is no current position', async () => {
  const account = ledger();
  await applyCorporateAction(account, { idempotencyKey: 'split-empty', symbol: 'AAPL', type: 'split', ratio: 2, effectiveAt: later(), source: 'issuer' }, context(later()));
  const oldBasis = await submitOrder(account, order('old-basis'), quote(), context(later(2)));
  assert.equal(hasError(oldBasis, 'PRE_CORPORATE_ACTION_QUOTE'), true);
  const adjusted = await submitOrder(account, order('new-basis'), quote('AAPL', 50, later(2)), context(later(2)));
  assert.equal(adjusted.status, 'filled');
  await submitOrder(account, order('close-basis', { side: 'sell' }), quote('AAPL', 50, later(3)), context(later(3)));
  const reopened = await submitOrder(account, order('reopen-old'), quote(), context(later(4)));
  assert.equal(hasError(reopened, 'PRE_CORPORATE_ACTION_QUOTE'), true);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('audit detects event tampering, ledger state tampering and event deletion', async () => {
  const account = ledger();
  await submitOrder(account, order(), quote(), context());
  await setTradingPaused(account, true, context(later()));
  const editedEvent = structuredClone(account);
  editedEvent.audit[0].payload.cashDelta += 1;
  assert.equal((await verifyAuditChain(editedEvent)).valid, false);
  const editedState = structuredClone(account);
  editedState.cash += 10;
  const verification = await verifyAuditChain(editedState);
  assert.equal(hasError(verification, 'STATE_HASH_MISMATCH'), true);
  assert.equal(hasError(verification, 'CASH_RECONCILIATION'), true);
  const removed = structuredClone(account);
  removed.audit.shift();
  assert.equal((await verifyAuditChain(removed)).valid, false);
});

test('same-instance parallel mutations are rejected explicitly; retries require external serialization', async () => {
  const account = ledger();
  const [first, concurrent] = await Promise.all([
    submitOrder(account, order('one'), quote(), context()),
    submitOrder(account, order('two'), quote(), context()),
  ]);
  assert.equal(first.status, 'filled');
  assert.equal(hasError(concurrent, 'CONCURRENT_MUTATION'), true);
  assert.equal(account.fills.length, 1);
  const retry = await submitOrder(account, order('two'), quote('AAPL', 100, later()), context(later()));
  assert.equal(retry.status, 'filled');
  assert.equal(account.positions.AAPL.quantity, 20);
  assert.equal((await verifyAuditChain(account)).valid, true);
});

test('sequential multi-order fills conserve cash and basis across mixed fractional buys and sells', async () => {
  const account = ledger({ feeBps: 2, slippageBps: 7 });
  for (let index = 0; index < 40; index += 1) {
    const buying = index % 2 === 0;
    const timestamp = later(index);
    const result = await submitOrder(account, order(`event-${index}`, { quantity: buying ? 0.17345678 : 0.12345678, side: buying ? 'buy' : 'sell' }), quote('AAPL', 100 + (index % 7), timestamp), context(timestamp));
    assert.equal(result.status, 'filled');
    const report = ledgerInvariantReport(account);
    assert.equal(report.valid, true, JSON.stringify(report.errors));
    const mark = markToMarket(account, { AAPL: quote('AAPL', 100 + (index % 7), timestamp) }, context(timestamp));
    near(mark.totalPnl, mark.realizedPnl + mark.unrealizedPnl + mark.dividendIncome);
  }
  assert.equal((await verifyAuditChain(account)).valid, true);
});
