import { describe, it, expect } from 'vitest';
import { computeBazi } from '../src/lib/bazi.js';
import {
  tenGodOfStem, HIDDEN_STEMS, nayinOf, kongWangOf, twelveStage, STAGE_ZH,
  seasonalStrength, SEASON_STAGE_ZH, stemRelations, branchRelations,
  computeShensha, ziPingAnalysis,
} from '../src/lib/ziping.js';

// Real reference chart from a professional paishan app (测测), for a
// 1992-02-23 23:26 birth: 壬申/壬寅/庚午/丙子. Every table in ziping.js was
// checked against this app's displayed 藏干/支神/纳音/空亡/地势/自坐/神煞/
// 刑冲合害/旺相休囚死 output for this exact chart before being written down.
const chart = computeBazi({ y: 1992, m: 2, d: 23, hour: 23 });
const pillars = [chart.year, chart.month, chart.day, chart.hour];

describe('nayinOf (纳音) — vs published reference chart', () => {
  it('all four pillars match', () => {
    expect(nayinOf(8).zh).toBe('剑锋金');   // 壬申
    expect(nayinOf(38).zh).toBe('金箔金');  // 壬寅
    expect(nayinOf(6).zh).toBe('路旁土');   // 庚午
    expect(nayinOf(12).zh).toBe('涧下水');  // 丙子
  });
});

describe('kongWangOf (空亡) — vs published reference chart', () => {
  it('all four pillars match (each pillar\'s own 旬)', () => {
    expect(kongWangOf(8)).toEqual([10, 11]);  // 年柱 -> 戌亥
    expect(kongWangOf(38)).toEqual([4, 5]);   // 月柱 -> 辰巳
    expect(kongWangOf(6)).toEqual([10, 11]);  // 日柱 -> 戌亥
    expect(kongWangOf(12)).toEqual([8, 9]);   // 时柱 -> 申酉
  });
});

describe('twelveStage (十二长生: 地势/自坐) — vs published reference chart', () => {
  const dayStem = pillars[2].stem; // 庚
  it('地势 (day stem\'s stage at each pillar\'s own branch)', () => {
    expect(STAGE_ZH[twelveStage(dayStem, pillars[0].branch)]).toBe('临官'); // 申
    expect(STAGE_ZH[twelveStage(dayStem, pillars[1].branch)]).toBe('绝');   // 寅
    expect(STAGE_ZH[twelveStage(dayStem, pillars[2].branch)]).toBe('沐浴'); // 午
    expect(STAGE_ZH[twelveStage(dayStem, pillars[3].branch)]).toBe('死');   // 子
  });
  it('自坐 (each pillar\'s own stem at its own branch)', () => {
    expect(STAGE_ZH[twelveStage(pillars[0].stem, pillars[0].branch)]).toBe('长生'); // 壬申
    expect(STAGE_ZH[twelveStage(pillars[1].stem, pillars[1].branch)]).toBe('病');   // 壬寅
    expect(STAGE_ZH[twelveStage(pillars[2].stem, pillars[2].branch)]).toBe('沐浴'); // 庚午
    expect(STAGE_ZH[twelveStage(pillars[3].stem, pillars[3].branch)]).toBe('胎');   // 丙子
  });
});

describe('seasonalStrength (旺相休囚死) — vs published reference chart', () => {
  it('寅 month (wood): 木旺 火相 水休 金囚 土死', () => {
    const s = seasonalStrength(pillars[1].branch);
    expect(SEASON_STAGE_ZH[s[0]]).toBe('旺'); // wood
    expect(SEASON_STAGE_ZH[s[1]]).toBe('相'); // fire
    expect(SEASON_STAGE_ZH[s[4]]).toBe('休'); // water
    expect(SEASON_STAGE_ZH[s[3]]).toBe('囚'); // metal
    expect(SEASON_STAGE_ZH[s[2]]).toBe('死'); // earth
  });
});

describe('stemRelations (天干刑冲合害) — vs published reference chart', () => {
  it('壬 壬 庚 丙 -> 丙壬冲 + 丙克庚 (no relation for 壬-庚)', () => {
    const rel = stemRelations(pillars.map((p) => p.stem)).map((r) => r.text);
    expect(rel).toContain('丙壬冲');
    expect(rel).toContain('丙克庚');
    expect(rel.length).toBe(2);
  });
});

