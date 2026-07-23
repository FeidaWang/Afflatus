import { describe, it, expect } from 'vitest';
import {
  openGapPct,
  intradayRangePct,
  computeVWAP,
  vwapDriftPct,
  volumeSurgeRatio,
  pivotBreakState,
  buildPulseFeatures,
} from '../src/lib/arenaFeatures.js';

describe('openGapPct', () => {
  it('computes the gap between open and prior close', () => {
    expect(openGapPct({ o: 102, pc: 100 })).toBeCloseTo(2, 3);
  });
  it('returns null on missing/invalid input', () => {
    expect(openGapPct(null)).toBeNull();
    expect(openGapPct({ o: 102, pc: 0 })).toBeNull();
  });
});

describe('intradayRangePct', () => {
  it('computes today\'s high-low range as a percent of prior close', () => {
    expect(intradayRangePct({ h: 105, l: 100, pc: 100 })).toBeCloseTo(5, 3);
  });
  it('returns null on missing input', () => {
    expect(intradayRangePct({ h: null, l: 100, pc: 100 })).toBeNull();
  });
});

describe('computeVWAP', () => {
  it('volume-weights the typical price across candles', () => {
    const candles = [
      { high: 101, low: 99, close: 100, volume: 100 },
      { high: 103, low: 101, close: 102, volume: 300 },
    ];
    // typical1=100, typical2=102 -> vwap = (100*100+102*300)/400 = 101.5
    expect(computeVWAP(candles)).toBeCloseTo(101.5, 2);
  });
  it('returns null with no volume', () => {
    expect(computeVWAP([])).toBeNull();
    expect(computeVWAP([{ high: 1, low: 1, close: 1, volume: 0 }])).toBeNull();
  });
});

describe('vwapDriftPct', () => {
  it('computes drift of price above/below vwap', () => {
    expect(vwapDriftPct(102, 100)).toBeCloseTo(2, 3);
    expect(vwapDriftPct(98, 100)).toBeCloseTo(-2, 3);
  });
  it('returns null when vwap is unavailable', () => {
    expect(vwapDriftPct(100, null)).toBeNull();
  });
});

describe('volumeSurgeRatio', () => {
  it('computes today volume vs trailing average', () => {
    const daily = Array.from({ length: 20 }, () => ({ v: 1000000 }));
    expect(volumeSurgeRatio(3000000, daily)).toBeCloseTo(3, 3);
  });
  it('returns null with no history or zero today volume', () => {
    expect(volumeSurgeRatio(1000, [])).toBeNull();
    expect(volumeSurgeRatio(0, [{ v: 1000 }])).toBeNull();
  });
});

describe('pivotBreakState', () => {
  const prior = { t: '2026-07-22', o: 100, h: 110, l: 90, c: 105, v: 1000000 };
  it('finds the nearest pivot level and side', () => {
    // pp = (110+90+105)/3 = 101.667
    const r = pivotBreakState([prior], 102);
    expect(r.nearest).toBe('pp');
    expect(r.side).toBe('above');
  });
  it('flags below when price sits under the nearest level', () => {
    const r = pivotBreakState([prior], 101);
    expect(r.side).toBe('below');
  });
  it('returns null with no candle history', () => {
    expect(pivotBreakState([], 100)).toBeNull();
  });
});

describe('buildPulseFeatures', () => {
  it('composes the full feature vector for one candidate', () => {
    const quote = { c: 103, pc: 100, o: 101, h: 104, l: 99 };
    const dailyCandles = [{ t: '2026-07-22', o: 100, h: 110, l: 90, c: 105, v: 1000000 }];
    const intradayCandles = [
      { high: 102, low: 100, close: 101, volume: 500000 },
      { high: 104, low: 101, close: 103, volume: 700000 },
    ];
    const f = buildPulseFeatures({ quote, dailyCandles, intradayCandles });
    expect(f.openGapPct).toBeCloseTo(1, 3);
    expect(f.vwap).toBeGreaterThan(0);
    expect(f.vwapDriftPct).not.toBeNull();
    expect(f.pivotBreak).not.toBeNull();
  });
  it('degrades gracefully with partial data (no throws)', () => {
    expect(() => buildPulseFeatures({})).not.toThrow();
    const f = buildPulseFeatures({});
    expect(f.openGapPct).toBeNull();
  });
});
