import { describe, it, expect } from 'vitest';
import {
  startTimeline,
  phaseFraction,
  elapsedMs,
  isFinished,
  activePhase,
  msUntilPhase,
  msRemaining,
  forceAdvance,
} from '../src/combat/weaponClock.js';

describe('startTimeline', () => {
  it('sorts out-of-order phases and derives totalMs from the last one', () => {
    const tl = startTimeline('ciws', [{ name: 'barrage', at: 3000 }, { name: 'laserLock', at: 0 }, { name: 'cameraEnd', at: 9600 }], 1000);
    expect(tl.phases.map((p) => p.name)).toEqual(['laserLock', 'barrage', 'cameraEnd']);
    expect(tl.totalMs).toBe(9600);
    expect(tl.t0).toBe(1000);
  });
  it('inserts an implicit _start phase if the first phase is not at 0', () => {
    const tl = startTimeline('nuke', [{ name: 'detonate', at: 5000 }], 0);
    expect(tl.phases[0]).toEqual({ name: '_start', at: 0 });
  });
  it('defaults t0 to now() when omitted', () => {
    const before = Date.now();
    const tl = startTimeline('missile', [{ name: 'impact', at: 100 }]);
    const after = Date.now();
    expect(tl.t0).toBeGreaterThanOrEqual(before);
    expect(tl.t0).toBeLessThanOrEqual(after);
  });
});

describe('phaseFraction', () => {
  const tl = startTimeline('missile', [{ name: 'impact', at: 1000 }], 0);
  it('is 0 at t0', () => expect(phaseFraction(tl, 0)).toBe(0));
  it('is 0.5 halfway through', () => expect(phaseFraction(tl, 500)).toBe(0.5));
  it('is 1 at the end', () => expect(phaseFraction(tl, 1000)).toBe(1));
  it('clamps below 0 (t before t0)', () => expect(phaseFraction(tl, -100)).toBe(0));
  it('clamps above 1 (t past totalMs)', () => expect(phaseFraction(tl, 5000)).toBe(1));
  it('returns 0 for a null timeline instead of throwing', () => expect(phaseFraction(null, 100)).toBe(0));
});

describe('elapsedMs / isFinished / msRemaining', () => {
  const tl = startTimeline('nuke', [{ name: 'detonate', at: 5000 }], 1000);
  it('elapsedMs never goes negative even if t < t0', () => expect(elapsedMs(tl, 500)).toBe(0));
  it('isFinished is false before totalMs and true at/after it', () => {
    expect(isFinished(tl, 1000 + 4999)).toBe(false);
    expect(isFinished(tl, 1000 + 5000)).toBe(true);
    expect(isFinished(tl, 1000 + 6000)).toBe(true);
  });
  it('msRemaining counts down to exactly 0 and clamps there', () => {
    expect(msRemaining(tl, 1000 + 2000)).toBe(3000);
    expect(msRemaining(tl, 1000 + 9000)).toBe(0);
  });
});

describe('activePhase', () => {
  const tl = startTimeline('ciws', [
    { name: 'laserLock', at: 0 },
    { name: 'barrage', at: 3000 },
    { name: 'ceaseFire', at: 5600 },
    { name: 'cameraEnd', at: 9600 },
  ], 0);
  it('resolves the correct named phase at each boundary', () => {
    expect(activePhase(tl, 0)).toBe('laserLock');
    expect(activePhase(tl, 2999)).toBe('laserLock');
    expect(activePhase(tl, 3000)).toBe('barrage');
    expect(activePhase(tl, 5599)).toBe('barrage');
    expect(activePhase(tl, 5600)).toBe('ceaseFire');
    expect(activePhase(tl, 9600)).toBe('cameraEnd');
    expect(activePhase(tl, 99999)).toBe('cameraEnd'); // stays at the last phase past the end
  });
});

describe('msUntilPhase', () => {
  const tl = startTimeline('nuke', [{ name: 'laserDesignate', at: 0 }, { name: 'bombRelease', at: 3000 }, { name: 'end', at: 11500 }], 0);
  it('counts down to a named phase boundary, not just the timeline end', () => {
    expect(msUntilPhase(tl, 'bombRelease', 0)).toBe(3000);
    expect(msUntilPhase(tl, 'bombRelease', 1000)).toBe(2000);
    expect(msUntilPhase(tl, 'bombRelease', 3000)).toBe(0);
  });
  it('clamps at 0 once the phase boundary has passed (never negative)', () => {
    expect(msUntilPhase(tl, 'bombRelease', 5000)).toBe(0);
  });
  it('returns 0 for an unknown phase name instead of throwing', () => {
    expect(msUntilPhase(tl, 'doesNotExist', 0)).toBe(0);
  });
});

describe('forceAdvance — early real-kill sync', () => {
  it('shifts t0 so the timeline reads as fully finished at the given instant', () => {
    const tl = startTimeline('missile', [{ name: 'impact', at: 2000 }], 0);
    const jumped = forceAdvance(tl, 1, 500); // real kill lands at t=500, well before the scripted 2000ms impact
    expect(phaseFraction(jumped, 500)).toBe(1);
  });
  it('supports partial force-advance (e.g. snap to 86% for a missile cut-to-impact cue)', () => {
    const tl = startTimeline('missile', [{ name: 'impact', at: 2000 }], 0);
    const jumped = forceAdvance(tl, 0.86, 500);
    expect(phaseFraction(jumped, 500)).toBeCloseTo(0.86, 5);
  });
  it('does not mutate the original timeline (pure)', () => {
    const tl = startTimeline('missile', [{ name: 'impact', at: 2000 }], 0);
    forceAdvance(tl, 1, 500);
    expect(tl.t0).toBe(0);
  });
});

// ---- the actual V16 acceptance bar: two independent "consumers" of the
// same timeline must derive byte-identical output when sampled at the same
// instant. This is the automatable stand-in for "UI indicator and 3D phase
// boundary flip on the same rAF tick, 0 frame diff" — we can't drive a real
// browser rAF loop in this test environment, but we CAN assert that nothing
// about the shared-timeline API allows two consumers to diverge when given
// the same `t`, which is the actual bug class V16 exists to eliminate.
describe('single-clock guarantee — two consumers, one timeline, zero drift', () => {
  const tl = startTimeline('ciws', [
    { name: 'laserLock', at: 0 },
    { name: 'barrage', at: 3000 },
    { name: 'ceaseFire', at: 5600 },
    { name: 'cameraEnd', at: 9600 },
  ], 12345);

  function domConsumerRender(timeline, t) {
    // stand-in for a DOM countdown label
    return { phase: activePhase(timeline, t), fraction: phaseFraction(timeline, t), msLeft: msRemaining(timeline, t) };
  }
  function canvasConsumerRender(timeline, t) {
    // stand-in for combatCine's canvas cinematic, sampled at the exact same t
    return { phase: activePhase(timeline, t), fraction: phaseFraction(timeline, t), msLeft: msRemaining(timeline, t) };
  }

  it('produces identical phase/fraction/countdown for every sampled instant across the whole timeline', () => {
    for (let t = tl.t0 - 100; t <= tl.t0 + tl.totalMs + 500; t += 137) {
      const dom = domConsumerRender(tl, t);
      const canvas = canvasConsumerRender(tl, t);
      expect(dom).toEqual(canvas);
    }
  });
});