describe('branchRelations (地支刑冲合害) — vs published reference chart', () => {
  it('申 寅 午 子 -> 申子半合水, 寅午半合火, 申刑寅, 子午相冲, 寅申相冲', () => {
    const rel = branchRelations(pillars.map((p) => p.branch)).map((r) => r.text);
    expect(rel).toContain('申子半合水');
    expect(rel).toContain('寅午半合火');
    expect(rel).toContain('申刑寅');
    expect(rel).toContain('子午相冲');
    expect(rel).toContain('寅申相冲');
    expect(rel.length).toBe(5);
  });
});

describe('computeShensha (神煞) — vs published reference chart', () => {
  const tags = computeShensha(pillars);
  it('年柱: 驿马, 禄神, 学堂, 太极贵人-equivalent set', () => {
    expect(tags[0]).toContain('驿马');
    expect(tags[0]).toContain('禄神');
    expect(tags[0]).toContain('学堂');
  });
  it('月柱: 天乙贵人, 文昌贵人, 驿马', () => {
    expect(tags[1]).toContain('天乙贵人');
    expect(tags[1]).toContain('文昌贵人');
    expect(tags[1]).toContain('驿马');
  });
  it('日柱: 天乙贵人, 灾煞, 福星贵人, 童子', () => {
    expect(tags[2]).toContain('天乙贵人');
    expect(tags[2]).toContain('灾煞');
    expect(tags[2]).toContain('福星贵人');
    expect(tags[2]).toContain('童子');
  });
  it('时柱: 月德贵人, 将星, 童子', () => {
    expect(tags[3]).toContain('月德贵人');
    expect(tags[3]).toContain('将星');
    expect(tags[3]).toContain('童子');
  });
});

describe('tenGodOfStem (十神, algorithmic)', () => {
  it('same stem exactly -> 比肩 (same element, same polarity)', () => {
    expect(tenGodOfStem(0, 0)).toBe(0); // 甲甲
  });
  it('day master 甲(wood,yang), 乙(wood,yin) -> 劫财', () => {
    expect(tenGodOfStem(0, 1)).toBe(1);
  });
  it('day master 甲(wood), 丙(fire,yang, wood generates fire) -> 食神', () => {
    expect(tenGodOfStem(0, 2)).toBe(2);
  });
  it('day master 甲(wood), 丁(fire,yin) -> 伤官', () => {
    expect(tenGodOfStem(0, 3)).toBe(3);
  });
  it('day master 甲(wood), 戊(earth,yang, wood overcomes earth) -> 偏财', () => {
    expect(tenGodOfStem(0, 4)).toBe(4);
  });
  it('day master 甲(wood), 庚(metal,yang, metal overcomes wood) -> 七杀', () => {
    expect(tenGodOfStem(0, 6)).toBe(6);
  });
  it('day master 甲(wood), 辛(metal,yin) -> 正官', () => {
    expect(tenGodOfStem(0, 7)).toBe(7);
  });
  it('day master 甲(wood), 癸(water,yin, water generates wood) -> 正印', () => {
    expect(tenGodOfStem(0, 9)).toBe(9);
  });
});

describe('HIDDEN_STEMS (藏干) — vs published reference chart order', () => {
  it('申 -> 庚壬戊 (year branch)', () => { expect(HIDDEN_STEMS[8]).toEqual([6, 8, 4]); });
  it('寅 -> 甲丙戊 (month branch)', () => { expect(HIDDEN_STEMS[2]).toEqual([0, 2, 4]); });
  it('午 -> 丁己 (day branch)', () => { expect(HIDDEN_STEMS[6]).toEqual([3, 5]); });
  it('子 -> 癸 (hour branch)', () => { expect(HIDDEN_STEMS[0]).toEqual([9]); });
});

describe('ziPingAnalysis (simplified 身强身弱/格局/用神 + score)', () => {
  it('runs without throwing and returns a well-formed result', () => {
    const a = ziPingAnalysis(pillars);
    expect(['strong', 'weak', 'balanced']).toContain(a.strength);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.pattern.zh).toBeTruthy();
    expect(a.favorable.length).toBeGreaterThan(0);
    expect(a.unfavorable.length).toBeGreaterThan(0);
  });
  it('is deterministic (same input -> same output)', () => {
    expect(ziPingAnalysis(pillars)).toEqual(ziPingAnalysis(pillars));
  });
});
