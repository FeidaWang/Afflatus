import { describe, it, expect } from 'vitest';
import { Solar } from 'lunar-javascript';
import { almanac } from '../src/lib/almanac.js';
import { buildContext, dailyGuide, DOMAINS, suyaoDayType } from '../src/lib/dailyGuide.js';

describe('almanac vs lunar-javascript', () => {
  it('建除十二神 and 黄黑道 agree on 2000 days (≤1 solar-term-edge miss)', () => {
    let bad = 0;
    for (let t = Date.UTC(1980, 0, 1), i = 0; i < 2000; i++, t += 864e5 * 7) {
      const D = new Date(t); const y = D.getUTCFullYear(), m = D.getUTCMonth() + 1, d = D.getUTCDate();
      const a = almanac(y, m, d); const L = Solar.fromYmd(y, m, d).getLunar();
      if (a.jianchu.zh !== L.getZhiXing() || a.tianshen.zh !== L.getDayTianShen()) bad++;
    }
    expect(bad).toBeLessThanOrEqual(1);
  });
});

describe('宿曜 day types', () => {
  it('follows the 三九 pattern', () => {
    expect(suyaoDayType(5, 5).key).toBe('命');
    expect(suyaoDayType(5, 6).key).toBe('栄');
    expect(suyaoDayType(5, 14).key).toBe('業');
    expect(suyaoDayType(5, 23).key).toBe('胎');
    expect(suyaoDayType(5, 4).key).toBe('親');
  });
});

describe('dailyGuide', () => {
  const me = { y: 1990, m: 6, d: 15, hour: 14, gender: 'F' };
  const ctx = buildContext(me);
  it('is deterministic and every score equals 50 + 1.25 × its receipts (± mansion)', () => {
    const a = dailyGuide(ctx, '2026-09-28'), b = dailyGuide(ctx, '2026-09-28');
    expect(a).toEqual(b);
    expect(a.domains.map((d) => d.id)).toEqual(DOMAINS);
    for (const d of a.domains) {
      const sum = d.receipts.reduce((s, r) => s + r.pts, 0) + (a.xiu.good ? 1 : -1);
      expect(d.score).toBe(Math.max(12, Math.min(96, Math.round(50 + 1.25 * sum))));
    }
  });
  it('uses 紫微 only when the hour is known', () => {
    expect(dailyGuide(ctx, '2026-09-28').ziwei).toHaveLength(4);
    expect(dailyGuide(buildContext({ ...me, hour: null }), '2026-09-28').ziwei).toBeNull();
  });
  it('never words a low day as bad luck', () => {
    for (let i = 0; i < 60; i++) {
      const ds = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      for (const d of dailyGuide(ctx, ds).domains) expect(d.zh + d.en).not.toMatch(/凶|厄运|倒霉|bad luck|doom/i);
    }
  });
});
