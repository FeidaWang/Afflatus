import { describe, it, expect } from 'vitest';
import { validateArenaPicks } from '../src/lib/validateArenaPicks.js';

function pick(overrides = {}) {
  return {
    sym: 'NVDA', side: 'long', confidence: 0.78,
    entry: 182.4, stop: 167.8, target: 199.0,
    thesis_en: 'Momentum + earnings tailwind.', thesis_zh: '动能加财报顺风。',
    signals: ['8-K', 'sentiment+0.6'],
    ...overrides,
  };
}

function base(overrides = {}) {
  return {
    date: '2026-07-23', generatedAt: '2026-07-23T08:00:00Z', regime: 'risk-on',
    models: { S: [pick()], P: [], T: [] },
    quoteAllowlist: ['NVDA', 'SPY'],
    ...overrides,
  };
}

describe('validateArenaPicks — valid input', () => {
  it('accepts a well-formed picks file, including empty model arrays', () => {
    expect(validateArenaPicks(base())).toEqual({ ok: true, errors: [] });
  });
});

describe('validateArenaPicks — top-level', () => {
  it('rejects non-object input', () => {
    expect(validateArenaPicks(null).ok).toBe(false);
  });
  it('requires date/generatedAt', () => {
    expect(validateArenaPicks(base({ date: '' })).ok).toBe(false);
    expect(validateArenaPicks(base({ generatedAt: null })).ok).toBe(false);
  });
  it('rejects an unrecognized regime', () => {
    expect(validateArenaPicks(base({ regime: 'bullish' })).ok).toBe(false);
  });
  it('requires models.S/P/T to each be arrays', () => {
    const r = validateArenaPicks(base({ models: { S: [], P: 'none', T: [] } }));
    expect(r.ok).toBe(false);
  });
});

describe('validateArenaPicks — per-pick fields', () => {
  it('rejects side other than "long" (long-only system)', () => {
    const r = validateArenaPicks(base({ models: { S: [pick({ side: 'short' })], P: [], T: [] } }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('long-only'))).toBe(true);
  });
  it('rejects confidence outside [0,1]', () => {
    expect(validateArenaPicks(base({ models: { S: [pick({ confidence: 1.2 })], P: [], T: [] } })).ok).toBe(false);
  });
  it('rejects non-positive entry/stop/target', () => {
    expect(validateArenaPicks(base({ models: { S: [pick({ stop: -1 })], P: [], T: [] } })).ok).toBe(false);
  });
  it('rejects missing bilingual thesis', () => {
    expect(validateArenaPicks(base({ models: { S: [pick({ thesis_zh: '' })], P: [], T: [] } })).ok).toBe(false);
  });
  it('rejects empty signals array', () => {
    expect(validateArenaPicks(base({ models: { S: [pick({ signals: [] })], P: [], T: [] } })).ok).toBe(false);
  });
});

describe('validateArenaPicks — quoteAllowlist consistency', () => {
  it('rejects a picked symbol missing from quoteAllowlist', () => {
    const r = validateArenaPicks(base({ quoteAllowlist: ['SPY'] })); // NVDA picked but not allowlisted
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('NVDA'))).toBe(true);
  });
  it('accepts an allowlist that is a superset of every pick', () => {
    expect(validateArenaPicks(base({ quoteAllowlist: ['NVDA', 'SPY', 'QQQ'] })).ok).toBe(true);
  });
});
