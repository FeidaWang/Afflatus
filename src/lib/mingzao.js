/* ============================================================
   MINGZAO RANK (U5, Urgent.md) — a 0-100 "chart quality" composite over
   four classical judging axes, plus a population percentile against a
   precomputed uniform-sample distribution (mingzaoDist.js).

   The four axes follow the traditional rubric the site owner specified
   (中和流通 / 格局高低 / 用神有力 / 岁运配合), but every scoring weight
   here is an ORIGINAL, entertainment-oriented simplification — classical
   texts rank charts qualitatively, not on a 0-100 scale. The page says so.

   Pure functions, no DOM, vitest-covered. Only static imports from
   ziping.js/bazi.js (no ephemeris, no fetch).
   ============================================================ */
import { STEM_ELEMENT, BRANCH_ELEMENT } from './bazi.js';
import { HIDDEN_STEMS, seasonalStrength, ziPingAnalysis, branchRelations, stemRelations, tenGodOfStem } from './ziping.js';

const mod = (n, m) => ((n % m) + m) % m;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** Weighted five-element tally: stems 1.0; hidden stems 1.0/0.5/0.3. */
export function elementTally(pillars) {
  const tally = [0, 0, 0, 0, 0];
  const HIDDEN_W = [1, 0.5, 0.3];
  for (const p of pillars) {
    tally[STEM_ELEMENT[p.stem]] += 1;
    HIDDEN_STEMS[p.branch].forEach((hs, k) => { tally[STEM_ELEMENT[hs]] += HIDDEN_W[k] || 0.3; });
  }
  return tally;
}

/** Longest unbroken 相生 chain among elements present in the tally (1..5). */
export function flowChainLength(tally) {
  const present = tally.map((t) => t > 0);
  let best = present.some(Boolean) ? 1 : 0;
  for (let start = 0; start < 5; start++) {
    if (!present[start]) continue;
    let len = 1;
    for (let step = 1; step < 5; step++) {
      if (present[mod(start + step, 5)]) len++; else break;
    }
    best = Math.max(best, len);
  }
  return best;
}

// -- axis 1: 中和流通 — element evenness + generation flow − clash/harm/punishment friction
function scoreZhonghe(pillars) {
  const tally = elementTally(pillars);
  const total = tally.reduce((a, b) => a + b, 0) || 1;
  const dev = tally.reduce((a, t) => a + Math.abs(t / total - 0.2), 0); // 0 (even) .. 1.6 (one element only)
  const balance = (1 - dev / 1.6) * 100;
  const flow = (flowChainLength(tally) / 5) * 100;
  const rel = branchRelations(pillars.map((p) => p.branch));
  const friction = Math.min(30, rel.filter((r) => r.type === 'chong' || r.type === 'xing' || r.type === 'hai').length * 8);
  return { value: clamp(0.55 * balance + 0.45 * flow - friction), balance: Math.round(balance), flow: Math.round(flow), friction };
}

// -- axis 2: 格局高低 — simplified pattern base + 透干 bonus + 伤官见官 break
// Base scores loosely follow the classical 贵格/败格 hierarchy (正官/正印/
// 食神/财格 high; 伤官/劫财 low); numbers are original simplifications.
const PATTERN_BASE = { '-1': 60, 0: 52, 1: 46, 2: 66, 3: 48, 4: 60, 5: 62, 6: 50, 7: 70, 8: 56, 9: 68 };
function scoreGeju(pillars) {
  const dayStem = pillars[2].stem;
  const monthMainQi = HIDDEN_STEMS[pillars[1].branch][0];
  const patternGod = monthMainQi === dayStem ? -1 : tenGodOfStem(dayStem, monthMainQi);
  let v = PATTERN_BASE[String(patternGod)] ?? 55;
  const otherStems = pillars.filter((_, i) => i !== 2).map((p) => p.stem);
  // 透干: the month's primary qi element also appears among the visible stems
  const touGan = otherStems.some((s) => STEM_ELEMENT[s] === STEM_ELEMENT[monthMainQi]);
  if (touGan) v += 8;
  // 伤官见官 (classic pattern break): both 伤官(3) and 正官(7) visible among stems
  const gods = otherStems.map((s) => (s === dayStem ? 0 : tenGodOfStem(dayStem, s)));
  const shangGuanJianGuan = gods.includes(3) && gods.includes(7);
  if (shangGuanJianGuan) v -= 14;
  // stem clash friction (天干相冲) mildly damages the frame
  v -= Math.min(8, stemRelations(pillars.map((p) => p.stem)).filter((r) => r.type === 'clash').length * 4);
  return { value: clamp(v), patternGod, touGan, shangGuanJianGuan };
}

