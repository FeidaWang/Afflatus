import { describe, expect, it, vi } from 'vitest';
import { createAutoLocalEnvironmentScheduler } from '../src/city/autoLocalEnvironment.ts';

describe('production Auto-local environment scheduler', () => {
  it('refreshes from an explicit clock, pauses in the background and resumes immediately', () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn((request, instant) => ({ request, instant }));
      const now = vi.fn()
        .mockReturnValueOnce('2026-01-15T09:30:00.000Z')
        .mockReturnValueOnce('2026-01-15T09:31:00.000Z')
        .mockReturnValueOnce('2026-01-15T09:32:00.000Z');
      const scheduler = createAutoLocalEnvironmentScheduler({ refresh, now });

      scheduler.select('auto-local');
      expect(refresh).toHaveBeenLastCalledWith('auto-local', '2026-01-15T09:30:00.000Z');
      vi.advanceTimersByTime(60_000);
      expect(refresh).toHaveBeenLastCalledWith('auto-local', '2026-01-15T09:31:00.000Z');

      scheduler.pause();
      vi.advanceTimersByTime(120_000);
      expect(refresh).toHaveBeenCalledTimes(2);
      scheduler.resume();
      expect(refresh).toHaveBeenLastCalledWith('auto-local', '2026-01-15T09:32:00.000Z');
      expect(scheduler.getState()).toMatchObject({ active: true, paused: false });

      scheduler.select('night');
      expect(refresh).toHaveBeenLastCalledWith('night');
      expect(scheduler.getState()).toMatchObject({ selectedRequest: 'night', active: false });
      scheduler.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the last verified state when a scheduled refresh fails', () => {
    vi.useFakeTimers();
    try {
      const onRefreshError = vi.fn();
      const refresh = vi.fn()
        .mockReturnValueOnce('verified')
        .mockImplementationOnce(() => { throw new Error('clock-refresh-failed'); });
      const scheduler = createAutoLocalEnvironmentScheduler({
        refresh,
        now: () => '2026-01-15T09:30:00.000Z',
        onRefreshError,
      });
      expect(scheduler.select('auto-local')).toBe('verified');
      vi.advanceTimersByTime(60_000);
      expect(onRefreshError).toHaveBeenCalledOnce();
      expect(scheduler.getState()).toMatchObject({
        active: true,
        successfulRefreshes: 1,
        failedRefreshes: 1,
      });
      scheduler.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
