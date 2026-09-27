import { describe, it, expect } from 'vitest';
import { computeBazi } from '../src/lib/bazi.js';
import { strength, geju, yongshen, proTable, hehun, computeShenshaExtra, tiaohou, branchPairType } from '../src/lib/baziPro.js';

const C = (y, m, d, hour) => computeBazi({ y, m, d, hour });

describe('格局 (子平真诠)', () => {
  it('透干取格 / 本气 / 建禄', () => {
    expect(geju(C(1990, 6, 15, 14)).main.zh).toBe('七杀格');      // 辛 born 午, 丁 not visible → 本气
    expect(geju(C(1988, 3, 20, 23)).main.zh).toBe('建禄格');      // 乙 born 卯
  });
});

describe('strength & 用神', () => {
  it('weights sum to 1 and label follows the ratio', () => {
    const s = strength(C(1990, 6, 15, 14));
    expect(s.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(s.key).toBe('weak');
  });
  it('weak chart under heavy Officer uses Seal', () => {
    const y = yongshen(C(1990, 6, 15, 14));
    expect(y.yong.zh).toBe('土');
    expect(y.ji.zh).toBe('火');
    expect(new Set([y.yong.el, y.xi.el, y.ji.el, y.chou.el, ...y.xian.map((x) => x.el)]).size).toBe(5);
  });
  it('调候 table row lookup (甲 born 寅 → 丙癸)', () => {
    const c = C(1984, 2, 20, 12); // 甲子年 丙寅月
    const t = tiaohou({ ...c, day: { stem: 0, branch: 0 }, month: { stem: 2, branch: 2 } });
    expect(t).toEqual([2, 9]);
  });
});

describe('extra 神煞', () => {
  it('红鸾 from year branch, 阴差阳错 on the day pillar', () => {
    const c = C(1990, 6, 15, 14); // 庚午 year → 红鸾 酉
    const tags = computeShenshaExtra({ ...c, hour: { stem: 7, branch: 9 } }, 'M');
    expect(tags[3]).toContain('红鸾');
    const c2 = { year: { stem: 0, branch: 0 }, month: { stem: 2, branch: 2 }, day: { stem: 2, branch: 0 }, hour: null };
    expect(computeShenshaExtra(c2, 'M')[2]).toContain('阴差阳错');
  });
  it('pro table has four columns with 主星 on stems', () => {
    const t = proTable(C(1990, 6, 15, 14), 'M');
    expect(t.map((r) => r.main.zh)).toEqual(['劫财', '伤官', '元男', '偏财']);
  });
});

describe('合婚', () => {
  it('branch pair types', () => {
    expect(branchPairType(0, 1)).toBe('liuhe');
    expect(branchPairType(0, 6)).toBe('chong');
    expect(branchPairType(8, 4)).toBe('sanhe');
  });
  it('score is bounded and itemised', () => {
    const h = hehun(C(1990, 6, 15, 14), C(1992, 3, 3, 9), 'M', 'F');
    expect(h.score).toBeGreaterThanOrEqual(10); expect(h.score).toBeLessThanOrEqual(95);
    expect(h.items.map((i) => i.w).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
