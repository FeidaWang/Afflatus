import { describe, it, expect } from 'vitest';
import { validateArenaUniverse } from '../src/lib/validateArenaUniverse.js';

function base(overrides = {}) {
  return {
    updated: '2026-07-23', version: 2, mode: 'market',
    exclusions: [],
    tradability: { minLastClose: 3, minAvgDollarVol: 5000000 },
    benchmarks: ['SPY'],
    symbols: [
      { sym: 'NVDA', name: 'NVIDIA', sector: 'Information Technology', bucket: 'information-technology' },
      { sym: 'SPY', name: 'SPDR S&P 500 ETF', sector: 'Benchmark', bucket: 'benchmark' },
    ],
    ...overrides,
  };
}

describe('validateArenaUniverse — valid input', () => {
  it('accepts a well-formed v2 universe', () => {
    expect(validateArenaUniverse(base())).toEqual({ ok: true, errors: [] });
  });
});

describe('validateArenaUniverse — top-level', () => {
  it('rejects non-object input', () => {
    expect(validateArenaUniverse(null).ok).toBe(false);
    expect(validateArenaUniverse([]).ok).toBe(false);
  });
  it('rejects mode other than "market"', () => {
    const r = validateArenaUniverse(base({ mode: 'fixed' }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('mode'))).toBe(true);
  });
  it('requires updated/version/benchmarks/exclusions', () => {
    expect(validateArenaUniverse(base({ updated: '' })).ok).toBe(false);
    expect(validateArenaUniverse(base({ version: '2' })).ok).toBe(false);
    expect(validateArenaUniverse(base({ benchmarks: [] })).ok).toBe(false);
    expect(validateArenaUniverse(base({ exclusions: 'none' })).ok).toBe(false);
  });
});

describe('validateArenaUniverse — tradability floors', () => {
  it('rejects a missing/malformed tradability block', () => {
    expect(validateArenaUniverse(base({ tradability: null })).ok).toBe(false);
    expect(validateArenaUniverse(base({ tradability: { minLastClose: -1, minAvgDollarVol: 1 } })).ok).toBe(false);
  });
});

describe('validateArenaUniverse — symbols', () => {
  it('rejects an empty symbols array', () => {
    expect(validateArenaUniverse(base({ symbols: [] })).ok).toBe(false);
  });
  it('rejects a symbol with an invalid ticker shape', () => {
    const r = validateArenaUniverse(base({ symbols: [{ sym: 'TOO-LONG-SYM', name: 'X', bucket: 'x' }] }));
    expect(r.ok).toBe(false);
  });
  it('rejects a duplicate symbol', () => {
    const dup = { sym: 'NVDA', name: 'NVIDIA', bucket: 'information-technology' };
    const r = validateArenaUniverse(base({ symbols: [dup, dup] }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });
  it('rejects a benchmark ticker missing from symbols[]', () => {
    const r = validateArenaUniverse(base({ benchmarks: ['QQQ'] })); // QQQ not in symbols
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('QQQ'))).toBe(true);
  });
});
