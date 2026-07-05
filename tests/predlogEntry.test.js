import { describe, it, expect } from 'vitest';
import { pctChange, directionHit, buildPredlogDay, appendPredlogDay } from '../src/lib/predlogEntry.js';

describe('pctChange', () => {
  it('computes a positive percent change', () => {
    expect(pctChange(110, 100)).toBeCloseTo(10, 5);
  });
  it('computes a negative percent change', () => {
    expect(pctChange(95, 100)).toBeCloseTo(-5, 5);
  });
  it('returns null for a zero/negative base instead of Infinity/NaN', () => {
    expect(pctChange(100, 0)).toBe(null);
    expect(pctChange(100, -5)).toBe(null);
  });
  it('returns null for a non-finite actual', () => {
    expect(pctChange(NaN, 100)).toBe(null);
    expect(pctChange(undefined, 100)).toBe(null);
  });
});

describe('directionHit', () => {
  it('UP call hits on a positive move', () => {
    expect(directionHit('UP', 2.4)).toBe(true);
  });
  it('DOWN call hits on a negative move', () => {
    expect(directionHit('DOWN', -1.1)).toBe(true);
  });
  it('UP call misses on a negative move and vice versa', () => {
    expect(directionHit('UP', -0.3)).toBe(false);
    expect(directionHit('DOWN', 0.3)).toBe(false);
  });
  it('a perfectly flat day counts as a miss for either direction', () => {
    expect(directionHit('UP', 0)).toBe(false);
    expect(directionHit('DOWN', 0)).toBe(false);
  });
  it('returns null when actualClosePct is unavailable (missing quote)', () => {
    expect(directionHit('UP', null)).toBe(null);
    expect(directionHit('UP', undefined)).toBe(null);
  });
});

describe('buildPredlogDay', () => {
  const predictions = {
    NVDA: { direction: 'UP', predOpenPct: 0.5, predClosePct: 1.2 },
    MU: { direction: 'DOWN', predOpenPct: -0.4, predClosePct: -1.0 },
  };
  const prevCloseMap = { NVDA: 100, MU: 200 };

  it('computes actual pct + dirHit per symbol from real O/C quotes', () => {
    const actuals = { NVDA: { open: 100.5, close: 102 }, MU: { open: 199, close: 190 } };
    const day = buildPredlogDay('2026-07-06', predictions, prevCloseMap, actuals);
    expect(day.date).toBe('2026-07-06');
    expect(day.entries.NVDA.predOpenPct).toBe(0.5);
    expect(day.entries.NVDA.predClosePct).toBe(1.2);
    expect(day.entries.NVDA.actualClosePct).toBeCloseTo(2, 5);
    expect(day.entries.NVDA.dirHit).toBe(true);
    expect(day.entries.MU.actualClosePct).toBeCloseTo(-5, 5);
    expect(day.entries.MU.dirHit).toBe(true);
  });

  it('a symbol with no actual quote gets null actual fields, not dropped', () => {
    const day = buildPredlogDay('2026-07-06', predictions, prevCloseMap, { NVDA: { open: 101, close: 99 } });
    expect(day.entries.MU.actualOpenPct).toBe(null);
    expect(day.entries.MU.actualClosePct).toBe(null);
    expect(day.entries.MU.dirHit).toBe(null);
    // NVDA still present and computed
    expect(day.entries.NVDA.actualClosePct).toBeCloseTo(-1, 5);
  });

  it('missing predOpenPct/predClosePct fields fall back to null (old-format predictions)', () => {
    const day = buildPredlogDay('2026-07-06', { NVDA: { direction: 'UP' } }, prevCloseMap, { NVDA: { open: 101, close: 102 } });
    expect(day.entries.NVDA.predOpenPct).toBe(null);
    expect(day.entries.NVDA.predClosePct).toBe(null);
  });
});

describe('appendPredlogDay', () => {
  it('appends a new day and keeps the list date-sorted', () => {
    const days = [{ date: '2026-07-01', entries: {} }, { date: '2026-07-03', entries: {} }];
    const result = appendPredlogDay(days, { date: '2026-07-02', entries: {} });
    expect(result.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('is idempotent — rerunning for the same date replaces instead of duplicating', () => {
    const days = [{ date: '2026-07-01', entries: { NVDA: { dirHit: false } } }];
    const result = appendPredlogDay(days, { date: '2026-07-01', entries: { NVDA: { dirHit: true } } });
    expect(result.length).toBe(1);
    expect(result[0].entries.NVDA.dirHit).toBe(true);
  });

  it('caps the rolling window to maxDays, dropping the oldest first', () => {
    const days = Array.from({ length: 60 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, entries: {} }));
    const result = appendPredlogDay(days, { date: '2026-03-15', entries: {} }, 60);
    expect(result.length).toBe(60);
    expect(result[result.length - 1].date).toBe('2026-03-15');
    expect(result[0].date).toBe('2026-01-02'); // oldest (01-01) dropped
  });

  it('never exceeds maxDays even starting from an empty/undefined list', () => {
    const result = appendPredlogDay(undefined, { date: '2026-07-01', entries: {} }, 60);
    expect(result).toEqual([{ date: '2026-07-01', entries: {} }]);
  });
});
