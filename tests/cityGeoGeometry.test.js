import { describe, expect, it } from 'vitest';
import {
  clipClosedRingToBounds,
  clipLineStringToBounds,
  signedRingArea,
} from '../src/city/geoGeometry.ts';

const bounds = Object.freeze({ west: 0, south: 0, east: 10, north: 10 });

describe('real-city rectangular geometry clipping', () => {
  it('clips and closes a polygon without leaving the approved bounds', () => {
    const clipped = clipClosedRingToBounds([
      [-2, 2], [8, 2], [8, 12], [-2, 12], [-2, 2],
    ], bounds);
    expect(clipped[0]).toEqual(clipped[clipped.length - 1]);
    expect(clipped.every(([x, y]) => x >= 0 && x <= 10 && y >= 0 && y <= 10)).toBe(true);
    expect(Math.abs(signedRingArea(clipped))).toBe(64);
  });

  it('returns an empty immutable ring when a polygon is outside or invalid', () => {
    expect(clipClosedRingToBounds([[20, 20], [21, 20], [21, 21], [20, 20]], bounds)).toEqual([]);
    expect(clipClosedRingToBounds([[0, 0], [1, 1]], bounds)).toEqual([]);
  });

  it('rejects unordered bounds', () => {
    expect(() => clipClosedRingToBounds(
      [[0, 0], [1, 0], [1, 1], [0, 0]],
      { west: 2, south: 0, east: 1, north: 1 },
    )).toThrow(/ordered/);
  });

  it('clips line strings and preserves disconnected in-bounds sections', () => {
    expect(clipLineStringToBounds([
      [-2, 2], [5, 2], [12, 2], [12, 8], [5, 8], [-2, 8],
    ], bounds)).toEqual([
      [[0, 2], [5, 2], [10, 2]],
      [[10, 8], [5, 8], [0, 8]],
    ]);
  });

  it('returns no line for invalid, outside or zero-length segments', () => {
    expect(clipLineStringToBounds([[20, 20], [21, 21]], bounds)).toEqual([]);
    expect(clipLineStringToBounds([[2, 2]], bounds)).toEqual([]);
    expect(clipLineStringToBounds([[2, 2], [2, 2]], bounds)).toEqual([]);
  });
});
