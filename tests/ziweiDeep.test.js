import { describe, it, expect } from 'vitest';
import { computeZiwei, ZW_STARS_ZH } from '../src/lib/ziwei.js';
import { BRANCHES } from '../src/lib/bazi.js';
import { dayunDirection } from '../src/lib/dayun.js';
import {
  computeZiweiDeep, daXianAges, toChartMatrix, SIHUA_BY_STEM,
  sanFangSiZheng, partnershipRead, liunianZiweiPalace, flowingYearScan,
} from '../src/lib/ziweiDeep.js';

// Same anchor chart as tests/ziwei.test.js (cross-checked against iztro
// there): 1992-02-23, 午时 (hour 12), male → 命宫戊申, 土五局, 紫微在巳.
// Every placement below was independently cross-checked against iztro for
// this exact birth (see ziweiDeep.js module header for the 150-random-
// birth verification methodology).
const z = computeZiwei({ y: 1992, m: 2, d: 23, hour: 12 });

describe('SIHUA_BY_STEM (四化) — anchor chart, 壬年', () => {
  it('壬: 天梁禄, 紫微权, 左辅科, 武曲忌 (iztro-verified)', () => {
    expect(SIHUA_BY_STEM.壬).toEqual({ lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' });
  });
  it('all 10 stems have a complete 4-star row', () => {
    for (const stem of Object.keys(SIHUA_BY_STEM)) {
      const row = SIHUA_BY_STEM[stem];
      for (const k of ['lu', 'quan', 'ke', 'ji']) expect(typeof row[k]).toBe('string');
    }
  });
});

describe('computeZiweiDeep — auxiliary/sha star placements (vs iztro)', () => {
  const deep = computeZiweiDeep(z, 'M');
  const findStar = (name) => deep.palaces.find((p) => p.stars.some((s) => s.name === name));
  it('禄存在亥, 擎羊在子, 陀罗在戌 (禄存前后两位)', () => {
    expect(BRANCHES[findStar('禄存').branch]).toBe('亥');
    expect(BRANCHES[findStar('擎羊').branch]).toBe('子');
    expect(BRANCHES[findStar('陀罗').branch]).toBe('戌');
  });
  it('天马在寅 (申子辰年支组)', () => {
    expect(BRANCHES[findStar('天马').branch]).toBe('寅');
  });
  it('左辅/文昌/铃星都在辰; 右弼/文曲/陀罗都在戌', () => {
    expect(BRANCHES[findStar('左辅').branch]).toBe('辰');
    expect(BRANCHES[findStar('文昌').branch]).toBe('辰');
    expect(BRANCHES[findStar('铃星').branch]).toBe('辰');
    expect(BRANCHES[findStar('右弼').branch]).toBe('戌');
    expect(BRANCHES[findStar('文曲').branch]).toBe('戌');
  });
  it('地空/地劫都在巳; 火星在申 (命宫)', () => {
    expect(BRANCHES[findStar('地空').branch]).toBe('巳');
    expect(BRANCHES[findStar('地劫').branch]).toBe('巳');
    expect(BRANCHES[findStar('火星').branch]).toBe('申');
  });
  it('every major star carries a brightness + wuXing + transformation field', () => {
    for (const p of deep.palaces) {
      for (const s of p.stars.filter((s2) => s2.level === 'Major')) {
        expect(s.brightness).toBeTruthy();
        expect(['Wood', 'Fire', 'Earth', 'Metal', 'Water']).toContain(s.wuXing);
        expect(['None', '化禄', '化权', '化科', '化忌']).toContain(s.transformation);
      }
    }
  });
  it('壬年 四化 lands on the right stars: 天梁化禄, 紫微化权, 左辅化科, 武曲化忌', () => {
    const flat = deep.palaces.flatMap((p) => p.stars);
    const byName = (n) => flat.find((s) => s.name === n);
    expect(byName('天梁').transformation).toBe('化禄');
    expect(byName('紫微').transformation).toBe('化权');
    expect(byName('左辅').transformation).toBe('化科');
    expect(byName('武曲').transformation).toBe('化忌');
  });
});

describe('daXianAges (大限)', () => {
  it('direction agrees with dayun.dayunDirection() for 20 random births', () => {
    for (let i = 0; i < 20; i++) {
      const y = 1950 + Math.floor(Math.random() * 100);
      const hour = Math.floor(Math.random() * 24);
      const zz = computeZiwei({ y, m: 1 + Math.floor(Math.random() * 12), d: 1 + Math.floor(Math.random() * 27), hour });
      if (!zz) continue;
      const gender = Math.random() < 0.5 ? 'M' : 'F';
      const dx = daXianAges(zz, gender);
      expect(dx.direction).toBe(dayunDirection(zz.yearStem, gender));
    }
  });
  it('tiles all 12 palace branches exactly once, each spanning 10 years', () => {
    const dx = daXianAges(z, 'M');
    const branches = Object.keys(dx.ages).map(Number);
    expect(new Set(branches).size).toBe(12);
    for (const b of branches) {
      const { startAge, endAge } = dx.ages[b];
      expect(endAge - startAge).toBe(9);
    }
  });
  it('first decade starts at the Bureau number (土五局 -> age 5)', () => {
    const dx = daXianAges(z, 'M');
    expect(dx.ages[z.ming].startAge).toBe(5);
  });
});

describe('toChartMatrix — spec §1.2 shape', () => {
  const deep = computeZiweiDeep(z, 'M');
  const matrix = toChartMatrix(z, deep, 'test-client-id');
  it('has the required top-level fields', () => {
    expect(matrix.clientId).toBe('test-client-id');
    expect(matrix.fiveElementsBureau).toBe('Earth 5');
    expect(matrix.palaces).toHaveLength(12);
  });
  it('every palace has the required fields and spec-shaped palaceName (with 宫 suffix, 交友宫 not 仆役)', () => {
    const names = matrix.palaces.map((p) => p.palaceName);
    expect(names).toContain('交友宫');
    expect(names).not.toContain('仆役');
    for (const p of matrix.palaces) {
      expect(p.palaceName.endsWith('宫')).toBe(true);
      expect(typeof p.earthlyBranchIndex).toBe('number');
      expect(BRANCHES[p.earthlyBranchIndex]).toBe(p.earthlyBranchName);
      expect(typeof p.isSelfPalace).toBe('boolean');
      for (const s of p.stars) {
        expect(s.name).toBeTruthy();
        expect(['Major', 'Auxiliary', 'Lucky', 'Sha']).toContain(s.level);
        expect(s.wuXing).toBeTruthy();
      }
    }
  });
  it('exactly one palace is flagged isSelfPalace (身宫)', () => {
    expect(matrix.palaces.filter((p) => p.isSelfPalace)).toHaveLength(1);
  });
});

describe('sanFangSiZheng (三方四正, spec §3.1 exact weights)', () => {
  const deep = computeZiweiDeep(z, 'M');
  it('opposite/trine indices are correct for every target', () => {
    for (let i = 0; i < 12; i++) {
      const s = sanFangSiZheng(deep.palaces, i);
      expect(s.opposing).toBe((i + 6) % 12);
      expect(s.trine1).toBe((i + 4) % 12);
      expect(s.trine2).toBe((i + 8) % 12);
    }
  });
  it('化忌 in the OPPOSING palace scores double + sets huaJiActive (spec\'s 2x rule)', () => {
    const synthetic = Array.from({ length: 12 }, (_, b) => ({ branch: b, name: 'p' + b, stars: [] }));
    synthetic[6].stars = [{ name: 'X', level: 'Major', transformation: '化忌' }]; // opposing of target 0
    const s = sanFangSiZheng(synthetic, 0);
    expect(s.huaJiActive).toBe(true);
    expect(s.clashingStars).toBe(10); // 5.0 base + 5.0 opposing bonus
  });
  it('化忌 NOT in the opposing palace only counts once (5.0, no bonus, no huaJiActive)', () => {
    const synthetic = Array.from({ length: 12 }, (_, b) => ({ branch: b, name: 'p' + b, stars: [] }));
    synthetic[4].stars = [{ name: 'X', level: 'Major', transformation: '化忌' }]; // trine1 of target 0, not opposing
    const s = sanFangSiZheng(synthetic, 0);
    expect(s.huaJiActive).toBe(false);
    expect(s.clashingStars).toBe(5);
  });
  it('overlaySihua layers an annual transformation on top of the natal one', () => {
    const synthetic = Array.from({ length: 12 }, (_, b) => ({ branch: b, name: 'p' + b, stars: [] }));
    synthetic[0].stars = [{ name: '天梁', level: 'Major', transformation: 'None' }];
    const withOverlay = sanFangSiZheng(synthetic, 0, { 天梁: 'lu' });
    const without = sanFangSiZheng(synthetic, 0);
    expect(withOverlay.favorableStars).toBe(without.favorableStars + 4.0);
  });
});

describe('partnershipRead (兄弟宫, spec §3.2 exact condition)', () => {
  it('permitted=true when 兄弟宫 has neither 化忌 nor 七杀+Sha', () => {
    const palaces = [{ name: '兄弟', branch: 7, stars: [{ name: '天同', level: 'Major', transformation: 'None' }] }];
    expect(partnershipRead(palaces).permitted).toBe(true);
  });
  it('permitted=false when 兄弟宫 holds 化忌', () => {
    const palaces = [{ name: '兄弟', branch: 7, stars: [{ name: '太阴', level: 'Major', transformation: '化忌' }] }];
    const r = partnershipRead(palaces);
    expect(r.permitted).toBe(false);
    expect(r.hasHuaJi).toBe(true);
  });
  it('permitted=false when 兄弟宫 holds 七杀 + a Sha star', () => {
    const palaces = [{ name: '兄弟', branch: 7, stars: [{ name: '七杀', level: 'Major', transformation: 'None' }, { name: '擎羊', level: 'Sha', transformation: 'None' }] }];
    const r = partnershipRead(palaces);
    expect(r.permitted).toBe(false);
    expect(r.qishaWithSha).toBe(true);
  });
  it('七杀 WITHOUT a Sha star does not trip the rule', () => {
    const palaces = [{ name: '兄弟', branch: 7, stars: [{ name: '七杀', level: 'Major', transformation: 'None' }] }];
    expect(partnershipRead(palaces).permitted).toBe(true);
  });
});

describe('liunianZiweiPalace (流年)', () => {
  const deep = computeZiweiDeep(z, 'M');
  it('picks the palace whose branch equals the liunian branch', () => {
    const ly = liunianZiweiPalace(deep, 2026);
    expect(deep.palaces[ly.branch].branch).toBe(ly.branch);
  });
  it('carries that year\'s own 四化 (not the natal chart\'s)', () => {
    const ly2026 = liunianZiweiPalace(deep, 2026); // 丙午 year -> 丙 stem
    expect(ly2026.sihua).toEqual(SIHUA_BY_STEM.丙);
  });
});

describe('flowingYearScan (流年倒推, spec §3.4, capped at 10y)', () => {
  const deep = computeZiweiDeep(z, 'M');
  it('returns STANDARD when nothing catastrophic is ahead', () => {
    // sweep several ages; at least one should NOT trigger (STANDARD is the
    // common case — the deceptive-bait pattern requires a rare confluence)
    const results = Array.from({ length: 10 }, (_, i) => flowingYearScan(deep, 20 + i, 1992));
    expect(results.some((r) => r.tacticalActionRequired === 'STANDARD')).toBe(true);
  });
  it('every result has the spec-shaped fields', () => {
    const r = flowingYearScan(deep, 25, 1992);
    expect(['DEFENSIVE', 'STANDARD']).toContain(r.tacticalActionRequired);
    expect(typeof r.deceptiveBaitTriggered).toBe('boolean');
    if (r.deceptiveBaitTriggered) {
      expect(r.aggressiveStanceScore).toBe(25);
      expect(r.defensiveStanceScore).toBe(90);
    }
  });
  it('look-ahead years beyond 10 are ignored (capped)', () => {
    // a look-ahead request of only [15] (beyond the cap) must never be
    // able to trigger the bait, regardless of that far-future score
    const r = flowingYearScan(deep, 25, 1992, [15]);
    expect(r.deceptiveBaitTriggered).toBe(false);
    expect(r.tacticalActionRequired).toBe('STANDARD');
  });
});
