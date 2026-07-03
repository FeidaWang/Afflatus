/* ============================================================
   WEAPON CAMERA DIRECTOR — shot state machine for the top-down combat
   scene (V14, ROADMAP §4). No THREE.js import here: it only needs a
   camera-like object exposing `.position.set(x,y,z)` and `.lookAt(x,y,z)`,
   so this file stays a thin, swappable layer over cameraMath.js's pure
   helpers (see tests/cameraMath.test.js for the math itself).

   Usage (see src/scene/topdownCombat.js for the live wiring):
     const director = createWeaponCameraDirector({ camera, shots: {...}, home: 'tacticalTopdown' });
     director.requestShot('missileTail', { durationMs: 1800 });
     director.update(now, ctx); // once per rendered frame

   Design notes:
   - A "shot" is `{ priority, compute(t, ctx) => {pos:{x,y,z}, look:{x,y,z}} }`.
     `t` is seconds since THIS shot became active (not scene time), so shot
     math can be written self-relative.
   - Preemption follows cameraMath.shouldPreempt: strictly-higher-priority
     shots cut in immediately; same/lower priority must wait for the
     current shot's scripted duration to elapse (see ROADMAP §4).
   - Frequently-firing shots (e.g. CIWS bursts) should call requestShot with
     `refresh: true` — if that shot is ALREADY active, this only extends its
     endsAt instead of restarting switchedAt/blend, so rapid-fire triggers
     don't cause a blend-restart stutter every ~600ms.
   - Position AND look-at target are both critically-damped (smoothDamp),
     independently per axis, so the camera itself never teleports even when
     the *target* pose jumps at a shot switch — the blend window then further
     crossfades the target pose itself for the first blendInMs.
   ============================================================ */
import { smoothDamp, shouldPreempt, blendFactor, easeBlend } from './cameraMath.js';

function vel3() { return { x: { v: 0 }, y: { v: 0 }, z: { v: 0 } }; }

export function createWeaponCameraDirector({ camera, shots, home, smoothTime = 0.55, maxSpeed = 60 }) {
  if (!shots || !shots[home]) throw new Error(`weaponCameraDirector: unknown home shot "${home}"`);

  let current = { id: home, priority: shots[home].priority, startedAt: 0, endsAt: 0, refreshable: false };
  let prevTarget = null;   // {pos, look} captured at the moment of the last switch, for blending
  let switchedAt = 0;
  let lastNow = 0;
  const posVel = vel3();
  const lookVel = vel3();
  let curPos = null, curLook = null; // smoothed render state, lazily seeded on first update

  function requestShot(id, { durationMs = 1600, blendInMs = 350, refresh = false, now = Date.now() } = {}) {
    const def = shots[id];
    if (!def) return false;
    if (refresh && current.id === id) {
      // idempotent refresh: extend the window, don't restart the blend
      current.endsAt = now + durationMs;
      return true;
    }
    if (!shouldPreempt(current.priority, current.endsAt, def.priority, now)) return false;
    prevTarget = curPos && curLook ? { pos: { ...curPos }, look: { ...curLook } } : null;
    switchedAt = now;
    current = { id, priority: def.priority, startedAt: now, endsAt: now + durationMs, blendInMs };
    return true;
  }

  function update(now, ctx = {}) {
    if (!lastNow) lastNow = now;
    const dt = Math.max(0, Math.min(0.1, (now - lastNow) / 1000)); // clamp huge tab-switch gaps
    lastNow = now;

    // auto-return to the home shot once a scripted (non-home) shot expires
    if (current.id !== home && current.endsAt > 0 && now >= current.endsAt) {
      requestShot(home, { durationMs: 0, blendInMs: shots[home].blendInMs ?? 400, now });
    }

    const def = shots[current.id];
    const tShot = (now - current.startedAt) / 1000;
    let target = def.compute(tShot, ctx);

    if (prevTarget && current.blendInMs > 0) {
      const f = easeBlend(blendFactor(now - switchedAt, current.blendInMs));
      target = {
        pos: {
          x: prevTarget.pos.x + (target.pos.x - prevTarget.pos.x) * f,
          y: prevTarget.pos.y + (target.pos.y - prevTarget.pos.y) * f,
          z: prevTarget.pos.z + (target.pos.z - prevTarget.pos.z) * f,
        },
        look: {
          x: prevTarget.look.x + (target.look.x - prevTarget.look.x) * f,
          y: prevTarget.look.y + (target.look.y - prevTarget.look.y) * f,
          z: prevTarget.look.z + (target.look.z - prevTarget.look.z) * f,
        },
      };
      if (f >= 1) prevTarget = null; // blend finished, stop paying the extra lerp
    }

    if (!curPos) { curPos = { ...target.pos }; curLook = { ...target.look }; }
    curPos = {
      x: smoothDamp(curPos.x, target.pos.x, posVel.x, smoothTime, dt, maxSpeed),
      y: smoothDamp(curPos.y, target.pos.y, posVel.y, smoothTime, dt, maxSpeed),
      z: smoothDamp(curPos.z, target.pos.z, posVel.z, smoothTime, dt, maxSpeed),
    };
    curLook = {
      x: smoothDamp(curLook.x, target.look.x, lookVel.x, smoothTime, dt, maxSpeed),
      y: smoothDamp(curLook.y, target.look.y, lookVel.y, smoothTime, dt, maxSpeed),
      z: smoothDamp(curLook.z, target.look.z, lookVel.z, smoothTime, dt, maxSpeed),
    };

    camera.position.set(curPos.x, curPos.y, curPos.z);
    camera.lookAt(curLook.x, curLook.y, curLook.z);
  }

  return {
    requestShot,
    update,
    get currentShotId() { return current.id; },
  };
}
