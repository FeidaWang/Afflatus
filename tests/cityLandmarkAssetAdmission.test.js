import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  validateCityLandmarkAssetAdmission,
  validateCityLandmarkAssetReferences,
} from '../src/lib/validateCityLandmarkAssets.js';

const CONTRACT_PATH = resolve(import.meta.dirname, '../data/city/city-reality-contracts.json');
const reality = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const shanghai = reality.cities.find(({ id }) => id === 'shanghai');

function fixture() {
  return {
    schemaVersion: 2,
    packageId: 'shanghai-v1',
    cityId: 'shanghai',
    truthClass: 'rights-cleared-city-landmark-set',
    assets: shanghai.minimumLandmarks.map((landmark) => ({
      landmarkId: landmark.id,
      sourceKind: landmark.assetClass === 'terrain-hero' ? 'approved-terrain-source' : 'authored-original',
      anchor: {
        longitude: 121.497,
        latitude: 31.238,
        yawDegrees: 0,
        metresPerUnit: 1,
        localFrame: 'ENU',
        upAxis: 'Y',
        groundReference: 'approved-local-ground-v1',
      },
      lods: [0, 1, 2].map((level) => ({
        level,
        uri: `/assets/city/packages/shanghai-v1/landmarks/${landmark.id}-lod${level}.glb`,
        sha256: String(level + 1).repeat(64),
        byteLength: 1024 + level,
      })),
      wholeEnvelopeEmission: false,
      lightMaterialGroups: shanghai.landmarkAssetContract.requiredMaterialGroupsByLandmark[landmark.id]
        .map((name) => ({ name, lods: [0, 1], emitsWholeEnvelope: false })),
      rights: {
        mesh: 'approved',
        textures: 'approved',
        signage: 'approved',
        evidence: [`reviews/${landmark.id}-rights.md`],
      },
    })),
    nightGoldens: shanghai.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
      shanghai.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
        cameraId,
        platform,
        uri: `/assets/city/packages/shanghai-v1/goldens/${cameraId}-${platform}-night.png`,
        sha256: 'f'.repeat(64),
        byteLength: 128,
      }))
    )),
    silhouetteMasks: shanghai.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
      shanghai.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
        cameraId,
        platform,
        uri: `/assets/city/packages/shanghai-v1/goldens/${cameraId}-${platform}-silhouette-mask.png`,
        sha256: 'e'.repeat(64),
        byteLength: 128,
      }))
    )),
    performanceTraces: shanghai.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
      platform,
      uri: `/assets/city/packages/shanghai-v1/performance/${platform}-30m.json`,
      sha256: 'd'.repeat(64),
      byteLength: 128,
    })),
  };
}

function glb(materials) {
  const source = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, materials }), 'utf8');
  const jsonLength = Math.ceil(source.length / 4) * 4;
  const bytes = Buffer.alloc(20 + jsonLength, 0x20);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  source.copy(bytes, 20);
  return bytes;
}

function stage(admission) {
  const assetsByUri = {};
  for (const asset of admission.assets) {
    for (const lod of asset.lods) {
      const names = asset.lightMaterialGroups
        .filter((group) => group.lods.includes(lod.level))
        .map((group) => ({ name: group.name }));
      const bytes = glb([{ name: `surface-${asset.landmarkId}` }, ...names]);
      lod.sha256 = createHash('sha256').update(bytes).digest('hex');
      lod.byteLength = bytes.length;
      assetsByUri[lod.uri] = { bytes };
    }
  }
  for (const golden of [...admission.nightGoldens, ...admission.silhouetteMasks]) {
    const bytes = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    golden.sha256 = createHash('sha256').update(bytes).digest('hex');
    golden.byteLength = bytes.length;
    assetsByUri[golden.uri] = { bytes };
  }
  for (const trace of admission.performanceTraces) {
    const report = {
      schemaVersion: 1,
      packageId: admission.packageId,
      platform: trace.platform,
      durationMs: 30 * 60 * 1_000,
      canonicalCameraIds: shanghai.landmarkAssetContract.nightGoldenCameraIds,
      environmentStates: ['day', 'twilight', 'night'],
      longTaskCount: 0,
      longTaskTotalMs: 0,
      samples: shanghai.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
        ['day', 'twilight', 'night'].map((environment) => ({
          cameraId,
          environment,
          renderer: 'webgl',
          budgetWithinLimits: true,
          drawCalls: 20,
          triangles: 80_000,
          p95Ms: trace.platform === 'desktop' ? 16 : 30,
          activeGpuBytes: 64 * 1024 * 1024,
          horizontalOverflowPx: 0,
        }))
      )),
    };
    const bytes = Buffer.from(JSON.stringify(report));
    trace.sha256 = createHash('sha256').update(bytes).digest('hex');
    trace.byteLength = bytes.length;
    assetsByUri[trace.uri] = { bytes };
  }
  return assetsByUri;
}