// -- axis 3: 用神有力 — favorable elements' weighted share + their seasonal stage
function scoreYongshen(pillars) {
  const za = ziPingAnalysis(pillars);
  const tally = elementTally(pillars);
  const total = tally.reduce((a, b) => a + b, 0) || 1;
  const favEls = za.favorable.map((f) => f.el);
  const share = favEls.reduce((a, el) => a + tally[el], 0) / total;
  let v = Math.min(100, share * 220);
  const stage = seasonalStrength(pillars[1].branch);
  const primaryStage = stage[favEls[0]]; // 0旺 1相 2休 3囚 4死
  v += [10, 5, 0, -5, -10][primaryStage] || 0;
  return { value: clamp(v), share, primaryStage, favorable: za.favorable, strength: za.strength };
}

// -- axis 4: 岁运配合 — current luck pillar's elements vs the favorable set.
// Needs a current dayun pillar (gender + birth data resolved by the caller);
// returns null when unavailable so the composite can renormalize honestly.
function scoreSuiyun(pillars, currentDayunPillar) {
  if (!currentDayunPillar) return null;
  const za = ziPingAnalysis(pillars);
  const fav = new Set(za.favorable.map((f) => f.el));
  const unf = new Set(za.unfavorable.map((f) => f.el));
  let v = 50;
  for (const el of [STEM_ELEMENT[currentDayunPillar.stem], BRANCH_ELEMENT[currentDayunPillar.branch]]) {
    if (fav.has(el)) v += 22; else if (unf.has(el)) v -= 16;
  }
  return { value: clamp(v) };
}

/**
 * The composite. `currentDayunPillar` is optional ({stem, branch} of the
 * luck pillar covering the current year) — pass null when gender/hour is
 * unknown and the 岁运 axis will be excluded with the weights renormalized.
 *
 * `core` (中和40% + 格局30% + 用神30%) is the percentile-comparable number:
 * the precomputed distribution is built WITHOUT the 岁运 axis (it depends
 * on gender + the sampling date), so percentiles always compare cores.
 */
export function mingzaoRank(pillars, currentDayunPillar = null) {
  const zhonghe = scoreZhonghe(pillars);
  const geju = scoreGeju(pillars);
  const yongshen = scoreYongshen(pillars);
  const suiyun = scoreSuiyun(pillars, currentDayunPillar);
  const core = clamp(0.4 * zhonghe.value + 0.3 * geju.value + 0.3 * yongshen.value);
  const total = suiyun == null ? core : clamp(0.8 * core + 0.2 * suiyun.value);
  return { zhonghe, geju, yongshen, suiyun, core, total };
}

/**
 * Percentile of a core score against a cumulative histogram (counts per
 * integer score 0..100, as generated by scripts/gen-mingzao-dist.mjs).
 * Midrank convention: everyone strictly below + half of the equal bucket.
 */
export function percentileOf(core, hist) {
  const idx = Math.max(0, Math.min(100, Math.round(core)));
  let below = 0, total = 0;
  for (let i = 0; i <= 100; i++) { total += hist[i] || 0; if (i < idx) below += hist[i] || 0; }
  if (!total) return null;
  const eq = hist[idx] || 0;
  return Math.round(((below + eq / 2) / total) * 1000) / 10; // one decimal
}
