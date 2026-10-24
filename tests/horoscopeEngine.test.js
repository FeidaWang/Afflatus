import { describe, it, expect } from 'vitest';
import { elementRelation, dailyFortune, synastry, dailyPull, encodeShare, decodeShare } from '../src/lib/horoscopeEngine.js';
import { dayPillar } from '../src/lib/bazi.js';

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

// A birth date in 1990 whose day stem is `stem` (0=甲 … 9=癸).
const withDayStem = (stem, from = 1) => {
  for (let d = from; d <= 28; d++) if (dayPillar(1990, 6, d).stem === stem) return { y: 1990, m: 6, d, hour: 10 };
  throw new Error('no date');
};
const dm = (s) => s.parts.find((p) => p.id === 'daymaster');

describe('health copy (C1)', () => {
  it('never names organs or body systems across a year of readings', () => {
    const banned = /脾|胃|肝|肺|肾|心脏|肠|气血|血压|Digestion|stomach|liver|kidney|lung|blood/i;
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      for (const p of [P1, P2]) expect(JSON.stringify(dailyFortune(p, d))).not.toMatch(banned);
    }
  });
});

describe('synastry', () => {
  it('is deterministic and bounded, with no per-domain sub-scores (Q2)', () => {
    const s1 = synastry(P1, P2), s2 = synastry(P1, P2);
    expect(s1.base).toBe(s2.base);
    expect(s1.base).toBeGreaterThanOrEqual(8);
    expect(s1.base).toBeLessThanOrEqual(96);
    expect(s1.pillars).toBeUndefined();
  });
  it('swapping the two people never changes base or any part (Q3)', () => {
    for (let i = 0; i < 300; i++) {
      const a = { y: 1970 + (i % 37), m: 1 + (i * 7) % 12, d: 1 + (i * 11) % 28, hour: i % 3 ? (i * 5) % 24 : null };
      const b = { y: 1975 + (i * 3 % 30), m: 1 + (i * 5) % 12, d: 1 + (i * 13) % 28, hour: i % 4 ? (i * 3) % 24 : null };
      const ab = synastry(a, b), ba = synastry(b, a);
      expect(ba.base).toBe(ab.base);
      expect(ba.parts.map((p) => p.pts)).toEqual(ab.parts.map((p) => p.pts));
    }
  });
  it('day stems in 五合 (甲己) score as a combination, not as 相克 (Q3)', () => {
    const p = dm(synastry(withDayStem(0), withDayStem(5)));
    expect(p.pts).toBe(8);
    expect(p.zh).toContain('五合');
  });
  it('天干四冲 (甲庚) scores below a same-polarity check (甲戊) and both below zero', () => {
    const chong = dm(synastry(withDayStem(0), withDayStem(6))).pts;
    const sha = dm(synastry(withDayStem(0), withDayStem(4))).pts;
    expect(chong).toBe(-6);
    expect(sha).toBe(-3);
  });
  it('same-element day masters read as 比和, never as 相生 (C2b)', () => {
    const p = dm(synastry(withDayStem(0), withDayStem(1)));
    expect(p.pts).toBe(3);
    expect(p.zh).toContain('比和');
    expect(p.zh).not.toContain('相生');
  });
  it('zodiac part uses the real solar longitude and element-specific copy (C2, Q3c)', () => {
    // 2024-03-20 11:06 CST is the March equinox: 08:00 is still Pisces (water), 13:00 is Aries (fire)
    const before = synastry({ y: 2024, m: 3, d: 20, hour: 7 }, { y: 1990, m: 7, d: 1, hour: 9 }); // Cancer, water
    const after = synastry({ y: 2024, m: 3, d: 20, hour: 13 }, { y: 1990, m: 7, d: 1, hour: 9 });
    const z = (s) => s.parts.find((p) => p.id === 'zodiac');
    expect(z(before).pts).toBe(8);
    expect(z(before).zh).toContain('水象');
    expect(z(after).pts).toBe(0);
    expect(z(after).zh).not.toContain('火焰');
  });
  it('unknown hour on a sign-change day leaves the zodiac part unscored and says why', () => {
    const z = synastry({ y: 2024, m: 3, d: 20, hour: null }, P1).parts.find((p) => p.id === 'zodiac');
    expect(z.pts).toBe(0);
    expect(z.unknown).toBe(true);
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

describe('dailyPull (流日 reading, Q5)', () => {
  it('is a three-level tone, deterministic, with no 0-100 score', () => {
    const r = dailyPull(P1, P2, '2026-07-05');
    expect(r).toEqual(dailyPull(P1, P2, '2026-07-05'));
    expect(['smooth', 'even', 'yield']).toContain(r.tone);
    expect(r.score).toBeUndefined();
    expect(r.gz).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(r.why.zh && r.why.en).toBeTruthy();
  });
  it('a day branch that clashes either day branch reads 宜让', () => {
    // find a date whose day branch clashes P1's day branch
    const p1Day = dayPillar(P1.y, P1.m, P1.d).branch;
    for (let d = 1; d <= 28; d++) {
      if (dayPillar(2026, 8, d).branch === (p1Day + 6) % 12) {
        expect(dailyPull(P1, P2, `2026-08-${String(d).padStart(2, '0')}`).tone).toBe('yield');
        return;
      }
    }
    throw new Error('no clash day found');
  });
  it('does not depend on who is A and who is B', () => {
    for (const day of ['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']) {
      expect(dailyPull(P2, P1, day)).toEqual(dailyPull(P1, P2, day));
    }
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

describe('dailyFortune headline (C3)', () => {
  it('every relation × tone has headlines within 32 English / 16 Chinese characters', async () => {
    const { HEADLINE_BANK } = await import('../src/lib/horoscopeEngine.js');
    for (const rel of ['feeds', 'same', 'drains', 'prize', 'presses']) {
      for (const tone of ['up', 'flat', 'down']) {
        expect(HEADLINE_BANK[rel][tone].length).toBeGreaterThan(0);
        for (const h of HEADLINE_BANK[rel][tone]) {
          expect(h.en.length).toBeLessThanOrEqual(32);
          expect([...h.zh].length).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  it('matches the day’s relation and tone, is deterministic, and carries a ruleId', () => {
    for (let i = 1; i <= 28; i++) {
      const dateStr = `2026-03-${String(i).padStart(2, '0')}`;
      const f = dailyFortune(P1, dateStr);
      expect(f.headline.ruleId).toBe(`daily.headline.${f.relation}.${f.overall.tone}`);
      expect(dailyFortune(P1, dateStr).headline).toEqual(f.headline);
    }
  });
});
