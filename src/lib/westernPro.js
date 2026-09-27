/* ============================================================
   WESTERN PRO — natal + predictive techniques on astronomy-engine.

   DYNAMIC-IMPORT ONLY (same rule as astroPlanets.ts): this module pulls in
   astronomy-engine and must only load when the user opens the astrology
   lab / synastry, never on first paint.

   Conventions (each chosen to match astro.com / Swiss Ephemeris defaults
   unless noted; sources in docs linked from the page):
   - Positions: geocentric apparent tropical longitude, true ecliptic of
     date (Ecliptic(GeoVector(...,true))), Moon via EclipticGeoMoon.
   - Lunar node: TRUE (osculating) node from the Moon's state vector, as
     Swiss SE_TRUE_NODE; South Node = +180°. Mean node also returned.
   - Black Moon Lilith: MEAN lunar apogee (Meeus ch.50 mean perigee +180°).
   - Juno 婚神星: osculating-element table (junoElements.js, ≤1 yr Kepler
     propagation) — ≤0.07° vs JPL Horizons 1900–2100.
   - Houses: Placidus (Swiss swehouse.c iteration); Porphyry inside the
     polar circles (Swiss does the same fallback). Whole Sign available.
   - Secondary progressions (次限): 1 day = 1 tropical year (365.24219 d);
     progressed angles by Naibod in RA (astro.com default).
   - Tertiary progressions (三限): 1 day = 1 lunar month. Troinski's
     tropical month (27.321582 d) by default; Chinese sites (12sign) use the
     synodic month 29.530589 d — pass { month: 'synodic' }.
     Angles: solar arc (progressed Sun − natal Sun) added to the MC.
   - Solar arc directions (日弧): arc = secondary-progressed Sun − natal Sun,
     added to every natal point.
   - Solar / lunar return (日返/月返): exact instant the Sun / Moon returns
     to its natal longitude; cast for the location you pass (current
     residence by default in the UI — the modern convention).
   - Firdaria (法达): diurnal order ☉♀☿☽♄♃♂☊☋; nocturnal Abu Ma'shar order
     ☽♄♃♂☉♀☿☊☋ (Bonatti variant available); planetary periods split in 7
     equal sub-periods in Chaldean order from the period lord; nodes have
     no sub-periods; cycle restarts after 75 years.
   - Annual profections (小限): whole-sign, one sign per completed year
     from the ASC sign; lord = traditional domicile ruler; monthly
     profection = +1 sign per 1/12 year.
   - Relocation (重置盘): same UT instant, angles/houses for a new place.
   - Composite (组合盘): near-midpoints; houses from the midpoint MC.
     Davison (时空盘): chart for the time & space midpoint.
   ENTERTAINMENT ONLY — the page says so.
   ============================================================ */
import * as A from 'astronomy-engine';
import { JUNO_ELEMENTS } from './junoElements.js';

const DEG = Math.PI / 180;
export const norm = (x) => ((x % 360) + 360) % 360;
export const diff180 = (a, b) => { const d = norm(a - b); return d > 180 ? d - 360 : d; };
const jdOf = (date) => date.getTime() / 864e5 + 2440587.5;
const dateOf = (jd) => new Date((jd - 2440587.5) * 864e5);
const timeOf = (jd) => A.MakeTime(dateOf(jd));

