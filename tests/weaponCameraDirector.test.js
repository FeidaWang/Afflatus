import { describe, it, expect } from 'vitest';
import { createWeaponCameraDirector } from '../src/combat/weaponCameraDirector.js';

// Minimal camera stand-in — mirrors THREE.Camera's public surface used by
// weaponCameraDirector.js (position.set + lookAt), so this whole module can
// be unit tested without a WebGL context (same rationale as arenaRules.js
// and weaponClock.js: pure/DOM-light logic gets a Node test before any
// browser-only integration).
function mockCamera() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    lookAtCalls: [],
    lookAt(x, y, z) { this.lookAtCalls.push({ x, y, z }); },
  };
}

// V18 Phase 1 (ROADMAP §4 chaseCam): a fuller mock exposing `up`/`fov`/
// `updateProjectionMatrix`, mirroring THREE.PerspectiveCamera's surface, to
// exercise the banking/dynamic-FOV path. The plain mockCamera() above
// intentionally lacks these so the existing tests double as a guarantee
// that shots without fov/roll fields never touch them (see weaponCameraDirector.js).
function mockCameraWithFovAndUp(startFov = 34) {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    up: { x: 0, y: 1, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    fov: startFov,
    updateProjectionMatrix() {},
    lookAtCalls: [],
    lookAt(x, y, z) { this.lookAtCalls.push({ x, y, z }); },
  };
}

function makeShots() {
  return {
    home: { priority: 1, compute: () => ({ pos: { x: 0, y: 10, z: 0 }, look: { x: 0, y: 0, z: 0 } }) },
    ciws: { priority: 2, compute: () => ({ pos: { x: 5, y: 4, z: 2 }, look: { x: 1, y: 1, z: 1 } }) },
    missile: { priority: 4, compute: () => ({ pos: { x: 9, y: 9, z: 9 }, look: { x: 2, y: 2, z: 2 } }) },
  };
}

describe('createWeaponCameraDirector', () => {
  it('starts on the home shot and converges the camera toward its target', () => {
    const camera = mockCamera();
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.1 });
    let now = 1000;
    for (let i = 0; i < 200; i++) { now += 16; d.update(now); }
    expect(d.currentShotId).toBe('home');
    expect(camera.position.y).toBeCloseTo(10, 0);
  });

  it('a higher-priority request preempts the home shot immediately', () => {
    const camera = mockCamera();
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.1 });
    const now = 1000;
    d.update(now);
    const accepted = d.requestShot('missile', { durationMs: 500, now });
    expect(accepted).toBe(true);
    expect(d.currentShotId).toBe('missile');
  });

  it('a same/lower-priority request is rejected while the current shot is still active', () => {
    const camera = mockCamera();
    const shots = makeShots();
    const d = createWeaponCameraDirector({ camera, shots, home: 'home', smoothTime: 0.1 });
    const now = 1000;
    d.update(now);
    d.requestShot('missile', { durationMs: 1000, now }); // priority 4, active until now+1000
    const rejected = d.requestShot('ciws', { durationMs: 500, now: now + 100 }); // priority 2 < 4, still active
    expect(rejected).toBe(false);
    expect(d.currentShotId).toBe('missile');
  });

  it('the director auto-returns to the home shot once a scripted shot expires', () => {
    const camera = mockCamera();
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.05 });
    let now = 1000;
    d.update(now);
    d.requestShot('ciws', { durationMs: 300, now });
    expect(d.currentShotId).toBe('ciws');
    now += 400; // past the 300ms window
    d.update(now);
    expect(d.currentShotId).toBe('home');
  });

  it('refresh:true on an already-active shot extends it without being rejected', () => {
    const camera = mockCamera();
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.05 });
    let now = 1000;
    d.update(now);
    d.requestShot('ciws', { durationMs: 300, now });
    now += 200;
    const refreshed = d.requestShot('ciws', { durationMs: 300, now, refresh: true });
    expect(refreshed).toBe(true);
    expect(d.currentShotId).toBe('ciws');
    now += 250; // would have expired under the ORIGINAL window (1000+300=1300), but refresh pushed it to 1200+300=1500
    d.update(now);
    expect(d.currentShotId).toBe('ciws');
  });

  it('never produces NaN/Infinity in camera position or lookAt across a shot switch', () => {
    const camera = mockCamera();
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.2 });
    let now = 1000;
    for (let i = 0; i < 50; i++) {
      now += 16;
      if (i === 10) d.requestShot('missile', { durationMs: 200, now });
      d.update(now);
      expect(Number.isFinite(camera.position.x)).toBe(true);
      expect(Number.isFinite(camera.position.y)).toBe(true);
      expect(Number.isFinite(camera.position.z)).toBe(true);
      const last = camera.lookAtCalls[camera.lookAtCalls.length - 1];
      expect(Number.isFinite(last.x) && Number.isFinite(last.y) && Number.isFinite(last.z)).toBe(true);
    }
  });

  it('a shot without fov/roll fields never touches camera.fov/up on a plain camera (backward compat)', () => {
    const camera = mockCamera(); // no `up`/`fov` at all
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.1 });
    for (let i = 0; i < 30; i++) d.update(1000 + i * 16);
    expect(camera.fov).toBeUndefined();
    expect(camera.up).toBeUndefined();
  });

  it('leaves fov/up untouched (home default) when the active shot sets neither', () => {
    const camera = mockCameraWithFovAndUp(34);
    const d = createWeaponCameraDirector({ camera, shots: makeShots(), home: 'home', smoothTime: 0.05 });
    for (let i = 0; i < 60; i++) d.update(1000 + i * 16);
    expect(camera.fov).toBeCloseTo(34, 1);
    expect(camera.up.x).toBeCloseTo(0, 5);
    expect(camera.up.y).toBeCloseTo(1, 5);
  });

  it('a chaseCam-style shot with fov/roll widens FOV and tilts up, then relaxes back on the home shot', () => {
    const camera = mockCameraWithFovAndUp(34);
    const shots = makeShots();
    shots.chase = {
      priority: 3,
      compute: () => ({ pos: { x: 1, y: 1, z: 1 }, look: { x: 0, y: 0, z: 0 }, fov: 70, roll: 0.3 }),
    };
    const d = createWeaponCameraDirector({ camera, shots, home: 'home', smoothTime: 0.05 });
    let now = 1000;
    d.update(now);
    d.requestShot('chase', { durationMs: 1500, now }); // outlasts the 60-frame (~960ms) check below
    for (let i = 0; i < 60; i++) { now += 16; d.update(now); }
    expect(camera.fov).toBeCloseTo(70, 0);
    expect(camera.up.y).toBeLessThan(1); // tilted away from the untouched default

    // once the scripted shot expires, the director auto-returns home, and
    // fov/up must relax back toward the untouched defaults (34, (0,1,0))
    for (let i = 0; i < 200; i++) { now += 16; d.update(now); }
    expect(d.currentShotId).toBe('home');
    expect(camera.fov).toBeCloseTo(34, 0);
    expect(camera.up.y).toBeCloseTo(1, 1);
  });
});
