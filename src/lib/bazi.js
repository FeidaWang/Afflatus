/* ============================================================
   BAZI (四柱八字) — pure calendar math (V20, horoscope.html).

   Pure functions only — no DOM, no fetch, no Date.now() defaults; callers
   pass explicit {y,m,d,hour}. Same testing discipline as arenaRules.js:
   this is entertainment content, but WRONG calendar math is still a bug,
   so the sexagenary day cycle is verified against two independently
   documented anchors in tests/bazi.test.js (1949-10-01 = 甲子日,
   1970-01-01 = 辛巳日 — both widely published).

   Year/month pillar boundaries use REAL solar-term instants (立春 and the
   other eleven 节), computed from the sun's apparent ecliptic longitude
   (Meeus low-precision formula, ~0.01° / a few minutes accuracy — plenty
   for day-level boundaries) instead of fixed calendar dates. Verified
   against published 节气 times in tests/bazi.test.js, including 2025
   (立春 fell on Feb 3, not the Feb-4 "usual" date) and 2026 (Feb 4).

   Remaining honest approximations (labelled on the page itself):
   - Hour pillar: 23:00–00:59 is treated as 子时 of the SAME calendar day
     (the 晚子时 day-boundary debate is out of scope).
   - Solar-term instants are converted to a China Standard Time (UTC+8)
     calendar date; no birth-location/timezone input, so a birth
     recorded in another timezone is treated as if it were a Beijing
     civil-calendar date (same simplification the day/month/year pillars
     already make).
   ============================================================ */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ANIMALS_ZH = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const ANIMALS_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

// Five elements: 0 wood 木, 1 fire 火, 2 earth 土, 3 metal 金, 4 water 水
export const ELEMENTS_ZH = ['木', '火', '土', '金', '水'];
export const ELEMENTS_EN = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 子水丑土寅卯木辰土巳午火未土申酉金戌土亥水

// ---- Julian Day Number (civil calendar) --------------------------------
export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// Anchor: 1949-10-01 was a 甲子 day (sexagenary index 0) — verified against
// the independent 1970-01-01 = 辛巳 (index 17) anchor in tests.
const DAY_ANCHOR_JDN = jdn(1949, 10, 1);

const mod = (n, m) => ((n % m) + m) % m;
const pillar = (idx60) => ({ stem: mod(idx60, 10), branch: mod(idx60, 12), idx: mod(idx60, 60) });

// ---- day pillar ----------------------------------------------------------
export function dayPillar(y, m, d) {
  return pillar(jdn(y, m, d) - DAY_ANCHOR_JDN);
}

