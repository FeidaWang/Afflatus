import { describe, it, expect } from 'vitest';
import {
  smaSeries, maSnapshot, classicPivots, reviewSession, swingLevels,
  roundLevels, detectGaps, detectBreakouts, normalizeDaily, analyzeTicker,
} from '../src/lib/technicals.js';

/** Build a flat candle quickly. */
const K = (t, o, h, l, c, v = 1000) => ({ t, o, h, l, c, v });
/** n flat candles at price p (tiny range so no swings/gaps fire). */
function flat(n, p, { vol = 1000, startDay = 1 } = {}) {
  return Array.from({ length: n }, (_, i) =>
    K(`2026-01-${String(startDay + i).padStart(2, '0')}`, p, p * 1.001, p * 0.999, p, vol));
}

describe('smaSeries', () => {
  it('computes simple averages with nulls until the window fills', () => {
    const s = smaSeries([1, 2, 3, 4, 5], 3);
    expect(s[0]).toBeNull();
    expect(s[1]).toBeNull();
    expect(s[2]).toBeCloseTo(2);
    expect(s[4]).toBeCloseTo(4);
  });
});

describe('maSnapshot', () => {
  it('reports value, price position, and slope', () => {
    // strictly rising closes: every MA rises, price above all MAs
    const candles = Array.from({ length: 220 }, (_, i) => K(`d${i}`, 0, 0, 0, 100 + i));
    const snap = maSnapshot(candles, 100 + 219);
    for (const m of snap) {
      expect(m.value).not.toBeNull();
      expect(m.pricePos).toBe('above');
      expect(m.slope).toBe('up');
    }
    expect(snap.map((m) => m.n)).toEqual([5, 10, 20, 60, 200]);
  });
  it('returns null value when not enough data', () => {
    const snap = maSnapshot(flat(10, 100), 100);
    expect(snap.find((m) => m.n === 200).value).toBeNull();
    expect(snap.find((m) => m.n === 5).value).not.toBeNull();
  });
});

describe('classicPivots', () => {
  it('matches the textbook formulas', () => {
    const p = classicPivots({ h: 110, l: 90, c: 100 });
    expect(p.pp).toBeCloseTo(100);
    expect(p.r1).toBeCloseTo(110);
    expect(p.s1).toBeCloseTo(90);
    expect(p.r2).toBeCloseTo(120);
    expect(p.s2).toBeCloseTo(80);
    expect(p.r3).toBeCloseTo(130);
    expect(p.s3).toBeCloseTo(70);
  });
});

describe('reviewSession', () => {
  it('flags touched and closed-above per level', () => {
    const pivots = classicPivots({ h: 110, l: 90, c: 100 }); // pp=100 r1=110 s1=90
    const rev = reviewSession(K('d', 100, 112, 99, 111), pivots);
    const r1 = rev.find((x) => x.name === 'r1');
    const s1 = rev.find((x) => x.name === 's1');
    expect(r1.touched).toBe(true);
    expect(r1.closedAbove).toBe(true);   // closed 111 > 110: breakout above R1
    expect(s1.touched).toBe(false);      // low 99 never reached 90
    expect(s1.closedAbove).toBe(true);
  });
});

describe('swingLevels', () => {
  it('detects an isolated swing high and low and sorts by distance', () => {
    const c = flat(30, 100, { startDay: 1 });
    // swing high at index 10 (h=120), swing low at index 20 (l=80)
    c[10] = K('2026-01-11', 100, 120, 99.9, 100);
    c[20] = K('2026-01-21', 100, 100.1, 80, 100);
    const { supports, resistances } = swingLevels(c, { price: 100, strength: 3, lookback: 30 });
    expect(resistances[0].level).toBeCloseTo(120);
    expect(supports[0].level).toBeCloseTo(80);
  });
  it('clusters nearby levels and counts touches', () => {
    const c = flat(40, 100);
    c[10] = K('a', 100, 120, 99.9, 100);
    c[25] = K('b', 100, 120.5, 99.9, 100); // within 1.2% of 120 → same cluster
    const { resistances } = swingLevels(c, { price: 100, strength: 3, lookback: 40 });
    expect(resistances.length).toBe(1);
    expect(resistances[0].touches).toBe(2);
    expect(resistances[0].level).toBeGreaterThan(120 - 1);
    expect(resistances[0].level).toBeLessThan(121);
  });
});

describe('roundLevels', () => {
  it('uses a $10 minor grid with $50 majors for a $200 stock', () => {
    const { below, above } = roundLevels(200);
    expect(above[0].level).toBeCloseTo(200);
    expect(above[0].weight).toBe('major');
    expect(below[0].level).toBeCloseTo(190);
    expect(below[0].weight).toBe('minor');
  });
  it('uses a $1 grid for a cheap stock', () => {
    const { below, above } = roundLevels(8.6);
    expect(below[0].level).toBeCloseTo(8);
    expect(above[0].level).toBeCloseTo(9);
  });
  it('always includes the nearest major ("century" level) for a $1000+ stock', () => {
    const { below } = roundLevels(1083);
    expect(below[0].level).toBeCloseTo(1080);
    expect(below.some((x) => x.level === 1000 && x.weight === 'major')).toBe(true);
  });
});

