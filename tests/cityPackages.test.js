import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canPublishCityPackage,
  validateCityPackageAssetReferences,
  validateCityPackageManifest,
  validateCityPackageRegistry,
} from '../src/lib/validateCityPackages.js';
import { validateCityPackageReleaseReferences } from '../src/lib/validateCityPackageReleases.js';
import { wgs84ToLocalEnu } from '../src/city/projection.ts';

const REGISTRY_PATH = resolve(import.meta.dirname, '../data/city/city-package-registry.json');
const LEDGER_PATH = resolve(import.meta.dirname, '../data/city/city-data-ledger.json');
const REALITY_PATH = resolve(import.meta.dirname, '../data/city/city-reality-contracts.json');
const MANIFEST_PATH = 'public/assets/city/packages/melbourne-core-v1/manifest.json';
const CANDIDATE_MANIFEST_PATH = resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1/manifest.json',
);
const MELBOURNE_EVIDENCE_SHA = '6cfeacc65b1486e274ffcd225af3fd49e47e69f4c5a39f2fc2c23e6b2934fde2';

const fixture = (path) => JSON.parse(readFileSync(path, 'utf8'));
const approval = (role) => ({
  status: 'approved',
  by: `${role}-reviewer`,
  at: '2026-08-15',
  evidence: `reviews/${role}.md`,
});

function syntheticCanonicalViews() {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `fixture-view-${index + 1}`,
    labels: { en: `Fixture view ${index + 1}`, zh: `测试视角 ${index + 1}` },
    positionLocal: { x: 1000 + index, y: 500, z: 1000 },
    targetLocal: { x: 250, y: 20, z: 125 },
    verticalFovDegrees: 42,
    verticalBasis: 'local-datum-metres',
    verticalEvidence: 'tests/fixtures/city/canonical-view.md',
  }));
}

function contractCanonicalViews(contract, anchor) {
  return contract.canonicalCameras.map((camera, index) => {
    const position = wgs84ToLocalEnu(camera.positionWgs84, anchor);
    const target = wgs84ToLocalEnu(camera.targetWgs84, anchor);
    return {
      id: camera.id,
      labels: structuredClone(camera.labels),
      positionLocal: { x: position.east, y: 120 + index * 10, z: -position.north },
      targetLocal: { x: target.east, y: 45, z: -target.north },
      verticalFovDegrees: camera.verticalFovDegrees,
      verticalBasis: 'local-datum-metres',
      verticalEvidence: `reviews/${camera.id}-vertical-camera-evidence.md`,
    };
  });
}

function packageFixture({ approved = false } = {}) {
  return {
    schemaVersion: 1,
    packageId: 'melbourne-core-v1',
    packageVersion: '2026.08.15+fixture',
    cityId: 'melbourne',
    truthClass: 'licensed-real-data',
    status: approved ? 'production-approved' : 'candidate',
    precinct: {
      status: approved ? 'frozen' : 'candidate-unverified',
      labels: { en: 'Melbourne core', zh: '墨尔本核心区' },
      boundsWgs84: { west: 144.945, south: -37.835, east: 144.99, north: -37.795 },
      anchorWgs84: { longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 },
      localFrame: 'ENU',
      ianaTimeZone: 'Australia/Melbourne',
    },
    sourceLayers: [{
      ledgerLayerId: 'melbourne-buildings-2023',
      datasetId: '2023-building-footprints',
      provider: 'City of Melbourne',
      sourceUrl: 'https://data.melbourne.vic.gov.au/explore/dataset/2023-building-footprints/',
      datasetVersion: 'static-capture-2023-05',
      capturedAt: '2023-05',
      retrievedAt: '2026-08-15',
      sourceCrs: approved
        ? { status: 'declared', identifier: 'EPSG:7855', axisOrder: 'easting,northing', unit: 'metre' }
        : { status: 'review', identifier: null, axisOrder: null, unit: null },
      verticalDatum: approved
        ? { status: 'declared', name: 'AHD', unit: 'metre', transformPipeline: 'AHD-to-local-ENU-v1' }
        : { status: 'review', name: null, unit: null, transformPipeline: null },
      spatialVerification: approved ? 'verified' : 'review',
      licenceSpdx: 'CC-BY-4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
      licenceSnapshotSha256: MELBOURNE_EVIDENCE_SHA,
      attribution: 'City of Melbourne — 2023 Building Footprints, CC BY 4.0.',
      sourceArtifactSha256: 'b'.repeat(64),
      rights: Object.fromEntries(['cache', 'derivatives', 'redistribution', 'commercialUse']
        .map((right) => [right, approved ? 'allowed' : 'review'])),
      truthClass: 'authoritative',
      confidence: 'official',
      transformHistory: approved ? ['EPSG:7855 to local ENU using approved pipeline v1'] : [],
    }],
    assets: [{
      id: 'entities-index',
      kind: 'entities-index',
      uri: '/assets/city/packages/melbourne-core-v1/entities.bin',
      sha256: 'c'.repeat(64),
      byteLength: 1024,
      lod: null,
    }],
    landmarkAssets: approved ? {
      admissionUri: '/assets/city/packages/melbourne-core-v1/landmark-admission.json',
      sha256: 'e'.repeat(64),
      byteLength: 1024,
    } : null,
    canonicalViews: approved ? syntheticCanonicalViews() : null,
    generatedAt: '2026-08-15T12:00:00.000Z',
    approvals: Object.fromEntries(['dataOwner', 'legal', 'engineering', 'productRelease']
      .map((role) => [role, approved
        ? approval(role)
        : { status: 'review', by: null, at: null, evidence: null }])),
    release: {
      featureFlag: 'city-melbourne-real-v1',
      withdrawalOwner: 'productRelease',
      rollbackPackageId: null,
    },
  };
}

