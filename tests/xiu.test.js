import { describe, it, expect } from 'vitest';
import { dailyXiu, natalXiu, xiuRelation, XIU28_ZH, XIU27_ZH, XIU_REL } from '../src/lib/xiu.js';

describe('dailyXiu (值日二十八宿)', () => {
  // Anchors cross-checked against an independent library over 2,000 random
  // days with zero mismatches (see RELEASE_NOTES V21 Phase 3).
  it.each([
    [2026, 7, 6, '危'], [2026, 7, 7, '室'], [2026, 7, 13, '毕'],
    [2000, 1, 1, '胃'], [1992, 2, 23, '房'],
  ])('%i-%i-%i is %s宿', (y, m, d, xiu) => {
    expect(XIU28_ZH[dailyXiu(y, m, d)]).toBe(xiu);
  });
  it('classical weekday lock: every Sunday mansion ∈ {房虚昴星}', () => {
    for (let i = 0; i < 8; i++) {
      const dt = new Date(Date.UTC(2026, 0, 4 + i * 7)); // consecutive Sundays
      const x = XIU28_ZH[dailyXiu(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())];
      expect(['房', '虚', '昴', '星']).toContain(x);
    }
  });
});

describe('natalXiu (本命宿, 宿曜经 27 mansions)', () => {
  it('the 27 list is the 28 minus 牛宿', () => {
    expect(XIU27_ZH.length).toBe(27);
    expect(XIU27_ZH).not.toContain('牛');
  });
  it('month day-1 mansions per the Xiuyao-jing table: 正月=室, 八月=角, 十二月=虚', () => {
    expect(XIU27_ZH[natalXiu(1, 1)]).toBe('室');
    expect(XIU27_ZH[natalXiu(8, 1)]).toBe('角');
    expect(XIU27_ZH[natalXiu(12, 1)]).toBe('虚');
  });
  it('counts forward through the cycle: 正月二十 → 室+19 = 房', () => {
    expect(XIU27_ZH[natalXiu(1, 20)]).toBe('房');
  });
  it('wraps the 27 cycle', () => {
    expect(natalXiu(12, 28)).toBe((natalXiu(12, 1) + 27) % 27);
  });
});

describe('xiuRelation (三九秘法)', () => {
  it('distance 0 / 9 / 18 → 命 / 業 / 胎', () => {
    expect(xiuRelation(5, 5)).toBe('ming');
    expect(xiuRelation(0, 9)).toBe('ye');
    expect(xiuRelation(0, 18)).toBe('tai');
  });
  it('the nine-step sequence: +1 荣, +3 安, +8 亲, +10 (d%9=1) 荣 again', () => {
    expect(xiuRelation(0, 1)).toBe('rong');
    expect(xiuRelation(0, 3)).toBe('an');
    expect(xiuRelation(0, 8)).toBe('qin');
    expect(xiuRelation(0, 10)).toBe('rong');
  });
  it('is directional (A→B generally differs from B→A)', () => {
    expect(xiuRelation(0, 1)).toBe('rong');
    expect(xiuRelation(1, 0)).toBe('qin'); // 26 back → d=26, 26%9=8 → 亲
  });
  it('every relation key has zh/en labels and descriptions', () => {
    for (const k of ['ming', 'ye', 'tai', 'rong', 'shuai', 'an', 'wei', 'cheng', 'huai', 'you', 'qin']) {
      expect(XIU_REL[k].zh).toBeTruthy();
      expect(XIU_REL[k].descEn).toBeTruthy();
    }
  });
});

describe('Xiuyao-jing check (T1299, p.391b11)', () => {
  const at = (name) => XIU27_ZH.indexOf(name);
  it('二月五日 is 畢 (毕) — the scripture’s own worked example', () => {
    expect(XIU27_ZH[natalXiu(2, 5)]).toBe('毕');
  });

  it('month day-1 mansions under the 27-mansion method: 室 奎 胃 毕 参 鬼 张 角 氐 心 斗 虚', () => {
    expect(Array.from({ length: 12 }, (_, i) => XIU27_ZH[natalXiu(i + 1, 1)]).join('')).toBe('室奎胃毕参鬼张角氐心斗虚');
  });

  it('the same example’s three-nine roles from 畢: 觜 荣, 参 衰, 轸 业, 角 荣, 女 胎, 虚 荣', () => {
    const from = at('毕');
    expect(xiuRelation(from, from)).toBe('ming');
    expect(xiuRelation(from, at('觜'))).toBe('rong');
    expect(xiuRelation(from, at('参'))).toBe('shuai');
    expect(xiuRelation(from, at('轸'))).toBe('ye');
    expect(xiuRelation(from, at('角'))).toBe('rong');
    expect(xiuRelation(from, at('女'))).toBe('tai');
    expect(xiuRelation(from, at('虚'))).toBe('rong');
  });
});
