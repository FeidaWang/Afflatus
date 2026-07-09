import { describe, it, expect } from 'vitest';
import { dailyDraw, XIU_SERIES, ZODIAC_SERIES } from '../src/lib/starDraw.js';

const DOOM = /吉|凶|灾|克夫|克妻|will happen|doom|curse/i;

describe('dailyDraw', () => {
  it('is deterministic for the same (date, birth, streak)', () => {
    const a = dailyDraw({ dateStr: '2026-07-09', birthKey: '1990-1-1-8', streak: 3 });
    const b = dailyDraw({ dateStr: '2026-07-09', birthKey: '1990-1-1-8', streak: 3 });
    expect(a).toEqual(b);
  });
  it('varies across different birth keys on the same day (not everyone draws the same)', () => {
    const seen = new Set();
    for (let i = 0; i < 30; i++) {
      const r = dailyDraw({ dateStr: '2026-07-09', birthKey: `person-${i}`, streak: 0 });
      seen.add(`${r.card.series}-${r.card.idx}`);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
  it('varies across different days for the same person', () => {
    const seen = new Set();
    for (let d = 1; d <= 20; d++) {
      const r = dailyDraw({ dateStr: `2026-07-${String(d).padStart(2, '0')}`, birthKey: 'fixed-person', streak: 0 });
      seen.add(`${r.card.series}-${r.card.idx}`);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
  it('never draws from the hidden pool when streak < 7', () => {
    for (let i = 0; i < 50; i++) {
      const r = dailyDraw({ dateStr: `2026-0${1 + (i % 9)}-0${1 + (i % 8)}`, birthKey: `x${i}`, streak: i % 7 });
      expect(r.hidden).toBe(false);
      expect(r.card.series).not.toBe('hidden');
    }
  });
  it('can draw from the hidden pool once streak >= 7 (over enough samples)', () => {
    let hiddenSeen = false;
    for (let i = 0; i < 60; i++) {
      const r = dailyDraw({ dateStr: `2026-0${1 + (i % 9)}-1${i % 8}`, birthKey: `y${i}`, streak: 10 });
      if (r.hidden) hiddenSeen = true;
    }
    expect(hiddenSeen).toBe(true);
  });
  it('always returns a non-empty bilingual card + advice, never fortune-telling language', () => {
    for (let i = 0; i < 20; i++) {
      const r = dailyDraw({ dateStr: '2026-07-09', birthKey: `z${i}`, streak: 8 });
      expect(r.card.zh.length).toBeGreaterThan(0);
      expect(r.card.en.length).toBeGreaterThan(0);
      expect(r.advice.zh.length).toBeGreaterThan(0);
      expect(r.advice.en.length).toBeGreaterThan(0);
      expect(DOOM.test(r.advice.zh)).toBe(false);
      expect(DOOM.test(r.advice.en)).toBe(false);
    }
  });
  it('card pools cover 28 mansions + 12 zodiac signs exactly', () => {
    expect(XIU_SERIES.length).toBe(28);
    expect(ZODIAC_SERIES.length).toBe(12);
  });
});