function landmarkGlb(materials) {
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

function stageLandmarkAdmission(manifest, reality) {
  const contract = reality.cities.find(({ id }) => id === manifest.cityId);
  manifest.precinct.boundsWgs84 = structuredClone(contract.precinct.boundsWgs84);
  manifest.canonicalViews = contractCanonicalViews(contract, manifest.precinct.anchorWgs84);
  const admission = {
    schemaVersion: 2,
    packageId: manifest.packageId,
    cityId: manifest.cityId,
    truthClass: 'rights-cleared-city-landmark-set',
    assets: contract.minimumLandmarks.map((landmark) => ({
      landmarkId: landmark.id,
      sourceKind: landmark.assetClass === 'terrain-hero' ? 'approved-terrain-source' : 'authored-original',
      anchor: {
        ...contract.coordinateFrame.originWgs84,
        yawDegrees: 0,
        metresPerUnit: 1,
        localFrame: 'ENU',
        upAxis: 'Y',
        groundReference: 'approved-local-ground-v1',
      },
      lods: [0, 1, 2].map((level) => ({
        level,
        uri: `/assets/city/packages/${manifest.packageId}/landmarks/${landmark.id}-lod${level}.glb`,
        sha256: '0'.repeat(64),
        byteLength: 1,
      })),
      wholeEnvelopeEmission: false,
      lightMaterialGroups: contract.landmarkAssetContract.requiredMaterialGroupsByLandmark[landmark.id]
        .map((name) => ({ name, lods: [0, 1], emitsWholeEnvelope: false })),
      rights: {
        mesh: 'approved',
        textures: 'approved',
        signage: 'approved',
        evidence: [`reviews/${landmark.id}-rights.md`],
      },
    })),
    nightGoldens: contract.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
      contract.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
        cameraId,
        platform,
        uri: `/assets/city/packages/${manifest.packageId}/goldens/${cameraId}-${platform}-night.png`,
        sha256: '0'.repeat(64),
        byteLength: 1,
      }))
    )),
    silhouetteMasks: contract.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
      contract.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
        cameraId,
        platform,
        uri: `/assets/city/packages/${manifest.packageId}/goldens/${cameraId}-${platform}-silhouette-mask.png`,
        sha256: '0'.repeat(64),
        byteLength: 1,
      }))
    )),
    performanceTraces: contract.landmarkAssetContract.nightGoldenPlatforms.map((platform) => ({
      platform,
      uri: `/assets/city/packages/${manifest.packageId}/performance/${platform}-30m.json`,
      sha256: '0'.repeat(64),
      byteLength: 1,
    })),
  };
  const artifacts = {};
  for (const asset of admission.assets) {
    for (const lod of asset.lods) {
      const materials = asset.lightMaterialGroups
        .filter((group) => group.lods.includes(lod.level))
        .map(({ name }) => ({ name }));
      const bytes = landmarkGlb([{ name: `surface-${asset.landmarkId}` }, ...materials]);
      lod.sha256 = createHash('sha256').update(bytes).digest('hex');
      lod.byteLength = bytes.length;
      artifacts[lod.uri] = { bytes };
    }
  }
  for (const golden of [...admission.nightGoldens, ...admission.silhouetteMasks]) {
    const bytes = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    golden.sha256 = createHash('sha256').update(bytes).digest('hex');
    golden.byteLength = bytes.length;
    artifacts[golden.uri] = { bytes };
  }
  for (const trace of admission.performanceTraces) {
    const report = {
      schemaVersion: 1,
      packageId: admission.packageId,
      platform: trace.platform,
      durationMs: 30 * 60 * 1_000,
      canonicalCameraIds: contract.landmarkAssetContract.nightGoldenCameraIds,
      environmentStates: ['day', 'twilight', 'night'],
      longTaskCount: 0,
      longTaskTotalMs: 0,
      samples: contract.landmarkAssetContract.nightGoldenCameraIds.flatMap((cameraId) => (
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
    artifacts[trace.uri] = { bytes };
  }
  const admissionBytes = Buffer.from(JSON.stringify(admission));
  manifest.landmarkAssets = {
    admissionUri: `/assets/city/packages/${manifest.packageId}/landmark-admission.json`,
    sha256: createHash('sha256').update(admissionBytes).digest('hex'),
    byteLength: admissionBytes.length,
  };
  artifacts[manifest.landmarkAssets.admissionUri] = {
    sha256: manifest.landmarkAssets.sha256,
    byteLength: admissionBytes.length,
    bytes: admissionBytes,
    data: admission,
  };
  return artifacts;
}

function registryWith(manifest) {
  const registry = fixture(REGISTRY_PATH);
  registry.productionPackages.melbourne = {
    packageId: manifest.packageId,
    manifestPath: MANIFEST_PATH,
    manifestSha256: 'd'.repeat(64),
  };
  return registry;
}

function approveLedgerLayer(ledger, manifest) {
  const city = ledger.cities.find(({ id }) => id === 'melbourne');
  const layer = city.layers.find(({ id }) => id === 'melbourne-buildings-2023');
  city.precinct.status = 'frozen';
  city.precinct.tileInventoryStatus = 'frozen';
  city.precinct.controlPointStatus = 'verified';
  city.releaseBlockers.forEach((blocker) => { blocker.status = 'resolved'; });
  layer.spatial.verificationStatus = 'verified';
  layer.spatial.horizontalCrs = manifest.sourceLayers[0].sourceCrs.identifier;
  layer.spatial.verticalDatum = manifest.sourceLayers[0].verticalDatum.name;
  layer.sourceArtifactSha256 = manifest.sourceLayers[0].sourceArtifactSha256;
  Object.keys(layer.rights).forEach((right) => { layer.rights[right] = 'allowed'; });
  layer.approvals.dataOwner = approval('dataOwner');
  layer.approvals.legal = approval('legal');
  layer.approvals.engineering = approval('engineering');
  layer.approvals.productRelease = approval('productRelease');
  layer.decisions.acquisition = 'approved';
  layer.decisions.production = 'approved';
}

describe('CityPackage release gate', () => {
  it('keeps the production registry empty while all three cities are concepts', () => {
    const registry = fixture(REGISTRY_PATH);
    expect(validateCityPackageRegistry(registry)).toEqual({ ok: true, errors: [] });
    expect(registry.productionPackages).toEqual({
      shanghai: null,
      melbourne: null,
      'hong-kong': null,
    });
    expect(validateCityPackageReleaseReferences(registry, {}, fixture(LEDGER_PATH)))
      .toEqual({ ok: true, errors: [] });
  });

  it('accepts a candidate schema without treating review fields as publishable', () => {
    const manifest = packageFixture();
    expect(validateCityPackageManifest(manifest)).toEqual({ ok: true, errors: [] });
    expect(canPublishCityPackage(manifest)).toBe(false);
  });

  it('requires an explicit landmark admission reference for production packages', () => {
    const manifest = packageFixture({ approved: true });
    manifest.landmarkAssets = null;
    const result = validateCityPackageManifest(manifest);
    expect(result.errors).toContain(
      'landmarkAssets: production packages require an admitted landmark asset set',
    );
    expect(canPublishCityPackage(manifest)).toBe(false);
  });

  it('requires five frozen canonical views for production packages', () => {
    const manifest = packageFixture({ approved: true });
    manifest.canonicalViews = null;
    const result = validateCityPackageManifest(manifest);
    expect(result.errors).toContain(
      'canonicalViews: production packages require frozen canonical views',
    );
    expect(canPublishCityPackage(manifest)).toBe(false);
  });

  it('requires bilingual canonical-view labels', () => {
    const manifest = packageFixture({ approved: true });
    manifest.canonicalViews[0].labels.zh = '';
    expect(validateCityPackageManifest(manifest).errors).toContain(
      'canonicalViews[0].labels: bilingual labels are required',
    );
  });

  it('requires package approval and independently approved ledger layers', () => {
    const manifest = packageFixture({ approved: true });
    const reality = fixture(REALITY_PATH);
    const releaseArtifacts = stageLandmarkAdmission(manifest, reality);
    const registry = registryWith(manifest);
    const packages = {
      [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest },
    };
    expect(canPublishCityPackage(manifest)).toBe(true);

    const blocked = validateCityPackageReleaseReferences(
      registry,
      packages,
      fixture(LEDGER_PATH),
      reality,
      releaseArtifacts,
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.errors).toContain(
      'productionPackages.melbourne: ledger layer melbourne-buildings-2023 is not production-approved',
    );

    const approvedLedger = fixture(LEDGER_PATH);
    approveLedgerLayer(approvedLedger, manifest);
    expect(validateCityPackageReleaseReferences(
      registry,
      packages,
      approvedLedger,
      reality,
      releaseArtifacts,
    ))
      .toEqual({ ok: true, errors: [] });
  });

  it('blocks a production registry reference when landmark admission bytes are absent', () => {
    const manifest = packageFixture({ approved: true });
    const registry = registryWith(manifest);
    const packages = {
      [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest },
    };
    const result = validateCityPackageReleaseReferences(
      registry,
      packages,
      fixture(LEDGER_PATH),
      fixture(REALITY_PATH),
      {},
    );
    expect(result.errors).toContain(
      'productionPackages.melbourne: landmark admission artifact is missing',
    );
  });

  it('blocks a production registry reference when an admitted landmark GLB is altered', () => {
    const manifest = packageFixture({ approved: true });
    const reality = fixture(REALITY_PATH);
    const releaseArtifacts = stageLandmarkAdmission(manifest, reality);
    const glbUri = Object.keys(releaseArtifacts).find((uri) => uri.endsWith('.glb'));
    releaseArtifacts[glbUri].bytes = Buffer.from(releaseArtifacts[glbUri].bytes);
    releaseArtifacts[glbUri].bytes[releaseArtifacts[glbUri].bytes.length - 1] ^= 1;
    const registry = registryWith(manifest);
    const packages = {
      [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest },
    };
    const result = validateCityPackageReleaseReferences(
      registry,
      packages,
      fixture(LEDGER_PATH),
      reality,
      releaseArtifacts,
    );
    expect(result.errors).toContain(
      'productionPackages.melbourne: landmark admission assets are invalid',
    );
  });

  it('blocks a production registry reference when a canonical camera drifts horizontally', () => {
    const manifest = packageFixture({ approved: true });
    const reality = fixture(REALITY_PATH);
    const releaseArtifacts = stageLandmarkAdmission(manifest, reality);
    manifest.canonicalViews[0].positionLocal.x += 2;
    const registry = registryWith(manifest);
    const packages = {
      [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest },
    };
    const result = validateCityPackageReleaseReferences(
      registry,
      packages,
      fixture(LEDGER_PATH),
      reality,
      releaseArtifacts,
    );
    expect(result.errors).toContain(
      'productionPackages.melbourne.southbank-north-cbd: horizontal ENU pose does not match WGS84 camera contract',
    );
  });

  it('blocks a production registry reference when a canonical camera is relabelled', () => {
    const manifest = packageFixture({ approved: true });
    const reality = fixture(REALITY_PATH);
    const releaseArtifacts = stageLandmarkAdmission(manifest, reality);
    manifest.canonicalViews[0].labels.en = 'Invented skyline';
    const result = validateCityPackageReleaseReferences(
      registryWith(manifest),
      { [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest } },
      fixture(LEDGER_PATH),
      reality,
      releaseArtifacts,
    );
    expect(result.errors).toContain(
      'productionPackages.melbourne.southbank-north-cbd: bilingual labels do not match camera contract',
    );
  });

  it('rejects remote package assets and approval without named evidence', () => {
    const manifest = packageFixture({ approved: true });
    manifest.assets[0].uri = 'https://example.com/entities.bin';
    manifest.approvals.legal = { status: 'approved', by: null, at: null, evidence: null };
    const result = validateCityPackageManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('assets[0].uri: must be a local CityPackage asset');
    expect(result.errors).toContain('approvals.legal: approved status requires by, at and evidence');
    expect(canPublishCityPackage(manifest)).toBe(false);
  });

  it('validates the staged Melbourne tile inventory without making it publishable', () => {
    const manifest = fixture(CANDIDATE_MANIFEST_PATH);
    const directory = dirname(CANDIDATE_MANIFEST_PATH);
    const assets = Object.fromEntries(manifest.assets.map((asset) => {
      const bytes = readFileSync(resolve(directory, asset.uri.split('/').at(-1)));
      return [asset.uri, {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        byteLength: bytes.length,
        bytes,
        data: asset.uri.endsWith('.json') ? JSON.parse(bytes.toString('utf8')) : null,
      }];
    }));
    expect(validateCityPackageAssetReferences(manifest, assets)).toEqual({ ok: true, errors: [] });
    expect(manifest.precinct.status).toBe('frozen');
    expect(manifest.sourceLayers).toHaveLength(7);
    expect(canPublishCityPackage(manifest)).toBe(false);

    const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
    const brokenAssets = structuredClone(assets);
    brokenAssets[indexAsset.uri].data.terrain.sourceCellValuesResampled = true;
    expect(validateCityPackageAssetReferences(manifest, brokenAssets).errors)
      .toContain('entities-index.terrain.sourceCellValuesResampled: must be false');
  });
});
