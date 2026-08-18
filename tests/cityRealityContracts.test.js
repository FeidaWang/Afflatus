import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCityRealityContracts } from '../src/lib/validateCityRealityContracts.js';

const CONTRACT_PATH = resolve(import.meta.dirname, '../data/city/city-reality-contracts.json');
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));

function spatialIdentity(city) {
  return createHash('sha256').update(JSON.stringify({
    precinct: city.precinct,
    coordinateFrame: city.coordinateFrame,
    sourceLayerRequirements: city.sourceLayerRequirements,
    minimumLandmarks: city.minimumLandmarks,
    landmarkAssetContract: city.landmarkAssetContract,
    canonicalCameras: city.canonicalCameras,
  })).digest('hex');
}

describe('City reality Wave 0 contracts', () => {
  it('validates all frozen precinct, datum, landmark, camera and rights contracts', () => {
    expect(validateCityRealityContracts(contract)).toEqual({ ok: true, errors: [] });
    expect(contract.cities.map(({ id }) => id)).toEqual(['shanghai', 'melbourne', 'hong-kong']);
    expect(contract.rightsChecklist.every(({ status }) => status !== 'approved')).toBe(true);
  });

  it('keeps real-city spatial identity independent from a Sandbox seed', () => {
    for (const city of contract.cities) {
      const before = spatialIdentity({ ...city, visualSeed: 'alpha' });
      const after = spatialIdentity({ ...city, visualSeed: 'omega' });
      expect(after, city.id).toBe(before);
    }
  });

  it('rejects an origin outside the frozen AOI', () => {
    const changed = structuredClone(contract);
    changed.cities[0].coordinateFrame.originWgs84.longitude = 0;
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('cities[0].coordinateFrame.originWgs84: must remain inside the frozen AOI');
  });

  it('rejects removing a required landmark or canonical view floor', () => {
    const changed = structuredClone(contract);
    changed.cities[2].minimumLandmarks = [];
    changed.cities[2].canonicalCameras = [];
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('cities[2].minimumLandmarks: at least five landmarks are required');
    expect(result.errors).toContain('cities[2].canonicalCameras: at least five cameras are required');
  });

  it('requires bilingual names for every canonical camera', () => {
    const changed = structuredClone(contract);
    changed.cities[0].canonicalCameras[0].labels.zh = '';
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'cities[0].canonicalCameras[0].labels: bilingual labels are required',
    );
  });

  it('rejects weakening a frozen Shanghai core light rig', () => {
    const changed = structuredClone(contract);
    changed.cities[0].landmarkAssetContract.requiredMaterialGroupsByLandmark['oriental-pearl'].pop();
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'cities[0].landmarkAssetContract.requiredMaterialGroupsByLandmark.oriental-pearl: Shanghai core light groups are frozen',
    );
  });

  it('rejects unknown light prefixes and whole-building emission', () => {
    const changed = structuredClone(contract);
    changed.cities[0].landmarkAssetContract.wholeBuildingEmissionAllowed = true;
    changed.cities[0].landmarkAssetContract.requiredMaterialGroupsByLandmark['oriental-pearl'][1]
      = 'buildings-oriental-pearl-glow';
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'cities[0].landmarkAssetContract.wholeBuildingEmissionAllowed: must be false',
    );
    expect(result.errors).toContain(
      'cities[0].landmarkAssetContract.requiredMaterialGroupsByLandmark.oriental-pearl: buildings-oriental-pearl-glow is not an allowed authored light material group',
    );
  });

  it('requires desktop and mobile night goldens for every canonical camera', () => {
    const changed = structuredClone(contract);
    changed.cities[1].landmarkAssetContract.nightGoldenCameraIds.pop();
    changed.cities[1].landmarkAssetContract.nightGoldenPlatforms = ['desktop'];
    const result = validateCityRealityContracts(changed);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'cities[1].landmarkAssetContract.nightGoldenCameraIds: must cover every canonical camera in order',
    );
    expect(result.errors).toContain(
      'cities[1].landmarkAssetContract.nightGoldenPlatforms: must be desktop, mobile',
    );
  });
});
