/* ============================================================
   ALMANAC SKY — one pure model behind every figure, readout and sentence
   of the almanac horoscope page ("truth first").

   skyAt(dateISO, { window }) reads the Melbourne-noon sky of a day from the
   ±30-day window precomputed in public/transits-daily.json (see
   scripts/gen-transits-daily.mjs); outside the window it falls back to the
   light local Sun/Moon maths in astro.js and flags planetsAvailable:false.
   termInfo(dateISO) gives the current/next solar term with the exact instant
   in Melbourne time. Day pillar comes straight from bazi.dayPillar.
   ============================================================ */
import { dayPillar, julianDayUTC, sunApparentLongitude, STEMS, BRANCHES, ZODIAC_EN, ZODIAC_ZH } from './bazi.js';
import { moonLongitude, signOf, degInSign } from './astro.js';

export const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const mod = (n, m) => ((n % m) + m) % m;
const DAY_MS = 86400000;
const TZ = 'Australia/Melbourne';

export const PHASES = [
  { en: 'new moon', zh: '新月' }, { en: 'waxing crescent', zh: '蛾眉月' },
  { en: 'first quarter', zh: '上弦月' }, { en: 'waxing gibbous', zh: '盈凸月' },
  { en: 'full moon', zh: '满月' }, { en: 'waning gibbous', zh: '亏凸月' },
  { en: 'last quarter', zh: '下弦月' }, { en: 'waning crescent', zh: '残月' },
];

// 24 solar terms starting at 小寒 (λ = 285°), each 15° apart.
const TERM_NAMES = [
  ['小寒', 'Minor Cold'], ['大寒', 'Major Cold'], ['立春', 'Start of Spring'], ['雨水', 'Rain Water'],
  ['惊蛰', 'Awakening of Insects'], ['春分', 'Spring Equinox'], ['清明', 'Clear and Bright'], ['谷雨', 'Grain Rain'],
  ['立夏', 'Start of Summer'], ['小满', 'Grain Buds'], ['芒种', 'Grain in Ear'], ['夏至', 'Summer Solstice'],
  ['小暑', 'Minor Heat'], ['大暑', 'Major Heat'], ['立秋', 'Start of Autumn'], ['处暑', 'End of Heat'],
  ['白露', 'White Dew'], ['秋分', 'Autumn Equinox'], ['寒露', 'Cold Dew'], ['霜降', 'Frost Descent'],
  ['立冬', 'Start of Winter'], ['小雪', 'Minor Snow'], ['大雪', 'Major Snow'], ['冬至', 'Winter Solstice'],
];

