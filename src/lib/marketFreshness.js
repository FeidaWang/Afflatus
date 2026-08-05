import { easternTimeParts, isNyseSession } from './marketSession.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addIsoDays(dateString, amount) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function previousSession(dateString, extraHolidays) {
  let candidate = isNyseSession(dateString, extraHolidays)
    ? addIsoDays(dateString, -1)
    : dateString;
  while (!isNyseSession(candidate, extraHolidays)) candidate = addIsoDays(candidate, -1);
  return candidate;
}

/**
 * Expected session date for a market artifact. Before the artifact's normal
 * publication time, the previous session remains current. This avoids false
 * stale warnings on weekends and exchange holidays without letting a weekday
 * pipeline silently remain "today" for weeks.
 */
export function expectedMarketSnapshotDate(value = new Date(), options = {}) {
  const { date, minutes } = easternTimeParts(value);
  const availableFromMinutes = options.availableFromMinutes ?? (9 * 60);
  const extraHolidays = options.extraHolidays || [];
  if (isNyseSession(date, extraHolidays) && minutes >= availableFromMinutes) return date;
  return previousSession(date, extraHolidays);
}

export function assessMarketSnapshot(snapshotDate, value = new Date(), options = {}) {
  const expectedDate = expectedMarketSnapshotDate(value, options);
  if (!DATE_RE.test(String(snapshotDate || ''))) {
    return { state: 'missing', stale: true, snapshotDate: null, expectedDate };
  }
  if (snapshotDate > expectedDate) {
    return { state: 'future', stale: true, snapshotDate, expectedDate };
  }
  const stale = snapshotDate < expectedDate;
  return { state: stale ? 'stale' : 'fresh', stale, snapshotDate, expectedDate };
}

export const ARENA_PUBLICATION_MINUTES = Object.freeze({
  briefing: 8 * 60 + 30,
  picks: 9 * 60,
  postMarket: 16 * 60 + 30,
});
