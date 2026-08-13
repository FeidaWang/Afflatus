import { describe, expect, it } from 'vitest';
import {
  PREMARKET_PROVENANCE_SCHEMA,
  bindPremarketOrders,
  computeArenaDecisionHash,
  computeArenaProposalId,
  computeArenaSourceHash,
  sha256Hex,
} from '../src/lib/arenaDecisionProvenance.js';
import { validateArenaPicks, validateArenaPicksForPublication } from '../src/lib/validateArenaPicks.js';
import { applyFill } from '../src/lib/arenaRules.js';
import { runArenaLedger } from '../src/lib/arenaRun.js';

function sealedPick(overrides = {}, model = 'S') {
  const pick = {
    provenanceSchema: PREMARKET_PROVENANCE_SCHEMA,
    sessionDate: '2026-08-12',
    decidedAt: '2026-08-12T12:45:00.000Z', // 08:45 America/New_York (EDT)
    decisionWindow: 'pre-market',
    expiresAt: '2026-08-12T19:55:00.000Z',
    allowedExecutionWindows: ['open-window', 'late-window'],
    sourceRefs: ['https://www.sec.gov/Archives/example', 'arena-news:2026-08-12:item-0'],
    sym: 'NVDA',
    side: 'long',
    order: { side: 'buy', qty: 5 },
    confidence: 0.78,
    entry: 100,
    stop: 92,
    target: 115,
    thesis_en: 'A sourced pre-market thesis.',
    thesis_zh: '一项有来源的盘前判断。',
    signals: ['filing', 'premarket-tape'],
    ...overrides,
  };
  pick.sourceHash = computeArenaSourceHash(pick);
  pick.decisionHash = computeArenaDecisionHash(model, pick);
  pick.proposalId = computeArenaProposalId(model, pick);
  return pick;
}

function snapshot(pick = sealedPick()) {
  return {
    date: '2026-08-12',
    generatedAt: '2026-08-12T12:46:00.000Z',
    decisionStatus: 'sealed',
    executable: true,
    decisionStatus: 'sealed',
    executable: true,
    regime: 'neutral',
    models: { S: [pick], P: [], T: [] },
    quoteAllowlist: ['NVDA', 'SPY', 'QQQ', 'SMH'],
  };
}

