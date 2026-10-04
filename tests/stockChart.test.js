import { describe, expect, it } from 'vitest';
import { stockWindow, aggregateCandles, normalizeIntraday } from '../prototypes/us-equities-dashboard/src/stockChartUtils.js';
import { assessNyseSession, isNyseSession, nyseHolidayDates } from '../prototypes/us-equities-dashboard/src/marketSession.js';

const days = (start, end) => {
  const rows = [];
  for (let date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    const t = date.toISOString().slice(0, 10);
    if (isNyseSession(t)) rows.push({ t, o: 100, h: 110, l: 90, c: 105, v: 10 });
  }
  return rows;
};

describe('stock chart windows', () => {
  const candles = days('2025-01-02', '2026-03-31');
  it.each([['M', '2026-03-02'], ['3M', '2025-12-31'], ['YTD', '2026-01-02'], ['Y', '2025-03-31'], ['MAX', '2025-01-02']])('selects %s using source calendar dates', (range, start) => {
    const view = stockWindow(candles, range);
    expect(view.candles[0].t).toBe(start);
    expect(view.candles.at(-1).t).toBe('2026-03-31');
  });
  it('pans without changing the window length or losing the last candle', () => {
    const newest = stockWindow(candles, '3M');
    const earliest = stockWindow(candles, '3M', 0);
    expect(earliest.candles[0].t).toBe('2025-01-02');
    expect(earliest.count).toBe(newest.count);
    expect(stockWindow(candles, '3M', 2).candles).toEqual(newest.candles);
    expect(stockWindow([], 'M').candles).toEqual([]);
  });
  it('preserves price extrema, opening, closing and volume when aggregating', () => {
    const rows = [
      { t: 'a', o: 100, h: 120, l: 90, c: 110, v: 5 },
      { t: 'b', o: 110, h: 115, l: 85, c: 95, v: 7 },
      { t: 'c', o: 95, h: 110, l: 88, c: 105, v: 3 },
    ];
    expect(aggregateCandles(rows, 1)).toEqual({ step: 3, candles: [{ t: 'a', end: 'c', o: 100, h: 120, l: 85, c: 105, v: 15 }] });
  });
  it('excludes malformed, nonfinite and extended-session intraday bars', () => {
    const row = datetime => ({ datetime, open: '100', high: '110', low: '90', close: '105' });
    const values = [row('2026-10-02 10:00:00'), row('2026-10-02 08:00:00'), row('2026-10-02 16:00:00'), row('bad'), { ...row('2026-10-02 10:05:00'), high: '101' }, { ...row('2026-10-02 10:10:00'), close: 'NaN' }];
    expect(normalizeIntraday(values).map(c => c.t)).toEqual(['2026-10-02 10:00:00']);
  });
});

describe('Melbourne US market clock — NYSE published 2026–2028 calendar', () => {
  it.each([
    ['2026-07-03T12:00:00Z', '2026-07-06T13:30:00.000Z'], // Observed Independence Day and weekend
    ['2026-04-03T12:00:00Z', '2026-04-06T13:30:00.000Z'], // Good Friday
    ['2026-11-26T12:00:00Z', '2026-11-27T14:30:00.000Z'], // Thanksgiving
    ['2026-12-25T12:00:00Z', '2026-12-28T14:30:00.000Z'], // Christmas and weekend
    ['2026-03-06T22:00:00Z', '2026-03-09T13:30:00.000Z'], // US DST begins
    ['2026-10-30T22:00:00Z', '2026-11-02T14:30:00.000Z'], // US DST ends
    ['2026-10-03T12:00:00Z', '2026-10-05T13:30:00.000Z'], // Melbourne DST begins
  ])('finds the next opening from %s', (now, target) => {
    const session = assessNyseSession(new Date(now));
    expect(session.regularOpen).toBe(false);
    expect(new Date(session.nextOpenMs).toISOString()).toBe(target);
  });
  it('converts Melbourne DST boundaries through IANA timezone rules', () => {
    const local = utc => new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(utc));
    expect(local('2026-10-02T13:30:00Z')).toBe('23:30');
    expect(local('2026-10-05T13:30:00Z')).toBe('00:30');
    expect(local('2026-11-02T14:30:00Z')).toBe('01:30');
  });
  it('uses the published 13:00 early close and returns to next-open countdown', () => {
    const before = assessNyseSession(new Date('2026-11-27T17:59:59Z'));
    expect(before.regularOpen).toBe(true);
    expect(new Date(before.closeMs).toISOString()).toBe('2026-11-27T18:00:00.000Z');
    const after = assessNyseSession(new Date('2026-11-27T18:00:00Z'));
    expect(after.regularOpen).toBe(false);
    expect(new Date(after.nextOpenMs).toISOString()).toBe('2026-11-30T14:30:00.000Z');
  });
  it('keeps New Year Saturday exceptions and all published 2026 holidays', () => {
    expect([...nyseHolidayDates(2026)].sort()).toEqual(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);
    expect(isNyseSession('2027-12-31')).toBe(true);
    expect(isNyseSession('2028-01-01')).toBe(false);
    expect(assessNyseSession(new Date('2029-01-02T12:00:00Z')).nextOpenMs).toBeNull();
  });
});