// ---- solar longitude (Meeus low-precision, ~0.01° accuracy) ---------------
// JD (UTC, decimal) for a proleptic-Gregorian calendar date/time.
function julianDayUTC(y, m, d, hourUTC) {
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const A = Math.floor(yy / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + hourUTC / 24 + B - 1524.5;
}
// Inverse: calendar {year, month, day(+fraction)} for a JD (UTC).
function calendarFromJD(jd) {
  const Z = Math.floor(jd + 0.5), F = jd + 0.5 - Z;
  const alpha = Math.floor((Z - 1867216.25) / 36524.25);
  const A = Z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return { year, month, day };
}
const DEG = Math.PI / 180;
// Apparent geocentric ecliptic longitude of the sun, degrees [0,360).
function sunApparentLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * DEG;
  return mod(L0 + C - 0.00569 - 0.00478 * Math.sin(omega), 360);
}
// Signed shortest angular distance lon → target, in (-180, 180].
const angleDelta = (lon, target) => { const a = mod(lon - target, 360); return a > 180 ? a - 360 : a; };
// Find the JD (UTC) nearest approxJD where the sun's longitude == targetDeg.
function findSolarTermJD(targetDeg, approxJD) {
  let lo = approxJD - 4, hi = approxJD + 4;
  for (let i = 0; i < 20 && angleDelta(sunApparentLongitude(lo), targetDeg) > 0; i++) lo -= 4;
  for (let i = 0; i < 20 && angleDelta(sunApparentLongitude(hi), targetDeg) < 0; i++) hi += 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (angleDelta(sunApparentLongitude(mid), targetDeg) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// Calendar {m, d} (China Standard Time, UTC+8) on which the sun's apparent
// longitude reaches targetDeg in the given Gregorian year. approxMonth/Day
// seed the search window (must be within ~4 days of the true date).
export function solarTermDate(year, targetDeg, approxMonth, approxDay) {
  const approxJD = julianDayUTC(year, approxMonth, approxDay, 12);
  const jdUTC = findSolarTermJD(targetDeg, approxJD);
  const cal = calendarFromJD(jdUTC + 8 / 24);
  return { m: cal.month, d: Math.floor(cal.day) };
}

// ---- year pillar (real 立春 boundary) -------------------------------------
const _termCache = new Map();
function termDateInYear(year, term) {
  const key = year * 1000 + term.lon;
  if (!_termCache.has(key)) _termCache.set(key, solarTermDate(year, term.lon, term.m, term.d));
  return _termCache.get(key);
}
export function baziYear(y, m, d) {
  const lichun = termDateInYear(y, MONTH_TERMS[1]); // 立春, lon 315
  const beforeLichun = m < lichun.m || (m === lichun.m && d < lichun.d);
  return beforeLichun ? y - 1 : y;
}
export function yearPillar(y, m, d) {
  const by = baziYear(y, m, d);
  return { stem: mod(by - 4, 10), branch: mod(by - 4, 12), baziYear: by };
}

// ---- month pillar (real solar-term boundaries) ----------------------------
// Each entry: solar longitude `lon`, {m,d} seed the search window, branch `b`.
const MONTH_TERMS = [
  { lon: 285, m: 1, d: 6, b: 1 },   // 小寒 → 丑月
  { lon: 315, m: 2, d: 4, b: 2 },   // 立春 → 寅月
  { lon: 345, m: 3, d: 6, b: 3 },   // 惊蛰 → 卯月
  { lon: 15, m: 4, d: 5, b: 4 },    // 清明 → 辰月
  { lon: 45, m: 5, d: 6, b: 5 },    // 立夏 → 巳月
  { lon: 75, m: 6, d: 6, b: 6 },    // 芒种 → 午月
  { lon: 105, m: 7, d: 7, b: 7 },   // 小暑 → 未月
  { lon: 135, m: 8, d: 8, b: 8 },   // 立秋 → 申月
  { lon: 165, m: 9, d: 8, b: 9 },   // 白露 → 酉月
  { lon: 195, m: 10, d: 8, b: 10 }, // 寒露 → 戌月
  { lon: 225, m: 11, d: 7, b: 11 }, // 立冬 → 亥月
  { lon: 255, m: 12, d: 7, b: 0 },  // 大雪 → 子月
];
export function monthBranch(y, m, d) {
  let b = 0; // dates before 小寒 fall in the 子月 that started the previous 大雪
  for (const t of MONTH_TERMS) {
    const td = termDateInYear(y, t);
    if (m > td.m || (m === td.m && d >= td.d)) b = t.b;
  }
  return b;
}
// 五虎遁: the 寅-month stem starts from 丙 for 甲/己 years, advancing 2 per pair.
export function monthPillar(y, m, d) {
  const yp = yearPillar(y, m, d);
  const b = monthBranch(y, m, d);
  const startStem = mod((yp.stem % 5) * 2 + 2, 10);
  const offsetFromYin = mod(b - 2, 12);
  return { stem: mod(startStem + offsetFromYin, 10), branch: b };
}

// ---- birth-input timezone/DST correction (optional accuracy refinement) --
// All the calendar math above assumes the input {y,m,d,hour} is already in
// the China Standard Time (UTC+8) civil-calendar frame. If the birth
// actually happened somewhere else (or during daylight saving), the clock
// time on the birth certificate is NOT that frame, and the day/hour pillar
// (and, near a boundary, the month/year pillar) can come out wrong.
//
// China itself briefly ran its own DST 1986-1991 (published start/end
// dates below) — so even an "I don't know my timezone, just use China"
// input needs this one correction applied automatically.
const CN_DST_WINDOWS = {
  1986: [5, 4, 9, 14], 1987: [4, 12, 9, 13], 1988: [4, 10, 9, 11],
  1989: [4, 16, 9, 17], 1990: [4, 15, 9, 16], 1991: [4, 14, 9, 15],
};
function inCnDstWindow(y, m, d) {
  const w = CN_DST_WINDOWS[y];
  if (!w) return false;
  const [sm, sd, em, ed] = w;
  return (m > sm || (m === sm && d >= sd)) && (m < em || (m === em && d <= ed));
}
// Shift {y,m,d,hour} by deltaHours (possibly fractional, e.g. a half-hour
// timezone), rolling the calendar date forward/back as needed. Uses Date's
// UTC methods purely as calendar arithmetic (no host-timezone dependency).
function shiftHours(y, m, d, hour, deltaHours) {
  const dt = new Date(Date.UTC(y, m - 1, d, hour));
  dt.setTime(dt.getTime() + deltaHours * 3600000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), hour: dt.getUTCHours() };
}
// Normalize a birth {y,m,d,hour} into the CST frame this module assumes.
// tz is optional: { utcOffset, dst }. utcOffset is the birth location's
// STANDARD (non-DST) UTC offset in hours (may be fractional, e.g. 5.5 for
// India); dst means the local clock was on daylight saving at that moment.
// If tz is omitted, the birth is assumed to already be China civil time,
// with China's own 1986-1991 DST corrected automatically. hour == null
// (unknown time) is returned unchanged — there's no clock reading to
// correct, and the date alone is never far enough from a boundary for a
// few hours' timezone difference to matter at day granularity in practice.
export function normalizeBirthToCST({ y, m, d, hour }, tz) {
  if (hour == null) return { y, m, d, hour: null };
  if (!tz || tz.utcOffset == null) {
    return inCnDstWindow(y, m, d) ? shiftHours(y, m, d, hour, -1) : { y, m, d, hour };
  }
  const delta = (tz.dst ? -1 : 0) + (8 - tz.utcOffset);
  return delta === 0 ? { y, m, d, hour } : shiftHours(y, m, d, hour, delta);
}

// ---- hour pillar (五鼠遁) -------------------------------------------------
export function hourBranchOf(hour) {
  return Math.floor(mod(hour + 1, 24) / 2);
}
export function hourPillar(dayStemIdx, hour) {
  const hb = hourBranchOf(hour);
  const startStem = mod((dayStemIdx % 5) * 2, 10);
  return { stem: mod(startStem + hb, 10), branch: hb };
}

// ---- full chart -----------------------------------------------------------
// hour: 0-23, or null/undefined for "hour unknown" (three-pillar chart).
export function computeBazi({ y, m, d, hour }) {
  const yp = yearPillar(y, m, d);
  const mp = monthPillar(y, m, d);
  const dp = dayPillar(y, m, d);
  const hp = (hour == null) ? null : hourPillar(dp.stem, hour);
  const pillars = [yp, mp, dp, ...(hp ? [hp] : [])];
  const elements = [0, 0, 0, 0, 0];
  for (const p of pillars) { elements[STEM_ELEMENT[p.stem]]++; elements[BRANCH_ELEMENT[p.branch]]++; }
  return {
    year: yp, month: mp, day: dp, hour: hp,
    dayMaster: dp.stem,
    dayMasterElement: STEM_ELEMENT[dp.stem],
    animal: yp.branch,
    elements,
  };
}

export const pillarName = (p) => STEMS[p.stem] + BRANCHES[p.branch];

// ---- western zodiac --------------------------------------------------------
export const ZODIAC_ZH = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const ZODIAC_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// triplicity: 0 fire 1 earth 2 air 3 water — Aries fire, Taurus earth, ...
export const ZODIAC_TRIPLICITY = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
const ZODIAC_STARTS = [[3, 21], [4, 20], [5, 21], [6, 22], [7, 23], [8, 23], [9, 23], [10, 24], [11, 23], [12, 22], [1, 20], [2, 19]];
export function zodiacIndex(m, d) {
  // latest sign whose start date (within the calendar year) is <= (m, d);
  // dates before Jan 20 fall through to Capricorn (wrapped from Dec 22).
  let best = 9, bestKey = -1;
  for (let i = 0; i < 12; i++) {
    const [sm, sd] = ZODIAC_STARTS[i], key = sm * 100 + sd;
    if ((m > sm || (m === sm && d >= sd)) && key > bestKey) { best = i; bestKey = key; }
  }
  return best;
}
