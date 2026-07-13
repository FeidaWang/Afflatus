import { describe, it, expect } from 'vitest';
import { fmtRange, edgeClamp } from '../src/ui/tacticalOverlay.js';

describe('fmtRange', () => {
  it('formats sub-10km with one decimal, 10km+ as integers', () => {
    expect(fmtRange(10)).toBe('1.2km');    // 10 units * 0.12
    expect(fmtRange(100)).toBe('12km');
    expect(fmtRange(0)).toBe('0.0km');
  });
});

describe('edgeClamp', () => {
  const W = 800, H = 400, M = 16;

  it('clamps an off-screen point to inside the panel bounds', () => {
    for (const [nx, ny, behind] of [[1.8, 0.5, false], [-0.4, 0.5, false], [0.5, 2.2, false], [0.5, 0.5, true]]) {
      const e = edgeClamp(nx, ny, behind, W, H, M);
      expect(e.x).toBeGreaterThanOrEqual(M - 1e-6);
      expect(e.x).toBeLessThanOrEqual(W - M + 1e-6);
      expect(e.y).toBeGreaterThanOrEqual(M - 1e-6);
      expect(e.y).toBeLessThanOrEqual(H - M + 1e-6);
      expect(Number.isFinite(e.ang)).toBe(true);
    }
  });

  it('points the chevron toward the target side', () => {
    const right = edgeClamp(2.0, 0.5, false, W, H, M);
    expect(Math.cos(right.ang)).toBeGreaterThan(0.9); // facing right
    expect(right.x).toBeCloseTo(W - M, 5);
    const above = edgeClamp(0.5, -1.0, false, W, H, M);
    expect(Math.sin(above.ang)).toBeLessThan(-0.9);   // facing up
  });

  it('mirrors direction when the target is behind the camera', () => {
    const front = edgeClamp(0.8, 0.5, false, W, H, M);
    const behind = edgeClamp(0.8, 0.5, true, W, H, M);
    expect(Math.sign(Math.cos(front.ang))).not.toBe(Math.sign(Math.cos(behind.ang)));
  });
});
