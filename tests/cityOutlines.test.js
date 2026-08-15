import { describe, expect, it } from 'vitest';
import {
  appendBoxEdges,
  appendEllipsoidLines,
  appendEllipticCylinderLines,
  appendEllipticFrustumLines,
} from '../src/city/outlines.ts';

describe('city structure line generators', () => {
  it('emits only the twelve structural box edges', () => {
    const positions = [];
    appendBoxEdges(positions, 4, 2, -3, 10, 20, 8, Math.PI / 7);
    expect(positions).toHaveLength(12 * 2 * 3);
    expect(positions.every(Number.isFinite)).toBe(true);
  });

  it('emits closed ellipse rings and vertical surface lines at a controlled density', () => {
    const positions = [];
    appendEllipticCylinderLines(positions, 0, 2, 0, 12, 30, 8, 0, {
      radialSegments: 12,
      verticalLines: 6,
      ringFractions: [0, 0.5, 1],
    });
    expect(positions).toHaveLength((12 * 3 + 6) * 2 * 3);
    expect(positions.every(Number.isFinite)).toBe(true);

    const segments = Array.from({ length: positions.length / 6 }, (_, index) => positions.slice(index * 6, index * 6 + 6));
    const rings = segments.slice(0, 36);
    const verticals = segments.slice(36);
    expect(rings.every((segment) => segment[1] === segment[4])).toBe(true);
    expect(verticals.every((segment) => segment[0] === segment[3] && segment[2] === segment[5])).toBe(true);
    expect(new Set(rings.map((segment) => segment[1]))).toEqual(new Set([2, 17, 32]));
  });

  it('clamps invalid densities and appends without replacing existing batches', () => {
    const positions = [99, 98, 97];
    appendEllipticCylinderLines(positions, 0, 0, 0, 4, 8, 4, Math.PI / 4, {
      radialSegments: 1,
      verticalLines: 1,
      ringFractions: [-2, 2, 2],
    });
    expect(positions.slice(0, 3)).toEqual([99, 98, 97]);
    expect(positions.length).toBe(3 + (6 * 2 + 4) * 2 * 3);
  });

  it('generates batched sphere and cone families without invalid coordinates', () => {
    const sphere = [];
    const cone = [];
    appendEllipsoidLines(sphere, 4, 10, -3, 12, 8, 10, 0.2, {
      radialSegments: 12,
      meridians: 6,
      latitudeFractions: [-0.5, 0, 0.5],
    });
    appendEllipticFrustumLines(cone, 0, 0, 0, 12, 10, 0, 0, 30, -0.1, {
      radialSegments: 12,
      verticalLines: 6,
    });
    expect(sphere).toHaveLength((12 * 3 + 6 * 6) * 2 * 3);
    expect(cone).toHaveLength((12 * 2 + 6) * 2 * 3);
    expect([...sphere, ...cone].every(Number.isFinite)).toBe(true);
  });
});
