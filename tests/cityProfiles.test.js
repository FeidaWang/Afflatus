import { describe, expect, it } from 'vitest';
import {
  CITY_CONCEPT_GENERATION_PROFILES,
  CITY_EXPERIENCE_PROFILES,
  LEGACY_CITY_CONCEPT_PROFILE_KEYS,
  canLoadRealCityData,
  normalizeCityConceptProfileKey,
  normalizeCityExperienceProfileKey,
  validateCityExperienceProfile,
} from '../src/city/profiles.ts';

describe('city experience and generated concept profiles', () => {
  it('uses one valid profile contract with unique ids and in-bounds anchors', () => {
    const profiles = Object.values(CITY_EXPERIENCE_PROFILES);
    expect(profiles.map((profile) => profile.id)).toEqual([
      'shanghai-lujiazui-v0',
      'melbourne-hoddle-grid-v0',
      'hong-kong-victoria-harbour-v0',
    ]);
    expect(new Set(profiles.map((profile) => profile.id)).size).toBe(profiles.length);
    for (const profile of profiles) expect(validateCityExperienceProfile(profile)).toEqual([]);
  });

  it('refuses real-city data until licence and source review is approved', () => {
    for (const profile of Object.values(CITY_EXPERIENCE_PROFILES)) {
      expect(profile.status).toBe('candidate-unverified');
      expect(profile.dataPolicy.externalDataAllowed).toBe(false);
      expect(canLoadRealCityData(profile)).toBe(false);
    }
  });

  it('keeps city-specific traffic and narrative roles in data, not controllers', () => {
    expect(CITY_EXPERIENCE_PROFILES['shanghai-lujiazui-v0']).toMatchObject({
      role: 'brand-first',
      trafficSide: 'right',
    });
    expect(CITY_EXPERIENCE_PROFILES['melbourne-hoddle-grid-v0']).toMatchObject({
      role: 'data-first',
      trafficSide: 'left',
    });
    expect(CITY_EXPERIENCE_PROFILES['hong-kong-victoria-harbour-v0']).toMatchObject({
      role: 'brand-first',
      trafficSide: 'left',
    });
  });

  it('keeps three legacy concept fixtures isolated from the synthetic Sandbox and real-data approval', () => {
    expect(Object.keys(CITY_CONCEPT_GENERATION_PROFILES)).toEqual([
      'sandbox',
      'shanghai',
      'melbourne',
      'hong-kong',
    ]);
    expect(LEGACY_CITY_CONCEPT_PROFILE_KEYS).toEqual([
      'shanghai',
      'melbourne',
      'hong-kong',
    ]);
    expect(CITY_CONCEPT_GENERATION_PROFILES.sandbox).toMatchObject({
      id: 'synthetic-test-fixture-v1',
      experienceProfileId: null,
    });
    for (const profile of Object.values(CITY_CONCEPT_GENERATION_PROFILES)) {
      expect(profile.truthClass).toBe('generated-concept');
      expect(profile.totalDays).toBe(210);
      expect(profile.radius).toBe(4);
    }
    expect(CITY_CONCEPT_GENERATION_PROFILES.shanghai).toMatchObject({
      trafficSide: 'right',
      landmarkForm: 'twist',
      waterChannel: { axis: 'z' },
    });
    expect(CITY_CONCEPT_GENERATION_PROFILES.melbourne).toMatchObject({
      trafficSide: 'left',
      landmarkForm: 'tapered-spire',
      waterChannel: { axis: 'x' },
    });
    expect(CITY_CONCEPT_GENERATION_PROFILES['hong-kong']).toMatchObject({
      trafficSide: 'left',
      landmarkForm: 'tapered-spire',
      coreBuildingCount: 3,
      mixedBuildingCount: 3,
      vehicleCount: 26,
      coreOffset: { z: -2 },
      landmarkGrid: { x: 2, z: 1 },
      waterChannel: { axis: 'x', gridIndex: -1 },
      ridgeBackdrop: { axis: 'x', peakCount: 9 },
    });
    expect(normalizeCityConceptProfileKey('MELBOURNE')).toBe('melbourne');
    expect(normalizeCityConceptProfileKey('HONG-KONG')).toBe('hong-kong');
    expect(normalizeCityConceptProfileKey('unknown')).toBe('sandbox');
    expect(normalizeCityExperienceProfileKey('MELBOURNE')).toBe('melbourne');
    expect(normalizeCityExperienceProfileKey('HONG-KONG')).toBe('hong-kong');
    expect(normalizeCityExperienceProfileKey('sandbox')).toBe('shanghai');
    expect(normalizeCityExperienceProfileKey('unknown')).toBe('shanghai');
  });
});
