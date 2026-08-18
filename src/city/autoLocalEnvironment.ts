import type { CityEnvironmentRequest } from './environmentClock.ts';

type TimerHandle = ReturnType<typeof globalThis.setInterval>;

export function createAutoLocalEnvironmentScheduler<T>({
  refresh,
  now = () => new Date(),
  intervalMs = 60_000,
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  onRefreshError = () => {},
}: {
  refresh: (request: CityEnvironmentRequest, instant?: Date | string | number) => T;
  now?: () => Date | string | number;
  intervalMs?: number;
  setIntervalFn?: (callback: () => void, milliseconds: number) => TimerHandle;
  clearIntervalFn?: (handle: TimerHandle) => void;
  onRefreshError?: (error: unknown) => void;
}) {
  if (typeof refresh !== 'function') throw new Error('Auto-local scheduler requires a refresh callback.');
  if (!Number.isFinite(intervalMs) || intervalMs < 1_000) {
    throw new Error('Auto-local scheduler interval must be at least one second.');
  }
  let selectedRequest: CityEnvironmentRequest | null = null;
  let timer: TimerHandle | null = null;
  let paused = false;
  let destroyed = false;
  let successfulRefreshes = 0;
  let failedRefreshes = 0;

  const stopTimer = () => {
    if (timer === null) return;
    clearIntervalFn(timer);
    timer = null;
  };

  const refreshAutoLocal = (instant: Date | string | number = now()) => {
    try {
      const result = refresh('auto-local', instant);
      successfulRefreshes += 1;
      return result;
    } catch (error) {
      failedRefreshes += 1;
      onRefreshError(error);
      return null;
    }
  };

  const schedule = () => {
    if (destroyed || paused || selectedRequest !== 'auto-local' || timer !== null) return;
    timer = setIntervalFn(() => refreshAutoLocal(), intervalMs);
  };

  const select = (request: CityEnvironmentRequest, instant?: Date | string | number) => {
    if (destroyed) throw new Error('Auto-local scheduler is destroyed.');
    stopTimer();
    const result = request === 'auto-local'
      ? refresh('auto-local', instant ?? now())
      : refresh(request);
    successfulRefreshes += 1;
    selectedRequest = request;
    paused = false;
    schedule();
    return result;
  };

  return Object.freeze({
    select,
    pause() {
      if (destroyed) return;
      paused = true;
      stopTimer();
    },
    resume() {
      if (destroyed || !paused) return null;
      paused = false;
      const result = selectedRequest === 'auto-local' ? refreshAutoLocal() : null;
      schedule();
      return result;
    },
    getState() {
      return Object.freeze({
        selectedRequest,
        active: timer !== null,
        paused,
        destroyed,
        intervalMs,
        successfulRefreshes,
        failedRefreshes,
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTimer();
    },
  });
}
