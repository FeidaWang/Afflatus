/* ============================================================
   ASTRO (日月升星盘) — V21 Phase 5. Sun sign, moon sign, rising sign
   (whole-sign, tropical) and two-person sun/moon aspects.

   - Sun: reuses bazi.js's Meeus low-precision apparent longitude (~0.01°).
   - Moon: Meeus truncated lunar-longitude series (the 24 leading Σl terms
     with the E eccentricity correction) — roughly 0.05° class accuracy,
     vastly sufficient for sign-level work. VERIFIED structurally against
     this repo's independently-verified lunar calendar: on every lunar
     初一 the sun-moon elongation must cross 0° during that CST day, and
     on every 十五 it must be near 180° (tests sweep ~150 months).
   - Rising: standard sidereal-time + ascendant formula, calibrated by two
     physical invariants in tests (the ascendant sweeps all 12 signs in a
     day; at sunrise the ascendant is near the sun's longitude).
   - PLANETS (Mercury..Pluto) are deliberately NOT included: hand-typing
     VSOP87 coefficient tables from memory is exactly the kind of
     unverifiable data-entry this project refuses, and vendoring a full
     ephemeris library adds ~350KB to the bundle — logged in roadmap §7.8
     as a follow-up decision. This module is honest about being 日月升.

   Aspects: conjunction 0°±8, sextile 60°±4, square 90°±6, trine 120°±6,
   opposition 180°±8 (common orb choices; documented, not universal).
   ============================================================ */
import { julianDayUTC, sunApparentLongitude } from './bazi.js';

const DEG = Math.PI / 180;
const mod = (n, m) => ((n % m) + m) % m;

// CST civil instant → JD(UT). Unknown hour → noon (callers show a caveat).
export const cstToJD = (y, m, d, hour) => julianDayUTC(y, m, d, (hour == null ? 12 : hour) - 8);

export const sunLongitude = (jd) => sunApparentLongitude(jd);

// ---- moon geocentric ecliptic longitude (Meeus ch. 47, truncated) ---------
// [coefficient ×1e-6 deg, D, M, M', F]
const MOON_TERMS = [
  [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
  [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
  [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
  [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
  [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
  [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
  [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
  [-5163, 1, 0, -1, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
];
export function moonLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = mod(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841, 360);
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868) * DEG;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699) * DEG;
  const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * DEG;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sum = 0;
  for (const [coef, d, m, mp, f] of MOON_TERMS) {
    const e = m === 0 ? 1 : (Math.abs(m) === 1 ? E : E * E);
    sum += coef * e * Math.sin(d * D + m * M + mp * Mp + f * F);
  }
  return mod(Lp + sum * 1e-6, 360);
}

// signed sun→moon elongation in (-180, 180]
export function elongation(jd) {
  const e = mod(moonLongitude(jd) - sunLongitude(jd), 360);
  return e > 180 ? e - 360 : e;
}

// ---- rising sign (ascendant, tropical, whole-sign display) -----------------
function gmstDeg(jd) {
  const T = (jd - 2451545.0) / 36525;
  return mod(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000, 360);
}
export function ascendant(jd, latDeg, eastLonDeg) {
  const T = (jd - 2451545.0) / 36525;
  const eps = (23.4392911 - 0.0130042 * T) * DEG;
  const ramc = mod(gmstDeg(jd) + eastLonDeg, 360) * DEG;
  const phi = latDeg * DEG;
  // standard ascendant formula; quadrant handled by atan2
  const asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
  return mod(asc / DEG, 360);
}

export const signOf = (lonDeg) => Math.floor(mod(lonDeg, 360) / 30); // 0 = Aries
export const degInSign = (lonDeg) => mod(lonDeg, 30);

// ---- aspects ----------------------------------------------------------------
export const ASPECTS = [
  { key: 'conj', angle: 0, orb: 8 },
  { key: 'sextile', angle: 60, orb: 4 },
  { key: 'square', angle: 90, orb: 6 },
  { key: 'trine', angle: 120, orb: 6 },
  { key: 'opp', angle: 180, orb: 8 },
];
export const ASPECT_T = {
  conj: { zh: '合相', en: 'Conjunction', tone: 'strong', dZh: '能量重叠——强连接，好坏都放大', dEn: 'Energies overlap — a strong tie that amplifies everything' },
  sextile: { zh: '六合', en: 'Sextile', tone: 'soft', dZh: '轻松互助的角度，顺其自然就舒服', dEn: 'An easy, helpful angle — comfort without effort' },
  square: { zh: '刑相', en: 'Square', tone: 'hard', dZh: '摩擦角——会互相磨，但磨得好是成长', dEn: 'A friction angle — it grinds, and growth hides in the grind' },
  trine: { zh: '拱相', en: 'Trine', tone: 'soft', dZh: '天然顺滑的角度，相处不费力', dEn: 'Naturally smooth — being together takes little work' },
  opp: { zh: '冲相', en: 'Opposition', tone: 'hard', dZh: '对望的两端——互相吸引也互相拉扯', dEn: 'Two ends of one axis — attraction and tug-of-war at once' },
};
// smallest separation between two longitudes, and the matched aspect (or null)
export function aspectBetween(lonA, lonB) {
  const sep = Math.abs(((lonA - lonB + 540) % 360) - 180); // 0..180
  for (const a of ASPECTS) {
    if (Math.abs(sep - a.angle) <= a.orb) return { key: a.key, sep, orb: Math.abs(sep - a.angle) };
  }
  return null;
}
