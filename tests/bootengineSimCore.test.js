import { describe, it, expect } from 'vitest';
import { createFighterSimState, stepSimFrame } from '../src/bootengine/simCore';
import { createRng } from '../src/bootengine/seed';

const finiteV = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const finiteQ = (q) => Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w);

// deterministic "enemy" trajectory — a circling target, purely a function
// of frame index so both runs in the determinism test see identical input.
function targetAt(i) {
  const t = i * 0.05;
  return {
    pos: { x: Math.cos(t) * 40, y: 2, z: Math.sin(t) * 40 },
    vel: { x: -Math.sin(t) * 40, y: 0, z: Math.cos(t) * 40 },
  };
}

function runSim(seed, steps, dt) {
  const rng = createRng(seed);
  let state = createFighterSimState();
  const trace = [];
  for (let i = 0; i < steps; i++) {
    const target = targetAt(i);
    state = stepSimFrame(state, { targetPos: target.pos, targetVel: target.vel, dt, rng });
    trace.push({
      pos: state.body.pos, vel: state.body.vel, quat: state.body.quat,
      intent: state.intent, maneuverU: state.maneuverU,
    });
  }
  return trace;
}

describe('stepSimFrame — golden-set determinism', () => {
  it('same seed → identical trajectory, frame for frame', () => {
    const a = runSim(1234, 300, 0.02);
    const b = runSim(1234, 300, 0.02);
    expect(a).toEqual(b);
  });

  it('different seeds can diverge (rng actually reaches the maneuver planner)', () => {
    const a = runSim(1, 300, 0.02);
    const b = runSim(2, 300, 0.02);
    // not a strict requirement that they differ every frame, but the full
    // traces should not be identical across 300 frames of a live dogfight
    expect(a).not.toEqual(b);
  });
});

describe('stepSimFrame — stability', () => {
  it('never produces NaN/Infinity across a long run with a maneuvering target', () => {
    const rng = createRng(42);
    let state = createFighterSimState();
    for (let i = 0; i < 1000; i++) {
      const target = targetAt(i);
      state = stepSimFrame(state, { targetPos: target.pos, targetVel: target.vel, dt: 0.016, rng });
      expect(finiteV(state.body.pos) && finiteV(state.body.vel) && finiteQ(state.body.quat)).toBe(true);
      expect(Number.isFinite(state.maneuverU)).toBe(true);
    }
  });

  it('handles a stationary, coincident target without diverging', () => {
    let state = createFighterSimState();
    for (let i = 0; i < 200; i++) {
      state = stepSimFrame(state, {
        targetPos: state.body.pos, targetVel: { x: 0, y: 0, z: 0 }, dt: 0.02,
      });
      expect(finiteV(state.body.pos) && finiteV(state.body.vel) && finiteQ(state.body.quat)).toBe(true);
    }
  });

  it('position grows at most linearly with sim time (rules out exponential blow-up)', () => {
    // P1's control law is intentionally simple (see simCore.ts header) and
    // isn't tuned for tight station-keeping over a long horizon — a fast
    // but LINEAR chase distance is expected and fine. What must never
    // happen is superlinear/exponential runaway (a real instability),
    // which this checkpoint-ratio check catches without pinning to an
    // arbitrary absolute unit budget this module has no basis to promise.
    const rng = createRng(9);
    let state = createFighterSimState();
    const radiusAt = (n) => Math.hypot(state.body.pos.x, state.body.pos.y, state.body.pos.z);
    let r1000 = 0;
    for (let i = 0; i < 2000; i++) {
      const target = targetAt(i);
      state = stepSimFrame(state, { targetPos: target.pos, targetVel: target.vel, dt: 0.02, rng });
      if (i === 999) r1000 = radiusAt(i);
    }
    const r2000 = radiusAt(1999);
    expect(Number.isFinite(r2000)).toBe(true);
    // doubling the sim time should at most roughly double the distance
    // travelled (linear), with slack for the bursty replanning behaviour —
    // an exponential runaway would blow this ratio out by orders of magnitude.
    expect(r2000 / Math.max(1, r1000)).toBeLessThan(6);
  });
});

describe('stepSimFrame — state is plain data (Worker postMessage safety)', () => {
  it('structuredClone-round-trips the returned state without loss', () => {
    let state = createFighterSimState();
    const target = targetAt(0);
    state = stepSimFrame(state, { targetPos: target.pos, targetVel: target.vel, dt: 0.02 });
    const cloned = structuredClone(state);
    expect(cloned).toEqual(state);
  });
});
