/* ============================================================
   DAYUN (大运流年) — V21 Phase 2. Pure calendar math on top of bazi.js.

   Rules implemented (mainstream convention):
   - Direction: 阳年生男 / 阴年生女 → 顺排 (forward through the 60 cycle
     from the month pillar); 阴年生男 / 阳年生女 → 逆排. The year pillar's
     stem parity decides yang/yin (甲丙戊庚壬 even index = yang).
   - 起运 age: distance from the birth instant to the NEXT 节 (forward) or
     the PREVIOUS 节 (backward), converted at 3 days = 1 year (so 1 day =
     4 months). Real solar-term instants come from bazi.js's astronomy.
   - Each 大运 lasts 10 years; the first starts at the 起运 age.
   - 流年: the display convention maps calendar year N to the (N-4) mod 60
     ganzhi (the strict 立春 boundary matters for charts, not for labelling
     a decade strip; bazi.js handles the strict boundary where it counts).
   - 犯太岁: the liunian branch vs the natal YEAR branch — 值 (same), 冲
     (six-clash), 刑 (punishment, either direction), 害 (six-harm), 破
     (six-break). 破's pair table lives here (ziping.js doesn't track 破).

   Gender is 'M' | 'F'. No reference-screenshot cross-check was available
   for the 起运/sequence outputs (unlike V20.8's tables) — tests instead
   pin the rule-level invariants (direction flips, sequence stepping,
   3-days-per-year conversion against hand-checked solar-term gaps).
   ============================================================ */
import { STEMS, BRANCHES, adjacentSolarTerms, computeBazi } from './bazi.js';
import { branchRelations } from './ziping.js';

const mod = (n, m) => ((n % m) + m) % m;
const ganzhiIndex = (stem, branch) => { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; };

// 六破 pairs (子酉 卯午 辰丑 未戌 寅亥 巳申) — only used for 破太岁.
const LIUPO = [[0, 9], [3, 6], [4, 1], [7, 10], [2, 11], [5, 8]];
const LIUCHONG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
const LIUHAI = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const XING_PAIRS = [[2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1], [0, 3], [3, 0]];
const hasPair = (table, a, b) => table.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function dayunDirection(yearStemIdx, gender) {
  const yangYear = yearStemIdx % 2 === 0;
  return ((gender === 'M') === yangYear) ? 1 : -1;
}

// Full luck-cycle computation. birth = CST-normalized {y,m,d,hour}.
// Returns null when gender is missing (direction is undefined without it).
export function computeDayun(birth, gender, count = 8) {
  if (gender !== 'M' && gender !== 'F') return null;
  const chart = computeBazi(birth);
  const dir = dayunDirection(chart.year.stem, gender);
  const { birthJD, prevJD, nextJD } = adjacentSolarTerms(birth.y, birth.m, birth.d, birth.hour);
  const gapDays = dir === 1 ? nextJD - birthJD : birthJD - prevJD;
  const ageYearsFloat = gapDays / 3; // 3 days = 1 year
  const years = Math.floor(ageYearsFloat);
  const months = Math.floor((ageYearsFloat - years) * 12);
  // calendar year in which the first 大运 begins (month-precision rollover)
  const startYear = birth.y + years + (birth.m + months > 12 ? 1 : 0);

  const mpIdx = ganzhiIndex(chart.month.stem, chart.month.branch);
  const pillars = [];
  for (let i = 0; i < count; i++) {
    const idx = mod(mpIdx + dir * (i + 1), 60);
    pillars.push({
      stem: idx % 10, branch: idx % 12,
      gz: STEMS[idx % 10] + BRANCHES[idx % 12],
      fromAge: years + 10 * i, toAge: years + 10 * i + 9,
      fromYear: startYear + 10 * i, toYear: startYear + 10 * i + 9,
    });
  }
  return { direction: dir, startAge: { years, months }, startYear, pillars, chart };
}

// 流年 ganzhi for a calendar year (display convention, see header).
export function liunianPillar(year) {
  return { stem: mod(year - 4, 10), branch: mod(year - 4, 12), gz: STEMS[mod(year - 4, 10)] + BRANCHES[mod(year - 4, 12)] };
}

// 犯太岁 check: liunian branch vs natal year branch. Returns matched kinds
// in display order (possibly empty). A branch can match several (e.g. 值+刑
// for the self-punishing branches).
export const TAISUI_ZH = { zhi: '值太岁', chong: '冲太岁', xing: '刑太岁', hai: '害太岁', po: '破太岁' };
export const TAISUI_EN = { zhi: 'Year Lord return', chong: 'Year Lord clash', xing: 'Year Lord punishment', hai: 'Year Lord harm', po: 'Year Lord break' };
export function taisuiRelation(liunianBranch, natalYearBranch) {
  const out = [];
  if (liunianBranch === natalYearBranch) out.push('zhi');
  if (hasPair(LIUCHONG, liunianBranch, natalYearBranch)) out.push('chong');
  if (hasPair(XING_PAIRS, liunianBranch, natalYearBranch)) out.push('xing');
  if (hasPair(LIUHAI, liunianBranch, natalYearBranch)) out.push('hai');
  if (hasPair(LIUPO, liunianBranch, natalYearBranch)) out.push('po');
  return out;
}

// Pairwise relations between one incoming branch (大运/流年) and each natal
// branch — reuses ziping.js's verified pair tables via branchRelations on
// the two-element set (equal branches have no pair relation to report;
// 值太岁 is handled by taisuiRelation above).
export function pairRelations(branch, natalBranches) {
  const out = [];
  for (const nb of new Set(natalBranches)) {
    if (nb === branch) continue;
    for (const r of branchRelations([branch, nb])) out.push(r.text);
  }
  return [...new Set(out)];
}
