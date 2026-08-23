export const MOTION_STORAGE_KEY = 'afflatus:motion:v1';
export const MOTION_ON = 'on';
export const MOTION_OFF = 'off';

function readStoredValue(storage) {
  try {
    const value = storage?.getItem?.(MOTION_STORAGE_KEY);
    return value === MOTION_ON || value === MOTION_OFF ? value : null;
  } catch {
    return null;
  }
}
function systemPrefersReducedMotion(matchMedia) {
  try {
    return Boolean(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function resolveMotionPreference({ storage, matchMedia, forceReduced = false } = {}) {
  if (forceReduced) return { enabled: false, source: 'experience' };

  const stored = readStoredValue(storage);
  if (stored) return { enabled: stored === MOTION_ON, source: 'stored' };

  return {
    enabled: !systemPrefersReducedMotion(matchMedia),
    source: 'system',
  };
}

export function persistMotionPreference(storage, enabled) {
  try {
    storage?.setItem?.(MOTION_STORAGE_KEY, enabled ? MOTION_ON : MOTION_OFF);
    return true;
  } catch {
    return false;
  }
}