describe('detectGaps', () => {
  it('finds an open gap up with the right zone', () => {
    const c = flat(10, 100);
    c.push(K('2026-02-01', 105, 106, 104, 105)); // low 104 > prior high ~100.1
    const gaps = detectGaps(c);
    expect(gaps.length).toBe(1);
    expect(gaps[0].dir).toBe('up');
    expect(gaps[0].status).toBe('open');
    expect(gaps[0].bottom).toBeCloseTo(100.1);
    expect(gaps[0].top).toBeCloseTo(104);
  });
  it('tracks partial then full fills', () => {
    const c = flat(10, 100);
    c.push(K('g', 105, 106, 104, 105));
    c.push(K('p', 105, 105, 102, 104)); // dips into the zone → partial
    expect(detectGaps(c)[0].status).toBe('partial');
    c.push(K('f', 103, 103, 99, 100));  // trades through zone bottom → filled
    expect(detectGaps(c)[0].status).toBe('filled');
  });
  it('detects gap downs', () => {
    const c = flat(10, 100);
    c.push(K('d', 95, 96, 94, 95)); // high 96 < prior low ~99.9
    const g = detectGaps(c)[0];
    expect(g.dir).toBe('down');
    expect(g.bottom).toBeCloseTo(96);
    expect(g.top).toBeCloseTo(99.9);
  });
  it('ignores sub-threshold gaps', () => {
    const c = flat(10, 100);
    c.push(K('t', 100.2, 100.4, 100.15, 100.3)); // ~0.05% gap
    expect(detectGaps(c).length).toBe(0);
  });
});

describe('detectBreakouts', () => {
  it('finds a volume-confirmed box breakout and reports holding', () => {
    const c = flat(25, 100, { vol: 1000 });
    c.push(K('bk', 100, 104, 100, 103, 2500)); // close above box high ~100.1 on 2.5x vol
    const b = detectBreakouts(c, { win: 20 });
    expect(b.length).toBe(1);
    expect(b[0].level).toBeCloseTo(100.1);
    expect(b[0].volConfirmed).toBe(true);
    expect(b[0].status).toBe('holding');
  });
  it('reports lost when price falls back below the breakout level', () => {
    const c = flat(25, 100, { vol: 1000 });
    c.push(K('bk', 100, 104, 100, 103, 2500));
    c.push(K('lose', 103, 103, 97, 98, 1200));
    const b = detectBreakouts(c, { win: 20 });
    expect(b[0].status).toBe('lost');
  });
  it('skips boxes that are too wide to be consolidation', () => {
    const c = [];
    for (let i = 0; i < 25; i++) c.push(K(`w${i}`, 100, 100 + (i % 2 ? 8 : 0), 92, 100, 1000));
    c.push(K('bk', 100, 112, 100, 111, 3000));
    expect(detectBreakouts(c, { win: 20 }).length).toBe(0);
  });
});

describe('normalizeDaily', () => {
  const c = [...flat(5, 100), K('2026-07-04', 100, 101, 99, 100.5)];
  it('drops the last candle when it is today and the session is not complete', () => {
    const out = normalizeDaily(c, { etDateStr: '2026-07-04', sessionComplete: false });
    expect(out.length).toBe(c.length - 1);
  });
  it('keeps the last candle after the close or on other days', () => {
    expect(normalizeDaily(c, { etDateStr: '2026-07-04', sessionComplete: true }).length).toBe(c.length);
    expect(normalizeDaily(c, { etDateStr: '2026-07-05', sessionComplete: false }).length).toBe(c.length);
  });
});

describe('analyzeTicker', () => {
  it('assembles pre pivots from the last candle and post pivots from the prior one', () => {
    const c = flat(30, 100);
    c.push(K('prev', 100, 110, 90, 100));  // -> post reference
    c.push(K('last', 100, 120, 100, 115)); // -> pre reference
    const a = analyzeTicker(c, { price: 116 });
    expect(a.pivots.pre.pp).toBeCloseTo((120 + 100 + 115) / 3);
    expect(a.pivots.post.pp).toBeCloseTo((110 + 90 + 100) / 3);
    expect(a.price).toBe(116);
    expect(a.postReview.find((x) => x.name === 'pp').touched).toBe(true);
    expect(Array.isArray(a.gaps)).toBe(true);
    expect(a.ma.length).toBe(5);
  });
  it('returns null without enough candles', () => {
    expect(analyzeTicker([K('x', 1, 1, 1, 1)], {})).toBeNull();
  });
});
