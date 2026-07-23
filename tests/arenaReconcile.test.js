import { describe, it, expect } from 'vitest';
import {
  runIdentity, hasCompletedRun, upsertRunlogEntry,
  isTradingDay, tradingDaysBetween, expectedRunsForDate, findMissingRuns,
  buildMissedEntry, needsLateMarkToMarket, buildLateMarkToMarketNote,
} from '../src/lib/arenaReconcile.js';

const holidays = [{ date: '2026-07-03', name: 'Independence Day (observed)' }];

describe('runIdentity / hasCompletedRun', () => {
  it('builds a stable pipe-joined key', () => {
    expect(runIdentity('2026-07-23', 'open-window', 'S')).toBe('2026-07-23|open-window|S');
  });
  it('finds a done run by identity', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' }] };
    expect(hasCompletedRun(runlog, '2026-07-23', 'open-window', 'S')).toBe(true);
  });
  it('does not count a queued or missed run as completed', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'queued' }] };
    expect(hasCompletedRun(runlog, '2026-07-23', 'open-window', 'S')).toBe(false);
  });
  it('is false for an empty/missing runlog rather than throwing', () => {
    expect(hasCompletedRun(null, '2026-07-23', 'open-window', 'S')).toBe(false);
    expect(hasCompletedRun({}, '2026-07-23', 'open-window', 'S')).toBe(false);
  });
  it('distinguishes model within the same date/window', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' }] };
    expect(hasCompletedRun(runlog, '2026-07-23', 'open-window', 'P')).toBe(false);
  });
});

describe('upsertRunlogEntry', () => {
  it('appends a new entry when the identity is not present', () => {
    const runlog = { runs: [] };
    const next = upsertRunlogEntry(runlog, { date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' });
    expect(next.runs).toHaveLength(1);
  });
  it('replaces the existing entry in place when the identity matches (no duplicates)', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'queued' }] };
    const next = upsertRunlogEntry(runlog, { date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' });
    expect(next.runs).toHaveLength(1);
    expect(next.runs[0].status).toBe('done');
  });
  it('does not mutate the input runlog', () => {
    const runlog = { runs: [] };
    upsertRunlogEntry(runlog, { date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' });
    expect(runlog.runs).toHaveLength(0);
  });
});

describe('isTradingDay', () => {
  it('rejects Saturday/Sunday', () => {
    expect(isTradingDay('2026-07-25', holidays)).toBe(false); // Saturday
    expect(isTradingDay('2026-07-26', holidays)).toBe(false); // Sunday
  });
  it('rejects an NYSE holiday', () => {
    expect(isTradingDay('2026-07-03', holidays)).toBe(false);
  });
  it('accepts an ordinary weekday', () => {
    expect(isTradingDay('2026-07-23', holidays)).toBe(true); // Thursday
  });
});

describe('tradingDaysBetween', () => {
  it('walks forward excluding weekends and holidays', () => {
    // Thu 7/2 -> through Mon 7/6: 7/3 is a holiday, 7/4-5 is weekend, so only 7/6
    const days = tradingDaysBetween('2026-07-02', '2026-07-06', holidays);
    expect(days).toEqual(['2026-07-06']);
  });
  it('returns an empty array when since === through', () => {
    expect(tradingDaysBetween('2026-07-23', '2026-07-23', holidays)).toEqual([]);
  });
  it('is capped at 30 iterations so a huge gap cannot loop forever', () => {
    const days = tradingDaysBetween('2020-01-01', '2026-07-23', holidays);
    expect(days.length).toBeLessThanOrEqual(30);
  });
});

describe('expectedRunsForDate', () => {
  it('lists gatherer, S, P, T, reviewer across the daily windows', () => {
    const runs = expectedRunsForDate();
    const models = runs.map((r) => r.model);
    expect(models).toContain('S');
    expect(models).toContain('P');
    expect(models).toContain('T');
    expect(models).toContain('gatherer');
    expect(models).toContain('reviewer');
  });
});

describe('findMissingRuns', () => {
  it('flags every expected (window, model) pair when runlog is empty', () => {
    const missing = findMissingRuns({ runs: [] }, ['2026-07-23']);
    expect(missing.length).toBe(expectedRunsForDate().length);
  });
  it('excludes pairs already marked done', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' }] };
    const missing = findMissingRuns(runlog, ['2026-07-23']);
    expect(missing.some((m) => m.window === 'open-window' && m.model === 'S')).toBe(false);
    expect(missing.some((m) => m.window === 'open-window' && m.model === 'P')).toBe(true);
  });
  it('is empty when every expected pair across every date is done', () => {
    const runlog = { runs: expectedRunsForDate().map((r) => ({ ...r, date: '2026-07-23', status: 'done' })) };
    expect(findMissingRuns(runlog, ['2026-07-23'])).toEqual([]);
  });
});

describe('buildMissedEntry', () => {
  it('always sets status missed and zero orders — never a retro-trade', () => {
    const entry = buildMissedEntry({ date: '2026-07-23', window: 'open-window', model: 'S' });
    expect(entry.status).toBe('missed');
    expect(entry.ordersProposed).toBe(0);
    expect(entry.ordersFilled).toBe(0);
  });
});

describe('needsLateMarkToMarket', () => {
  it('is false on a non-trading day regardless of runlog', () => {
    expect(needsLateMarkToMarket({ runs: [] }, 'S', '2026-07-25', holidays)).toBe(false); // Saturday
  });
  it('is true when the model has zero done runs that date', () => {
    expect(needsLateMarkToMarket({ runs: [] }, 'S', '2026-07-23', holidays)).toBe(true);
  });
  it('is false when the model completed even one window that date', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' }] };
    expect(needsLateMarkToMarket(runlog, 'S', '2026-07-23', holidays)).toBe(false);
  });
  it('does not confuse one model completing with another model needing catch-up', () => {
    // S ran (e.g. open-window done) but P never ran that day at all.
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'done' }] };
    expect(needsLateMarkToMarket(runlog, 'P', '2026-07-23', holidays)).toBe(true);
  });
  it('a queued (not done) entry does not count as having run', () => {
    const runlog = { runs: [{ date: '2026-07-23', window: 'open-window', model: 'S', status: 'queued' }] };
    expect(needsLateMarkToMarket(runlog, 'S', '2026-07-23', holidays)).toBe(true);
  });
});

describe('buildLateMarkToMarketNote', () => {
  it('mentions the date and "no new orders"', () => {
    const note = buildLateMarkToMarketNote('2026-07-23');
    expect(note).toContain('2026-07-23');
    expect(note.toLowerCase()).toContain('no new orders');
  });
});
