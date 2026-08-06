import { describe, expect, it } from 'vitest';
import { assessPipelineOutput, zonedDate } from '../src/lib/dataFreshness.js';

describe('dataFreshness', () => {
  it('uses the configured timezone for calendar-day artifacts', () => {
    const now = new Date('2026-08-05T14:30:00Z');
    expect(zonedDate(now, 'Australia/Melbourne')).toBe('2026-08-06');
    const result = assessPipelineOutput(
      { kind: 'calendar-day', timeZone: 'Australia/Melbourne' },
      {},
      '2026-08-06',
      now,
    );
    expect(result).toMatchObject({ stale: false, state: 'fresh', expectedDate: '2026-08-06' });
  });

  it('does not accept an invalid max-age timestamp', () => {
    const result = assessPipelineOutput(
      { kind: 'max-age', maxAgeHours: 24 },
      {},
      'not-a-date',
      new Date('2026-08-06T00:00:00Z'),
    );
    expect(result).toMatchObject({ stale: true, state: 'stale', ageHours: null });
  });

  it('keeps a recent max-age artifact fresh', () => {
    const result = assessPipelineOutput(
      { kind: 'max-age', maxAgeHours: 24 },
      {},
      '2026-08-05T12:00:00Z',
      new Date('2026-08-06T00:00:00Z'),
    );
    expect(result).toMatchObject({ stale: false, state: 'fresh', ageHours: 12 });
  });

  it('rejects a future timestamp instead of treating it as freshly published', () => {
    const result = assessPipelineOutput(
      { kind: 'max-age', maxAgeHours: 24 },
      {},
      '2026-08-06T12:00:00Z',
      new Date('2026-08-06T00:00:00Z'),
    );
    expect(result).toMatchObject({ stale: true, state: 'future', ageHours: -12 });
  });
});
