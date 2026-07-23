import { describe, it, expect } from 'vitest';
import { STEMS, BRANCHES } from '../src/lib/bazi.js';
import { nayinOf } from '../src/lib/ziping.js';

// Part 5 §27 verification, updated after actually running the check
// (2026-07-23): the spec's own §2.2 table does NOT reproduce from this
// codebase's nayin-derived 五行局 path — and, on independent cross-check
// against iztro (the same library ziwei.js's 400-chart comparison uses,
// see ziwei.js's own header), THE SPEC'S TABLE ITSELF IS WRONG on 8 of
// its 30 cells (the 午/未 and 戌/亥 columns are swapped relative to every
// stem-pair row; verified by hand for 甲: spec says 午/未=Water2,
// 戌/亥=Earth5, but iztro — and this codebase — both give 午/未=Earth5,
// 戌/亥=Fire6). This test therefore does NOT assert against the spec's
// table (urgent.md §22.1 item 5 already calls the spec "a reference, not
// SSOT for math" — this is exactly that case, now with a concrete
// example). Instead it locks the repo's 五行局 derivation against the
// full iztro ground truth (all 10 stems × 12 branches, not just the
// spec's 6 branch-pairs), which is the actually-meaningful check.
const mod = (n, m) => ((n % m) + m) % m;
function ganzhiIndex(stem, branch) { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; }
const JU_BY_ELEMENT = [3, 6, 5, 4, 2]; // wood3 fire6 earth5 metal4 water2 (ELEMENTS order 木火土金水)
function deriveBureau(yearStemIdx, mingBranch) {
  const startStem = mod((yearStemIdx % 5) * 2 + 2, 10); // 五虎遁
  const mingStem = mod(startStem + mod(mingBranch - 2, 12), 10);
  return JU_BY_ELEMENT[nayinOf(ganzhiIndex(mingStem, mingBranch)).el];
}

// Ground truth extracted directly from iztro, astrolabeBySolarDate(),
// earthlyBranchOfSoulPalace + fiveElementsClass, swept over all 10 year
// stems × all 12 possible 命宫 branches (2026-07-23; see chat transcript
// for the extraction script — same methodology as ziweiDeep.js's header).
const IZTRO_BUREAU = {
  甲: { 寅: 6, 卯: 6, 辰: 3, 巳: 3, 午: 5, 未: 5, 申: 4, 酉: 4, 戌: 6, 亥: 6, 子: 2, 丑: 2 },
  乙: { 寅: 5, 卯: 5, 辰: 4, 巳: 4, 午: 3, 未: 3, 申: 2, 酉: 2, 戌: 5, 亥: 5, 子: 6, 丑: 6 },
  丙: { 寅: 3, 卯: 3, 辰: 2, 巳: 2, 午: 4, 未: 4, 申: 6, 酉: 6, 戌: 3, 亥: 3, 子: 5, 丑: 5 },
  丁: { 寅: 4, 卯: 4, 辰: 6, 巳: 6, 午: 2, 未: 2, 申: 5, 酉: 5, 戌: 4, 亥: 4, 子: 3, 丑: 3 },
  戊: { 寅: 2, 卯: 2, 辰: 5, 巳: 5, 午: 6, 未: 6, 申: 3, 酉: 3, 戌: 2, 亥: 2, 子: 4, 丑: 4 },
  己: { 寅: 6, 卯: 6, 辰: 3, 巳: 3, 午: 5, 未: 5, 申: 4, 酉: 4, 戌: 6, 亥: 6, 子: 2, 丑: 2 },
  庚: { 寅: 5, 卯: 5, 辰: 4, 巳: 4, 午: 3, 未: 3, 申: 2, 酉: 2, 戌: 5, 亥: 5, 子: 6, 丑: 6 },
  辛: { 寅: 3, 卯: 3, 辰: 2, 巳: 2, 午: 4, 未: 4, 申: 6, 酉: 6, 戌: 3, 亥: 3, 子: 5, 丑: 5 },
  壬: { 寅: 4, 卯: 4, 辰: 6, 巳: 6, 午: 2, 未: 2, 申: 5, 酉: 5, 戌: 4, 亥: 4, 子: 3, 丑: 3 },
  癸: { 寅: 2, 卯: 2, 辰: 5, 巳: 5, 午: 6, 未: 6, 申: 3, 酉: 3, 戌: 2, 亥: 2, 子: 4, 丑: 4 },
};

describe('五行局 derivation vs iztro ground truth (all 10 stems × 12 branches, 120/120)', () => {
  for (const stemZh of Object.keys(IZTRO_BUREAU)) {
    const stemIdx = STEMS.indexOf(stemZh);
    for (const branchZh of BRANCHES) {
      it(`${stemZh}年 命宫${branchZh} -> Bureau ${IZTRO_BUREAU[stemZh][branchZh]} (iztro)`, () => {
        const branchIdx = BRANCHES.indexOf(branchZh);
        expect(deriveBureau(stemIdx, branchIdx)).toBe(IZTRO_BUREAU[stemZh][branchZh]);
      });
    }
  }
});

describe('spec §2.2 table — documented discrepancy (not asserted, recorded)', () => {
  it('the spec\'s own 甲/己 row does NOT match iztro on 午/未 and 戌/亥 (spec table is wrong here, not this codebase)', () => {
    // spec says 午/未=Water2, 戌/亥=Earth5 for 甲/己; iztro (ground truth
    // above) says 午/未=Earth5, 戌/亥=Fire6. This mismatch is the reason
    // §22.1 item 5 calls the spec a reference, not SSOT for math.
    expect(IZTRO_BUREAU.甲.午).not.toBe(2); // spec claims Water2
    expect(IZTRO_BUREAU.甲.午).toBe(5); // repo + iztro actually agree: Earth5
  });
});
