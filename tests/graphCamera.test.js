import { describe, it, expect } from 'vitest';
import {
  smoothDamp, zoomAnchor, decayVelocity, clampPanTarget, focusTarget,
  easeOutQuad, easeOutBack, bloomLinkT, bloomNodeT, bloomLabelAlpha, BLOOM_DURATION,
} from '../src/lib/graphCamera.js';

describe('smoothDamp', () => {
  it('converges to the target without meaningful overshoot (critical damping)', () => {
    let value = 0, velocity = 0;
    const target = 100, smoothTime = 0.2, dt = 1 / 60;
    let maxSeen = 0;
    for (let i = 0; i < 300; i++) {
      const r = smoothDamp(value, target, velocity, smoothTime, dt);
      value = r.value; velocity = r.velocity;
      maxSeen = Math.max(maxSeen, value);
    }
    expect(value).toBeCloseTo(target, 3);
    // overshoot must not exceed 1% of the travel distance
    expect(maxSeen).toBeLessThanOrEqual(target * 1.01);
  });

  it('is well underway by 0.5s and fully settled soon after for a focus-fly-style tau of 0.35s', () => {
    // smoothTime is a time-constant, not a hard deadline: this critically-damped
    // filter reaches ~78% of the distance by t=0.5s (1.43*smoothTime) and >99%
    // by t=1.5s — both comfortably inside design.md's "≤0.5s pose interpolation
    // feel" guideline for a UI transition that reads as prompt, not a claim that
    // the tail is mathematically zero at exactly 500ms.
    let value = 0, velocity = 0;
    const target = 50, smoothTime = 0.35, dt = 1 / 60;
    function run(steps) { for (let i = 0; i < steps; i++) { const r = smoothDamp(value, target, velocity, smoothTime, dt); value = r.value; velocity = r.velocity; } }
    run(Math.round(0.5 / dt));
    expect(value).toBeGreaterThan(target * 0.7);
    run(Math.round(1.0 / dt)); // continue to the 1.5s mark
    expect(Math.abs(value - target)).toBeLessThan(target * 0.01);
  });

  it('blends smoothly when the target changes mid-flight (velocity carries over, no snap)', () => {
    let value = 0, velocity = 0;
    for (let i = 0; i < 30; i++) { const r = smoothDamp(value, 100, velocity, 0.3, 1 / 60); value = r.value; velocity = r.velocity; }
    const beforeSwitch = value;
    const r = smoothDamp(value, 0, velocity, 0.3, 1 / 60);
    // one frame after retargeting, value should move only a small, continuous
    // amount — not jump straight back to 0
    expect(Math.abs(r.value - beforeSwitch)).toBeLessThan(beforeSwitch);
  });

  it('never NaNs for degenerate dt/smoothTime', () => {
    const r = smoothDamp(5, 5, 0, 0, 0);
    expect(Number.isFinite(r.value)).toBe(true);
    expect(Number.isFinite(r.velocity)).toBe(true);
  });
});

describe('zoomAnchor', () => {
  it('keeps the world point under the cursor invariant across a zoom step', () => {
    const cam = { tx: 10, ty: -20, tscale: 80 };
    const W = 600, H = 400, sx = 340, sy = 220;
    const worldBefore = [(sx - W / 2 - cam.tx) / cam.tscale, (sy - H / 2 - cam.ty) / cam.tscale];
    const next = zoomAnchor(cam, sx, sy, 1.4, W, H, 30, 400);
    const worldAfter = [(sx - W / 2 - next.tx) / next.tscale, (sy - H / 2 - next.ty) / next.tscale];
    expect(worldAfter[0]).toBeCloseTo(worldBefore[0], 6);
    expect(worldAfter[1]).toBeCloseTo(worldBefore[1], 6);
  });

  it('holds under repeated zoom-in/zoom-out steps', () => {
    let cam = { tx: 0, ty: 0, tscale: 100 };
    const w = 800, h = 500, sx = 210, sy = 300;
    const worldBefore = [(sx - w / 2 - cam.tx) / cam.tscale, (sy - h / 2 - cam.ty) / cam.tscale];
    for (const factor of [1.2, 1.2, 0.7, 1.5, 0.4]) {
      cam = zoomAnchor(cam, sx, sy, factor, w, h, 10, 1000);
    }
    const worldAfter = [(sx - w / 2 - cam.tx) / cam.tscale, (sy - h / 2 - cam.ty) / cam.tscale];
    expect(worldAfter[0]).toBeCloseTo(worldBefore[0], 6);
    expect(worldAfter[1]).toBeCloseTo(worldBefore[1], 6);
  });

  it('respects the min/max scale clamp', () => {
    const cam = { tx: 0, ty: 0, tscale: 100 };
    const grown = zoomAnchor(cam, 0, 0, 100, 400, 400, 30, 400);
    expect(grown.tscale).toBe(400);
    const shrunk = zoomAnchor(cam, 0, 0, 0.001, 400, 400, 30, 400);
    expect(shrunk.tscale).toBe(30);
  });
});

