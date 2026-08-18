import {
  CITY_EXPERIENCE_PROFILES,
  normalizeCityExperienceProfileKey,
  type CityExperienceProfile,
  type CityExperienceProfileId,
  type CityPublicProfileKey,
} from './profiles';
import type { CityPackageRegistryReference } from './packages';

export type CityTruthMode = 'reality' | 'construction-scenario' | 'sandbox';

export interface CityTruthRequest {
  mode: CityTruthMode;
  profile: CityPublicProfileKey;
  migratedLegacySandbox: boolean;
}

export type CityRealityBlocker =
  | 'profile-unapproved'
  | 'external-data-blocked'
  | 'licence-review-required'
  | 'production-package-missing';

export interface CityRealityAvailability {
  available: boolean;
  profile: CityExperienceProfile;
  packageReference: CityPackageRegistryReference | null;
  blockers: readonly CityRealityBlocker[];
}

export const CITY_TRUTH_MODES: Readonly<Record<CityTruthMode, Readonly<{
  labels: Readonly<{ en: string; zh: string }>;
  requiresApprovedPackage: boolean;
  allowsGeneratedGeometry: boolean;
}>>> = Object.freeze({
  reality: Object.freeze({
    labels: Object.freeze({ en: 'Reality', zh: '现实城市' }),
    requiresApprovedPackage: true,
    allowsGeneratedGeometry: false,
  }),
  'construction-scenario': Object.freeze({
    labels: Object.freeze({ en: 'Construction scenario', zh: '建设情景' }),
    requiresApprovedPackage: true,
    allowsGeneratedGeometry: false,
  }),
  sandbox: Object.freeze({
    labels: Object.freeze({ en: 'Sandbox', zh: '沙盒' }),
    requiresApprovedPackage: false,
    allowsGeneratedGeometry: true,
  }),
});

const EXPERIENCE_PROFILE_IDS: Readonly<Record<CityPublicProfileKey, CityExperienceProfileId>> = Object.freeze({
  shanghai: 'shanghai-lujiazui-v0',
  melbourne: 'melbourne-hoddle-grid-v0',
  'hong-kong': 'hong-kong-victoria-harbour-v0',
});

export function normalizeCityTruthMode(value: unknown): CityTruthMode {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'sandbox') return 'sandbox';
  if (mode === 'scenario' || mode === 'construction-scenario') return 'construction-scenario';
  return 'reality';
}

export function resolveCityTruthRequest(input: Readonly<{
  mode?: unknown;
  profile?: unknown;
}>): CityTruthRequest {
  const rawProfile = String(input.profile || '').trim().toLowerCase();
  const migratedLegacySandbox = rawProfile === 'sandbox';
  return Object.freeze({
    mode: migratedLegacySandbox ? 'sandbox' : normalizeCityTruthMode(input.mode),
    profile: normalizeCityExperienceProfileKey(migratedLegacySandbox ? 'shanghai' : rawProfile),
    migratedLegacySandbox,
  });
}

export function getCityExperienceProfile(profileKey: CityPublicProfileKey): CityExperienceProfile {
  return CITY_EXPERIENCE_PROFILES[EXPERIENCE_PROFILE_IDS[profileKey]];
}

export function evaluateCityRealityAvailability(
  profileKey: CityPublicProfileKey,
  packageReference: CityPackageRegistryReference | null | undefined,
): CityRealityAvailability {
  const profile = getCityExperienceProfile(profileKey);
  const blockers: CityRealityBlocker[] = [];
  // The registry is the production allow-list and can only reference a package
  // after its source layers, manifest, four approvals and release checks pass.
  // Legacy profile guards remain useful while no package exists, but must not
  // create a second, contradictory approval system once the registry is green.
  if (!packageReference) {
    if (profile.status !== 'approved') blockers.push('profile-unapproved');
    if (!profile.dataPolicy.externalDataAllowed) blockers.push('external-data-blocked');
    if (profile.dataPolicy.licenceReviewRequired) blockers.push('licence-review-required');
    blockers.push('production-package-missing');
  }
  return Object.freeze({
    available: Boolean(packageReference),
    profile,
    packageReference: packageReference ?? null,
    blockers: Object.freeze(blockers),
  });
}

export function mayMountGeneratedSandbox(request: CityTruthRequest): boolean {
  return request.mode === 'sandbox';
}
