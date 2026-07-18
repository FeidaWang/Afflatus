import { describe, it, expect } from 'vitest';
import { buildSpaceData } from '../src/lib/dataToSpace.js';

function fixtureSectors() {
  return {
    modelWatch: [
      { vendor: 'anthropic', route: 'closed' },
      { vendor: 'openai', route: 'closed' },
      { vendor: 'zhipu', route: 'open' },
      { vendor: 'alibaba', route: 'closed' },
    ],
    baskets: [
      { vendor: 'anthropic', market: 'US', equities: [
        { ticker: 'MU', relation: 'supplier', confidence: 0.8 },
        { ticker: 'AVGO', relation: 'supplier', confidence: 0.7 },
      ] },
      { vendor: 'openai', market: 'US', equities: [
        { ticker: 'MSFT', relation: 'infra', confidence: 0.8 },
        { ticker: 'AVGO', relation: 'supplier', confidence: 0.9 },
      ] },
      { vendor: 'zhipu', market: 'CN', equities: [
        { ticker: '0700.HK', relation: 'infra', confidence: 0.55 },
      ] },
      { vendor: 'alibaba', market: 'CN', equities: [
        { ticker: '9988.HK', relation: 'direct', confidence: 0.85 },
      ] },
    ],
  };
}

function fixtureUniverse() {
  return {
    symbols: [
      { sym: 'MU', name: 'Micron', bucket: 'core-ai-hardware' },
      { sym: 'AVGO', name: 'Broadcom', bucket: 'core-ai-hardware' },
      { sym: 'MSFT', name: 'Microsoft', bucket: 'megacap-tech' },
      { sym: 'SPY', name: 'S&P 500', bucket: 'benchmark' },
    ],
  };
}

describe('buildSpaceData', () => {
  it('creates 1 vendor node per modelWatch card + 1 equity node per unique ticker', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    expect(nodes.filter((n) => n.kind === 'vendor')).toHaveLength(4);
    // unique tickers: MU, AVGO, MSFT, 0700.HK, 9988.HK (5, AVGO deduped)
    expect(nodes.filter((n) => n.kind === 'equity')).toHaveLength(5);
  });

  it('dedupes a ticker referenced by two baskets into one node with averaged confidence', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    const avgo = nodes.filter((n) => n.id === 'equity:AVGO');
    expect(avgo).toHaveLength(1);
    expect(avgo[0].confidence).toBeCloseTo(0.8, 5); // avg(0.7, 0.9)
    expect(avgo[0].hasConfidence).toBe(true);
  });

  it('cross-references arena-universe.json for bucket when the ticker is on that list', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    expect(nodes.find((n) => n.id === 'equity:MU').bucket).toBe('core-ai-hardware');
    expect(nodes.find((n) => n.id === 'equity:MSFT').bucket).toBe('megacap-tech');
  });

  it('falls back to the supply-chain bucket for a ticker not on the arena-universe list', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    const hk = nodes.find((n) => n.id === 'equity:0700.HK');
    expect(hk.bucket).toBe('supply-chain');
  });

  it('adds remaining arena-universe symbols not already covered by a basket equity, unscored', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    const spy = nodes.find((n) => n.id === 'equity:SPY');
    expect(spy).toBeDefined();
    expect(spy.kind).toBe('universe');
    expect(spy.hasConfidence).toBe(false);
    expect(spy.confidence).toBeNull();
    expect(spy.market).toBe('US');
  });

  it('does not duplicate a ticker that is both a basket equity and an arena-universe symbol', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    expect(nodes.filter((n) => n.id === 'equity:MU')).toHaveLength(1);
    expect(nodes.find((n) => n.id === 'equity:MU').kind).toBe('equity'); // basket wins over plain universe listing
  });

  it('places US vendors/equities at negative x and CN ones at positive x', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    const us = nodes.filter((n) => n.market === 'US').map((n) => n.x);
    const cn = nodes.filter((n) => n.market === 'CN').map((n) => n.x);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(us)).toBeLessThan(avg(cn));
  });

  it('uses the real confidence value as y (within jitter) for a scored equity', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    const direct = nodes.find((n) => n.id === 'equity:9988.HK');
    expect(direct.y).toBeGreaterThan(0.75);
    expect(direct.y).toBeLessThan(0.95);
  });

  it('is deterministic for a given seed (same input+seed -> byte-identical layout)', () => {
    const a = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() }, { seed: 3 });
    const b = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() }, { seed: 3 });
    expect(a.nodes.map((n) => [n.x, n.y, n.z])).toEqual(b.nodes.map((n) => [n.x, n.y, n.z]));
  });

  it('never produces NaN/Infinity coordinates', () => {
    const { nodes } = buildSpaceData({ sectorsData: fixtureSectors(), universeData: fixtureUniverse() });
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(Number.isFinite(n.z)).toBe(true);
    }
  });

  it('degrades to an empty node list, no throw, on missing/empty inputs', () => {
    expect(() => buildSpaceData()).not.toThrow();
    expect(buildSpaceData().nodes).toEqual([]);
    expect(buildSpaceData({ sectorsData: {}, universeData: {} }).nodes).toEqual([]);
  });
});
