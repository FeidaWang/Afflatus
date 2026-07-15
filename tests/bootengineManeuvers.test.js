import { describe, it, expect } from 'vitest';
import { planManeuver } from '../src/bootengine/maneuvers';
import { createCatmullRomPath } from '../src/bootengine/catmullRom';
import { createRng } from '../src/bootengine/seed';

const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const baseInput = {
  selfPos: { x: 0, y: 0, z: 0 },
  selfVel: { x: 5, y: 0, z: 0 },
  targetPos: { x: 30, y: 2, z: 10 },
  targetVel: { x: -3, y: 0, z: 1 },
};

const intents = ['tailChase', 'breakTurn', 'scissors', 'disengage', 'formationRejoin', 'holdFormation'];

describe('planManeuver — shape guarantees', () => {
  for (const intent of intents) {
    it(`${intent}: starts exactly at selfPos, ≥2 finite waypoints`, () => {
      const m = planManeuver({ ...baseInput, intent });
      expect(m.intent).toBe(intent);
      expect(m.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(dist(m.waypoints[0], baseInput.selfPos)).toBeLessThan(1e-9);
      for (const wp of m.waypoints) expect(finite(wp)).toBe(true);
    });

    it(`${intent}: waypoints feed createCatmullRomPath without throwing`, () => {
      const m = planManeuver({ ...baseInput, intent });
      expect(() => createCatmullRomPath(m.waypoints)).not.toThrow();
    });
  }
});

describe('planManeuver — determinism', () => {
  it('same inputs → identical waypoints (golden-set requirement)', () => {
    for (const intent of intents) {
      const a = planManeuver({ ...baseInput, intent, rng: createRng(7) });
      const b = planManeuver({ ...baseInput, intent, rng: createRng(7) });
      expect(a.waypoints).toEqual(b.waypoints);
    }
  });

  it('breakTurn honours the seeded rng for which side to turn', () => {
    // craft two seeds and just assert each seed is internally reproducible
    // AND that at least one of a small seed sweep picks each side (both
    // branches of the coin flip are actually reachable, not dead code).
    const sides = new Set();
    for (let seed = 0; seed < 20; seed++) {
      const m = planManeuver({ ...baseInput, intent: 'breakTurn', rng: createRng(seed) });
      const p1 = m.waypoints[1];
      const away = { x: baseInput.selfPos.x - baseInput.targetPos.x, y: baseInput.selfPos.y - baseInput.targetPos.y, z: baseInput.selfPos.z - baseInput.targetPos.z };
      // sign of the cross-product z-ish component tells us which side —
      // simpler: just bucket by p1.z sign relative to selfPos.z since the
      // scene is roughly planar in this test's geometry.
      sides.add(Math.sign(p1.z - baseInput.selfPos.z) || Math.sign(p1.y - baseInput.selfPos.y) || Math.sign(p1.x - baseInput.selfPos.x));
    }
    expect(sides.size).toBeGreaterThan(1);
  });

  it('omitting rng still gives a deterministic (fixed) result', () => {
    const a = planManeuver({ ...baseInput, intent: 'breakTurn' });
    const b = planManeuver({ ...baseInput, intent: 'breakTurn' });
    expect(a.waypoints).toEqual(b.waypoints);
  });
});

describe('planManeuver — degenerate geometry', () => {
  it('self and target at the same position never produces NaN', () => {
    for (const intent of intents) {
      const m = planManeuver({
        intent,
        selfPos: { x: 5, y: 5, z: 5 },
        selfVel: { x: 0, y: 0, z: 0 },
        targetPos: { x: 5, y: 5, z: 5 },
        targetVel: { x: 0, y: 0, z: 0 },
      });
      for (const wp of m.waypoints) expect(finite(wp)).toBe(true);
    }
  });
});