const parseISO = (dateISO) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) throw new Error(`almanacSky: bad date ${dateISO}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);

const melbourneParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
function melbourneClock(ms) {
  const p = Object.fromEntries(melbourneParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Melbourne's UTC offset (hours) at noon of the given day (DST changes at 02:00-03:00, so noon is unambiguous).
function melbourneOffsetHours(y, m, d) {
  const probe = new Date(Date.UTC(y, m - 1, d, 2));
  const clock = melbourneClock(probe.getTime());
  const hour = Number(clock.time.slice(0, 2));
  const dayShift = clock.date === isoOf(probe.getTime()) ? 0 : 24;
  return hour + dayShift - 2;
}
const noonJD = (dateISO) => {
  const [y, m, d] = parseISO(dateISO);
  return julianDayUTC(y, m, d, 12 - melbourneOffsetHours(y, m, d));
};

const jdToMs = (jd) => (jd - 2440587.5) * DAY_MS;

function termInstantJD(targetDeg, approxJD) {
  const delta = (jd) => { const a = mod(sunApparentLongitude(jd) - targetDeg, 360); return a > 180 ? a - 360 : a; };
  let lo = approxJD - 10, hi = approxJD + 10;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (delta(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const termCache = new Map();
// All 24 term instants of a Gregorian year, ascending. {index, jd}
function termsOfYear(year) {
  if (!termCache.has(year)) {
    const jan1 = julianDayUTC(year, 1, 1, 0);
    termCache.set(year, TERM_NAMES.map((_, k) => ({
      index: k,
      jd: termInstantJD(mod(285 + 15 * k, 360), jan1 + 4 + (k * 365.2422) / 24),
    })));
  }
  return termCache.get(year);
}

function describeTerm({ index, jd }) {
  const ms = jdToMs(jd);
  const { date, time } = melbourneClock(ms);
  return { index, zh: TERM_NAMES[index][0], en: TERM_NAMES[index][1], lon: mod(285 + 15 * index, 360), at: new Date(ms).toISOString(), melbourneDate: date, melbourneTime: time };
}

// Solar-term context of a Melbourne calendar day. `current` is the term in
// force at Melbourne noon, `next` the following one; `entersToday` is the term
// whose instant falls on that Melbourne date (null on ordinary days).
export function termInfo(dateISO) {
  const [y] = parseISO(dateISO);
  const all = [...termsOfYear(y - 1), ...termsOfYear(y), ...termsOfYear(y + 1)];
  const noon = noonJD(dateISO);
  let at = all.findIndex((t) => t.jd > noon);
  const current = describeTerm(all[at - 1]);
  const next = describeTerm(all[at]);
  const entersToday = all.map(describeTerm).find((t) => t.melbourneDate === dateISO) || null;
  const daysToNext = Math.round((Date.parse(`${next.melbourneDate}T00:00:00Z`) - Date.parse(`${dateISO}T00:00:00Z`)) / DAY_MS);
  return { current, next, daysToNext, entersToday };
}

function windowRow(win, dateISO) {
  if (!win || !Array.isArray(win.days)) return null;
  const i = win.days.findIndex((r) => r[0] === dateISO);
  return i < 0 ? null : { i, days: win.days };
}

const wrapDelta = (to, from) => { const a = mod(to - from, 360); return a > 180 ? a - 360 : a; };

export function skyAt(dateISO, { window: win } = {}) {
  const [y, m, d] = parseISO(dateISO);
  const hit = windowRow(win, dateISO);
  const bodies = win && win.bodies ? win.bodies : BODIES;
  let longitudes;
  let retrograde = null;
  if (hit) {
    const row = hit.days[hit.i];
    longitudes = Object.fromEntries(bodies.map((b, k) => [b, row[k + 1]]));
    // Retrograde = longitude falls against the previous day (next day at the window's first row).
    const other = hit.days[hit.i > 0 ? hit.i - 1 : hit.i + 1];
    retrograde = Object.fromEntries(bodies.map((b, k) => {
      if (b === 'Sun' || b === 'Moon' || !other) return [b, false];
      const step = hit.i > 0 ? wrapDelta(row[k + 1], other[k + 1]) : wrapDelta(other[k + 1], row[k + 1]);
      return [b, step < 0];
    }));
  } else {
    const jd = noonJD(dateISO);
    longitudes = { Sun: sunApparentLongitude(jd), Moon: moonLongitude(jd) };
  }
  const sun = longitudes.Sun;
  const moon = longitudes.Moon;
  const elongation = mod(moon - sun, 360);
  const phaseIndex = Math.floor(mod(elongation + 22.5, 360) / 45);
  const sign = signOf(moon);
  const p = dayPillar(y, m, d);
  return {
    date: dateISO,
    planetsAvailable: Boolean(hit),
    planets: hit ? longitudes : null,
    retrograde,
    sun,
    moon,
    elongation,
    illumination: (1 - Math.cos((elongation * Math.PI) / 180)) / 2,
    phase: { index: phaseIndex, ...PHASES[phaseIndex] },
    moonSign: { index: sign, en: ZODIAC_EN[sign], zh: ZODIAC_ZH[sign], deg: degInSign(moon) },
    dayPillar: { stem: p.stem, branch: p.branch, name: STEMS[p.stem] + BRANCHES[p.branch] },
    term: termInfo(dateISO),
  };
}
