import { describe, it, expect } from 'vitest';
import { createCarousel, drag, release, step, indexAt, goTo } from '../src/lib/worldsCarousel.js';

function run(state, maxFrames = 2000) {
  let s = state;
  const trace = [s];
  for (let i = 0; i < maxFrames && s.phase !== 'idle'; i++) {
    s = step(s, 16);
    trace.push(s);
  }
  return { final: s, trace };
}

describe('createCarousel', () => {
  it('loops only from four cards up', () => {
    expect(createCarousel(8).loop).toBe(true);
    expect(createCarousel(4).loop).toBe(true);
    expect(createCarousel(3).loop).toBe(false);
    expect(createCarousel(8)).toMatchObject({ pos: 0, vel: 0, n: 8, phase: 'idle' });
  });
});

describe('drag', () => {
  it('follows the finger one-to-one inside the range', () => {
    expect(drag(createCarousel(8, 2), 0.4).pos).toBeCloseTo(2.4);
  });

  it('damps the part of a drag past either end of an arc by 0.35', () => {
    expect(drag(createCarousel(3, 0), -1).pos).toBeCloseTo(-0.35);
    expect(drag(createCarousel(3, 2), 1).pos).toBeCloseTo(2.35);
    expect(drag(createCarousel(3, 0.5), -1).pos).toBeCloseTo(-0.175);
  });

  it('does not mutate its input', () => {
    const s = createCarousel(8, 1);
    drag(s, 1);
    expect(s.pos).toBe(1);
  });
});

describe('release + step', () => {
  it('coasts with a decaying speed, then settles on a whole card', () => {
    const { final, trace } = run(release(drag(createCarousel(8, 0), 0.2), 0.5));
    const coasting = trace.filter((s) => s.phase === 'coast').map((s) => Math.abs(s.vel));
    expect(coasting.length).toBeGreaterThan(3);
    for (let i = 1; i < coasting.length; i++) expect(coasting[i]).toBeLessThan(coasting[i - 1]);
    expect(final.phase).toBe('idle');
    expect(Number.isInteger(final.pos)).toBe(true);
    expect(final.pos).toBeGreaterThanOrEqual(0);
    expect(final.pos).toBeLessThan(8);
  });

  it('wraps a looped ring when it settles', () => {
    const { final } = run(release(createCarousel(8, 0), -0.6));
    expect(final.pos).toBeGreaterThanOrEqual(0);
    expect(final.pos).toBeLessThan(8);
  });

  it('overshoots the snap target by at most a quarter card', () => {
    const { final, trace } = run(release(createCarousel(8, 2.4), 0));
    expect(final.pos).toBe(2);
    const overshoot = Math.max(...trace.map((s) => 2 - s.pos));
    expect(overshoot).toBeGreaterThan(0);
    expect(overshoot).toBeLessThanOrEqual(0.25);
  });

  it('springs an arc back inside its ends', () => {
    const { final } = run(release(drag(createCarousel(3, 2), 1.5), 0.4));
    expect(final.pos).toBe(2);
  });

  it('jumps straight to the snap target under reduced motion', () => {
    const s = release(createCarousel(8, 2.6), 0.9, { reduced: true });
    expect(s.phase).toBe('idle');
    expect(s.pos).toBe(3);
  });

  it('always returns a single card to zero', () => {
    const { final } = run(release(drag(createCarousel(1, 0), 3), 1));
    expect(final.pos).toBe(0);
  });

  it('keeps two cards inside [0, 1]', () => {
    const { final } = run(release(drag(createCarousel(2, 1), 2), 0.8));
    expect(final.pos).toBe(1);
  });
});

describe('indexAt', () => {
  it('wraps on a ring and clamps on an arc', () => {
    expect(indexAt(-0.6, 8, true)).toBe(7);
    expect(indexAt(3.7, 3, false)).toBe(2);
    expect(indexAt(8.2, 8, true)).toBe(0);
  });
});

describe('goTo', () => {
  it('springs to the requested card', () => {
    const { final } = run(goTo(createCarousel(8, 0), 5));
    expect(final.pos).toBe(5);
  });

  it('takes the short way round a ring', () => {
    const { trace } = run(goTo(createCarousel(8, 0), 7));
    expect(Math.min(...trace.map((s) => s.pos))).toBeLessThan(0);
  });
});
