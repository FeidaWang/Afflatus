const SIZE_SCALE = Object.freeze({
  small: 0.72,
  medium: 1,
  large: 1.48,
  giant: 2.08,
  unknown: 1,
});

const PHASE_CAMERA_CUES = Object.freeze({
  ciws: Object.freeze({ shot: 'ciwsTurret', durationMs: 3200, blendInMs: 260 }),
  offline: Object.freeze({ shot: 'offlineWide', durationMs: 4200, blendInMs: 360 }),
  nukeAuth: Object.freeze({ shot: 'nukeEscort', durationMs: 3400, blendInMs: 320 }),
  nemp: Object.freeze({ shot: 'nukeTerminal', durationMs: 2200, blendInMs: 140 }),
  mainGun: Object.freeze({ shot: 'mainGunBroadside', durationMs: 4600, blendInMs: 420 }),
  mosaic: Object.freeze({ shot: 'impactOrbit', durationMs: 1200, blendInMs: 120 }),
});

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Produces a readable optical signature before fire-control lock while still
 * letting lock quality intensify the coma and tails. Radius is authoritative
 * screen-space data, so it is combined with (rather than replaced by) the
 * discrete threat class.
 */
export function cometVisualProfile(target = {}) {
  const classScale = SIZE_SCALE[String(target.sizeClass || 'unknown')] || SIZE_SCALE.unknown;
  const radiusScale = clamp(finite(target.radius, 48) / 72, 0.64, 2.55);
  const scale = clamp(Math.max(classScale, radiusScale), 0.64, 2.55);
  const lock = target.locked ? 1 : clamp(finite(target.lockProgress), 0, 1);
  return Object.freeze({
    scale,
    lock,
    rockOpacity: 0.82 + lock * 0.18,
    ionOpacity: 0.78 + lock * 0.2,
    dustOpacity: 0.58 + lock * 0.22,
    comaOpacity: 0.4 + lock * 0.22,
  });
}

/**
 * Maps authoritative screen velocity into combat-scene axes and points the
 * visible wake backwards. The fallback retains the historical +Z wake when a
 * target has not yet reported a useful velocity.
 */
export function cometTailDirection(target = {}, viewportWidth = 1, viewportHeight = 1) {
  const sceneVx = finite(target.vx) * 52 / Math.max(1, finite(viewportWidth, 1));
  const sceneVz = finite(target.vy) * 32 / Math.max(1, finite(viewportHeight, 1));
  const length = Math.hypot(sceneVx, sceneVz);
  if (length < 1e-8) return Object.freeze({ x: 0, y: 0, z: 1 });
  return Object.freeze({ x: -sceneVx / length, y: 0, z: -sceneVz / length });
}

/** One named camera cue per HUD phase; event-driven weapon cuts may pre-empt it. */
export function phaseCameraCue(phase) {
  const cue = PHASE_CAMERA_CUES[String(phase || '')];
  return cue ? Object.freeze({ ...cue }) : null;
}