export const SIGN_ZH = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const SIGN_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const BODY_ZH = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星', Node: '北交点', SouthNode: '南交点', Lilith: '莉莉丝', Juno: '婚神星', ASC: '上升', MC: '天顶', DSC: '下降', IC: '天底' };
export const BODY_GLYPH = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Node: '☊', SouthNode: '☋', Lilith: '⚸', Juno: '⚵', ASC: 'AC', MC: 'MC', DSC: 'DC', IC: 'IC' };
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// ---- body positions ---------------------------------------------------------
function planetLon(body, jd) {
  const t = timeOf(jd);
  if (body === 'Sun') return A.SunPosition(t).elon;
  if (body === 'Moon') return A.EclipticGeoMoon(t).lon;
  return A.Ecliptic(A.GeoVector(A.Body[body], t, true)).elon;
}
export function trueNode(jd) {
  const t = timeOf(jd);
  const s = A.RotateState(A.Rotation_EQJ_ECT(t), A.GeoMoonState(t));
  const hx = s.y * s.vz - s.z * s.vy, hy = s.z * s.vx - s.x * s.vz;
  return norm(Math.atan2(hx, -hy) / DEG);
}
const T_of = (jd) => (jd - 2451545.0) / 36525;
export function meanNode(jd) {
  const T = T_of(jd);
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T ** 4 / 60616000);
}
export function meanLilith(jd) {
  const T = T_of(jd);
  return norm(83.3532465 + 4069.0137287 * T - 0.0103200 * T * T - T ** 3 / 80053 + T ** 4 / 18999000 + 180);
}
// Juno: nearest osculating element set, Kepler, light-time, true ecliptic of date.
const GM = 0.01720209895 ** 2, EPS0 = 23.4392911 * DEG;
function junoHelioEQJ(jd) {
  let best = JUNO_ELEMENTS[0];
  for (const r of JUNO_ELEMENTS) if (Math.abs(r[0] - jd) < Math.abs(best[0] - jd)) best = r;
  const [ej, a, e, i0, O0, w0, M0] = best;
  const M = M0 * DEG + Math.sqrt(GM / a ** 3) * (jd - ej);
  let E = M; for (let k = 0; k < 30; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const i = i0 * DEG, O = O0 * DEG, w = w0 * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
  const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  return [x, y * Math.cos(EPS0) - z * Math.sin(EPS0), y * Math.sin(EPS0) + z * Math.cos(EPS0)];
}
export function junoLon(jd) {
  const t = timeOf(jd); const earth = A.HelioVector(A.Body.Earth, t);
  let lt = 0, g;
  for (let k = 0; k < 3; k++) { const p = junoHelioEQJ(jd - lt); g = [p[0] - earth.x, p[1] - earth.y, p[2] - earth.z]; lt = Math.hypot(...g) * 0.0057755183; }
  return A.Ecliptic(new A.Vector(g[0], g[1], g[2], t)).elon;
}
function lonOf(body, jd) {
  if (body === 'Node') return trueNode(jd);
  if (body === 'SouthNode') return norm(trueNode(jd) + 180);
  if (body === 'Lilith') return meanLilith(jd);
  if (body === 'Juno') return junoLon(jd);
  return planetLon(body, jd);
}
export const BODIES = ['Sun', 'Moon', ...PLANETS, 'Node', 'SouthNode', 'Juno', 'Lilith'];
export function bodiesAt(jd, list = BODIES) {
  const out = {};
  for (const b of list) {
    const lon = lonOf(b, jd);
    const speed = b === 'SouthNode' ? null : diff180(lonOf(b, jd + 0.5), lonOf(b, jd - 0.5)); // °/day
    out[b] = { lon, speed, retro: speed != null && speed < 0 && b !== 'Node', sign: Math.floor(lon / 30), deg: lon % 30 };
  }
  if (out.SouthNode) out.SouthNode.speed = out.Node?.speed ?? null;
  return out;
}

// ---- angles & houses ----------------------------------------------------------
export function obliquity(jd) { return A.e_tilt(timeOf(jd)).tobl; }
export function armcOf(jd, eastLon) { return norm(A.SiderealTime(timeOf(jd)) * 15 + eastLon); }
export function mcFromArmc(armc, eps) {
  const r = armc * DEG, e = eps * DEG;
  return norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
}
// ecliptic point where the circle with pole height f cuts, for RA x (Swiss Asc1)
function asc1(x, f, eps) {
  const r = x * DEG, e = eps * DEG, ff = f * DEG;
  return norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e) - Math.tan(ff) * Math.sin(e)) / DEG);
}
export function ascFromArmc(armc, lat, eps) { return asc1(norm(armc + 90), lat, eps); }
export function armcFromMc(mc, eps) {
  const l = mc * DEG, e = eps * DEG;
  return norm(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) / DEG);
}
function placidusCusp(armc, lat, eps, offset, k, f0) {
  const R = norm(armc + offset);
  let lam = asc1(R, f0, eps);
  for (let i = 0; i < 100; i++) {
    const tanD = Math.tan(Math.asin(Math.sin(eps * DEG) * Math.sin(lam * DEG)));
    if (Math.abs(tanD) < 1e-10) return R;
    const f = Math.atan(Math.sin(Math.asin(Math.tan(lat * DEG) * tanD) / k) / tanD) / DEG;
    const next = asc1(R, f, eps);
    if (Math.abs(diff180(next, lam)) < 1 / 360000) return next;
    lam = next;
  }
  return null;
}
export function housesFromArmc(armc, lat, eps, system = 'placidus') {
  const mc = mcFromArmc(armc, eps), asc = ascFromArmc(armc, lat, eps);
  const cusps = new Array(12);
  if (system === 'whole') {
    for (let i = 0; i < 12; i++) cusps[i] = norm(Math.floor(asc / 30) * 30 + 30 * i);
    return { asc, mc, cusps, system: 'whole' };
  }
  let used = 'placidus';
  if (Math.abs(lat) < 90 - eps) {
    const a = Math.asin(Math.tan(lat * DEG) * Math.tan(eps * DEG));
    const fh1 = Math.atan(Math.sin(a / 3) / Math.tan(eps * DEG)) / DEG;
    const fh2 = Math.atan(Math.sin(2 * a / 3) / Math.tan(eps * DEG)) / DEG;
    const c11 = placidusCusp(armc, lat, eps, 30, 3, fh1), c12 = placidusCusp(armc, lat, eps, 60, 1.5, fh2);
    const c2 = placidusCusp(armc, lat, eps, 120, 1.5, fh2), c3 = placidusCusp(armc, lat, eps, 150, 3, fh1);
    if ([c11, c12, c2, c3].every((c) => c != null)) {
      Object.assign(cusps, { 0: asc, 1: c2, 2: c3, 3: norm(mc + 180), 9: mc, 10: c11, 11: c12 });
    } else used = 'porphyry';
  } else used = 'porphyry';
  if (used === 'porphyry') {
    const q = norm(asc - mc), q2 = norm(mc + 180 - asc);
    Object.assign(cusps, { 0: asc, 9: mc, 10: norm(mc + q / 3), 11: norm(mc + 2 * q / 3), 1: norm(asc + q2 / 3), 2: norm(asc + 2 * q2 / 3), 3: norm(mc + 180) });
  }
  for (const [i, j] of [[4, 10], [5, 11], [6, 0], [7, 1], [8, 2]]) cusps[i] = norm(cusps[j] + 180);
  return { asc, mc, cusps, system: used };
}
export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    if (norm(lon - a) < norm(b - a)) return i + 1;
  }
  return 12;
}

