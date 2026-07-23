/* ============================================================
   BAZI SCHEMA (V25 Part 5, §23.1) — adapter between computeBazi()'s
   internal {stem,branch} pillar objects and the spec-§1.1 `birthPillars`
   JSON shape ({ year, month, day, hour } as ganzhi strings).

   Pure functions only, no new tables — everything here is a thin,
   hand-verified wrapper around bazi.js. `todayPillars()` is the single
   sanctioned entry point for "today's real ganzhi" (dayPillar() is the
   true JDN-based day cycle, zero RNG); horoscopeEngine.js's dailyFortune
   v2 (§23.2) and ziweiDeep.js's 流年 layer (§25.4) both call this instead
   of recomputing the day pillar themselves.
   ============================================================ */
import { pillarName, dayPillar, STEMS, BRANCHES } from './bazi.js';

const PILLAR_RE = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

// computeBazi() output -> spec-§1.1 birthPillars shape.
export function toBirthPillars(chart) {
  return {
    year: pillarName(chart.year),
    month: pillarName(chart.month),
    day: pillarName(chart.day),
    hour: chart.hour ? pillarName(chart.hour) : null,
  };
}

// Throws with a descriptive message on the first invalid field; returns
// true otherwise. year/month/day are required; hour may be null.
export function validateBirthPillars(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('birthPillars: expected an object');
  for (const key of ['year', 'month', 'day']) {
    const v = obj[key];
    if (typeof v !== 'string' || !PILLAR_RE.test(v)) throw new Error(`birthPillars.${key}: invalid ganzhi "${v}"`);
  }
  if (obj.hour != null && (typeof obj.hour !== 'string' || !PILLAR_RE.test(obj.hour))) {
    throw new Error(`birthPillars.hour: invalid ganzhi "${obj.hour}"`);
  }
  return true;
}

// Today's real day pillar (true sexagenary cycle, no RNG) for dateStr
// 'YYYY-MM-DD'. The single place "today's ganzhi" gets computed.
export function todayPillars(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const p = dayPillar(y, m, d);
  return { day: STEMS[p.stem] + BRANCHES[p.branch], stem: p.stem, branch: p.branch };
}
