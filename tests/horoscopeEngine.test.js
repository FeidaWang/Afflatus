import { describe, it, expect } from 'vitest';
import { elementRelation, dailyFortune, synastry, dailyPull, encodeShare, decodeShare } from '../src/lib/horoscopeEngine.js';

const P1 = { y: 1994, m: 4, d: 18, hour: 8 };
const P2 = { y: 1996, m: 11, d: 2, hour: null };

describe('elementRelation (five-element cycle)', () => {
  it('covers all five relations from wood day master', () => {
    expect(elementRelation(0, 0)).toBe('same');     // wood-wood 比和
    expect(elementRelation(0, 4)).toBe('feeds');    // water feeds wood 印
    expect(elementRelation(0, 1)).toBe('drains');   // wood generates fire 食伤
    expect(elementRelation(0, 2)).toBe('prize');    // wood controls earth 财
    expect(elementRelation(0, 3)).toBe('presses');  // metal controls wood 官
  });
});

describe('dailyFortune', () => {
  it('is deterministic: same birth + same date → identical output', () => {
    expect(dailyFortune(P1, '2026-07-05')).toEqual(dailyFortune(P1, '2026-07-05'));
  });
  it('changes across days (real ganzhi drives it)', () => {
    const a = dailyFortune(P1, '2026-07-05');
    const b = dailyFortune(P1, '2026-07-06');
    const differs = a.overall.score !== b.overall.score
      || a.domains.some((d, i) => d.score !== b.domains[i].score)
      || a.relation !== b.relation;
    expect(differs).toBe(true);
  });
  it('differs between two different people on the same day', () => {
    const a = dailyFortune(P1, '2026-07-05');
    const b = dailyFortune(P2, '2026-07-05');
    expect(JSON.stringify(a.domains)).not.toBe(JSON.stringify(b.domains));
  });
  it('all scores clamped to 8..96 (no absolute answers by design)', () => {
    for (const date of ['2026-01-01', '2026-04-15', '2026-07-05', '2026-10-31', '2026-12-31']) {
      const f = dailyFortune(P1, date);
      expect(f.overall.score).toBeGreaterThanOrEqual(8);
      expect(f.overall.score).toBeLessThanOrEqual(96);
      for (const d of f.domains) { expect(d.score).toBeGreaterThanOrEqual(8); expect(d.score).toBeLessThanOrEqual(96); }
    }
  });
  it('has bilingual text everywhere + 2 yi + 2 ji + lucky set', () => {
    const f = dailyFortune(P2, '2026-07-05');
    expect(f.overall.zh).toBeTruthy(); expect(f.overall.en).toBeTruthy();
    expect(f.domains).toHaveLength(4);
    for (const d of f.domains) { expect(d.zh).toBeTruthy(); expect(d.en).toBeTruthy(); }
    expect(f.yi).toHaveLength(2); expect(f.ji).toHaveLength(2);
    expect(f.lucky.color.css).toMatch(/^#/);
    expect(f.lucky.number).toBeGreaterThanOrEqual(1);
    expect(f.lucky.number).toBeLessThanOrEqual(9);
  });

  // v2 (Part 5 §23.2): stem-channel ten god + branch-channel 合冲刑害,
  // hand-verified against P1's real chart (甲戌年 戊辰月 甲戌日 戊辰时,
  // day branch 戌=10).
  it('tags the ten-god of the day (stem channel)', () => {
    const f = dailyFortune(P1, '2026-07-05');
    expect(f.tenGod.zh).toBeTruthy(); expect(f.tenGod.en).toBeTruthy();
    expect(f.tenGod.idx).toBeGreaterThanOrEqual(0); expect(f.tenGod.idx).toBeLessThanOrEqual(9);
  });
  it('2026-07-05 (庚辰日) clashes P1\'s natal day branch (戌) — caps overall at 60', () => {
    const f = dailyFortune(P1, '2026-07-05');
    const dayEvent = f.branchEvents.find((e) => e.pillar === 'day');
    expect(dayEvent.type).toBe('chong');
    expect(f.overall.score).toBeLessThanOrEqual(60);
  });
  it('2026-01-05 (己卯日) six-harmonizes P1\'s natal day branch (戌, 卯戌合) — floors overall at 40', () => {
    const f = dailyFortune(P1, '2026-01-05');
    const dayEvent = f.branchEvents.find((e) => e.pillar === 'day');
    expect(dayEvent.type).toBe('liuhe');
    expect(f.overall.score).toBeGreaterThanOrEqual(40);
  });
});

describe('synastry', () => {
  it('is symmetric-ish in bounds and deterministic', () => {
    const s1 = synastry(P1, P2), s2 = synastry(P1, P2);
    expect(s1.base).toBe(s2.base);
    expect(s1.base).toBeGreaterThanOrEqual(8);
    expect(s1.base).toBeLessThanOrEqual(96);
    expect(s1.pillars).toHaveLength(5);
    for (const p of s1.pillars) { expect(p.score).toBeGreaterThanOrEqual(8); expect(p.score).toBeLessThanOrEqual(96); }
  });
  it('六合 year branches score above 相冲 year branches (all else similar)', () => {
    // 1996 丙子 (rat) vs 1997 丁丑 (ox) = 子丑六合; 1996 vs 1990 庚午 (horse) = 子午相冲
    const he = synastry({ y: 1996, m: 6, d: 10 }, { y: 1997, m: 6, d: 10 });
    const chong = synastry({ y: 1996, m: 6, d: 10 }, { y: 1990, m: 6, d: 10 });
    const heYear = he.parts.find((p) => p.id === 'year').pts;
    const chongYear = chong.parts.find((p) => p.id === 'year').pts;
    expect(heYear).toBe(18);
    expect(chongYear).toBe(-16);
  });
  it('breakdown parts carry bilingual notes', () => {
    for (const p of synastry(P1, P2).parts) { expect(p.zh).toBeTruthy(); expect(p.en).toBeTruthy(); }
  });
});

describe('dailyPull', () => {
  it('deterministic per (pair, date), varies across dates', () => {
    expect(dailyPull(P1, P2, '2026-07-05')).toEqual(dailyPull(P1, P2, '2026-07-05'));
    const days = ['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08'];
    const scores = days.map((d) => dailyPull(P1, P2, d).score);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });
});

describe('share codec', () => {
  it('roundtrips with and without hours', () => {
    const code = encodeShare(P1, P2);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe
    const dec = decodeShare(code);
    expect(dec.a).toEqual({ y: 1994, m: 4, d: 18, hour: 8 });
    expect(dec.b).toEqual({ y: 1996, m: 11, d: 2, hour: null });
  });
  it('rejects garbage and out-of-range values', () => {
    expect(decodeShare('not-base64!!!')).toBeNull();
    expect(decodeShare(btoa(JSON.stringify([1, 2, 3])))).toBeNull();
    expect(decodeShare(btoa(JSON.stringify([1700, 1, 1, null, 1990, 1, 1, null])))).toBeNull();
  });
});
