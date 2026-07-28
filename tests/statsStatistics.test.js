import { describe, expect, it } from 'vitest';
import {
  bootstrapDistribution,
  brierScore,
  calibrationBins,
  cumulativeSeries,
  exactBinomialTwoSided,
  summarizeRecords,
  thresholdSummary,
  wilsonInterval,
} from '../src/lib/stats/statistics.js';

const RECORDS = [
  { conf: 0.8, ok: true, exact: true },
  { conf: 0.7, ok: false, exact: false },
  { conf: 0.6, ok: true, exact: false },
  { conf: 0.55, ok: true, exact: false },
];

describe('stats pure calculations', () => {
  it('keeps interval, p-value, Brier and threshold summaries deterministic', () => {
    expect(wilsonInterval(3, 4)[0]).toBeCloseTo(0.3006360524, 10);
    expect(wilsonInterval(3, 4)[1]).toBeCloseTo(0.9544139374, 10);
    expect(exactBinomialTwoSided(3, 4)).toBe(0.625);
    expect(brierScore(RECORDS)).toBeCloseTo(0.223125, 8);
    expect(summarizeRecords(RECORDS)).toMatchObject({
      total: 4,
      successes: 3,
      exact: 1,
      hitRate: 0.75,
    });
    expect(thresholdSummary(RECORDS, 0.65)).toMatchObject({
      total: 2,
      successes: 1,
      exact: 1,
      hitRate: 0.5,
    });
  });

  it('produces shared cumulative and calibration models', () => {
    expect(cumulativeSeries(RECORDS).map((point) => point.hitRate)).toEqual([
      1,
      0.5,
      2 / 3,
      0.75,
    ]);
    expect(calibrationBins(RECORDS)).toMatchObject([
      { total: 2, successes: 2, averageConfidence: 0.575, hitRate: 1 },
      { total: 1, successes: 0, averageConfidence: 0.7, hitRate: 0 },
      { total: 1, successes: 1, averageConfidence: 0.8, hitRate: 1 },
    ]);
  });

  it('returns byte-for-byte stable bootstrap histograms for a fixed seed', () => {
    const first = bootstrapDistribution({
      outcomes: RECORDS.map((record) => record.ok),
      iterations: 2000,
      seed: 'stats-contract-v1',
    });
    const second = bootstrapDistribution({
      outcomes: RECORDS.map((record) => record.ok),
      iterations: 2000,
      seed: 'stats-contract-v1',
    });

    expect(second).toEqual(first);
    expect(first.counts.reduce((sum, count) => sum + count, 0)).toBe(2000);
    expect(first).toMatchObject({
      total: 4,
      iterations: 2000,
      lower: 0.25,
      upper: 1,
    });
  });

  it('rejects empty bootstrap inputs', () => {
    expect(() => bootstrapDistribution({ outcomes: [], seed: 1 })).toThrow(/at least one outcome/);
  });
});
