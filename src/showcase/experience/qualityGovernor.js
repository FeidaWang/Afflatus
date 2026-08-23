import { RENDER_BUDGETS, RESOURCE_MATRIX } from './qualityProfile.js';

export const GOVERNOR_THRESHOLDS = Object.freeze({
  cooldownMs: 5_000,
  restoreFrameMs: 14,
  restoreSustainMs: 5_000,
  slowFrameMs: 22,
  slowSustainMs: 2_000,
});

function maxLevel(profile) {
  return RESOURCE_MATRIX[profile]?.bloom ? 3 : 2;
}

export function qualitySettingsForLevel(profile, level = 0) {
  const budget = RENDER_BUDGETS[profile] || RENDER_BUDGETS.mobile;
  const resources = RESOURCE_MATRIX[profile] || RESOURCE_MATRIX.mobile;
  const boundedLevel = Math.max(0, Math.min(maxLevel(profile), Math.round(Number(level) || 0)));
  return Object.freeze({
    bloomEnabled: resources.bloom && boundedLevel < 3,
    degradationLevel: boundedLevel,
    dpr: boundedLevel >= 1 ? budget.degradedDpr : budget.dpr,
    dustEnabled: resources.dust && boundedLevel < 2,
  });
}

export function createQualityGovernor({
  profile = 'high',
  thresholds = GOVERNOR_THRESHOLDS,
} = {}) {
  let level = 0;
  let averageFrameMs = 0;
  let sampleCount = 0;
  let slowSince = null;
  let fastSince = null;
  let cooldownUntil = 0;
  let lastChange = 'baseline';

  const snapshot = () => Object.freeze({
    ...qualitySettingsForLevel(profile, level),
    averageFrameMs,
    cooldownUntil,
    lastChange,
    profile,
  });

  return Object.freeze({
    getSnapshot: snapshot,
    sample(frameMs, now = performance.now()) {
      const duration = Number(frameMs);
      const timestamp = Number(now);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(timestamp)) return snapshot();

      sampleCount += 1;
      averageFrameMs = sampleCount === 1
        ? duration
        : averageFrameMs * 0.9 + duration * 0.1;

      if (averageFrameMs > thresholds.slowFrameMs) {
        slowSince ??= timestamp;
        fastSince = null;
      } else if (averageFrameMs < thresholds.restoreFrameMs) {
        fastSince ??= timestamp;
        slowSince = null;
      } else {
        slowSince = null;
        fastSince = null;
      }

      if (timestamp >= cooldownUntil
        && slowSince !== null
        && timestamp - slowSince >= thresholds.slowSustainMs
        && level < maxLevel(profile)) {
        level += 1;
        lastChange = ['baseline', 'reduce-dpr', 'disable-dust', 'disable-bloom'][level];
        cooldownUntil = timestamp + thresholds.cooldownMs;
        slowSince = null;
      } else if (timestamp >= cooldownUntil
        && fastSince !== null
        && timestamp - fastSince >= thresholds.restoreSustainMs
        && level > 0) {
        lastChange = ['restore-baseline', 'restore-dpr', 'restore-dust', 'restore-bloom'][level];
        level -= 1;
        cooldownUntil = timestamp + thresholds.cooldownMs;
        fastSince = null;
      }

      return snapshot();
    },
  });
}
