import { describe, it, expect } from 'vitest';
import { createPidState, stepPid } from '../src/bootengine/pid';

// First-order lag plant: x' = -x + u (a stand-in for one rigidBody6dof axis
// under drag). Used to check the PID drives x to the setpoint and STAYS
// there — the "no divergence" half of the U29 P1 golden-set contract.
function simulate(gains, setpoint, steps, dt, opts) {
  const state = createPidState();
  let x = 0;
  const trace = [];
  for (let i = 0; i < steps; i++) {
    const u = stepPid(state, gains, setpoint - x, dt, opts);
    x = x + (-x + u) * dt;
    trace.push(x);
  }
  return trace;
}

describe('stepPid — step response', () => {
  it('converges to the setpoint without diverging', () => {
    const trace = simulate({ kp: 2, ki: 0.5, kd: 0.1 }, 10, 2000, 0.02);
    const last50 = trace.slice(-50);
    for (const x of last50) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Math.abs(x - 10)).toBeLessThan(0.5);
    }
  });

  it('never produces NaN/Infinity even with aggressive gains', () => {
    const trace = simulate({ kp: 50, ki: 20, kd: 5 }, 10, 200, 0.02, { outputLimit: 100 });
    for (const x of trace) expect(Number.isFinite(x)).toBe(true);
  });

  it('is deterministic given the same inputs (golden-set requirement)', () => {
    const a = simulate({ kp: 2, ki: 0.5, kd: 0.1 }, 10, 100, 0.02);
    const b = simulate({ kp: 2, ki: 0.5, kd: 0.1 }, 10, 100, 0.02);
    expect(a).toEqual(b);
  });
});

describe('stepPid — anti-windup', () => {
  it('clamps the integral accumulator so a saturated output does not overshoot on reversal', () => {
    const gains = { kp: 1, ki: 5, kd: 0 };
    const opts = { outputLimit: 10, integralLimit: 2 };
    const state = createPidState();
    // large constant error for a long time would normally wind up ki hard
    for (let i = 0; i < 500; i++) stepPid(state, gains, 100, 0.02, opts);
    expect(state.integral).toBeLessThanOrEqual(2 + 1e-9);
    // reverse the error sign: output should react quickly, not stay pinned
    // by a huge leftover integral term (the windup failure mode).
    const out = stepPid(state, gains, -100, 0.02, opts);
    expect(out).toBeLessThan(0);
  });

  it('output always respects outputLimit', () => {
    const state = createPidState();
    const out = stepPid(state, { kp: 1000, ki: 0, kd: 0 }, 999, 0.02, { outputLimit: 5 });
    expect(out).toBe(5);
  });
});
