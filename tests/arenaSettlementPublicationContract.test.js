import { describe, expect, it } from 'vitest';
import {
  validateArenaPredlogPublicationDelta,
  validateArenaSettlementPublication,
} from '../src/lib/arenaSettlementPublicationContract.js';

const DATE = '2026-08-12';
const OPEN_NOW = new Date('2026-08-12T14:10:00.000Z');
const OPEN_TS = '2026-08-12T14:11:00.000Z';

function book(overrides = {}) {
  return {
    startEquity: 10000,
    cash: 10000,
    equity: 10000,
    positions: [],
    trades: [],
    rejections: [],
    equityHistory: [{ day: 0, equity: 10000 }],
    review: { en: '', zh: '' },
    ...overrides,
  };
}

function ledger(overrides = {}) {
  return {
    updated: DATE,
    day: 0,
    lastRunDate: DATE,
    bench: { spyPct: 0, smhPct: 0 },
    models: { S: book(), P: book(), T: book() },
    ...overrides,
  };
}

function pick(overrides = {}) {
  return {
    proposalId: 'arena:2026-08-12:S:abc',
    sessionDate: DATE,
    decidedAt: '2026-08-12T12:45:00.000Z',
    expiresAt: '2026-08-12T20:00:00.000Z',
    allowedExecutionWindows: ['open-window', 'late-window'],
    decisionHash: 'sha256:decision',
    sourceHash: 'sha256:source',
    sym: 'NVDA',
    order: { side: 'buy', qty: 5 },
    confidence: 0.9,
    signals: ['earnings', 'flow'],
    entry: 101,
    ...overrides,
  };
}

function picks(modelPick = pick()) {
  return { date: DATE, models: { S: modelPick ? [modelPick] : [], P: [], T: [] } };
}

function run(overrides = {}) {
  return {
    date: DATE,
    window: 'open-window',
    model: 'S',
    status: 'done',
    ordersProposed: 0,
    ordersFilled: 0,
    proposalIds: [],
    ...overrides,
  };
}

function quoteReceipt(symbol = 'NVDA', overrides = {}) {
  return {
    sourceUrl: `https://feida.au/api/quote?symbol=${encodeURIComponent(symbol)}`,
    requestId: `req-${symbol}`,
    observedAt: '2026-08-12T14:10:30.000Z',
    providerTimestamp: '2026-08-12T14:10:00.000Z',
    refPx: 100,
    ...overrides,
  };
}

function trade(modelPick = pick(), overrides = {}) {
  const executionQuote = quoteReceipt(modelPick.sym);
  return {
    ts: OPEN_TS,
    sym: modelPick.sym,
    side: modelPick.order.side,
    qty: modelPick.order.qty,
    px: 100.05,
    fee: 0.025,
    slipBps: 5,
    realizedPnl: null,
    proposalId: modelPick.proposalId,
    decisionHash: modelPick.decisionHash,
    sourceHash: modelPick.sourceHash,
    decidedAt: modelPick.decidedAt,
    executionType: 'proposal',
    executionQuote,
    ...overrides,
  };
}

function validate({
  baselineLedger = ledger(),
  baselineRuns = [],
  candidateLedger = baselineLedger,
  candidateRuns = baselineRuns,
  publishedPicks = picks(),
  pipelineId = 'arena-open',
  now = OPEN_NOW,
} = {}) {
  return validateArenaSettlementPublication({
    baselineLedger,
    baselineRunlog: { runs: baselineRuns },
    candidateLedger,
    candidateRunlog: { runs: candidateRuns },
    publishedPicks,
    pipelineId,
    now,
  });
}