describe('Arena pre-market decision seal', () => {
  it('uses a real SHA-256 digest and accepts a complete sealed snapshot', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(validateArenaPicks(snapshot())).toEqual({ ok: true, errors: [] });
  });

  it('detects an edited source, symbol, quantity, or execution window', () => {
    for (const mutate of [
      (pick) => { pick.sourceRefs[0] = 'https://example.com/rewritten'; },
      (pick) => { pick.sym = 'MU'; },
      (pick) => { pick.order.qty = 99; },
      (pick) => { pick.allowedExecutionWindows = ['late-window']; },
    ]) {
      const pick = sealedPick();
      mutate(pick);
      const result = validateArenaPicks(snapshot(pick));
      expect(result.ok).toBe(false);
      expect(result.errors.some((error) => /Hash|proposalId/.test(error))).toBe(true);
    }
  });

  it('requires new snapshots to declare executable state and keeps historical snapshots readable', () => {
    const unsigned = sealedPick();
    for (const field of ['provenanceSchema', 'sessionDate', 'decidedAt', 'decisionWindow', 'expiresAt', 'allowedExecutionWindows', 'sourceRefs', 'sourceHash', 'decisionHash', 'proposalId', 'order']) {
      delete unsigned[field];
    }
    expect(validateArenaPicks(snapshot(unsigned)).ok).toBe(false);

    const empty = snapshot();
    empty.models.S = [];
    empty.generatedAt = '2026-08-13T03:00:00.000Z';
    delete empty.decisionStatus;
    delete empty.executable;
    expect(validateArenaPicks(empty).ok).toBe(false);

    empty.decisionStatus = 'missed';
    empty.executable = false;
    expect(validateArenaPicks(empty).ok).toBe(true);

    const historical = snapshot(unsigned);
    historical.date = '2026-08-07';
    historical.generatedAt = '2026-08-08T02:44:17.000Z';
    expect(validateArenaPicks(historical).ok).toBe(true);
  });

  it('write-time validation rejects post-open/backfilled publication while allowing a timely witness', () => {
    const timely = validateArenaPicksForPublication(snapshot(), { now: '2026-08-12T12:47:00.000Z' });
    expect(timely.ok).toBe(true);

    const afterOpen = validateArenaPicksForPublication(snapshot(), { now: '2026-08-12T13:31:00.000Z' });
    expect(afterOpen.ok).toBe(false);
    expect(afterOpen.errors.some((error) => error.includes('09:30'))).toBe(true);

    const staleGeneration = validateArenaPicksForPublication(snapshot(), { now: '2026-08-12T13:10:00.000Z' });
    expect(staleGeneration.ok).toBe(false);
    expect(staleGeneration.errors.some((error) => error.includes('five minutes'))).toBe(true);

    const empty = snapshot();
    empty.models.S = [];
    expect(validateArenaPicksForPublication(empty, { now: '2026-08-12T13:31:00.000Z' }).ok).toBe(false);

    empty.decisionStatus = 'missed';
    empty.executable = false;
    empty.generatedAt = '2026-08-12T13:31:00.000Z';
    expect(validateArenaPicksForPublication(empty, { now: '2026-08-12T13:32:00.000Z' }).ok).toBe(true);
  });

  it('caps proposals per model and requires P buy exitBy within two days', () => {
    const tooMany = snapshot();
    tooMany.models.S = Array.from({ length: 5 }, (_, index) => sealedPick({ sym: `NV${index}` }));
    tooMany.quoteAllowlist = tooMany.models.S.map((pick) => pick.sym);
    expect(validateArenaPicks(tooMany).errors.some((error) => error.includes('at most 4'))).toBe(true);

    const pPick = sealedPick({}, 'P');
    const pSnapshot = snapshot();
    pSnapshot.models.S = [];
    pSnapshot.models.P = [pPick];
    expect(validateArenaPicks(pSnapshot).errors.some((error) => error.includes('exitBy'))).toBe(true);

    const validP = sealedPick({ exitBy: '2026-08-14' }, 'P');
    pSnapshot.models.P = [validP];
    expect(validateArenaPicks(pSnapshot).ok).toBe(true);

    const sameDayP = sealedPick({ exitBy: '2026-08-12' }, 'P');
    pSnapshot.models.P = [sameDayP];
    expect(validateArenaPicks(pSnapshot).errors.some((error) => error.includes('NYSE sessions'))).toBe(true);

    const fridayP = sealedPick({
      sessionDate: '2026-08-14',
      decidedAt: '2026-08-14T12:45:00.000Z',
      expiresAt: '2026-08-14T19:55:00.000Z',
      exitBy: '2026-08-17',
    }, 'P');
    const fridaySnapshot = snapshot();
    fridaySnapshot.date = '2026-08-14';
    fridaySnapshot.generatedAt = '2026-08-14T12:46:00.000Z';
    fridaySnapshot.models.S = [];
    fridaySnapshot.models.P = [fridayP];
    expect(validateArenaPicks(fridaySnapshot).ok).toBe(true);
  });

  it('keeps every execution and catch-up benchmark in the anonymous quote allowlist', () => {
    const missing = snapshot();
    missing.quoteAllowlist = ['NVDA', 'SPY', 'QQQ'];
    expect(validateArenaPicks(missing).errors).toContain('quoteAllowlist: missing required Arena benchmark SMH');
  });
});

