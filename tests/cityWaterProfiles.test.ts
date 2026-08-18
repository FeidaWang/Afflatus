import { describe, expect, it } from 'vitest';
import { createCityEnvironmentClock } from '../src/city/environmentClock.ts';
import { cityWaterProfileForSnapshot } from '../src/scene/cityWaterProfiles.ts';

describe('city-specific water visual profiles', () => {
  it('keeps Shanghai, Victoria Harbour and Yarra visual parameters distinct and explicit', () => {
    const profiles = ['shanghai', 'hong-kong', 'melbourne'].map((cityId) => (
      cityWaterProfileForSnapshot(
        cityId as 'shanghai' | 'hong-kong' | 'melbourne',
        createCityEnvironmentClock(cityId as 'shanghai' | 'hong-kong' | 'melbourne').resolve('day'),
      )
    ));
    expect(profiles.map((profile) => profile?.id)).toEqual([
      'shanghai-water-visual-v1',
      'hong-kong-water-visual-v1',
      'melbourne-water-visual-v1',
    ]);
    expect(new Set(profiles.map((profile) => profile?.color)).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile?.surface.rippleScale)).size).toBe(3);
    expect(profiles.every((profile) => profile?.basis === 'art-directed-visual-only')).toBe(true);
  });

  it('normalizes visual flow vectors and interpolates without changing truth classification', () => {
    for (const cityId of ['shanghai', 'hong-kong', 'melbourne'] as const) {
      const clock = createCityEnvironmentClock(cityId);
      const profile = cityWaterProfileForSnapshot(cityId, clock.resolve('sunset'));
      expect(profile).not.toBeNull();
      expect(Math.hypot(
        profile?.surface.flowDirection.x ?? 0,
        profile?.surface.flowDirection.z ?? 0,
      )).toBeCloseTo(1, 12);
      expect(profile?.solarBlend.sunset).toBeGreaterThan(0.5);
    }
  });
});
