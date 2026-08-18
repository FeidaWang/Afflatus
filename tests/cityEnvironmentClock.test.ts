import { describe, expect, it } from 'vitest';
import {
  MELBOURNE_ENVIRONMENT_CLOCK,
  MELBOURNE_ENVIRONMENT_PRESET_INSTANTS,
  classifySolarEnvironment,
  createCityEnvironmentClock,
  normalizeCityEnvironmentRequest,
} from '../src/city/environmentClock.ts';

describe('Melbourne EnvironmentClock', () => {
  it('resolves fixed presets deterministically in Melbourne civil time', () => {
    const expected = {
      analysis: { band: 'day', local: '2026-08-16T12:00:00' },
      day: { band: 'day', local: '2026-01-15T13:00:00' },
      sunset: { band: 'sunset', local: '2026-01-15T20:30:00' },
      night: { band: 'night', local: '2026-01-16T00:00:00' },
    } as const;

    for (const [request, result] of Object.entries(expected)) {
      const snapshot = MELBOURNE_ENVIRONMENT_CLOCK.resolve(request);
      expect(snapshot.environment).toBe(request);
      expect(snapshot.solarBand).toBe(result.band);
      expect(snapshot.localDateTime).toBe(result.local);
      expect(snapshot.instant).toBe(
        MELBOURNE_ENVIRONMENT_PRESET_INSTANTS[
          request as keyof typeof MELBOURNE_ENVIRONMENT_PRESET_INSTANTS
        ],
      );
      expect(snapshot.timeSource).toBe('fixed-preset');
      expect(snapshot.location.timeZone).toBe('Australia/Melbourne');
      expect(Object.isFrozen(snapshot)).toBe(true);
    }
  });

  it('derives auto-local mode from an explicit instant without hidden wall-clock state', () => {
    const day = MELBOURNE_ENVIRONMENT_CLOCK.resolve('auto-local', '2026-01-15T02:00:00Z');
    const sunset = MELBOURNE_ENVIRONMENT_CLOCK.resolve('auto-local', '2026-01-15T09:30:00Z');
    const night = MELBOURNE_ENVIRONMENT_CLOCK.resolve('auto-local', '2026-01-15T13:00:00Z');
    expect([day.environment, sunset.environment, night.environment]).toEqual([
      'day',
      'sunset',
      'night',
    ]);
    expect(day.timeSource).toBe('local-clock');
    expect(() => MELBOURNE_ENVIRONMENT_CLOCK.resolve('auto-local')).toThrow(
      'requires an explicit clock instant',
    );
  });

  it('returns a unit East/Up/North direction toward the calculated sun', () => {
    for (const request of ['day', 'sunset', 'night'] as const) {
      const { sun } = MELBOURNE_ENVIRONMENT_CLOCK.resolve(request);
      expect(Math.hypot(sun.direction.x, sun.direction.y, sun.direction.z)).toBeCloseTo(1, 12);
      expect(sun.altitudeDegrees).toBeGreaterThanOrEqual(-90);
      expect(sun.altitudeDegrees).toBeLessThanOrEqual(90);
      expect(sun.azimuthDegrees).toBeGreaterThanOrEqual(0);
      expect(sun.azimuthDegrees).toBeLessThan(360);
    }
  });

  it('uses explicit day, civil-twilight and night altitude boundaries', () => {
    expect(classifySolarEnvironment(8)).toBe('day');
    expect(classifySolarEnvironment(7.999)).toBe('sunset');
    expect(classifySolarEnvironment(-5.999)).toBe('sunset');
    expect(classifySolarEnvironment(-6)).toBe('night');
  });

  it('normalizes only the five supported requests and marks night lighting simulated', () => {
    expect(normalizeCityEnvironmentRequest(' Auto-Local ')).toBe('auto-local');
    expect(normalizeCityEnvironmentRequest('weather')).toBeNull();
    expect(() => MELBOURNE_ENVIRONMENT_CLOCK.resolve('weather')).toThrow('Unknown city environment');
    expect(MELBOURNE_ENVIRONMENT_CLOCK.resolve('night').simulatedLighting).toBe(true);
    expect(MELBOURNE_ENVIRONMENT_CLOCK.resolve('sunset').simulatedLighting).toBe(false);
  });

  it('shares the same deterministic environment contract across all production cities', () => {
    const expectations = {
      shanghai: 'Asia/Shanghai',
      melbourne: 'Australia/Melbourne',
      'hong-kong': 'Asia/Hong_Kong',
    } as const;
    for (const [cityId, timeZone] of Object.entries(expectations)) {
      const clock = createCityEnvironmentClock(cityId as keyof typeof expectations);
      expect(clock.resolve('day')).toMatchObject({ environment: 'day', solarBand: 'day' });
      expect(clock.resolve('sunset')).toMatchObject({ environment: 'sunset', solarBand: 'sunset' });
      expect(clock.resolve('night')).toMatchObject({
        environment: 'night',
        solarBand: 'night',
        simulatedLighting: true,
        location: { timeZone },
      });
    }
  });
});
