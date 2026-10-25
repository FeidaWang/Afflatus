import { describe, it, expect } from 'vitest';
import { ZOOM_TREE, ZOOM_STAGE, ZOOM_MATCH, pointDistance, nextZoomLevel, wheelScaleDelta } from '../src/lib/pinchZoom.js';

describe('pointDistance', () => {
  it('computes euclidean distance', () => {
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('is zero for identical points', () => {
    expect(pointDistance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });
});

describe('nextZoomLevel', () => {
  it('holds steady below the threshold (jitter guard)', () => {
    expect(nextZoomLevel(ZOOM_STAGE, 10, 36)).toBe(ZOOM_STAGE);
    expect(nextZoomLevel(ZOOM_STAGE, -20, 36)).toBe(ZOOM_STAGE);
  });
  it('zooms in (spread) past the threshold', () => {
    expect(nextZoomLevel(ZOOM_STAGE, 40, 36)).toBe(ZOOM_MATCH);
  });
  it('zooms out (pinch) past the threshold', () => {
    expect(nextZoomLevel(ZOOM_STAGE, -40, 36)).toBe(ZOOM_TREE);
  });
  it('clamps at the ZOOM_MATCH ceiling', () => {
    expect(nextZoomLevel(ZOOM_MATCH, 100, 36)).toBe(ZOOM_MATCH);
  });
  it('clamps at the ZOOM_TREE floor', () => {
    expect(nextZoomLevel(ZOOM_TREE, -100, 36)).toBe(ZOOM_TREE);
  });
  it('ignores non-finite deltas', () => {
    expect(nextZoomLevel(ZOOM_STAGE, NaN, 36)).toBe(ZOOM_STAGE);
    expect(nextZoomLevel(ZOOM_STAGE, Infinity, 36)).toBe(ZOOM_STAGE);
  });
});

describe('wheelScaleDelta', () => {
  it('flips sign so pinch-out(zoom in) trackpad deltaY reads as zoom-in', () => {
    expect(wheelScaleDelta(-50)).toBe(50);
    expect(wheelScaleDelta(50)).toBe(-50);
  });
});
