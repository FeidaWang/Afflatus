import { describe, expect, it } from 'vitest';
import { createFramePacer } from '../src/lib/framePacing.js';

function simulate(refreshHz, targetFps, seconds = 4, droppedAt = new Set()) {
  const refreshInterval = 1000 / refreshHz;
  const pacer = createFramePacer();
  const presented = [];
  let refresh = 0;
  for (let now = refreshInterval; now <= seconds * 1000; now += refreshInterval) {
    refresh += 1;
    if (droppedAt.has(refresh)) continue;
    if (!pacer.shouldPresent(now, targetFps)) continue;
    presented.push(now);
  }
  return presented;
}

describe('frame pacing', () => {
  it.each([60, 65, 90, 113, 118, 120, 122, 127, 144])('keeps a 60fps target near 60Hz on a %iHz display', (refreshHz) => {
    const frames = simulate(refreshHz, 60);
    expect(frames.length / 4).toBeGreaterThanOrEqual(58.5);
    expect(frames.length / 4).toBeLessThanOrEqual(61);
  });

  it('does not alias 120Hz refresh to 40fps when timestamps land just below 16.7ms', () => {
    const frames = simulate(120, 60);
    const gaps = frames.slice(1).map((time, index) => time - frames[index]);
    expect(gaps.filter((gap) => gap > 20)).toHaveLength(0);
  });

  it('carries overshoot to maintain a 60fps average on a 90Hz display', () => {
    const frames = simulate(90, 60);
    const gaps = frames.slice(1).map((time, index) => time - frames[index]);
    expect(gaps.some((gap) => gap < 15)).toBe(true);
    expect(gaps.some((gap) => gap > 20)).toBe(true);
    expect(frames.length / 4).toBeGreaterThanOrEqual(59);
  });

  it('drops stall debt instead of presenting an 8ms catch-up frame at 120Hz', () => {
    const frames = simulate(120, 60, 2, new Set([20, 21]));
    const gaps = frames.slice(1).map((time, index) => time - frames[index]);
    const stallIndex = gaps.findIndex((gap) => gap > 25);
    expect(stallIndex).toBeGreaterThanOrEqual(0);
    expect(gaps[stallIndex + 1]).toBeGreaterThan(12);
  });

  it('presents immediately after a target-rate change and then resumes pacing', () => {
    const pacer = createFramePacer();
    expect(pacer.shouldPresent(10, 30)).toBe(true);
    expect(pacer.shouldPresent(20, 30)).toBe(false);
    expect(pacer.shouldPresent(25, 60)).toBe(true);
    expect(pacer.shouldPresent(30, 60)).toBe(false);
    pacer.reset();
    expect(pacer.shouldPresent(10_000, 60)).toBe(true);
  });

  it('adapts from 120Hz to 90Hz without locking to the old callback cadence', () => {
    const pacer = createFramePacer();
    let firstPhase = 0;
    let secondPhase = 0;
    for (let now = 1000 / 120; now <= 2000; now += 1000 / 120) {
      if (pacer.shouldPresent(now, 60)) firstPhase += 1;
    }
    for (let now = 2000 + 1000 / 90; now <= 4000; now += 1000 / 90) {
      if (pacer.shouldPresent(now, 60)) secondPhase += 1;
    }
    expect(firstPhase).toBeGreaterThanOrEqual(118);
    expect(secondPhase).toBeGreaterThanOrEqual(116);
  });
});
