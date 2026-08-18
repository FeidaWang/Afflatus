import { describe, expect, it } from 'vitest';
import {
  blendSolarScalar,
  citySolarBlendWeights,
} from '../src/scene/citySolarBlend.ts';

describe('continuous solar environment blend', () => {
  it('uses normalized continuous weights across night, twilight and day', () => {
    for (let altitude = -20; altitude <= 30; altitude += 0.25) {
      const weights = citySolarBlendWeights(altitude);
      expect(weights.day + weights.sunset + weights.night).toBeCloseTo(1, 12);
      expect(Math.min(weights.day, weights.sunset, weights.night)).toBeGreaterThanOrEqual(0);
    }
    expect(citySolarBlendWeights(-20)).toEqual({ day: 0, sunset: 0, night: 1 });
    expect(citySolarBlendWeights(30)).toEqual({ day: 1, sunset: 0, night: 0 });
    expect(citySolarBlendWeights(0).sunset).toBeGreaterThan(0.9);
  });

  it('interpolates renderer values instead of stepping at classification boundaries', () => {
    const before = citySolarBlendWeights(7.999);
    const after = citySolarBlendWeights(8);
    expect(Math.abs(after.day - before.day)).toBeLessThan(0.001);
    expect(blendSolarScalar(citySolarBlendWeights(0), {
      day: 1,
      sunset: 0.5,
      night: 0,
    })).toBeGreaterThan(0.45);
  });
});