// ---- aspects ----------------------------------------------------------------
export const ASPECTS = [
  { key: 'conj', angle: 0, zh: '合', en: 'conjunct', glyph: '☌', tone: 0, orb: 8 },
  { key: 'sext', angle: 60, zh: '六合', en: 'sextile', glyph: '⚹', tone: 1, orb: 5 },
  { key: 'sq', angle: 90, zh: '刑', en: 'square', glyph: '□', tone: -1, orb: 7 },
  { key: 'tri', angle: 120, zh: '拱', en: 'trine', glyph: '△', tone: 1, orb: 7 },
  { key: 'qx', angle: 150, zh: '梅花', en: 'quincunx', glyph: '⚻', tone: -0.3, orb: 3 },
  { key: 'opp', angle: 180, zh: '冲', en: 'opposite', glyph: '☍', tone: -1, orb: 8 },
];
const LUMINARY = new Set(['Sun', 'Moon']);
const POINT = new Set(['Node', 'SouthNode', 'Juno', 'Lilith', 'ASC', 'MC', 'DSC', 'IC']);
function orbFor(asp, a, b, scale) {
  let o = asp.orb;
  if (LUMINARY.has(a) || LUMINARY.has(b)) o += (asp.key === 'qx' ? 0 : 2);
  if (POINT.has(a) || POINT.has(b)) o = Math.min(o, asp.key === 'conj' || asp.key === 'opp' ? 4 : 2.5);
  return o * scale;
}
/** aspects between two point sets; `speedsA/B` (°/day, may be missing) decide applying/separating. */
export function aspectsBetween(A_, B_, { scale = 1, same = false, maxOrb = null } = {}) {
  const out = []; const ka = Object.keys(A_), kb = Object.keys(B_);
  for (let i = 0; i < ka.length; i++) {
    for (let j = same ? i + 1 : 0; j < kb.length; j++) {
      const a = ka[i], b = kb[j];
      if (same && ((a === 'Node' && b === 'SouthNode') || (a === 'ASC' && b === 'DSC') || (a === 'MC' && b === 'IC'))) continue;
      const pa = A_[a], pb = B_[b];
      const sep = Math.abs(diff180(pa.lon, pb.lon));
      for (const asp of ASPECTS) {
        const orbMax = maxOrb ?? orbFor(asp, a, b, scale);
        const orb = Math.abs(sep - asp.angle);
        if (orb <= orbMax) {
          const va = pa.speed || 0, vb = pb.speed || 0;
          const d = diff180(pa.lon, pb.lon), sepRate = Math.sign(d || 1) * (va - vb);
          const applying = (sep - asp.angle) * sepRate < 0;
          out.push({ a, b, key: asp.key, zh: asp.zh, en: asp.en, glyph: asp.glyph, tone: asp.tone, orb, exact: orb < 1, applying, strength: 1 - orb / orbMax });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

// ---- dignities / sect / rulers ------------------------------------------------
export const DOMICILE = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const EXALT = { Sun: 0, Moon: 1, Jupiter: 3, Mercury: 5, Saturn: 6, Mars: 9, Venus: 11 };
export function dignityOf(body, lon) {
  const s = Math.floor(norm(lon) / 30);
  if (DOMICILE[s] === body) return { key: 'dom', zh: '入庙', en: 'domicile', score: 5 };
  if (EXALT[body] === s) return { key: 'exalt', zh: '擢升', en: 'exaltation', score: 4 };
  if (DOMICILE[(s + 6) % 12] === body) return { key: 'det', zh: '落陷', en: 'detriment', score: -5 };
  if (EXALT[body] === (s + 6) % 12) return { key: 'fall', zh: '失势', en: 'fall', score: -4 };
  return null;
}

// ---- chart builder -----------------------------------------------------------
/** A full chart for a UT instant. loc = {lat, lon} or null (no houses/angles). */
export function chartAt(jd, loc, { system = 'placidus', bodies = BODIES } = {}) {
  const pts = bodiesAt(jd, bodies);
  let houses = null;
  if (loc && loc.lat != null && loc.lon != null) {
    const eps = obliquity(jd);
    houses = housesFromArmc(armcOf(jd, loc.lon), loc.lat, eps, system);
    houses.armc = armcOf(jd, loc.lon); houses.eps = eps;
    for (const b of Object.keys(pts)) pts[b].house = houseOf(pts[b].lon, houses.cusps);
  }
  const sect = houses ? (houseOf(pts.Sun.lon, houses.cusps) >= 7 ? 'day' : 'night') : null;
  return { jd, date: dateOf(jd), loc: loc || null, points: pts, houses, sect };
}
export function withAngles(chart) {
  const p = { ...chart.points };
  if (chart.houses) {
    p.ASC = { lon: chart.houses.asc, speed: null }; p.MC = { lon: chart.houses.mc, speed: null };
    p.DSC = { lon: norm(chart.houses.asc + 180), speed: null }; p.IC = { lon: norm(chart.houses.mc + 180), speed: null };
  }
  return p;
}
/** birth = CST-normalized {y,m,d,hour} (hour null → noon), plus optional lat/lon. */
export function birthJD(b) { return jdOf(new Date(Date.UTC(b.y, b.m - 1, b.d, (b.hour == null ? 12 : b.hour) - 8, b.hour == null ? 0 : 30))); }
export function natalChart(b, opts) {
  const c = chartAt(birthJD(b), b.lat != null && b.lon != null && b.hour != null ? { lat: b.lat, lon: b.lon } : null, opts);
  c.timeKnown = b.hour != null;
  return c;
}

// ---- predictive techniques ------------------------------------------------------
const TROPICAL_YEAR = 365.24219;
const yearsSince = (natal, jd) => (jd - natal.jd) / TROPICAL_YEAR;

export function transits(natal, jd, { loc = natal.loc } = {}) {
  const sky = chartAt(jd, loc);
  const tr = {};
  for (const b of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node', 'Juno']) {
    tr[b] = { ...sky.points[b], natalHouse: natal.houses ? houseOf(sky.points[b].lon, natal.houses.cusps) : null };
  }
  const aspects = aspectsBetween(tr, withAngles(natal), { maxOrb: null, scale: 0.4 });
  return { sky, points: tr, aspects };
}

export function secondaryProgression(natal, jd) {
  const years = yearsSince(natal, jd);
  const pjd = natal.jd + years; // 1 day per year
  const c = chartAt(pjd, null);
  if (natal.houses) {
    const armc = norm(natal.houses.armc + 0.985647 * years); // Naibod in RA
    const eps = obliquity(pjd);
    c.houses = housesFromArmc(armc, natal.loc.lat, eps);
    c.houses.armc = armc;
    for (const b of Object.keys(c.points)) c.points[b].house = houseOf(c.points[b].lon, c.houses.cusps);
  }
  c.progressedJD = pjd; c.years = years;
  return c;
}

export function tertiaryProgression(natal, jd, { month = 'tropical' } = {}) {
  const Lm = month === 'synodic' ? 29.530589 : 27.321582;
  const pjd = natal.jd + (jd - natal.jd) / Lm;
  const c = chartAt(pjd, null);
  if (natal.houses) {
    const arc = diff180(c.points.Sun.lon, natal.points.Sun.lon);
    const mc = norm(natal.houses.mc + arc), eps = obliquity(pjd);
    c.houses = housesFromArmc(armcFromMc(mc, eps), natal.loc.lat, eps);
    for (const b of Object.keys(c.points)) c.points[b].house = houseOf(c.points[b].lon, c.houses.cusps);
  }
  c.progressedJD = pjd; c.monthLength = Lm;
  return c;
}

export function solarArc(natal, jd) {
  const prog = secondaryProgression(natal, jd);
  const arc = diff180(prog.points.Sun.lon, natal.points.Sun.lon);
  const pts = {};
  for (const [k, v] of Object.entries(withAngles(natal))) pts[k] = { lon: norm(v.lon + arc), speed: 0 };
  return { arc, points: pts, aspects: aspectsBetween(pts, withAngles(natal), { maxOrb: 1 }).filter((a) => a.a !== a.b) };
}

function solveReturn(body, target, jd0, rate) {
  let jd = jd0;
  for (let i = 0; i < 12; i++) {
    const d = diff180(planetLon(body, jd), target);
    const r = body === 'Moon' ? diff180(planetLon('Moon', jd + 1 / 48), planetLon('Moon', jd - 1 / 48)) * 24 : rate;
    jd -= d / r;
    if (Math.abs(d) < 1e-6) break;
  }
  return jd;
}
/** Solar return nearest the birthday in calendar `year`. */
export function solarReturn(natal, year, loc) {
  const bd = natal.date;
  const jd0 = jdOf(new Date(Date.UTC(year, bd.getUTCMonth(), bd.getUTCDate(), bd.getUTCHours())));
  const jd = solveReturn('Sun', natal.points.Sun.lon, jd0, 0.98565);
  return chartAt(jd, loc);
}
/** First lunar return at/after jdFrom (use jdFrom − 27.3 to get the current one). */
export function lunarReturn(natal, jdFrom, loc) {
  const d = norm(natal.points.Moon.lon - planetLon('Moon', jdFrom));
  const jd = solveReturn('Moon', natal.points.Moon.lon, jdFrom + d / 13.176, 13.176);
  return chartAt(jd, loc);
}
export function currentLunarReturn(natal, jd, loc) {
  const r = lunarReturn(natal, jd - 27.4, loc);
  return r.jd > jd ? lunarReturn(natal, jd - 55, loc) : r;
}

export function relocation(natal, loc) { return chartAt(natal.jd, loc); }

// Firdaria
const FIRDARIA_DAY = [['Sun', 10], ['Venus', 8], ['Mercury', 13], ['Moon', 9], ['Saturn', 11], ['Jupiter', 12], ['Mars', 7], ['Node', 3], ['SouthNode', 2]];
const FIRDARIA_NIGHT = [['Moon', 9], ['Saturn', 11], ['Jupiter', 12], ['Mars', 7], ['Sun', 10], ['Venus', 8], ['Mercury', 13], ['Node', 3], ['SouthNode', 2]];
const FIRDARIA_NIGHT_BONATTI = [['Moon', 9], ['Saturn', 11], ['Jupiter', 12], ['Mars', 7], ['Node', 3], ['SouthNode', 2], ['Sun', 10], ['Venus', 8], ['Mercury', 13]];
const CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
export function firdaria(natal, jd, { school = 'abumashar', sect } = {}) {
  const s = sect || natal.sect || (natal.points.Sun && 'day');
  const seq = s === 'night' ? (school === 'bonatti' ? FIRDARIA_NIGHT_BONATTI : FIRDARIA_NIGHT) : FIRDARIA_DAY;
  const age = yearsSince(natal, jd);
  const cyc = ((age % 75) + 75) % 75;
  let start = 0;
  const periods = seq.map(([lord, len]) => { const p = { lord, from: start, to: start + len }; start += len; return p; });
  const cur = periods.find((p) => cyc >= p.from && cyc < p.to);
  let sub = null;
  if (cur && cur.lord !== 'Node' && cur.lord !== 'SouthNode') {
    const len = (cur.to - cur.from) / 7, k = Math.floor((cyc - cur.from) / len);
    const i0 = CHALDEAN.indexOf(cur.lord);
    sub = { lord: CHALDEAN[(i0 + k) % 7], from: cur.from + k * len, to: cur.from + (k + 1) * len };
  }
  const base = age - cyc;
  return { sect: s, school, age, periods: periods.map((p) => ({ ...p, fromAge: base + p.from, toAge: base + p.to })), current: cur, sub };
}

// Annual profections
export function profection(natal, jd) {
  if (!natal.houses) return null;
  const years = yearsSince(natal, jd);
  const age = Math.floor(years);
  const ascSign = Math.floor(natal.houses.asc / 30);
  const sign = (ascSign + age) % 12;
  const monthIdx = Math.floor((years - age) * 12);
  const mSign = (sign + monthIdx) % 12;
  return { age, house: (age % 12) + 1, sign, lord: DOMICILE[sign], month: { index: monthIdx, sign: mSign, lord: DOMICILE[mSign] } };
}

// Composite / Davison
export function composite(cA, cB) {
  const pts = {};
  for (const k of Object.keys(cA.points)) {
    if (!cB.points[k]) continue;
    pts[k] = { lon: norm(cA.points[k].lon + diff180(cB.points[k].lon, cA.points[k].lon) / 2), speed: 0 };
  }
  let houses = null;
  if (cA.houses && cB.houses) {
    const mc = norm(cA.houses.mc + diff180(cB.houses.mc, cA.houses.mc) / 2);
    const lat = (cA.loc.lat + cB.loc.lat) / 2, eps = (cA.houses.eps + cB.houses.eps) / 2;
    houses = housesFromArmc(armcFromMc(mc, eps), lat, eps);
    for (const k of Object.keys(pts)) pts[k].house = houseOf(pts[k].lon, houses.cusps);
  }
  return { points: pts, houses };
}
export function davison(cA, cB) {
  const jd = (cA.jd + cB.jd) / 2;
  let loc = null;
  if (cA.loc && cB.loc) loc = { lat: (cA.loc.lat + cB.loc.lat) / 2, lon: norm(cA.loc.lon + diff180(cB.loc.lon, cA.loc.lon) / 2 + 180) - 180 };
  return chartAt(jd, loc);
}
export { jdOf, dateOf };
