import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArenaService } from '../server/service.mjs';
import { StateStore, MemoryAdapter, SQLiteAdapter } from '../server/store.mjs';
import { createHandler } from '../server/http.mjs';
import { frozenContext, validateIntent } from '../server/ai.mjs';
import { MarketProvider, quoteStatus } from '../server/market.mjs';
import { configuration } from '../server/config.mjs';
import { hash } from '../server/common.mjs';

const START = '2026-10-12T15:00:00.000Z';
const at = (seconds) => new Date(Date.parse(START) + seconds * 1_000).toISOString();
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000002, `${actual} != ${expected}`);

function fixtureSnapshot({ quoteAt = START, receivedAt = START, price = 100, mode = 'live' } = {}) {
  const snapshot = {
    mode, asOf: quoteAt, receivedAt,
    marketOpen: true, calendarStatus: mode === 'demo' ? 'demo' : 'provider',
    quotes: [{ symbol: 'AAPL', price, bid: price - 0.01, ask: price + 0.01,
      asOf: quoteAt, receivedAt, currency: 'USD', source: 'local-test-fixture',
      quality: mode === 'demo' ? 'demo' : 'realtime', sector: 'Technology', previousClose: 100 }],
  };
  snapshot.id = hash(snapshot);
  for (const quote of snapshot.quotes) quote.snapshotId = snapshot.id;
  return snapshot;
}

function intentFor(context) {
  return {
    action: 'buy', symbol: 'AAPL', quantity: 1, confidence: 0.6, horizonHours: 24,
    rationale: 'Local deterministic fixture for the execution gate.',
    counterargument: 'The quoted observation can become outdated.',
    invalidation: 'Reject when new execution evidence is unavailable.',
    sourceIds: [`quote:${context.snapshot.id}:AAPL`],
  };
}

function memoryService(extra = {}) {
  let now = START;
  const service = new ArenaService({
    store: new StateStore(new MemoryAdapter()),
    env: { ARENA_MODE: 'demo', ARENA_WATCHLIST: 'AAPL' },
    clock: () => now,
    ...extra,
  });
  return { service, setNow: (value) => { now = value; } };
}

test('frozen context excludes future quote facts even when receivedAt incorrectly claims earlier availability', () => {
  const future = fixtureSnapshot({ quoteAt: at(5), receivedAt: START });
  const context = frozenContext(future, {}, {}, START);
  assert.equal(context.snapshot.quotes.length, 0);
  assert.equal(context.evidence.length, 0);
  assert.throws(() => validateIntent(intentFor(context), context), { code: 'SYMBOL_OUTSIDE_UNIVERSE' });
  const known = frozenContext(fixtureSnapshot(), {}, {}, START);
  assert.equal(validateIntent(intentFor(known), known).action, 'buy');
});

test('research evidence with a future publication or receipt never leaks through a backdated availableAt', () => {
  const evidence = [
    { id: 'future-publication', visibility: 'public', availableAt: START, publishedAt: at(1) },
    { id: 'future-receipt', visibility: 'public', availableAt: START, receivedAt: at(1) },
    { id: 'known-evidence', visibility: 'public', availableAt: START, publishedAt: START, receivedAt: START },
  ];
  const context = frozenContext(fixtureSnapshot(), {}, { evidence }, START);
  assert.ok(context.evidence.some((item) => item.id === 'known-evidence'));
  assert.ok(!context.evidence.some((item) => item.id.startsWith('future-')));
});

test('display and settlement quote classification reject even a sub-second future timestamp', () => {
  const quote = fixtureSnapshot().quotes[0];
  assert.equal(quoteStatus({ ...quote, asOf: at(0.5) }, START), 'unavailable');
  assert.equal(quoteStatus({ ...quote, quality: 'demo', asOf: at(0.5) }, START), 'unavailable');
});

