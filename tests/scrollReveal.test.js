import { describe, it, expect } from 'vitest';
import { revealProgress, chase, easeOutQuad, revealClipPath, revealClipPathX } from '../src/lib/scrollReveal.js';

describe('revealProgress', () => {
  const VH = 800;

  it('is 0 while the section center is at or below 70% viewport height', () => {
    // rectTop chosen so center == 0.70*VH exactly
    const rectTop = VH * 0.70 - 50, rectHeight = 100; // center = VH*0.70
    expect(revealProgress(rectTop, rectHeight, VH)).toBe(0);
    // further below (center lower on screen, i.e. larger rectTop) stays clamped at 0
    expect(revealProgress(rectTop + 200, rectHeight, VH)).toBe(0);
  });

  it('is 1 once the section center has risen to or above 40% viewport height', () => {
    const rectTop = VH * 0.40 - 50, rectHeight = 100; // center = VH*0.40
    expect(revealProgress(rectTop, rectHeight, VH)).toBe(1);
    expect(revealProgress(rectTop - 200, rectHeight, VH)).toBe(1);
  });

  it('is exactly 0.5 halfway through the trigger window', () => {
    const mid = VH * 0.55; // halfway between 70% and 40%
    const rectTop = mid - 50, rectHeight = 100;
    expect(revealProgress(rectTop, rectHeight, VH)).toBeCloseTo(0.5, 6);
  });

  it('clamps for degenerate/negative inputs instead of returning out-of-range values', () => {
    expect(revealProgress(-99999, 100, VH)).toBe(1);
    expect(revealProgress(99999, 100, VH)).toBe(0);
    expect(revealProgress(0, 0, VH)).toBeGreaterThanOrEqual(0);
    expect(revealProgress(0, 0, VH)).toBeLessThanOrEqual(1);
  });
});

describe('chase', () => {
  it('moves monotonically toward the target from below', () => {
    // 180 steps @ 1/60s = 3s elapsed ≈ 3.75*tau, well past convergence
    let v = 0;
    let prev = v;
    for (let i = 0; i < 180; i++) {
      v = chase(v, 1, 1 / 60);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
    expect(v).toBeGreaterThan(0.9);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('moves monotonically toward the target from above', () => {
    let v = 1;
    let prev = v;
    for (let i = 0; i < 180; i++) {
      v = chase(v, 0, 1 / 60);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
    expect(v).toBeLessThan(0.1);
  });

  it('never overshoots the target', () => {
    const v = chase(0, 1, 5); // huge dt
    expect(v).toBeLessThanOrEqual(1);
    expect(v).toBeGreaterThan(0.99);
  });

  it('is a no-op for zero/negative dt', () => {
    expect(chase(0.3, 1, 0)).toBe(0.3);
    expect(chase(0.3, 1, -1)).toBe(0.3);
  });

  it('is frame-rate independent: same total elapsed time converges to ~the same value at 30fps and 120fps', () => {
    const totalSec = 1.0;
    let v30 = 0;
    for (let t = 0; t < totalSec; t += 1 / 30) v30 = chase(v30, 1, 1 / 30);
    let v120 = 0;
    for (let t = 0; t < totalSec; t += 1 / 120) v120 = chase(v120, 1, 1 / 120);
    expect(Math.abs(v30 - v120)).toBeLessThan(0.01);
  });
});

describe('easeOutQuad', () => {
  it('maps 0->0 and 1->1', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
  });

  it('is front-loaded (ease-out: past the midpoint by t=0.5)', () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps outside [0,1]', () => {
    expect(easeOutQuad(-1)).toBe(0);
    expect(easeOutQuad(2)).toBe(1);
  });
});

describe('revealClipPath / revealClipPathX', () => {
  it('fully open (e=1) collapses to a zero-inset, zero-radius clip', () => {
    expect(revealClipPath(1, 1000)).toBe('inset(0.00px 0.00px round 0.00px)');
    expect(revealClipPathX(1, 1000)).toBe('inset(0px 0.00px round 0px)');
  });

  it('e=0 uses the full anchor inset scaled to element width', () => {
    expect(revealClipPath(0, 1000)).toBe('inset(24.00px 77.00px round 24.00px)');
    expect(revealClipPathX(0, 1000)).toBe('inset(0px 77.00px round 0px)');
  });

  it('scales the horizontal inset with element width', () => {
    const narrow = revealClipPath(0, 100);
    const wide = revealClipPath(0, 2000);
    expect(narrow).toContain('7.70px');
    expect(wide).toContain('154.00px');
  });
});
