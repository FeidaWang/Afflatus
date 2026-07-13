import { describe, it, expect } from 'vitest';
import {
  hermiteSegment, createLaunchPath, createLandingPath,
  LAUNCH_PHASES, LANDING_PHASES,
} from '../src/combat/flightPath.js';
import { activePhase } from '../src/combat/weaponClock.js';

// ── mock world (analytic, so expected velocities are exact) ──────────────
// deck: patrols x like the capital (-2 + sin(t*0.25)*6 at z=17), vel analytic
const deck = (tMs) => {
  const t = tMs / 1000;
  return {
    pos: { x: -2 + Math.sin(t * 0.25) * 6, y: 2.6, z: 17 },
    vel: { x: Math.cos(t * 0.25) * 1.5, y: 0, z: 0 },
  };
};
// formation: strafe ring like the scene's fighters (analytic derivative)
const formation = (tMs) => {
  const t = tMs / 1000, w = 1.1, ph = t * w;
  return {
    pos: { x: Math.cos(ph) * 16, y: 1.4 + Math.sin(ph * 2) * 0.6, z: -2 + Math.sin(ph) * 9 },
    vel: { x: -Math.sin(ph) * 16 * w, y: Math.cos(ph * 2) * 1.2 * w, z: Math.cos(ph) * 9 * w },
  };
};
const deckDir = { x: 0, y: 0, z: -1 }; // carrier front = -Z (scene convention)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('hermiteSegment', () => {
  it('hits both endpoints with both velocities', () => {
    const p0 = { x: 0, y: 0, z: 0 }, v0 = { x: 2, y: 0, z: 0 };
    const p1 = { x: 10, y: 4, z: -6 }, v1 = { x: 0, y: -1, z: 3 };
    const seg = hermiteSegment(p0, v0, p1, v1, 2000);
    expect(dist(seg.pos(0), p0)).toBeLessThan(1e-9);
    expect(dist(seg.pos(2000), p1)).toBeLessThan(1e-9);
    expect(dist(seg.vel(0), v0)).toBeLessThan(1e-6);
    expect(dist(seg.vel(2000), v1)).toBeLessThan(1e-6);
  });
});

describe('createLaunchPath', () => {
  const T0 = 12345;
  const path = createLaunchPath({ deck, deckDir, formation, t0: T0 });

  it('starts ON the deck, moving WITH the deck', () => {
    const s = path.sample(T0);
    expect(dist(s.pos, deck(T0).pos)).toBeLessThan(1e-9);
    expect(dist(s.vel, deck(T0).vel)).toBeLessThan(1e-6);
    expect(s.phase).toBe('catapult');
  });

  it('is C1-continuous at every phase boundary (< pos 1e-3 / vel 5e-2)', () => {
    for (const b of [1200, 2600, 5200]) {
      const before = path.sample(T0 + b - 1), after = path.sample(T0 + b + 1);
      expect(dist(before.pos, after.pos)).toBeLessThan(0.05); // ≤ ~2ms of travel
      expect(dist(before.vel, after.vel)).toBeLessThan(0.35);
    }
  });

  it('is exactly on the analytic formation from join onward', () => {
    for (const dt of [0, 100, 1000, 5000]) {
      const t = T0 + 5200 + dt;
      const s = path.sample(t), f = formation(t);
      expect(dist(s.pos, f.pos)).toBeLessThan(1e-9);
      expect(dist(s.vel, f.vel)).toBeLessThan(1e-6);
      expect(s.done).toBe(true);
    }
  });

  it('never produces NaN across a dense sweep (incl. before t0)', () => {
    for (let s = -200; s <= 7000; s += 37) {
      const smp = path.sample(T0 + s);
      expect(finite(smp.pos) && finite(smp.vel)).toBe(true);
    }
  });

  it('phase table drives weaponClock.activePhase()', () => {
    expect(activePhase(path.timeline, T0 + 100)).toBe('catapult');
    expect(activePhase(path.timeline, T0 + 1300)).toBe('rotate');
    expect(activePhase(path.timeline, T0 + 3000)).toBe('climb');
    expect(activePhase(path.timeline, T0 + 6000)).toBe('join');
  });
});

describe('createLandingPath', () => {
  const T0 = 98765;
  const path = createLandingPath({ deck, deckDir, formation, t0: T0 });

  it('starts exactly at the formation slot (pos AND vel)', () => {
    const s = path.sample(T0), f = formation(T0);
    expect(dist(s.pos, f.pos)).toBeLessThan(1e-9);
    expect(dist(s.vel, f.vel)).toBeLessThan(1e-6);
    expect(s.phase).toBe('break');
  });

  it('is C1-continuous at every phase boundary', () => {
    for (const b of [1600, 4200, 5200]) {
      const before = path.sample(T0 + b - 1), after = path.sample(T0 + b + 1);
      expect(dist(before.pos, after.pos)).toBeLessThan(0.05);
      expect(dist(before.vel, after.vel)).toBeLessThan(0.35);
    }
  });

  it('comes to rest ON the moving deck after touchdown', () => {
    for (const dt of [0, 500, 3000]) {
      const t = T0 + 5200 + dt;
      const s = path.sample(t), d = deck(t);
      expect(s.done).toBe(true);
      expect(dist(s.pos, d.pos)).toBeLessThan(1e-6); // parked exactly on the deck point
      expect(dist(s.vel, d.vel)).toBeLessThan(1e-6); // moving WITH the deck
    }
  });

  it('never produces NaN across a dense sweep', () => {
    for (let s = -200; s <= 8000; s += 37) {
      const smp = path.sample(T0 + s);
      expect(finite(smp.pos) && finite(smp.vel)).toBe(true);
    }
  });

  it('phase tables are exported and ordered', () => {
    const order = (ps) => ps.every((p, i) => i === 0 || ps[i - 1].at < p.at);
    expect(order(LAUNCH_PHASES)).toBe(true);
    expect(order(LANDING_PHASES)).toBe(true);
  });
});
