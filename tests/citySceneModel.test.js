import { describe, expect, it } from 'vitest';
import { generateSandboxCity } from '../src/city/generate.ts';
import {
  createCityProvenance,
  createSandboxCityScene,
} from '../src/city/sceneModel.ts';

describe('City scene semantic adapter', () => {
  it('flattens a deterministic plan into globally unique sourced entities', () => {
    const plan = generateSandboxCity('city-scene-contract', 'melbourne');
    const first = createSandboxCityScene(plan);
    const second = createSandboxCityScene(generateSandboxCity('city-scene-contract', 'melbourne'));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: 1,
      seed: 'city-scene-contract',
      profileId: 'melbourne-concept-v0',
      truthClass: 'generated-concept',
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
    expect(first.entities.every(({ assetId, lodProfile, source }) => (
      assetId.length > 0
      && lodProfile.length > 0
      && source.truthClass === 'generated-concept'
      && source.sourceCrs === 'LOCAL:PLAN'
    ))).toBe(true);
  });

  it('fails closed when provenance is incomplete or real data has no explicit CRS', () => {
    expect(() => createCityProvenance({
      truthClass: 'licensed-real-data',
      sourceId: 'provider',
      datasetVersion: '2026-08',
      licence: '',
      attribution: 'Provider',
      sourceCrs: 'EPSG:4326',
      capturedAt: '2026-08-15',
    })).toThrow(/licence/);
    expect(() => createCityProvenance({
      truthClass: 'licensed-real-data',
      sourceId: 'provider',
      datasetVersion: '2026-08',
      licence: 'approved-commercial',
      attribution: 'Provider',
      sourceCrs: 'LOCAL:PLAN',
      capturedAt: '2026-08-15',
    })).toThrow(/explicit source CRS/);
  });
});
