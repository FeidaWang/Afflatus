/**
 * Accumulator-based rAF pacer. Each refresh contributes at most one target
 * interval, so a long asset/decode frame is presented once and its debt is
 * discarded instead of causing an 8 ms catch-up burst on a 120 Hz display.
 */
export function createFramePacer({ toleranceMs = 0.35 } = {}) {
  let previousRafAt = 0;
  let accumulatorMs = 0;
  let previousTargetFps = 0;
  let estimatedRefreshMs = 0;
  let refreshesSincePresentation = 0;

  function reset() {
    previousRafAt = 0;
    accumulatorMs = 0;
    previousTargetFps = 0;
    estimatedRefreshMs = 0;
    refreshesSincePresentation = 0;
  }

  function shouldPresent(now, targetFps) {
    if (!Number.isFinite(now)) return false;
    const nextTargetFps = Math.max(1, Number(targetFps) || 60);
    const targetInterval = 1000 / nextTargetFps;
    if (!previousRafAt || previousTargetFps !== nextTargetFps) {
      previousRafAt = now;
      previousTargetFps = nextTargetFps;
      accumulatorMs = 0;
      refreshesSincePresentation = 0;
      return true;
    }

    const rawDelta = Math.max(0, now - previousRafAt);
    previousRafAt = now;
    if (rawDelta > 0 && rawDelta < 50) {
      estimatedRefreshMs = estimatedRefreshMs
        ? estimatedRefreshMs * 0.82 + rawDelta * 0.18
        : rawDelta;
    }

    // ProMotion commonly reports about 118–120 rAF callbacks per second.
    // When the refresh/target ratio is effectively integral, callback-count
    // pacing is visually steadier than a time accumulator: exactly every
    // second refresh, rather than periodic 25ms + 8ms correction pairs.
    const refreshRatio = estimatedRefreshMs > 0 ? targetInterval / estimatedRefreshMs : 0;
    const integralCadence = Math.max(1, Math.round(refreshRatio));
    const integralOutputFps = estimatedRefreshMs > 0
      ? 1000 / estimatedRefreshMs / integralCadence
      : 0;
    const useIntegralCadence = Math.abs(integralOutputFps - nextTargetFps) / nextTargetFps <= 0.035;
    const droppedRefresh = estimatedRefreshMs > 0 && rawDelta > estimatedRefreshMs * 1.7;
    if (useIntegralCadence) {
      accumulatorMs = 0;
      if (droppedRefresh) {
        refreshesSincePresentation = 0;
        return true;
      }
      refreshesSincePresentation += 1;
      if (refreshesSincePresentation < integralCadence) return false;
      refreshesSincePresentation = 0;
      return true;
    }

    refreshesSincePresentation = 0;
    accumulatorMs += Math.min(rawDelta, targetInterval);
    if (accumulatorMs < targetInterval - Math.max(0, toleranceMs)) return false;
    accumulatorMs = Math.max(0, accumulatorMs - targetInterval);
    return true;
  }

  return Object.freeze({ reset, shouldPresent });
}
