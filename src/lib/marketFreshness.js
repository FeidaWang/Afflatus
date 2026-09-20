import { validateQuote } from './validateQuote.js';
import { easternTimeParts, isNyseSession, isEarlyCloseSession, isValidMarketDate } from './marketSession.js';


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
  const normalMinutes = options.availableFromMinutes ?? (9 * 60);
  const availableFromMinutes = isEarlyCloseSession(date, options.extraEarlyCloses || []) && normalMinutes >= 16 * 60
    ? normalMinutes - 3 * 60 : normalMinutes;
  const extraHolidays = options.extraHolidays || [];
  if (isNyseSession(date, extraHolidays) && minutes >= availableFromMinutes) return date;
  return previousSession(date, extraHolidays);
}

export function assessMarketSnapshot(snapshotDate, value = new Date(), options = {}) {
  const expectedDate = expectedMarketSnapshotDate(value, options);
  if (!isValidMarketDate(snapshotDate)) {
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


export function assessQuoteFreshness(quote, now = Date.now(), maxAgeMs = 5 * 60_000) {
  if (!validateQuote(quote, now).ok) return { state: 'unknown', ageMs: null };
  const ageMs = now - quote.t * 1000;
  return { state: ageMs > maxAgeMs ? 'stale' : 'fresh', ageMs };
}
