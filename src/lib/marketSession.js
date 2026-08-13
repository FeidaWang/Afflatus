const ET_ZONE = 'America/New_York';
const SESSION_CLOSE_MINUTES = 16 * 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function nthWeekday(year, month, weekday, nth) {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, offset + ((nth - 1) * 7));
}

function lastWeekday(year, month, weekday) {
  const last = utcDate(year, month + 1, 0);
  return addDays(last, -((last.getUTCDay() - weekday + 7) % 7));
}

function observedFixedHoliday(year, month, day) {
  const date = utcDate(year, month, day);
  if (date.getUTCDay() === 6) return addDays(date, -1);
  if (date.getUTCDay() === 0) return addDays(date, 1);
  return date;
}

// Anonymous Gregorian computus. NYSE closes on Good Friday.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

export function nyseHolidayDates(year) {
  return new Set([
    observedFixedHoliday(year, 1, 1),
    nthWeekday(year, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(year, 2, 1, 3), // Washington's Birthday
    addDays(easterSunday(year), -2),
    lastWeekday(year, 5, 1), // Memorial Day
    observedFixedHoliday(year, 6, 19),
    observedFixedHoliday(year, 7, 4),
    nthWeekday(year, 9, 1, 1), // Labor Day
    nthWeekday(year, 11, 4, 4), // Thanksgiving
    observedFixedHoliday(year, 12, 25),
  ].map(isoDate));
}

export function easternTimeParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

export function isNyseSession(dateString, extraHolidays = []) {
  if (!DATE_RE.test(dateString)) return false;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = utcDate(year, month, day);
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const holidays = nyseHolidayDates(year);
  // When New Year's Day lands on Saturday, its observed Friday belongs to the
  // prior calendar year (for example 2021-12-31 for New Year 2022).
  const nextNewYearObserved = isoDate(observedFixedHoliday(year + 1, 1, 1));
  if (nextNewYearObserved.startsWith(`${year}-`)) holidays.add(nextNewYearObserved);
  for (const holiday of extraHolidays) holidays.add(holiday);
  return !holidays.has(dateString);
}

/** Return the Nth NYSE session strictly after dateString (DST-proof). */
export function addNyseSessions(dateString, amount = 1, extraHolidays = []) {
  if (!DATE_RE.test(String(dateString || '')) || !Number.isInteger(amount) || amount < 1) {
    throw new TypeError('addNyseSessions requires YYYY-MM-DD and a positive integer amount');
  }
  const cursor = utcDate(...dateString.split('-').map(Number));
  let remaining = amount;
  for (let guard = 0; guard < 370; guard += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const candidate = isoDate(cursor);
    if (isNyseSession(candidate, extraHolidays)) remaining -= 1;
    if (remaining === 0) return candidate;
  }
  throw new RangeError(`Could not resolve ${amount} NYSE sessions after ${dateString}`);
}

export function lastCompletedMarketSession(value = new Date(), options = {}) {
  const { date, minutes } = easternTimeParts(value);
  const extraHolidays = options.extraHolidays || [];
  let candidate = utcDate(...date.split('-').map(Number));
  if (minutes < (options.closeMinutes ?? SESSION_CLOSE_MINUTES)) {
    candidate = addDays(candidate, -1);
  }
  while (!isNyseSession(isoDate(candidate), extraHolidays)) {
    candidate = addDays(candidate, -1);
  }
  return isoDate(candidate);
}

export function historyCacheKey(symbol, session) {
  const normalized = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(normalized) || !DATE_RE.test(session)) {
    throw new TypeError('Invalid Arena history cache identity');
  }
  return `afflatus-ta:v2:${normalized}:${session}`;
}

function validEntry(entry) {
  return Boolean(
    entry
    && DATE_RE.test(entry.session)
    && Array.isArray(entry.candles)
    && entry.candles.length > 20,
  );
}

export function readHistoryCache(storage, symbol, session) {
  try {
    const entry = JSON.parse(storage.getItem(historyCacheKey(symbol, session)));
    return validEntry(entry) && entry.session === session ? entry : null;
  } catch {
    return null;
  }
}

export function readLatestHistoryCache(storage, symbol, beforeSession) {
  const prefix = `afflatus-ta:v2:${String(symbol || '').trim().toUpperCase()}:`;
  let latest = null;
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const session = key.slice(prefix.length);
      if (!DATE_RE.test(session) || session >= beforeSession) continue;
      const entry = JSON.parse(storage.getItem(key));
      if (validEntry(entry) && (!latest || entry.session > latest.session)) latest = entry;
    }
  } catch {
    return null;
  }
  return latest;
}

export function writeHistoryCache(storage, symbol, session, candles, maxEntries = 4) {
  const entry = { session, candles, storedAt: Date.now() };
  storage.setItem(historyCacheKey(symbol, session), JSON.stringify(entry));

  const prefix = `afflatus-ta:v2:${String(symbol).toUpperCase()}:`;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.sort().slice(0, Math.max(0, keys.length - maxEntries))
    .forEach((key) => storage.removeItem(key));
  return entry;
}

export function removeHistoryCache(storage, symbol) {
  const prefix = `afflatus-ta:v2:${String(symbol || '').trim().toUpperCase()}:`;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