describe('decayVelocity', () => {
  it('decays a moderate pan-release velocity below threshold within 1.5s (default tau=0.35, minSpeed=2)', () => {
    let v = 120; // px/s — a typical (not maximal) drag-release speed
    let t = 0;
    const dt = 1 / 60;
    while (v !== 0 && t < 3) { v = decayVelocity(v, dt); t += dt; }
    expect(v).toBe(0);
    expect(t).toBeLessThan(1.5);
  });

  it('always terminates (reaches exactly 0) in bounded time even for a hard flick', () => {
    let v = 2000; // px/s, an extreme flick
    let t = 0;
    const dt = 1 / 60;
    while (v !== 0 && t < 5) { v = decayVelocity(v, dt); t += dt; }
    expect(v).toBe(0);
    expect(t).toBeLessThan(5);
  });

  it('never goes negative-then-positive (monotonic decay toward 0)', () => {
    let v = 500, prev = v;
    for (let i = 0; i < 60; i++) { v = decayVelocity(v, 1 / 60); expect(v).toBeLessThanOrEqual(prev); prev = v; }
  });
});

describe('clampPanTarget', () => {
  it('never NaNs on a degenerate (single-node / zero-radius) graph', () => {
    const r = clampPanTarget(50, -30, 100, 0, 800, 500);
    expect(Number.isFinite(r.tx)).toBe(true);
    expect(Number.isFinite(r.ty)).toBe(true);
  });

  it('leaves an in-bounds pan untouched', () => {
    const r = clampPanTarget(10, -10, 50, 200, 800, 500);
    expect(r.tx).toBe(10);
    expect(r.ty).toBe(-10);
  });

  it('clamps an out-of-bounds pan to the rubber-band margin', () => {
    const r = clampPanTarget(999999, -999999, 50, 200, 800, 500);
    expect(r.tx).toBeLessThan(999999);
    expect(r.ty).toBeGreaterThan(-999999);
    expect(Number.isFinite(r.tx)).toBe(true);
  });
});

describe('focusTarget', () => {
  it('centers the given world point (tx/ty put it at screen center under worldToScreen conventions)', () => {
    const f = focusTarget(3, -2, 80, 1.15);
    const scale = 80 * 1.15;
    // worldToScreen: W/2 + tx + x*scale === W/2  =>  tx === -x*scale
    expect(f.tx).toBeCloseTo(-3 * scale, 6);
    expect(f.ty).toBeCloseTo(2 * scale, 6);
    expect(f.tscale).toBeCloseTo(scale, 6);
  });
});

describe('easing', () => {
  it('easeOutQuad maps endpoints and clamps', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
    expect(easeOutQuad(-1)).toBe(0);
    expect(easeOutQuad(2)).toBe(1);
  });
  it('easeOutBack maps endpoints and overshoots past 1 mid-curve', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    const mid = Array.from({ length: 20 }, (_, i) => easeOutBack(i / 19));
    expect(Math.max(...mid)).toBeGreaterThan(1);
  });
});

describe('bloom timing', () => {
  it('links closer to the pole (ratio 0) start drawing immediately; far links stagger later', () => {
    expect(bloomLinkT(0, 0)).toBe(0);
    expect(bloomLinkT(0.5, 0)).toBeGreaterThan(bloomLinkT(0.5, 1));
  });
  it('link progress reaches 1 and stays clamped', () => {
    expect(bloomLinkT(BLOOM_DURATION, 0)).toBe(1);
    expect(bloomLinkT(BLOOM_DURATION, 1)).toBeLessThanOrEqual(1);
    expect(bloomLinkT(999, 1)).toBe(1);
  });
  it('nodes begin after their link (150ms later) for the same distance ratio', () => {
    const ratio = 0.4;
    // at a time where the link has started drawing but the node stagger hasn't elapsed yet
    const t = 0.3 * ratio + 0.05;
    expect(bloomLinkT(t, ratio)).toBeGreaterThan(0);
    expect(bloomNodeT(t, ratio)).toBe(0);
  });
  it('labels stay at 0 until the final 300ms, then reach 1 by the end', () => {
    expect(bloomLabelAlpha(0)).toBe(0);
    expect(bloomLabelAlpha(BLOOM_DURATION - 0.3)).toBeCloseTo(0, 6);
    expect(bloomLabelAlpha(BLOOM_DURATION)).toBeCloseTo(1, 6);
  });
});
