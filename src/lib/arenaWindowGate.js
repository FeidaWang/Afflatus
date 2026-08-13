import { easternTimeParts, isNyseSession } from './marketSession.js';

export const ARENA_WINDOW_RANGES = Object.freeze({
  premarket: Object.freeze({ start: 8 * 60 + 30, end: 9 * 60 + 20 }),
  open: Object.freeze({ start: 10 * 60 + 5, end: 10 * 60 + 20 }),
  late: Object.freeze({ start: 15 * 60 + 30, end: 15 * 60 + 45 }),
  postmarket: Object.freeze({ start: 16 * 60 + 30, end: 17 * 60 + 15 }),
});

const EARLY_CLOSE_DATES = new Set([
  // NYSE-published 13:00 ET closes. Keep this fail-visible table aligned with
  // https://www.nyse.com/trade/hours-calendars when the exchange adds a year.
  '2026-11-27',
  '2026-12-24',
  '2027-11-26',
  '2028-07-03',
  '2028-11-24',
]);

export function isEarlyCloseSession(date, extraEarlyCloses = []) {
  return EARLY_CLOSE_DATES.has(date) || extraEarlyCloses.includes(date);
}

function effectiveRange(windowName, date, extraEarlyCloses) {
  const base = ARENA_WINDOW_RANGES[windowName];
  if (!base) throw new TypeError(`Unknown Arena window ${JSON.stringify(windowName)}`);
  if (!isEarlyCloseSession(date, extraEarlyCloses)) return base;

  if (windowName === 'late') return { start: 12 * 60 + 30, end: 12 * 60 + 45 };
  if (windowName === 'postmarket') return { start: 13 * 60 + 30, end: 14 * 60 + 15 };
  return base;
}

/**
 * Return a deterministic ET gate for one unattended Arena task invocation.
 * A seasonal duplicate schedule can safely call this outside its real window:
 * `due` will be false and the caller must perform no writes.
 */
export function assessArenaWindow(windowName, value = new Date(), options = {}) {
  const { date, minutes } = easternTimeParts(value);
  const session = isNyseSession(date, options.extraHolidays || []);
  const range = effectiveRange(windowName, date, options.extraEarlyCloses || []);
  let reason = 'outside-window';
  if (!session) reason = 'not-nyse-session';
  else if (minutes < range.start) reason = 'before-window';
  else if (minutes <= range.end) reason = 'due';
  else reason = 'after-window';

  return {
    window: windowName,
    date,
    minutes,
    session,
    earlyClose: isEarlyCloseSession(date, options.extraEarlyCloses || []),
    startMinutes: range.start,
    endMinutes: range.end,
    due: reason === 'due',
    reason,
  };
}

export function arenaExecutionWindowName(runlogWindow) {
  const names = {
    'open-window': 'open',
    'late-window': 'late',
    'post-market': 'postmarket',
  };
  const windowName = names[runlogWindow];
  if (!windowName) throw new TypeError(`Runlog window ${JSON.stringify(runlogWindow)} is not executable`);
  return windowName;
}
