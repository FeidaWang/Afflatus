import { describe, it, expect } from 'vitest';
import { fnv1aHash, toBase62, fromBase62, createRng, rngFromString } from '../src/bootengine/seed';

describe('fnv1aHash', () => {
  it('is deterministic for the same string', () => {
    expect(fnv1aHash('afflatus:wave3')).toBe(fnv1aHash('afflatus:wave3'));
  });
  it('differs for different strings (no trivial collision on close inputs)', () => {
    expect(fnv1aHash('afflatus:wave3')).not.toBe(fnv1aHash('afflatus:wave4'));
  });
  it('always returns an unsigned 32-bit int', () => {
    for (const s of ['', 'x', 'a much longer configuration string with spaces 123']) {
      const h = fnv1aHash(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('base62 round-trip', () => {
  it('round-trips a range of integers exactly', () => {
    for (const n of [0, 1, 61, 62, 999, 123456789, 4294967295]) {
      expect(fromBase62(toBase62(n))).toBe(n);
    }
  });
});

describe('createRng (mulberry32)', () => {
  it('same seed → identical sequence', () => {
    const a = createRng(42), b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds → different sequences', () => {
    const a = createRng(1), b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rngFromString composes hash+rng deterministically', () => {
    const s1 = rngFromString('afflatus:2026-07-15:wave3');
    const s2 = rngFromString('afflatus:2026-07-15:wave3');
    expect(s1()).toBe(s2());
  });
});