function validFillCandidate(modelPick = pick()) {
  const addedTrade = trade(modelPick);
  const receipt = addedTrade.executionQuote;
  const quoteReceipts = { [modelPick.sym]: receipt };
    const candidateBook = book({
    cash: 9499.725,
    equity: 9999.725,
    positions: [{ sym: modelPick.sym, qty: 5, avgPx: 100.05, mkPx: 100 }],
    trades: [addedTrade],
      equityHistory: [{ day: 0, equity: 9999.725 }],
      lastValuationDate: DATE,
      metrics: { cumPct: -0.003, maxDD: 0, hitRate: null, exposure: 5 },
    valuationAudits: [{
      date: DATE,
      window: 'open-window',
      mode: 'live-execution',
      recordedAt: OPEN_TS,
      quoteReceipts,
    }],
  });
  return {
    modelPick,
    candidateLedger: ledger({
      updated: DATE,
      models: { S: candidateBook, P: book(), T: book() },
    }),
    candidateRuns: [run({
      ordersProposed: 1,
      ordersFilled: 1,
      proposalIds: [modelPick.proposalId],
      quoteReceipts,
    })],
  };
}

describe('Arena settlement publication delta contract', () => {
  it('allows review metadata to change while preserving terminal evidence', () => {
    const terminal = run({ date: '2026-08-11', status: 'missed', note: 'expired honestly' });
    const baseline = ledger();
    const candidate = ledger({
      models: { S: book({ review: { en: 'new', zh: '新' } }), P: book(), T: book() },
    });
    expect(validate({ baselineLedger: baseline, baselineRuns: [terminal], candidateLedger: candidate, candidateRuns: [terminal] }))
      .toEqual({ ok: true, errors: [] });
  });

  it.each(['done', 'missed'])('rejects deletion or modification of terminal %s runlog entries', (status) => {
    const terminal = run({ date: '2026-08-11', status, note: 'original' });
    expect(validate({ baselineRuns: [terminal], candidateRuns: [] }).errors.join(' ')).toMatch(/deleted/);
    expect(validate({ baselineRuns: [terminal], candidateRuns: [{ ...terminal, note: 'rewritten' }] }).errors.join(' '))
      .toMatch(/immutable/);
  });

  it('allows queued to become done only in the matching real window', () => {
    const queued = run({ status: 'queued' });
    const settled = run({ quoteReceipts: {} });
    const candidateLedger = ledger({ models: {
      S: book({
        lastValuationDate: DATE,
        metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
        valuationAudits: [{
        date: DATE, window: 'open-window', mode: 'live-execution', recordedAt: OPEN_TS, quoteReceipts: {},
        }],
      }),
      P: book(),
      T: book(),
    } });
    const inside = validate({ baselineRuns: [queued], candidateRuns: [settled], candidateLedger, now: OPEN_NOW });
    expect(inside.errors, inside.errors.join('\n')).toEqual([]);
    const outside = validate({
      baselineRuns: [queued], candidateRuns: [settled], candidateLedger, now: new Date('2026-08-12T14:30:00.000Z'),
    });
    expect(outside.errors.join(' ')).toMatch(/only inside its real matching window/);
  });

  it('requires an expired queue to become missed and forbids early missed status', () => {
    const queued = run({ status: 'queued' });
    const expiredNow = new Date('2026-08-12T14:30:00.000Z');
    expect(validate({ baselineRuns: [queued], candidateRuns: [{ ...queued, status: 'missed' }], now: expiredNow }).ok).toBe(true);
    expect(validate({ baselineRuns: [queued], candidateRuns: [queued], now: expiredNow }).errors.join(' ')).toMatch(/must transition to missed/);
    expect(validate({ baselineRuns: [queued], candidateRuns: [{ ...queued, status: 'missed' }], now: OPEN_NOW }).errors.join(' '))
      .toMatch(/only after expiry/);
  });

  it.each(['trades', 'rejections', 'equityHistory'])('rejects mutation of the ledger %s prefix', (field) => {
    const baselineBook = book({
      trades: [{ ts: 'old', side: 'sell' }],
      rejections: [{ ts: 'old', reason: 'risk' }],
      equityHistory: [{ day: 0, equity: 10000 }],
    });
    const changedBook = book({ ...baselineBook, [field]: [{ ...baselineBook[field][0], changed: true }] });
    const baselineLedger = ledger({ models: { S: baselineBook, P: book(), T: book() } });
    const candidateLedger = ledger({ models: { S: changedBook, P: book(), T: book() } });
    expect(validate({ baselineLedger, candidateLedger }).errors.join(' ')).toMatch(/historical (?:prefix|point) was modified/);
  });

  it('accepts a unique same-day signed proposal fill aligned with runlog counts', () => {
    const candidate = validFillCandidate();
    expect(validate({
      candidateLedger: candidate.candidateLedger,
      candidateRuns: candidate.candidateRuns,
      publishedPicks: picks(candidate.modelPick),
    })).toEqual({ ok: true, errors: [] });
  });

  it.each(['proposalId', 'decisionHash', 'sourceHash', 'decidedAt'])('requires exact published %s receipt data', (field) => {
    const candidate = validFillCandidate();
    candidate.candidateLedger.models.S.trades[0][field] = `wrong-${field}`;
    expect(validate({
      candidateLedger: candidate.candidateLedger,
      candidateRuns: candidate.candidateRuns,
      publishedPicks: picks(candidate.modelPick),
    }).ok).toBe(false);
  });

  it('rejects replayed proposals and missing runlog proposal/fill alignment', () => {
    const candidate = validFillCandidate();
    const baselineTrade = trade(candidate.modelPick, { ts: '2026-08-11T14:10:00.000Z' });
    const baselineLedger = ledger({ models: { S: book({ trades: [baselineTrade] }), P: book(), T: book() } });
    candidate.candidateLedger.models.S.trades = [baselineTrade, candidate.candidateLedger.models.S.trades[0]];
    candidate.candidateRuns[0].proposalIds = [];
    candidate.candidateRuns[0].ordersProposed = 0;
    candidate.candidateRuns[0].ordersFilled = 2;
    const result = validate({
      baselineLedger,
      candidateLedger: candidate.candidateLedger,
      candidateRuns: candidate.candidateRuns,
      publishedPicks: picks(candidate.modelPick),
    });
    expect(result.errors.join(' ')).toMatch(/consumed more than once/);
    expect(result.errors.join(' ')).toMatch(/does not include/);
    expect(result.errors.join(' ')).toMatch(/ordersFilled=2/);
  });

  it('enforces S/P=open|late and T=post', () => {
    const wrong = run({ model: 'T', window: 'open-window' });
    expect(validate({ candidateRuns: [wrong] }).errors.join(' ')).toMatch(/outside arena-open's owned execution window/);
  });

  it('forbids any trade addition in a postmarket late/valuationRecovered catch-up candidate', () => {
    const forced = trade(pick(), {
      ts: '2026-08-12T19:35:00.000Z',
      side: 'sell',
      proposalId: undefined,
      decisionHash: undefined,
      sourceHash: undefined,
      decidedAt: undefined,
    });
    const candidateLedger = ledger({ models: { S: book({ trades: [forced] }), P: book(), T: book() } });
    const recovery = run({ window: 'post-market', status: 'done', late: true });
    const result = validate({
      candidateLedger,
      candidateRuns: [recovery],
      pipelineId: 'arena-postmarket',
      now: new Date('2026-08-13T14:00:00.000Z'),
    });
    expect(result.errors.join(' ')).toMatch(/exactly one non-late done run/);
  });

  it('rejects metadata-only freshness and score tampering without a witnessed run', () => {
    const baseline = ledger();
    const candidate = structuredClone(baseline);
    candidate.updated = '2099-01-01';
    candidate.lastRunDate = '2099-01-01';
    candidate.day = 999;
    candidate.models.S.startEquity = 1;
    candidate.models.S.promptVersion = 'tampered';
    candidate.models.S.metrics = { cumPct: 999, maxDD: 0, hitRate: 100, exposure: 0 };
    const result = validate({ baselineLedger: baseline, candidateLedger: candidate });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/without a witnessed valuation|immutable|metrics/);
  });

  it('rejects a claimed proposal evaluation without a quote or explicit outcome', () => {
    const modelPick = pick();
    const quoteReceipts = {};
    const candidateLedger = ledger({ models: {
      S: book({
        lastValuationDate: DATE,
        valuationAudits: [{ date: DATE, window: 'open-window', mode: 'live-execution', recordedAt: OPEN_TS, quoteReceipts }],
      }),
      P: book(),
      T: book(),
    } });
    const candidateRuns = [run({
      ordersProposed: 1,
      proposalIds: [modelPick.proposalId],
      quoteReceipts,
      ordersSkipped: 0,
      skippedProposals: [],
    })];
    const result = validate({ candidateLedger, candidateRuns, publishedPicks: picks(modelPick) });
    expect(result.errors.join(' ')).toMatch(/missing evaluated symbol NVDA/);
    expect(result.errors.join(' ')).toMatch(/has no fill, threshold skip, or risk rejection outcome/);
  });

  it('rejects a fabricated threshold skip when the signed proposal should execute', () => {
    const modelPick = pick({ entry: 101 });
    const receipt = quoteReceipt(modelPick.sym, { refPx: 100 });
    const quoteReceipts = { [modelPick.sym]: receipt };
    const candidateLedger = ledger({ models: {
      S: book({
        lastValuationDate: DATE,
        metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
        valuationAudits: [{
          date: DATE, window: 'open-window', mode: 'live-execution', recordedAt: OPEN_TS, quoteReceipts,
        }],
      }),
      P: book(),
      T: book(),
    } });
    const candidateRuns = [run({
      ordersProposed: 1,
      proposalIds: [modelPick.proposalId],
      ordersSkipped: 1,
      skippedProposals: [{
        proposalId: modelPick.proposalId,
        sym: modelPick.sym,
        reason: 'pretend threshold skip',
        executionQuote: receipt,
      }],
      quoteReceipts,
    })];
    const result = validate({ candidateLedger, candidateRuns, publishedPicks: picks(modelPick) });
    expect(result.errors.join(' ')).toMatch(/do not mechanically produce an entry-threshold skip/);
  });

  it('replays and locks dayStartEquity even when a live valuation run exists', () => {
    const queued = run({ status: 'queued' });
    const candidateLedger = ledger({ models: {
      S: book({
        dayStartEquity: 1,
        lastValuationDate: DATE,
        metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 },
        valuationAudits: [{
          date: DATE, window: 'open-window', mode: 'live-execution', recordedAt: OPEN_TS, quoteReceipts: {},
        }],
      }),
      P: book(),
      T: book(),
    } });
    const result = validate({
      baselineRuns: [queued],
      candidateRuns: [run({ quoteReceipts: {} })],
      candidateLedger,
    });
    expect(result.errors.join(' ')).toMatch(/dayStartEquity/);
  });

  it('rejects a run and trade owned by a different pipeline window', () => {
    const candidate = validFillCandidate();
    const result = validate({
      candidateLedger: candidate.candidateLedger,
      candidateRuns: candidate.candidateRuns,
      publishedPicks: picks(candidate.modelPick),
      pipelineId: 'arena-postmarket',
      now: new Date('2026-08-12T21:00:00.000Z'),
    });
    expect(result.errors.join(' ')).toMatch(/outside arena-postmarket's owned execution window/);
  });

  it('reapplies the signed entry and hard risk rules at final publication', () => {
    const modelPick = pick({ entry: 90, confidence: 0.1, order: { side: 'buy', qty: 50 } });
    const candidate = validFillCandidate(modelPick);
    const result = validate({
      candidateLedger: candidate.candidateLedger,
      candidateRuns: candidate.candidateRuns,
      publishedPicks: picks(modelPick),
    });
    expect(result.errors.join(' ')).toMatch(/exceeds the signed maximum entry|mechanical order gate rejects/);
  });

  it('rejects newly invented scored historical prediction days', () => {
    const baseline = {
      checkedThrough: '2026-08-10',
      days: [{ date: '2026-08-10', entries: {}, audit: { status: 'no-predictions' } }],
    };
    const candidate = {
      checkedThrough: DATE,
      days: [
        ...baseline.days,
        {
          date: '2026-08-11',
          entries: {
            NVDA: {
              predOpenPct: 99, predClosePct: 99, actualOpenPct: 99, actualClosePct: 99, dirHit: true,
            },
          },
          audit: { status: 'scored' },
        },
        { date: DATE, entries: {}, audit: { status: 'missed-source' } },
      ],
    };
    const result = validateArenaPredlogPublicationDelta(baseline, candidate, { currentDate: DATE });
    expect(result.errors.join(' ')).toMatch(/historical catch-up may add only/);
  });
});
