import { describe, it, expect } from 'vitest';
import { clampRange, panRange, resizeLeft, resizeRight, zoomRange, densityFor } from '../src/lib/stageRange.js';

describe('clampRange', () => {
  it('passes through an already-valid ordered pair', () => {
    expect(clampRange(1, 3, 5)).toEqual([1, 3]);
  });
  it('swaps a reversed pair back into order', () => {
    expect(clampRange(3, 1, 5)).toEqual([1, 3]);
  });
  it('clamps below 0', () => {
    expect(clampRange(-2, 3, 5)).toEqual([0, 3]);
  });
  it('clamps above n-1', () => {
    expect(clampRange(2, 10, 5)).toEqual([2, 4]);
  });
  it('rounds non-integer inputs', () => {
    expect(clampRange(1.6, 2.2, 5)).toEqual([2, 2]);
  });
});

describe('panRange', () => {
  it('shifts the window right, width unchanged', () => {
    expect(panRange([1, 2], 1, 5)).toEqual([2, 3]);
  });
  it('shifts the window left, width unchanged', () => {
    expect(panRange([2, 3], -1, 5)).toEqual([1, 2]);
  });
  it('saturates at the right edge without losing width', () => {
    expect(panRange([2, 4], 5, 5)).toEqual([2, 4]);
  });
  it('saturates at the left edge without losing width', () => {
    expect(panRange([0, 1], -5, 5)).toEqual([0, 1]);
  });
});

describe('resizeLeft', () => {
  it('shrinks from the left', () => {
    expect(resizeLeft([0, 3], 1, 5)).toEqual([1, 3]);
  });
  it('grows to the left', () => {
    expect(resizeLeft([1, 3], -1, 5)).toEqual([0, 3]);
  });
  it('clamps at 0', () => {
    expect(resizeLeft([1, 3], -5, 5)).toEqual([0, 3]);
  });
  it('cannot cross past the right edge (collapses to single cell)', () => {
    expect(resizeLeft([0, 3], 10, 5)).toEqual([3, 3]);
  });
});

describe('resizeRight', () => {
  it('grows to the right', () => {
    expect(resizeRight([0, 2], 2, 5)).toEqual([0, 4]);
  });
  it('shrinks from the right', () => {
    expect(resizeRight([0, 3], -1, 5)).toEqual([0, 2]);
  });
  it('cannot cross past the left edge (collapses to single cell)', () => {
    expect(resizeRight([2, 4], -10, 5)).toEqual([2, 2]);
  });
  it('clamps at n-1', () => {
    expect(resizeRight([0, 2], 10, 5)).toEqual([0, 4]);
  });
});

describe('zoomRange', () => {
  it('widens symmetrically', () => {
    expect(zoomRange([1, 2], 1, 5)).toEqual([0, 3]);
  });
  it('narrows symmetrically without crossing', () => {
    expect(zoomRange([0, 4], -1, 5)).toEqual([1, 3]);
  });
  it('narrows to exactly one cell at the boundary', () => {
    expect(zoomRange([0, 2], -1, 5)).toEqual([1, 1]);
  });
  it('snaps to the midpoint cell when narrowing would cross', () => {
    expect(zoomRange([0, 1], -2, 5)).toEqual([1, 1]);
  });
  it('clamps at n-1 when widening past the end', () => {
    expect(zoomRange([3, 4], 2, 5)).toEqual([1, 4]);
  });
});

describe('densityFor', () => {
  it('is detail for a single-stage window (w=0)', () => {
    expect(densityFor(0)).toBe('detail');
  });
  it('is cards for a 2-3 stage window (w=1,2)', () => {
    expect(densityFor(1)).toBe('cards');
    expect(densityFor(2)).toBe('cards');
  });
  it('is chips for a 4+ stage window (w>=3)', () => {
    expect(densityFor(3)).toBe('chips');
    expect(densityFor(10)).toBe('chips');
  });
});