describe('City landmark asset admission', () => {
  it('accepts a complete rights-cleared Shanghai asset set contract', () => {
    expect(validateCityLandmarkAssetAdmission(fixture(), shanghai)).toEqual({ ok: true, errors: [] });
  });

  it('rejects a missing core light group and whole-envelope emission', () => {
    const changed = fixture();
    const pearl = changed.assets.find(({ landmarkId }) => landmarkId === 'oriental-pearl');
    pearl.lightMaterialGroups.pop();
    pearl.wholeEnvelopeEmission = true;
    expect(validateCityLandmarkAssetAdmission(changed, shanghai).errors).toEqual(expect.arrayContaining([
      'assets[0].lightMaterialGroups: missing aviation-light-oriental-pearl',
      'assets[0].wholeEnvelopeEmission: must be false',
    ]));
  });

  it('rejects an invented light prefix, incomplete LODs, unapproved rights and missing goldens', () => {
    const changed = fixture();
    changed.assets[1].lods.pop();
    changed.assets[1].lightMaterialGroups[0].name = 'building-envelope-shanghai-tower-glow';
    changed.assets[1].rights.textures = 'review';
    changed.nightGoldens.pop();
    expect(validateCityLandmarkAssetAdmission(changed, shanghai).errors).toEqual(expect.arrayContaining([
      'assets[1].lods: must contain ordered LOD0, LOD1 and LOD2',
      'assets[1].lightMaterialGroups: missing landmark-light-shanghai-tower-crown',
      'assets[1].lightMaterialGroups[0].name: unknown authored light prefix',
      'assets[1].rights.textures: must be approved',
      'nightGoldens: must cover every canonical camera on desktop and mobile in order',
    ]));
  });

  it('requires ordered silhouette masks and 30-minute desktop/mobile performance traces', () => {
    const changed = fixture();
    changed.silhouetteMasks.pop();
    changed.performanceTraces.reverse();
    expect(validateCityLandmarkAssetAdmission(changed, shanghai).errors).toEqual(expect.arrayContaining([
      'silhouetteMasks: must cover every canonical camera on desktop and mobile in order',
      'performanceTraces: must contain ordered desktop and mobile traces',
    ]));
  });

  it('verifies checksums and required material groups inside the staged GLBs', () => {
    const admission = fixture();
    const assetsByUri = stage(admission);
    expect(validateCityLandmarkAssetReferences(admission, shanghai, assetsByUri))
      .toEqual({ ok: true, errors: [] });

    const pearl = admission.assets[0];
    const lod0 = pearl.lods[0];
    const corrupt = glb([
      { name: 'buildings-oriental-pearl-envelope', emissiveFactor: [1, 1, 1] },
      { name: 'landmark-lights-oriental-pearl' },
    ]);
    assetsByUri[lod0.uri] = { bytes: corrupt };
    const errors = validateCityLandmarkAssetReferences(admission, shanghai, assetsByUri).errors;
    expect(errors).toEqual(expect.arrayContaining([
      'oriental-pearl.lod0: SHA-256 does not match admission manifest',
      'oriental-pearl.lod0: material buildings-oriental-pearl-envelope emits a whole building envelope',
      'oriental-pearl.lod0: light material landmark-lights-oriental-pearl uses a forbidden plural prefix',
      'oriental-pearl.lod0: missing declared light material landmark-light-oriental-pearl',
      'oriental-pearl.lod0: missing declared light material aviation-light-oriental-pearl',
    ]));
  });

  it('rejects altered silhouette masks and performance samples outside release budgets', () => {
    const admission = fixture();
    const assetsByUri = stage(admission);
    const mask = admission.silhouetteMasks[0];
    assetsByUri[mask.uri].bytes = Buffer.from(assetsByUri[mask.uri].bytes);
    assetsByUri[mask.uri].bytes[mask.byteLength - 1] ^= 1;

    const trace = admission.performanceTraces[0];
    const report = JSON.parse(assetsByUri[trace.uri].bytes.toString('utf8'));
    report.durationMs -= 1;
    report.samples[0].activeGpuBytes = 221 * 1024 * 1024;
    assetsByUri[trace.uri].bytes = Buffer.from(JSON.stringify(report));

    expect(validateCityLandmarkAssetReferences(admission, shanghai, assetsByUri).errors)
      .toEqual(expect.arrayContaining([
        'bund-east-skyline.desktop.silhouetteMask: SHA-256 does not match admission manifest',
        'desktop.performanceTrace: SHA-256 does not match admission manifest',
        'desktop.performanceTrace.durationMs: must cover at least 30 minutes',
        'desktop.performanceTrace.samples[0].activeGpuBytes: exceeds desktop release budget',
      ]));
  });
});