test('market receipts are stamped after provider responses while original exchange timestamp stays intact', async () => {
  let now = START;
  const env = { ARENA_WATCHLIST: 'AAPL', ALPACA_API_KEY: 'fixture', ALPACA_SECRET_KEY: 'fixture' };
  const fetcher = async (url) => {
    if (String(url).endsWith('/clock')) {
      now = at(3);
      return Response.json({ timestamp: now, is_open: true, next_open: at(3600), next_close: at(7200) });
    }
    now = at(2);
    return Response.json({ AAPL: { latestQuote: { bp: 99.99, ap: 100.01, t: at(1) }, prevDailyBar: { c: 99 } } });
  };
  const snapshot = await new MarketProvider(configuration(env), env, fetcher, () => now).snapshot(START);
  assert.equal(snapshot.quotes[0].asOf, at(1));
  assert.equal(snapshot.quotes[0].receivedAt, at(2));
  assert.equal(snapshot.receivedAt, at(3));
  assert.equal(snapshot.marketOpen, true);
});

for (const freshAfterDecision of [false, true]) {
  test(`AI execution ${freshAfterDecision ? 'accepts a genuinely new' : 'rejects a still-fresh but pre-decision'} quote after analyst and critic finish`, async () => {
    let now = START;
    let snapshots = 0;
    const marketProvider = { snapshot: async () => {
      if (snapshots++ === 0) return fixtureSnapshot();
      if (freshAfterDecision) now = at(35);
      return fixtureSnapshot({ quoteAt: freshAfterDecision ? at(35) : at(20), receivedAt: now });
    } };
    const aiProvider = {
      analyze: async (profile, context) => {
        const value = validateIntent(intentFor(context), context);
        now = at(20);
        return { value, model: 'fixture-model', provider: 'fixture', usage: {} };
      },
      critique: async () => {
        now = at(30);
        return { value: { approved: true, reasons: ['Fixture review completed.'], sourceIds: [] }, usage: {} };
      },
    };
    const service = new ArenaService({ store: new StateStore(new MemoryAdapter()), env: { ARENA_MODE: 'live', ARENA_WATCHLIST: 'AAPL' }, clock: () => now, marketProvider, aiProvider });
    const run = await service.run({ mode: 'live', idempotencyKey: `decision-window-${freshAfterDecision}`, profiles: ['S'] });
    assert.equal(run.decisionAt, at(30));
    const execution = run.results[0].execution;
    if (freshAfterDecision) {
      assert.equal(execution.status, 'filled');
      assert.equal(execution.fill.quote.asOf, at(35));
    } else {
      assert.equal(execution.status, 'rejected');
      assert.ok(execution.errors.some((item) => item.code === 'NO_POST_SIGNAL_QUOTE'));
      assert.equal((await service.read('live')).ledgers.S.fills.length, 0);
    }
  });
}

test('a maximum-length run key can execute, replay and later calibrate its forecast', async () => {
  const { service, setNow } = memoryService();
  const request = { mode: 'demo', idempotencyKey: 'a'.repeat(128), profiles: ['S'] };
  const run = await service.run(request);
  assert.equal(run.results[0].execution.status, 'filled');
  assert.ok(run.results[0].execution.order.idempotencyKey.length <= 128);
  assert.equal((await service.run(request)).replayed, true);
  setNow(at(86_400 + 30));
  const settlement = await service.settle('demo');
  assert.equal(settlement.settled, 1);
  assert.equal(settlement.feedback.count, 1, JSON.stringify(settlement.feedback.excluded));
  assert.equal((await service.read('demo')).ledgers.S.fills.length, 1);
});

