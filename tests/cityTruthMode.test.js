import { describe, expect, it } from 'vitest';
import {
  CITY_TRUTH_MODES,
  evaluateCityRealityAvailability,
  mayMountGeneratedSandbox,
  normalizeCityTruthMode,
  resolveCityTruthRequest,
} from '../src/city/truthMode.ts';

describe('Cityview truth-mode boundary', () => {
  it('defaults real city URLs to Reality and never authorizes generated geometry', () => {
    const request = resolveCityTruthRequest({ profile: 'shanghai' });
    expect(request).toEqual({
      mode: 'reality',
      profile: 'shanghai',
      migratedLegacySandbox: false,
    });
    expect(CITY_TRUTH_MODES[request.mode]).toMatchObject({
      requiresApprovedPackage: true,
      allowsGeneratedGeometry: false,
    });
    expect(mayMountGeneratedSandbox(request)).toBe(false);
  });

  it('keeps construction scenarios on the approved real-city package path', () => {
    const request = resolveCityTruthRequest({ mode: 'scenario', profile: 'hong-kong' });
    expect(request.mode).toBe('construction-scenario');
    expect(CITY_TRUTH_MODES[request.mode]).toMatchObject({
      requiresApprovedPackage: true,
      allowsGeneratedGeometry: false,
    });
    expect(mayMountGeneratedSandbox(request)).toBe(false);
  });

  it('allows generated geometry only after an explicit Sandbox request', () => {
    const request = resolveCityTruthRequest({ mode: 'sandbox', profile: 'melbourne' });
    expect(request).toEqual({
      mode: 'sandbox',
      profile: 'melbourne',
      migratedLegacySandbox: false,
    });
    expect(mayMountGeneratedSandbox(request)).toBe(true);
  });

  it('migrates the retired profile=sandbox URL into the explicit Sandbox truth mode', () => {
    expect(resolveCityTruthRequest({ mode: 'reality', profile: 'sandbox' })).toEqual({
      mode: 'sandbox',
      profile: 'shanghai',
      migratedLegacySandbox: true,
    });
  });

  it('fails closed while the production package and source approvals are absent', () => {
    const availability = evaluateCityRealityAvailability('shanghai', null);
    expect(availability.available).toBe(false);
    expect(availability.packageReference).toBeNull();
    expect(availability.blockers).toEqual([
      'profile-unapproved',
      'external-data-blocked',
      'licence-review-required',
      'production-package-missing',
    ]);
  });

  it('treats the validated production registry as the single runtime allow-list', () => {
    const packageReference = {
      packageId: 'shanghai-core-v1',
      manifestPath: 'public/assets/city/packages/shanghai-core-v1/manifest.json',
      manifestSha256: 'a'.repeat(64),
    };
    const availability = evaluateCityRealityAvailability('shanghai', packageReference);
    expect(availability).toMatchObject({
      available: true,
      packageReference,
      blockers: [],
    });
  });

  it('normalizes unknown modes to the safer Reality path', () => {
    expect(normalizeCityTruthMode('construction-scenario')).toBe('construction-scenario');
    expect(normalizeCityTruthMode('SANDBOX')).toBe('sandbox');
    expect(normalizeCityTruthMode('unknown')).toBe('reality');
  });
});
