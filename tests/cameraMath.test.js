import { describe, it, expect } from 'vitest';
import { smoothDamp, shouldPreempt, blendFactor, easeBlend } from '../src/combat/cameraMath.js';

describe('smoothDamp', () => {
  it('converges to the target over repeated frames without overshooting', () => {
    const vel = { v: 0 };
    let x = 0;
    const target = 100;
    for (let i = 0; i < 300; i++) {
      x = smoothDamp(x, target, vel, 0.3, 1 / 60);
      expect(x).toBeLessThanOrEqual(target + 0.001); // never overshoots past target
    }
    expect(x).toBeCloseTo(target, 1);
  });
  it('stays put when already at the target (no drift)', () => {
    const vel = { v: 0 };
    const x = smoothDamp(50, 50, vel, 0.3, 1 / 60);
    expect(x).toBeCloseTo(50, 5);
  });
  it('respects a maxSpeed clamp — approaches no faster than maxSpeed*smoothTime per step relative bound', () => {
    const vel = { v: 0 };
    const unclamped = smoothDamp(0, 1000, { v: 0 }, 0.2, 1 / 60);
    const clamped = smoothDamp(0, 1000, vel, 0.2, 1 / 60, 5); // very slow max speed
    expect(clamped).toBeLessThan(unclamped);
  });
  it('does not blow up with a very small smoothTime (near-instant snap)', () => {
    const vel = { v: 0 };
    const x = smoothDamp(0, 10, vel, 0.0001, 1 / 60);
    expect(Number.isFinite(x)).toBe(true);
  });
});

describe('shouldPreempt — camera shot priority rules', () => {
  it('a strictly higher priority request always preempts immediately', () => {
    // current: mainGun (priority 3) still has 5000ms left; missile (priority 4) requested now
    expect(shouldPreempt(3, Date.now() + 5000, 4, Date.now())).toBe(true);
  });
  it('an equal-priority request must wait for the current shot to finish', () => {
    const now = Date.now();
    expect(shouldPreempt(2, now + 500, 2, now)).toBe(false);
    expect(shouldPreempt(2, now - 1, 2, now)).toBe(true); // current shot already ended
  });
  it('a lower-priority request must wait for the current shot to finish', () => {
    const now = Date.now();
    expect(shouldPreempt(4, now + 200, 1, now)).toBe(false);
    expect(shouldPreempt(4, now - 1, 1, now)).toBe(true);
  });
  it('matches the documented weapon priority order end to end (nuke > missile > mainGun > ciws > idle)', () => {
    const PRI = { nuke: 5, missile: 4, mainGun: 3, ciws: 2, idle: 1 };
    const now = Date.now();
    // a ciws shot is playing; a nuke event comes in — must cut immediately
    expect(shouldPreempt(PRI.ciws, now + 9999, PRI.nuke, now)).toBe(true);
    // a nuke shot is playing; a ciws event comes in — must NOT interrupt it
    expect(shouldPreempt(PRI.nuke, now + 9999, PRI.ciws, now)).toBe(false);
  });
});

describe('blendFactor / easeBlend', () => {
  it('blendFactor is 0 right at the switch and 1 once the blend window elapses', () => {
    expect(blendFactor(0, 400)).toBe(0);
    expect(blendFactor(400, 400)).toBe(1);
    expect(blendFactor(200, 400)).toBeCloseTo(0.5, 5);
  });
  it('blendFactor clamps beyond the window instead of exceeding 1', () => {
    expect(blendFactor(9999, 400)).toBe(1);
  });
  it('a zero/undefined blendIn means an instant cut (fraction always 1)', () => {
    expect(blendFactor(0, 0)).toBe(1);
  });
  it('easeBlend smooths the endpoints but preserves 0 and 1', () => {
    expect(easeBlend(0)).toBe(0);
    expect(easeBlend(1)).toBe(1);
    expect(easeBlend(0.5)).toBeCloseTo(0.5, 5);
    // smoothstep is steeper in the middle than at the edges
    expect(easeBlend(0.1)).toBeLessThan(0.1 * 1.5);
  });
});