test('a split reaches all paper accounts atomically and is excluded from unadjusted forecast scoring', async () => {
  const { service, setNow } = memoryService();
  await service.run({ mode: 'demo', idempotencyKey: 'split-cohort-review', profiles: ['S', 'P', 'T'] });
  const before = await service.status('demo', { admin: true });
  const oldPrice = before.snapshot.quotes[0].price;
  const quantities = Object.fromEntries(Object.entries((await service.read('demo')).ledgers).map(([id, account]) => [id, account.positions.AAPL.quantity]));
  setNow(at(3600));
  const action = { idempotencyKey: 'issuer-split-001', symbol: 'AAPL', type: 'split', ratio: 2, effectiveAt: at(3600), source: 'issuer-fixture' };
  // An obsolete per-account selector must not leave the other shared-price accounts on the old share basis.
  const applied = await service.corporateAction({ mode: 'demo', ledgerId: 'S', action });
  assert.deepEqual(Object.keys(applied.results).sort(), ['P', 'S', 'T']);
  await service.update('demo', (state) => { state.snapshot = fixtureSnapshot({ quoteAt: at(3600), receivedAt: at(3600), price: oldPrice / 2, mode: 'demo' }); return null; }, at(3600));
  const after = await service.status('demo', { admin: true });
  for (const portfolio of after.portfolios) {
    assert.equal(portfolio.valuation.positions[0].quantity, quantities[portfolio.id] * 2);
    near(portfolio.valuation.equity, before.portfolios.find((item) => item.id === portfolio.id).valuation.equity);
  }
  const state = await service.read('demo');
  assert.ok(state.forecasts.every((forecast) => forecast.invalidatedAt && forecast.outcome === null));
  const repeated = await service.corporateAction({ mode: 'demo', ledgerId: 'S', action });
  assert.ok(Object.values(repeated.results).every((result) => result.replayed));
  setNow(at(86_400 + 30));
  const settlement = await service.settle('demo');
  assert.equal(settlement.settled, 0);
  assert.equal(settlement.feedback.count, 0);
  const exported = await service.export('demo');
  assert.ok(Object.values(exported.ledgerVerification).every((verification) => verification.valid));
});

test('failure in one account rolls back a corporate action in all other accounts', async () => {
  const { service, setNow } = memoryService();
  await service.run({ mode: 'demo', idempotencyKey: 'split-rollback-review', profiles: ['S', 'P', 'T'] });
  setNow(at(3600));
  await service.pause({ mode: 'demo', ledgerId: 'P', paused: true });
  const before = await service.read('demo');
  setNow(at(3601));
  await assert.rejects(() => service.corporateAction({ mode: 'demo', action: {
    idempotencyKey: 'split-before-P-event', symbol: 'AAPL', type: 'split', ratio: 2, effectiveAt: at(1800), source: 'issuer-fixture',
  } }), { code: 'CORPORATE_ACTION_REJECTED' });
  const after = await service.read('demo');
  assert.deepEqual(after.ledgers, before.ledgers);
  assert.deepEqual(after.forecasts, before.forecasts);
});

test('health performs a real persistence read and fails closed when the database is unavailable', async () => {
  let reads = 0;
  const store = { persistent: true, read: async () => { reads += 1; throw new Error('private database connection details'); } };
  const service = new ArenaService({ store, env: { ARENA_MODE: 'live' }, clock: () => START });
  const response = await createHandler(service)(new Request('https://example.test/api/arena-fsi?route=health'));
  assert.equal(reads, 1);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
  assert.ok(!JSON.stringify(body).includes('private database connection details'));
});

test('separate SQLite connections serialize duplicate orders and keep demo balances out of live state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-runtime-review-'));
  const file = join(directory, 'paper.sqlite');
  const first = new DatabaseSync(file);
  const second = new DatabaseSync(file);
  try {
    const make = (database) => new ArenaService({ store: new StateStore(new SQLiteAdapter(database)), env: { ARENA_MODE: 'demo' }, clock: () => START });
    const a = make(first);
    const b = make(second);
    await a.refresh('demo');
    const requests = Array.from({ length: 8 }, (_, index) => (index % 2 ? a : b).placeOrder({
      mode: 'demo', ledgerId: 'S', order: { symbol: 'AAPL', side: 'buy', type: 'market', quantity: 1, idempotencyKey: `cross-process-${Math.floor(index / 2)}` },
    }));
    const responses = await Promise.all(requests);
    assert.ok(responses.every((response) => response.status === 'filled'));
    const exported = await b.export('demo');
    assert.equal(exported.state.ledgers.S.fills.length, 4);
    assert.equal(exported.state.ledgers.S.positions.AAPL.quantity, 4);
    assert.equal(exported.ledgerVerification.S.valid, true);
    const live = await a.read('live');
    assert.equal(live.ledgers.S.cash, 10_000);
    assert.deepEqual(live.ledgers.S.positions, {});
    assert.equal(live.forecasts.length, 0);
  } finally {
    first.close();
    second.close();
    await rm(directory, { recursive: true, force: true });
  }
});
