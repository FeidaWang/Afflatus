import { describe, it, expect } from 'vitest';
import { crossBranchMatrix } from '../src/lib/synastryBazi.js';

// Minimal pillar fixtures ({stem,branch} per pillar, year/month/day/hour) —
// same shape as computeBazi() output. Only branch indices matter for this
// module's math; stems are arbitrary filler.
const A = { year: { stem: 0, branch: 0 }, month: { stem: 1, branch: 1 }, day: { stem: 2, branch: 0 }, hour: { stem: 3, branch: 2 } }; // day branch 子(0)
const B = { year: { stem: 4, branch: 6 }, month: { stem: 5, branch: 7 }, day: { stem: 6, branch: 6 }, hour: { stem: 7, branch: 8 } }; // day branch 午(6)

describe('crossBranchMatrix — symmetry', () => {
  it('score(A,B) === score(B,A)', () => {
    expect(crossBranchMatrix(A, B).score).toBe(crossBranchMatrix(B, A).score);
  });
  it('cell (i,j) in A×B mirrors cell (j,i) in B×A', () => {
    const mAB = crossBranchMatrix(A, B), mBA = crossBranchMatrix(B, A);
    for (const cell of mAB.cells) {
      const mirror = mBA.cells.find((c) => c.pa === cell.pb && c.pb === cell.pa);
      expect(mirror).toBeTruthy();
      expect([...mirror.relations].sort()).toEqual([...cell.relations].sort());
      expect(mirror.w).toBe(cell.w);
    }
  });
});

describe('crossBranchMatrix — hand-verified 子午冲 (day×day)', () => {
  it('flags a day/day clash', () => {
    const m = crossBranchMatrix(A, B);
    const dayClash = m.clashes.find((c) => c.pa === 'day' && c.pb === 'day');
    expect(dayClash).toBeTruthy();
    expect(dayClash.type).toBe('chong');
    expect(dayClash.w).toBe(1.0); // day×day is the heaviest pair
  });
  it('a chart with a strong day×day clash and nothing else scores below 50', () => {
    const onlyDayClash = { year: { stem: 0, branch: 4 }, month: { stem: 1, branch: 5 }, day: { stem: 2, branch: 0 }, hour: { stem: 3, branch: 7 } };
    const otherOnlyDayClash = { year: { stem: 4, branch: 9 }, month: { stem: 5, branch: 10 }, day: { stem: 6, branch: 6 }, hour: { stem: 7, branch: 3 } };
    expect(crossBranchMatrix(onlyDayClash, otherOnlyDayClash).score).toBeLessThan(50);
  });
});

describe('crossBranchMatrix — missing hour (3×4 / 3×3, renormalized)', () => {
  const A3 = { year: A.year, month: A.month, day: A.day, hour: null };
  const B3 = { year: B.year, month: B.month, day: B.day, hour: null };
  it('produces a 3×4 matrix when only one side is missing hour', () => {
    const m = crossBranchMatrix(A3, B);
    expect(m.idsA).toEqual(['year', 'month', 'day']);
    expect(m.idsB).toEqual(['year', 'month', 'day', 'hour']);
    expect(m.cells).toHaveLength(12);
  });
  it('produces a 3×3 matrix when both sides are missing hour, still finds the day clash', () => {
    const m = crossBranchMatrix(A3, B3);
    expect(m.cells).toHaveLength(9);
    expect(m.clashes.some((c) => c.pa === 'day' && c.pb === 'day' && c.type === 'chong')).toBe(true);
  });
  it('stays within 0..100 bounds regardless of completeness', () => {
    for (const m of [crossBranchMatrix(A, B), crossBranchMatrix(A3, B), crossBranchMatrix(A3, B3)]) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('crossBranchMatrix — harmony scores higher than clash', () => {
  it('六合 day×day scores higher than 六冲 day×day (all else equal)', () => {
    const heB = { year: B.year, month: B.month, day: { stem: 6, branch: 1 }, hour: B.hour }; // 丑(1), 子丑合 with A's day 子(0)
    const he = crossBranchMatrix(A, heB).score;
    const chong = crossBranchMatrix(A, B).score;
    expect(he).toBeGreaterThan(chong);
  });
});
