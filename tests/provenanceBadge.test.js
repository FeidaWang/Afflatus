import { describe, it, expect } from 'vitest';
import { computeAgeHours, computeBadgeTier, buildProvenanceBadge } from '../src/lib/provenanceBadge.js';

describe('computeAgeHours', () => {
  it('returns null for null/undefined/empty updatedAt', () => {
    expect(computeAgeHours(null, new Date())).toBeNull();
    expect(computeAgeHours(undefined, new Date())).toBeNull();
    expect(computeAgeHours('', new Date())).toBeNull();
  });

  it('returns null for unparseable date strings', () => {
    expect(computeAgeHours('not-a-date', new Date())).toBeNull();
  });

  it('computes hours elapsed for a date-only string', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    expect(computeAgeHours('2026-07-04', now)).toBeCloseTo(36, 0);
  });

  it('computes hours elapsed for a full timestamp', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    expect(computeAgeHours('2026-07-05T06:00:00Z', now)).toBeCloseTo(6, 5);
  });

  it('clamps negative age (future updatedAt) to 0', () => {
    const now = new Date('2026-07-05T00:00:00Z');
    expect(computeAgeHours('2026-07-06T00:00:00Z', now)).toBe(0);
  });
});

describe('computeBadgeTier', () => {
  it('returns seed for null ageHours', () => {
    expect(computeBadgeTier(null)).toBe('seed');
  });

  it('returns fresh at and below 36h', () => {
    expect(computeBadgeTier(0)).toBe('fresh');
    expect(computeBadgeTier(36)).toBe('fresh');
  });

  it('returns amber between 36h (exclusive) and 72h (inclusive)', () => {
    expect(computeBadgeTier(36.01)).toBe('amber');
    expect(computeBadgeTier(72)).toBe('amber');
  });

  it('returns red above 72h', () => {
    expect(computeBadgeTier(72.01)).toBe('red');
    expect(computeBadgeTier(500)).toBe('red');
  });
});

describe('buildProvenanceBadge', () => {
  it('seed state (updatedAt null) — en', () => {
    const b = buildProvenanceBadge({ updatedAt: null, version: 1, lang: 'en' });
    expect(b.tier).toBe('seed');
    expect(b.text).toBe('FABLE 5 MAX · no data yet · v1 · NOT ADVICE');
  });

  it('seed state — zh', () => {
    const b = buildProvenanceBadge({ updatedAt: null, version: 1, lang: 'zh' });
    expect(b.tier).toBe('seed');
    expect(b.text).toBe('FABLE 5 MAX · 暂无数据 · v1 · 非投资建议');
  });

  it('fresh state with sourceCount and version — en', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    const b = buildProvenanceBadge({ updatedAt: '2026-07-05T06:00:00Z', version: 3, sourceCount: 5, lang: 'en', now });
    expect(b.tier).toBe('fresh');
    expect(b.text).toBe('FABLE 5 MAX · 6h ago · 5 sources · v3 · NOT ADVICE');
  });

  it('amber state — zh, no sourceCount', () => {
    const now = new Date('2026-07-05T12:00:00Z');
    const b = buildProvenanceBadge({ updatedAt: '2026-07-03T00:00:00Z', version: 2, lang: 'zh', now });
    expect(b.tier).toBe('amber');
    expect(b.text).toBe('FABLE 5 MAX · 2 天前 · v2 · 非投资建议');
  });

  it('red state — omits version when not provided', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    const b = buildProvenanceBadge({ updatedAt: '2026-07-05T00:00:00Z', lang: 'en', now });
    expect(b.tier).toBe('red');
    expect(b.text).toBe('FABLE 5 MAX · 5d ago · NOT ADVICE');
  });

  it('defaults lang to en and now to current time when omitted', () => {
    const b = buildProvenanceBadge({ updatedAt: null });
    expect(b.text).toContain('NOT ADVICE');
  });
});
