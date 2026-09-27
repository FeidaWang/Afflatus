// tests/sectorsRivalryMath.test.js
import { describe, expect, it } from 'vitest';
import { divergingShares, geographyLeaders, snapshotDims } from '../src/sectors/industry/rivalry-math.js';

const snap = {
  metrics: [{ id: 'intelligence', direction: 'higher' }],
  models: [
    { id: 'u1', name: 'U1', lab_geography: 'US', open_weights: false, prices: { output: 20 } },
    { id: 'u2', name: 'U2', lab_geography: 'US', open_weights: false, prices: { output: 50 } },
    { id: 'c1', name: 'C1', lab_geography: 'CN', open_weights: true, prices: { output: 0.87 } },
    { id: 'c2', name: 'C2', lab_geography: 'CN', open_weights: true, prices: { output: 4.4 } },
    { id: 'c3', name: 'C3', lab_geography: 'CN', open_weights: true, prices: { output: 1.2 } },
  ],
  observations: [
    { model_id: 'u1', metric_id: 'intelligence', value: 58 }, { model_id: 'u2', metric_id: 'intelligence', value: 53 },
    { model_id: 'c1', metric_id: 'intelligence', value: 46 }, { model_id: 'c2', metric_id: 'intelligence', value: 45 },
    { model_id: 'c3', metric_id: 'intelligence', value: null },
  ],
};

describe('geographyLeaders', () => {
  it('finds the best model per geography and the point gap', () => {
    const g = geographyLeaders(snap);
    expect(g.US.modelId).toBe('u1');
    expect(g.CN.modelId).toBe('c1');
    expect(g.points).toBe(12);
  });
});

describe('snapshotDims', () => {
  it('derives index, open-weights count and median output price', () => {
    const d = Object.fromEntries(snapshotDims(snap).map((x) => [x.id, x]));
    expect([d.top_index.us, d.top_index.cn]).toEqual([58, 46]);
    expect([d.open_configs.us, d.open_configs.cn]).toEqual([0, 3]);
    expect(d.median_output_price.us).toBe(35);
    expect(d.median_output_price.cn).toBe(1.2);
    expect(d.median_output_price.better).toBe('lower');
  });
});

describe('divergingShares', () => {
  it('splits each pair into shares and names the leader by direction', () => {
    const [a, b, c] = divergingShares([
      { id: 'gpu', us: 75, cn: 15, better: 'higher' },
      { id: 'price', us: 35, cn: 1.2, better: 'lower' },
      { id: 'even', us: 1, cn: 1, better: 'higher' },
    ]);
    expect(a.usShare).toBeCloseTo(75 / 90); expect(a.leader).toBe('US');
    expect(b.leader).toBe('CN');
    expect(c.leader).toBe('tie'); expect(c.usShare).toBe(0.5);
  });
  it('keeps a 50/50 split when both values are zero', () => {
    expect(divergingShares([{ id: 'z', us: 0, cn: 0, better: 'higher' }])[0].usShare).toBe(0.5);
  });
  it('names no leader and no shares when either side is missing', () => {
    const [a, b] = divergingShares([
      { id: 'no_cn', us: 58, cn: null, better: 'higher' },
      { id: 'no_us', us: null, cn: 1.2, better: 'lower' },
    ]);
    for (const r of [a, b]) {
      expect(r.leader).toBeNull(); expect(r.usShare).toBeNull(); expect(r.cnShare).toBeNull();
    }
    expect(a.us).toBe(58); expect(b.cn).toBe(1.2);
  });
});
