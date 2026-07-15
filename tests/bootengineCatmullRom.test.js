import { describe, it, expect } from 'vitest';
import { createCatmullRomPath } from '../src/bootengine/catmullRom';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('createCatmullRomPath', () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 2, z: 0 },
    { x: 8, y: 0, z: 3 },
    { x: 12, y: -1, z: 5 },
  ];
  const path = createCatmullRomPath(points);

  it('passes through every control point exactly at its u fraction', () => {
    for (let i = 0; i <= path.segments; i++) {
      const u = i / path.segments;
      expect(dist(path.pos(u), points[i])).toBeLessThan(1e-9);
    }
  });

  it('is continuous at segment boundaries (no position jump)', () => {
    for (let i = 1; i < path.segments; i++) {
      const u = i / path.segments;
      const before = path.pos(u - 1e-6);
      const after = path.pos(u + 1e-6);
      expect(dist(before, after)).toBeLessThan(1e-4);
    }
  });

  it('never produces NaN across a dense sweep, including out-of-range u', () => {
    for (let i = -10; i <= 110; i++) {
      const u = i / 100;
      const s = path.sample(u);
      expect(finite(s.pos) && finite(s.tangent)).toBe(true);
    }
  });

  it('clamps u outside [0,1] to the endpoints', () => {
    expect(dist(path.pos(-1), points[0])).toBeLessThan(1e-9);
    expect(dist(path.pos(2), points[points.length - 1])).toBeLessThan(1e-9);
  });

  it('is deterministic given the same inputs (golden-set requirement)', () => {
    const other = createCatmullRomPath(points);
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      expect(path.pos(u)).toEqual(other.pos(u));
      expect(path.tangent(u)).toEqual(other.tangent(u));
    }
  });

  it('a straight 2-point path is exactly linear', () => {
    const line = createCatmullRomPath([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]);
    const mid = line.pos(0.5);
    expect(mid.x).toBeCloseTo(5, 9);
    expect(mid.y).toBeCloseTo(0, 9);
    expect(mid.z).toBeCloseTo(0, 9);
  });

  it('throws on fewer than 2 points', () => {
    expect(() => createCatmullRomPath([{ x: 0, y: 0, z: 0 }])).toThrow();
  });
});
