/* ============================================================
   CAMERA MATH — pure numeric helpers for weaponCameraDirector.js (V14,
   ROADMAP §4). No THREE.js, no DOM — everything here is a plain-number
   function so the actual decision/damping logic can be unit tested without
   a WebGL context (see tests/cameraMath.test.js).
   ============================================================ */

// Classic critically-damped spring ("SmoothDamp"): eases `current` toward
// `target` over roughly `smoothTime` seconds, without the overshoot-then-
// correct wobble of an underdamped spring and without the "snaps at the
// end" feel of a raw lerp. Call once per axis per frame; `velocityRef` is a
// { v } box the caller keeps across frames (this function is otherwise
// stateless/pure — it reads and writes velocityRef.v, nothing else).
export function smoothDamp(current, target, velocityRef, smoothTime, dt, maxSpeed = Infinity) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * st;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const temp = (velocityRef.v + omega * change) * dt;
  velocityRef.v = (velocityRef.v - omega * temp) * exp;
  let result = current - change + (change + temp) * exp;
  // prevent overshoot past the target on the final approach
  if ((target - current > 0) === (result > target)) {
    result = target;
    velocityRef.v = 0;
  }
  return result;
}

// Priority preemption rule: a strictly-higher-priority request always cuts
// in immediately (nuke > missile > mainGun > ciws > idle). A request at the
// SAME or LOWER priority than what's currently playing only takes over once
// the current shot has run its full scripted duration — otherwise a busy
// scene could thrash between same-tier shots every frame.
export function shouldPreempt(currentPriority, currentEndsAt, requestedPriority, now) {
  if (requestedPriority > currentPriority) return true;
  return now >= currentEndsAt;
}

// 0..1 progress through a blend-in window since a shot became active —
// used to crossfade the previous camera pose into the new one instead of a
// hard cut (ROADMAP §4: "抢占用 0.3–0.5s 摄像机位姿插值缝合，不硬切").
export function blendFactor(elapsedSinceSwitchMs, blendInMs) {
  if (!(blendInMs > 0)) return 1;
  return Math.max(0, Math.min(1, elapsedSinceSwitchMs / blendInMs));
}

// Smoothstep easing for the blend factor (smoother than linear at the
// endpoints, matches the "insert not cut" language in the spec).
export function easeBlend(f) {
  const c = Math.max(0, Math.min(1, f));
  return c * c * (3 - 2 * c);
}

// ── V18 Phase 1 (ROADMAP §4 "V18 实施路线") ──────────────────────────────
// chaseCam preset math: dynamic FOV + banking, driven by acceleration (not
// elapsed time), plus the plain-vector camera placement itself. No THREE.js
// dependency, same rationale as the rest of this file.

// Widens FOV as acceleration magnitude rises (cruise → boost/ignition feel).
// accelScale is the magnitude at which FOV reaches boostFov; accelMag beyond
// that is clamped, not extrapolated.
export function fovForAccel(accelMag, { cruiseFov = 62, boostFov = 70, accelScale = 10 } = {}) {
  const f = Math.max(0, Math.min(1, Math.abs(accelMag) / Math.max(0.0001, accelScale)));
  return cruiseFov + (boostFov - cruiseFov) * f;
}

// Camera roll (radians), clamped to maxBank, driven by signed lateral
// (turning) acceleration — a lean into the turn, not a free-spinning roll.
export function bankAngle(lateralAccel, maxBank = 0.35, gain = 0.05) {
  return Math.max(-maxBank, Math.min(maxBank, lateralAccel * gain));
}

// THREE.Camera.up substitute for a given roll: tilting `up` before lookAt()
// is the standard way to bank a look-at camera. roll=0 reproduces the
// untouched default up vector (0,1,0) exactly, so this is safe to apply
// unconditionally ahead of every shot's lookAt, banking or not.
export function bankedUpVector(roll) {
  return { x: Math.sin(roll), y: Math.cos(roll), z: 0 };
}

// Chase-cam placement: camera sits `back` units behind the target along
// -forward, `up` units above, and `side` units along the right vector
// (forward × world-up), looking `lookAhead` units past the target so the
// shot reads as chasing into the direction of travel rather than staring at
// the target's tail. Plain {x,y,z} objects in, plain objects out — no THREE
// dependency, so this is unit-testable without a WebGL context.
export function chaseCamPose(targetPos, forward, { back = 6, up = 2.2, side = -2.5, lookAhead = 10 } = {}) {
  const flen = Math.hypot(forward.x, forward.y, forward.z) || 1;
  const fx = forward.x / flen, fy = forward.y / flen, fz = forward.z / flen;
  // right = forward × worldUp(0,1,0)
  let rx = -fz, ry = 0, rz = fx;
  const rlen = Math.hypot(rx, ry, rz) || 1;
  rx /= rlen; ry /= rlen; rz /= rlen;
  return {
    pos: {
      x: targetPos.x - fx * back + rx * side,
      y: targetPos.y - fy * back + up + ry * side,
      z: targetPos.z - fz * back + rz * side,
    },
    look: {
      x: targetPos.x + fx * lookAhead,
      y: targetPos.y + fy * lookAhead,
      z: targetPos.z + fz * lookAhead,
    },
  };
}
