import { describe, expect, it } from 'vitest';
import { earningsTimingState } from '../src/lib/arenaEarningsState.js';

describe('Arena earnings timing state', () => {
  it('keeps a future verified event in countdown state', () => {
    expect(earningsTimingState('2026-08-11T17:00:00-04:00', '2026-08-08T00:00:00Z').state).toBe('scheduled');
  });

  it('marks an elapsed reporting time as released and awaiting a data update', () => {
    expect(earningsTimingState('2026-08-11T17:00:00-04:00', '2026-08-12T00:00:00Z').state).toBe('released');
  });
});
