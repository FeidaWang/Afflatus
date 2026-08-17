import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  loadCandidateCityTiles,
  openCandidateCityPackage,
} from '../src/city/packageLoader.ts';

const packageDirectory = resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1',
);
const manifest = JSON.parse(readFileSync(resolve(packageDirectory, 'manifest.json'), 'utf8'));
const index = JSON.parse(readFileSync(resolve(packageDirectory, 'entities-index.json'), 'utf8'));

const stagedAsset = (uri) => readFileSync(resolve(packageDirectory, uri.split('/').at(-1)));
const fetchAsset = async (uri, signal) => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return stagedAsset(uri);
};

describe('candidate CityPackage loader', () => {
  it('loads a checksummed tile and its cross-tile ownership dependencies', async () => {
    const requested = index.tiles.find(({ id }) => id === 'tile-c01-r02');
    const result = await loadCandidateCityTiles({
      manifest,
      requestedTileIds: [requested.id],
      lod: 0,
      fetchAsset,
    });
    expect(result.status).toBe('ready');
    expect(result.packageId).toBe('melbourne-flinders-federation-v1');
    expect(result.requestedTileIds).toEqual([requested.id]);
    expect(result.resolvedTileIds).toEqual(
      [requested.id, ...requested.dependencyTileIds].sort(),
    );
    expect(result.resolvedTileIds).not.toContain('tile-c00-r00');
    expect(result.tiles.every(({ bytes, statistics }) => (
      bytes.byteLength > 0 && statistics.drawCalls > 0 && statistics.drawCalls <= 7
    ))).toBe(true);
    expect(result.tiles.every(({ features, statistics }) => (
      features.length === statistics.featureCount
    ))).toBe(true);
  });

  it('opens and verifies the index once for reusable spatial loads', async () => {
    let indexFetchCount = 0;
    const opened = await openCandidateCityPackage({
      manifest,
      fetchAsset: async (uri, signal) => {
        if (uri.endsWith('entities-index.json')) indexFetchCount += 1;
        return fetchAsset(uri, signal);
      },
    });
    expect(opened.status).toBe('ready');
    const first = await opened.session.loadTiles({
      requestedTileIds: ['tile-c01-r02'],
      lod: 0,
    });
    const second = await opened.session.loadTiles({
      requestedTileIds: ['tile-c02-r02'],
      lod: 1,
    });
    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    expect(indexFetchCount).toBe(1);
  });

  it('fails closed when a runtime GLB no longer matches its manifest hash', async () => {
    const result = await loadCandidateCityTiles({
      manifest,
      requestedTileIds: [index.tiles[0].id],
      lod: 1,
      fetchAsset: async (uri, signal) => {
        const bytes = await fetchAsset(uri, signal);
        if (!uri.endsWith('.glb')) return bytes;
        const altered = Buffer.from(bytes);
        altered[altered.length - 1] ^= 1;
        return altered;
      },
    });
    expect(result).toEqual({ status: 'fallback', reason: 'asset-invalid' });
  });

  it('reports cancellation without converting it into a fallback', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadCandidateCityTiles({
      manifest,
      requestedTileIds: [index.tiles[0].id],
      lod: 2,
      fetchAsset,
      signal: controller.signal,
    })).resolves.toEqual({ status: 'cancelled' });
  });

  it('keeps the preview loader closed to a falsely promoted manifest', async () => {
    const promoted = structuredClone(manifest);
    promoted.status = 'production-approved';
    await expect(loadCandidateCityTiles({
      manifest: promoted,
      requestedTileIds: [index.tiles[0].id],
      lod: 0,
      fetchAsset,
    })).resolves.toEqual({ status: 'fallback', reason: 'manifest-invalid' });
  });

  it('fails closed instead of throwing when a checksummed index is structurally invalid', async () => {
    const alteredIndex = structuredClone(index);
    delete alteredIndex.tiles[0].dependencyTileIds;
    const alteredBytes = Buffer.from(JSON.stringify(alteredIndex));
    const alteredManifest = structuredClone(manifest);
    const indexAsset = alteredManifest.assets.find(({ kind }) => kind === 'entities-index');
    indexAsset.byteLength = alteredBytes.byteLength;
    indexAsset.sha256 = createHash('sha256').update(alteredBytes).digest('hex');
    await expect(loadCandidateCityTiles({
      manifest: alteredManifest,
      requestedTileIds: [alteredIndex.tiles[0].id],
      lod: 0,
      fetchAsset: async (uri, signal) => (
        uri === indexAsset.uri ? alteredBytes : fetchAsset(uri, signal)
      ),
    })).resolves.toEqual({ status: 'fallback', reason: 'index-invalid' });
  });

  it('produces GLBs that Three.js can decode with Meshopt', async () => {
    await MeshoptDecoder.ready;
    const asset = manifest.assets.find(({ uri }) => uri.endsWith('tile-c00-r00-lod2-analysis.glb'));
    const bytes = stagedAsset(asset.uri);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(arrayBuffer, '');
    expect(gltf.scene.children).toHaveLength(1);
    expect(gltf.scene.children[0].name).toBe('tile-c00-r00-lod2-analysis');
  });
});
