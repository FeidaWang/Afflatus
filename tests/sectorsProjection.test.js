// tests/sectorsProjection.test.js
import { describe, expect, it } from 'vitest';
import { projectLatLon } from '../src/sectors/stage/projection.js';

const view = { lat0: 30, lon0: -100, radius: 200, cx: 300, cy: 300 };

describe('orthographic projection', () => {
  it('puts the view centre at the canvas centre', () => {
    const p = projectLatLon(30, -100, view);
    expect(p.x).toBeCloseTo(300); expect(p.y).toBeCloseTo(300); expect(p.visible).toBe(true);
  });
  it('puts east to the right and north up', () => {
    expect(projectLatLon(30, -90, view).x).toBeGreaterThan(300);
    expect(projectLatLon(40, -100, view).y).toBeLessThan(300);
  });
  it('hides the far side', () => expect(projectLatLon(-30, 80, view).visible).toBe(false));
  it('keeps visible points inside the disc', () => {
    for (let lon = -180; lon <= 180; lon += 15) for (let lat = -80; lat <= 80; lat += 20) {
      const p = projectLatLon(lat, lon, view);
      if (p.visible) expect(Math.hypot(p.x - 300, p.y - 300)).toBeLessThanOrEqual(200.0001);
    }
  });
});
