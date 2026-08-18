import { describe, expect, it } from 'vitest';
import { MELBOURNE_ENVIRONMENT_CLOCK } from '../src/city/environmentClock.ts';
import {
  cityAtmosphereProfile,
  cityAtmosphereProfileForSnapshot,
} from '../src/scene/cityOutdoorEnvironment.ts';

describe('city-specific outdoor atmosphere profiles', () => {
  it('keeps each city and environment optically distinct', () => {
    const shanghai = cityAtmosphereProfile('shanghai', 'day');
    const melbourne = cityAtmosphereProfile('melbourne', 'day');
    const hongKong = cityAtmosphereProfile('hong-kong', 'day');
    expect(shanghai.id).toBe('shanghai-day-atmosphere-v1');
    expect(melbourne.id).toBe('melbourne-day-atmosphere-v1');
    expect(hongKong.id).toBe('hong-kong-day-atmosphere-v1');
    expect(new Set([shanghai.turbidity, melbourne.turbidity, hongKong.turbidity]).size).toBe(3);
  });

  it('uses denser twilight aerosol scattering without reclassifying geometry', () => {
    for (const cityId of ['shanghai', 'melbourne', 'hong-kong'] as const) {
      const day = cityAtmosphereProfile(cityId, 'day');
      const sunset = cityAtmosphereProfile(cityId, 'sunset');
      const night = cityAtmosphereProfile(cityId, 'night');
      expect(sunset.turbidity).toBeGreaterThan(day.turbidity);
      expect(sunset.mieCoefficient).toBeGreaterThan(day.mieCoefficient);
      expect(night.rayleigh).toBeLessThan(day.rayleigh);
    }
  });

  it('interpolates atmospheric scattering from the exact solar altitude', () => {
    const base = MELBOURNE_ENVIRONMENT_CLOCK.resolve('sunset');
    const snapshotAt = (altitudeDegrees: number) => ({
      ...base,
      sun: { ...base.sun, altitudeDegrees },
    });
    const before = cityAtmosphereProfileForSnapshot('melbourne', snapshotAt(7.999));
    const after = cityAtmosphereProfileForSnapshot('melbourne', snapshotAt(8));
    expect(Math.abs(after.turbidity - before.turbidity)).toBeLessThan(0.01);
    expect(after.solarBlend?.day).toBeGreaterThan(before.solarBlend?.day ?? 0);
  });
});
