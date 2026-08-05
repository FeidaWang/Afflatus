import { describe, expect, it } from 'vitest';
import { ARENA_PUBLICATION_MINUTES, assessMarketSnapshot, expectedMarketSnapshotDate } from '../src/lib/marketFreshness.js';

describe('market snapshot freshness', () => {
  it('keeps the prior session current before the pre-market publication time', () => {
    const beforePublish = new Date('2026-08-05T12:00:00Z'); // 08:00 ET
    expect(expectedMarketSnapshotDate(beforePublish, { availableFromMinutes: ARENA_PUBLICATION_MINUTES.briefing }))
      .toBe('2026-08-04');
  });

  it('requires the current session after the publication time', () => {
    const afterPublish = new Date('2026-08-05T14:00:00Z'); // 10:00 ET
    expect(assessMarketSnapshot('2026-08-04', afterPublish, { availableFromMinutes: ARENA_PUBLICATION_MINUTES.picks }))
      .toMatchObject({ state: 'stale', stale: true, expectedDate: '2026-08-05' });
  });

  it('uses Friday as the expected snapshot during a weekend', () => {
    const saturday = new Date('2026-08-08T16:00:00Z');
    expect(expectedMarketSnapshotDate(saturday, { availableFromMinutes: ARENA_PUBLICATION_MINUTES.picks }))
      .toBe('2026-08-07');
  });

  it('fails closed for missing and future-dated artifacts', () => {
    const now = new Date('2026-08-05T14:00:00Z');
    expect(assessMarketSnapshot('', now).state).toBe('missing');
    expect(assessMarketSnapshot('2026-08-06', now).state).toBe('future');
  });
});
