import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import {
  createCityProvenance,
  createGeneratedCityScene,
} from '../src/city/sceneModel.ts';

describe('City scene semantic adapter', () => {
  it('flattens a deterministic plan into globally unique sourced entities', () => {
    const plan = generateSandboxCity('city-scene-contract', 'melbourne');
    const first = createGeneratedCityScene(plan);
    const second = createGeneratedCityScene(generateSandboxCity('city-scene-contract', 'melbourne'));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 1,
      seed: 'city-scene-contract',
      profileId: 'melbourne-concept-v0',
      truthClass: 'generated-concept',
      packageId: null,
    });
    expect(new Set(first.entities.map(({ id }) => id)).size).toBe(first.entities.length);
    expect(first.entities).toHaveLength(
      plan.blocks.length
      + plan.roads.length
      + plan.buildings.length
      + plan.heroLandmarks.length
      + plan.trees.length
      + plan.vehicles.length
      + plan.water.length,
    );
    expect(first.entities.every(({ assetId, lodProfile, sources }) => (
      assetId.length > 0
      && lodProfile.length > 0
      && sources.length === 1
      && sources[0].truthClass === 'generated-concept'
      && sources[0].sourceCrs === 'LOCAL:PLAN'
    ))).toBe(true);
  });

  it('fails closed when provenance is incomplete or real data has no explicit CRS', () => {
    expect(() => createCityProvenance({
      truthClass: 'licensed-real-data',
      sourceId: 'provider',
      sourceUrl: 'https://example.com/dataset',
      datasetVersion: '2026-08',
      licence: '',
      licenceSnapshotSha256: 'a'.repeat(64),
      sourceArtifactSha256: 'b'.repeat(64),
      attribution: 'Provider',
      sourceCrs: 'EPSG:4326',
      capturedAt: '2026-08-15',
      approvalStatus: 'production-approved',
    })).toThrow(/licence/);
    expect(() => createCityProvenance({
      truthClass: 'licensed-real-data',
      sourceId: 'provider',
      sourceUrl: 'https://example.com/dataset',
      datasetVersion: '2026-08',
      licence: 'approved-commercial',
      licenceSnapshotSha256: 'a'.repeat(64),
      sourceArtifactSha256: 'b'.repeat(64),
      attribution: 'Provider',
      sourceCrs: 'LOCAL:PLAN',
      capturedAt: '2026-08-15',
      approvalStatus: 'production-approved',
    })).toThrow(/explicit source CRS/);
  });

  it('does not admit real provenance without immutable hashes and production approval', () => {
    expect(() => createCityProvenance({
      truthClass: 'licensed-real-data',
      sourceId: 'provider',
      sourceUrl: 'https://example.com/dataset',
      datasetVersion: '2026-08',
      licence: 'CC-BY-4.0',
      licenceSnapshotSha256: null,
      sourceArtifactSha256: null,
      attribution: 'Provider',
      sourceCrs: 'EPSG:7855',
      capturedAt: '2026-08-15',
      approvalStatus: 'generated',
    })).toThrow(/licenceSnapshotSha256/);
  });
});
