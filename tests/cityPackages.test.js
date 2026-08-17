import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canPublishCityPackage,
  validateCityPackageAssetReferences,
  validateCityPackageManifest,
  validateCityPackageRegistry,
  validateCityPackageReleaseReferences,
} from '../src/lib/validateCityPackages.js';

const REGISTRY_PATH = resolve(import.meta.dirname, '../data/city/city-package-registry.json');
const LEDGER_PATH = resolve(import.meta.dirname, '../data/city/city-data-ledger.json');
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

  it('requires package approval and independently approved ledger layers', () => {
    const manifest = packageFixture({ approved: true });
    const registry = registryWith(manifest);
    const packages = {
      [MANIFEST_PATH]: { sha256: 'd'.repeat(64), data: manifest },
    };
    expect(canPublishCityPackage(manifest)).toBe(true);

    const blocked = validateCityPackageReleaseReferences(registry, packages, fixture(LEDGER_PATH));
    expect(blocked.ok).toBe(false);
    expect(blocked.errors).toContain(
      'productionPackages.melbourne: ledger layer melbourne-buildings-2023 is not production-approved',
    );

    const approvedLedger = fixture(LEDGER_PATH);
    approveLedgerLayer(approvedLedger, manifest);
    expect(validateCityPackageReleaseReferences(registry, packages, approvedLedger))
      .toEqual({ ok: true, errors: [] });
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