describe('mechanical same-session execution binding', () => {
  it('enforces the canonical model/window map even for an empty intent list', () => {
    expect(() => bindPremarketOrders({
      snapshot: snapshot(), book: 'S', sessionDate: '2026-08-12', window: 'post-market',
      nowIso: '2026-08-12T20:30:00.000Z', proposedOrders: [],
    })).toThrow(/Model S cannot execute/);
    expect(bindPremarketOrders({
      snapshot: snapshot(), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', proposedOrders: [],
    })).toEqual({ orders: [], skipped: [] });
  });

  it('rejects a valid proposal outside its named ET execution window or after prior consumption', () => {
    const pick = sealedPick();
    const common = {
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      priceMap: { NVDA: 99 }, proposedOrders: [{ proposalId: pick.proposalId }],
    };
    expect(() => bindPremarketOrders({ ...common, nowIso: '2026-08-12T18:05:00.000Z' })).toThrow(/outside open-window/);
    expect(() => bindPremarketOrders({ ...common, nowIso: '2026-08-12T14:05:00.000Z', consumedProposalIds: [pick.proposalId] })).toThrow(/already been consumed/);
  });

  it('rebuilds the executable order from signed fields at the live price', () => {
    const pick = sealedPick();
    const result = bindPremarketOrders({
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', priceMap: { NVDA: 99.5 },
      proposedOrders: [{ proposalId: pick.proposalId }],
    });
    expect(result.skipped).toEqual([]);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({ sym: 'NVDA', side: 'buy', qty: 5, refPx: 99.5, maxExecPx: 100, proposalId: pick.proposalId });
  });

  it('persists the proposal and decision receipts on the resulting ledger trade', () => {
    const pick = sealedPick();
    const bound = bindPremarketOrders({
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', priceMap: { NVDA: 99.5 },
      proposedOrders: [{ proposalId: pick.proposalId }],
    }).orders[0];
    const next = applyFill(
      { cash: 10_000, positions: [], trades: [] },
      {
        ...bound,
        executionType: 'proposal',
        executionQuote: {
          sourceUrl: 'https://feida.au/api/quote?symbol=NVDA', requestId: 'req-NVDA',
          observedAt: '2026-08-12T14:05:00.000Z', providerTimestamp: '2026-08-12T14:04:55.000Z', refPx: 99.5,
        },
      },
      { execPx: 99.55, fee: 0.02, slipBps: 5 },
      '2026-08-12T14:05:00.000Z',
    );
    expect(next.trades[0]).toMatchObject({
      proposalId: pick.proposalId,
      decisionHash: pick.decisionHash,
      sourceHash: pick.sourceHash,
      decidedAt: pick.decidedAt,
      executionType: 'proposal',
      executionQuote: {
        sourceUrl: 'https://feida.au/api/quote?symbol=NVDA', requestId: 'req-NVDA',
        observedAt: '2026-08-12T14:05:00.000Z', providerTimestamp: '2026-08-12T14:04:55.000Z', refPx: 99.5,
      },
    });
  });

  it('hard-rejects attempts to alter signed quantity, direction, or add a subjective threshold', () => {
    const pick = sealedPick();
    const common = {
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', priceMap: { NVDA: 99 },
    };
    expect(() => bindPremarketOrders({ ...common, proposedOrders: [{ proposalId: pick.proposalId, qty: 6 }] })).toThrow(/qty differs/);
    expect(() => bindPremarketOrders({ ...common, proposedOrders: [{ proposalId: pick.proposalId, side: 'sell' }] })).toThrow(/side differs/);
    expect(() => bindPremarketOrders({ ...common, proposedOrders: [{ proposalId: pick.proposalId, refPx: 90 }] })).toThrow(/unsigned execution fields/);
  });

  it('audits an above-entry live price as a skip, not a rules-engine rejection', () => {
    const pick = sealedPick({ entry: 100 });
    const result = bindPremarketOrders({
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', priceMap: { NVDA: 100.01 },
      proposedOrders: [{ proposalId: pick.proposalId }],
    });
    expect(result.orders).toEqual([]);
    expect(result.skipped).toEqual([{ proposalId: pick.proposalId, sym: 'NVDA', reason: expect.stringContaining('signed maximum entry') }]);
  });

  it('also skips when deterministic slippage would push the fill above the signed entry', () => {
    const pick = sealedPick({ entry: 100 });
    const order = bindPremarketOrders({
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'open-window',
      nowIso: '2026-08-12T14:05:00.000Z', priceMap: { NVDA: 100 },
      proposedOrders: [{ proposalId: pick.proposalId }],
    }).orders[0];
    const model = {
      promptVersion: 'S-v1', startEquity: 10_000, cash: 10_000, equity: 10_000, dayStartEquity: 10_000,
      equityHistory: [{ day: 0, equity: 10_000 }], positions: [], trades: [], rejections: [],
      metrics: { cumPct: 0, maxDD: 0, hitRate: null, exposure: 0 }, review: { zh: '', en: '' },
    };
    const ledger = {
      updated: '2026-08-11', version: 2, day: 0, season: 2, lastRunDate: null,
      bench: { spyPct: 0, smhPct: 0 }, models: { S: model, P: { ...model }, T: { ...model } },
    };
    const result = runArenaLedger(ledger, 'S', {
      etDateStr: '2026-08-12', nowIso: '2026-08-12T14:05:00.000Z',
      priceMap: { NVDA: 100 }, universe: ['NVDA'], proposedOrders: [order],
    });
    expect(result.summary.filled).toEqual([]);
    expect(result.summary.rejected).toEqual([]);
    expect(result.summary.executionSkipped[0].reason).toMatch(/signed maximum entry/);
    expect(result.ledger.models.S.trades).toEqual([]);
  });

  it('rejects expired, cross-session, late-recovery, and catch-up execution', () => {
    const pick = sealedPick();
    const common = {
      snapshot: snapshot(pick), book: 'S', sessionDate: '2026-08-12', window: 'late-window',
      nowIso: '2026-08-12T19:30:00.000Z', priceMap: { NVDA: 99 },
      proposedOrders: [{ proposalId: pick.proposalId }],
    };
    expect(() => bindPremarketOrders({ ...common, late: true })).toThrow(/late recovery/);
    expect(() => bindPremarketOrders({ ...common, catchup: true })).toThrow(/catch-up/);
    expect(() => bindPremarketOrders({ ...common, nowIso: '2026-08-13T14:05:00.000Z' })).toThrow(/execution timestamp/);
    expect(() => bindPremarketOrders({ ...common, nowIso: '2026-08-12T20:00:00.000Z' })).toThrow(/expired/);
  });
});
