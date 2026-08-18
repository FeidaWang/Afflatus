import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadCityProductionFirstFrame,
  prepareCityProductionRuntime,
} from '../src/city/productionRuntime.ts';

const PACKAGE_DIRECTORY = resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1',
);
const sourceManifest = JSON.parse(readFileSync(resolve(PACKAGE_DIRECTORY, 'manifest.json'), 'utf8'));
const sourceIndex = JSON.parse(readFileSync(resolve(PACKAGE_DIRECTORY, 'entities-index.json'), 'utf8'));
const MANIFEST_PATH = 'public/assets/city/packages/melbourne-runtime-fixture-v1/manifest.json';
const MANIFEST_URL = '/assets/city/packages/melbourne-runtime-fixture-v1/manifest.json';

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function productionFixture() {
  const manifest = structuredClone(sourceManifest);
  const index = structuredClone(sourceIndex);
  manifest.status = 'production-approved';
  manifest.landmarkAssets = {
    admissionUri: `/assets/city/packages/${manifest.packageId}/landmark-admission.json`,
    sha256: 'e'.repeat(64),
    byteLength: 1024,
  };
  manifest.canonicalViews = Array.from({ length: 5 }, (_, index) => ({
    id: `runtime-fixture-view-${index + 1}`,
    labels: { en: `Runtime view ${index + 1}`, zh: `运行时视角 ${index + 1}` },
    positionLocal: { x: 1047.5 + index, y: 525, z: 1115 },
    targetLocal: { x: 250, y: 18, z: 125 },
    verticalFovDegrees: 42,
    verticalBasis: 'local-datum-metres',
    verticalEvidence: 'tests/fixtures/city/runtime-camera.md',
  }));
  manifest.release.featureFlag = 'city-melbourne-runtime-fixture-v1';
  for (const role of Object.keys(manifest.approvals)) {
    manifest.approvals[role] = {
      status: 'approved',
      by: `${role}-fixture-reviewer`,
      at: '2026-08-18',
      evidence: `data/city/reviews/${role}-fixture.md`,
    };
  }
  index.packageId = manifest.packageId;
  index.runtime.representation = 'CityPackage GLB';
  index.runtime.candidateOnly = false;
  const indexBytes = Buffer.from(JSON.stringify(index));
  const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
  indexAsset.sha256 = hash(indexBytes);
  indexAsset.byteLength = indexBytes.byteLength;
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const packageReference = {
    packageId: manifest.packageId,
    manifestPath: MANIFEST_PATH,
    manifestSha256: hash(manifestBytes),
  };
  const readBytes = async (uri, signal) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (uri === MANIFEST_URL) return manifestBytes;
    if (uri === indexAsset.uri) return indexBytes;
    if (uri.startsWith('/assets/city/packages/')) {
      return readFileSync(resolve(PACKAGE_DIRECTORY, uri.split('/').at(-1)));
    }
    throw new Error(`Unexpected fixture URI: ${uri}`);
  };
  return { manifest, manifestBytes, packageReference, readBytes };
}

describe('production CityPackage runtime', () => {
  it('opens an approved package through the same registry-to-session route used by production', async () => {
    const fixture = productionFixture();
    const result = await prepareCityProductionRuntime({
      cityId: 'melbourne',
      packageReference: fixture.packageReference,
      readBytes: fixture.readBytes,
    });
    expect(result.status).toBe('ready');
    expect(result.manifest.packageId).toBe('melbourne-flinders-federation-v1');
    expect(result.session.packageId).toBe('melbourne-flinders-federation-v1');
    expect(result.manifestSha256).toBe(fixture.packageReference.manifestSha256);
  });

  it('loads a budgeted first frame from the generic production index', async () => {
    const fixture = productionFixture();
    const runtime = await prepareCityProductionRuntime({
      cityId: 'melbourne',
      packageReference: fixture.packageReference,
      readBytes: fixture.readBytes,
    });
    expect(runtime.status).toBe('ready');
    const firstFrame = await loadCityProductionFirstFrame({ runtime });
    expect(firstFrame.status).toBe('ready');
    expect(firstFrame.tileLoad.tiles.length).toBeGreaterThan(0);
    expect(firstFrame.tileLoad.tiles.every(({ lod }) => lod === 0)).toBe(true);
    expect(firstFrame.cameraPreset).toEqual({
      position: { x: 1047.5, y: 525, z: 1115 },
      target: { x: 250, y: 18, z: 125 },
      fov: 42,
    });
  });

  it('fails closed on a registry checksum mismatch', async () => {
    const fixture = productionFixture();
    fixture.packageReference.manifestSha256 = '0'.repeat(64);
    await expect(prepareCityProductionRuntime({
      cityId: 'melbourne',
      packageReference: fixture.packageReference,
      readBytes: fixture.readBytes,
    })).resolves.toEqual({ status: 'fallback', reason: 'manifest-checksum-mismatch' });
  });

  it('rejects a remote or non-public manifest reference before fetching', async () => {
    const fixture = productionFixture();
    fixture.packageReference.manifestPath = 'https://example.com/manifest.json';
    let reads = 0;
    await expect(prepareCityProductionRuntime({
      cityId: 'melbourne',
      packageReference: fixture.packageReference,
      readBytes: async (...args) => {
        reads += 1;
        return fixture.readBytes(...args);
      },
    })).resolves.toEqual({ status: 'fallback', reason: 'registry-reference-invalid' });
    expect(reads).toBe(0);
  });

  it('fails closed when registry city and manifest identity disagree', async () => {
    const fixture = productionFixture();
    await expect(prepareCityProductionRuntime({
      cityId: 'shanghai',
      packageReference: fixture.packageReference,
      readBytes: fixture.readBytes,
    })).resolves.toEqual({ status: 'fallback', reason: 'manifest-identity-mismatch' });
  });

  it('does not open a merely promoted candidate without four approvals', async () => {
    const fixture = productionFixture();
    fixture.manifest.approvals.legal = {
      status: 'review', by: null, at: null, evidence: null,
    };
    const manifestBytes = Buffer.from(JSON.stringify(fixture.manifest));
    fixture.packageReference.manifestSha256 = hash(manifestBytes);
    const readBytes = async (uri, signal) => (
      uri === MANIFEST_URL ? manifestBytes : fixture.readBytes(uri, signal)
    );
    await expect(prepareCityProductionRuntime({
      cityId: 'melbourne',
      packageReference: fixture.packageReference,
      readBytes,
    })).resolves.toEqual({ status: 'fallback', reason: 'package-session-failed' });
  });
});
