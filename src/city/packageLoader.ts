import type { CityPackageManifest } from './packages';
import { validateCityPackageManifest } from '../lib/validateCityPackages.js';

export type CityPackageFallbackReason =
  | 'manifest-invalid'
  | 'index-invalid'
  | 'asset-invalid'
  | 'tile-invalid'
  | 'fetch-failed';

export interface LoadedCityPackageTile {
  id: string;
  lod: 0 | 1 | 2;
  uri: string;
  sha256: string;
  bytes: ArrayBuffer;
  features: readonly Readonly<{
    featureId: number;
    entityId: string;
    layerId: string;
    sourceFeatureId?: string;
  }>[];
  statistics: Readonly<{
    drawCalls: number;
    triangles: number;
    lineSegments: number;
    points: number;
    featureCount: number;
  }>;
}

export type CityPackageTileLoadResult =
  | Readonly<{
    status: 'ready';
    packageId: string;
    requestedTileIds: readonly string[];
    resolvedTileIds: readonly string[];
    index: unknown;
    tiles: readonly Readonly<LoadedCityPackageTile>[];
  }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'fallback'; reason: CityPackageFallbackReason }>;

export type CityPackageTileResolutionResult =
  | Readonly<{
    status: 'ready';
    requestedTileIds: readonly string[];
    resolvedTileIds: readonly string[];
  }>
  | Readonly<{ status: 'fallback'; reason: 'tile-invalid' }>;

export interface CandidateCityPackageSession {
  readonly packageId: string;
  readonly index: unknown;
  resolveTileIds(requestedTileIds: readonly string[]): CityPackageTileResolutionResult;
  loadTiles(options: {
    requestedTileIds: readonly string[];
    lod: 0 | 1 | 2;
    signal?: AbortSignal;
  }): Promise<CityPackageTileLoadResult>;
  loadTileAssets(options: {
    tileIds: readonly string[];
    lod: 0 | 1 | 2;
    signal?: AbortSignal;
  }): Promise<CityPackageTileLoadResult>;
}

export type CandidateCityPackageSessionResult =
  | Readonly<{
    status: 'ready';
    packageId: string;
    index: unknown;
    session: CandidateCityPackageSession;
  }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'fallback'; reason: CityPackageFallbackReason }>;

export type CityPackageAssetFetcher = (
  uri: string,
  signal: AbortSignal,
) => Promise<ArrayBuffer | Uint8Array>;

const SHA256_RE = /^[a-f0-9]{64}$/;
const LOCAL_ASSET_RE = /^\/assets\/city\/packages\/[a-z0-9-/]+\.[a-z0-9]+$/;

function asArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('The CityPackage load was cancelled.');
  error.name = 'AbortError';
  throw error;
}

function parseJson(bytes: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseGlb(bytes: ArrayBuffer): {
  packageId: string;
  tileId: string;
  lod: number;
  statistics: LoadedCityPackageTile['statistics'];
  features: LoadedCityPackageTile['features'];
} {
  const view = new DataView(bytes);
  if (bytes.byteLength < 28 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error('Invalid GLB header.');
  }
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('Invalid GLB version or length.');
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength + 8 > bytes.byteLength) {
    throw new Error('Invalid GLB JSON chunk.');
  }
  const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
  const extras = json.extras;
  if (
    !json.extensionsRequired?.includes('EXT_meshopt_compression')
    || !extras
    || typeof extras.packageId !== 'string'
    || typeof extras.tileId !== 'string'
    || ![0, 1, 2].includes(extras.lod)
    || !extras.statistics
    || !Array.isArray(extras.features)
    || !extras.features.every((feature: any) => (
      typeof feature?.id === 'string'
      && typeof feature.sourceLayerId === 'string'
    ))
    || !['drawCalls', 'triangles', 'lineSegments', 'points', 'featureCount'].every((field) => (
      Number.isSafeInteger(extras.statistics[field]) && extras.statistics[field] >= 0
    ))
  ) throw new Error('Invalid GLB package metadata.');
  return {
    ...extras,
    features: extras.features.map((feature: any, featureId: number) => ({
      featureId,
      entityId: feature.id,
      layerId: feature.sourceLayerId,
      ...(typeof feature.sourceFeatureId === 'string'
        ? { sourceFeatureId: feature.sourceFeatureId }
        : {}),
    })),
  };
}

async function fetchVerified(
  fetchAsset: CityPackageAssetFetcher,
  signal: AbortSignal,
  asset: { uri: string; sha256: string; byteLength: number },
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  if (!LOCAL_ASSET_RE.test(asset.uri) || !SHA256_RE.test(asset.sha256) || asset.byteLength <= 0) {
    throw new Error('Invalid local asset reference.');
  }
  const bytes = asArrayBuffer(await fetchAsset(asset.uri, signal));
  throwIfAborted(signal);
  if (bytes.byteLength !== asset.byteLength || await sha256(bytes) !== asset.sha256) {
    throw new Error('Asset checksum or byte length mismatch.');
  }
  throwIfAborted(signal);
  return bytes;
}

export async function openCandidateCityPackage({
  manifest,
  fetchAsset,
  signal = new AbortController().signal,
}: {
  manifest: CityPackageManifest;
  fetchAsset: CityPackageAssetFetcher;
  signal?: AbortSignal;
}): Promise<CandidateCityPackageSessionResult> {
  if (
    !validateCityPackageManifest(manifest).ok
    || manifest.status !== 'candidate'
  ) return Object.freeze({ status: 'fallback', reason: 'manifest-invalid' });
  const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
  if (!indexAsset) return Object.freeze({ status: 'fallback', reason: 'manifest-invalid' });

  let index: any;
  try {
    index = parseJson(await fetchVerified(fetchAsset, signal, indexAsset));
  } catch (error) {
    if (isAbort(error, signal)) return Object.freeze({ status: 'cancelled' });
    return Object.freeze({ status: 'fallback', reason: 'fetch-failed' });
  }
  if (
    index?.packageId !== manifest.packageId
    || !Array.isArray(index.tiles)
    || index.runtime?.representation !== 'Analysis GLB'
    || index.runtime?.compression !== 'EXT_meshopt_compression'
    || index.runtime?.candidateOnly !== true
    || index.runtime?.dependencySemantics !== 'direct-entity-home-tiles'
    || index.tiles.some((tile: any) => (
      !tile
      || typeof tile.id !== 'string'
      || !Array.isArray(tile.dependencyTileIds)
      || !tile.dependencyTileIds.every((dependency: unknown) => typeof dependency === 'string')
      || !Array.isArray(tile.lods)
    ))
  ) return Object.freeze({ status: 'fallback', reason: 'index-invalid' });

  const tilesById = new Map(index.tiles.map((tile: any) => [tile.id, tile]));
  if (
    tilesById.size !== index.tiles.length
    || index.tiles.some((tile: any) => (
      tile.dependencyTileIds.includes(tile.id)
      || new Set(tile.dependencyTileIds).size !== tile.dependencyTileIds.length
      || tile.dependencyTileIds.some((dependency: string) => !tilesById.has(dependency))
    ))
  ) {
    return Object.freeze({ status: 'fallback', reason: 'index-invalid' });
  }

  const resolveTileIds = (requestedTileIds: readonly string[]): CityPackageTileResolutionResult => {
    const requested = [...new Set(requestedTileIds)];
    const resolved = new Set<string>();
    for (const tileId of requested) {
      const tile: any = tilesById.get(tileId);
      if (!tile) return Object.freeze({ status: 'fallback', reason: 'tile-invalid' });
      resolved.add(tileId);
      // Dependencies are entity home tiles for this requested spatial tile.
      // Their own dependencies describe a different request and must not be
      // expanded transitively.
      tile.dependencyTileIds.forEach((dependency: string) => resolved.add(dependency));
    }
    return Object.freeze({
      status: 'ready',
      requestedTileIds: Object.freeze(requested),
      resolvedTileIds: Object.freeze([...resolved].sort()),
    });
  };

  const loadTileAssets = async ({
    tileIds,
    lod,
    loadSignal = new AbortController().signal,
  }: {
    tileIds: readonly string[];
    lod: 0 | 1 | 2;
    loadSignal?: AbortSignal;
  }): Promise<CityPackageTileLoadResult> => {
    const exactTileIds = [...new Set(tileIds)].sort();
    if (exactTileIds.some((tileId) => !tilesById.has(tileId))) {
      return Object.freeze({ status: 'fallback', reason: 'tile-invalid' });
    }
    try {
      const tiles = await Promise.all(exactTileIds.map(async (tileId) => {
        const tile: any = tilesById.get(tileId);
        const reference = tile.lods.find((entry: any) => entry.lod === lod)?.runtimeAsset;
        const manifestAsset = manifest.assets.find(({ id }) => id === reference?.assetId);
        if (
          !reference
          || !manifestAsset
          || reference.uri !== manifestAsset.uri
          || reference.sha256 !== manifestAsset.sha256
          || reference.byteLength !== manifestAsset.byteLength
        ) throw new Error('Runtime tile reference does not match manifest.');
        const bytes = await fetchVerified(fetchAsset, loadSignal, manifestAsset);
        const metadata = parseGlb(bytes);
        if (
          metadata.packageId !== manifest.packageId
          || metadata.tileId !== tileId
          || metadata.lod !== lod
        ) throw new Error('Runtime GLB identity mismatch.');
        return Object.freeze({
          id: tileId,
          lod,
          uri: manifestAsset.uri,
          sha256: manifestAsset.sha256,
          bytes,
          features: Object.freeze(metadata.features.map((feature) => Object.freeze({ ...feature }))),
          statistics: Object.freeze({ ...metadata.statistics }),
        });
      }));
      return Object.freeze({
        status: 'ready',
        packageId: manifest.packageId,
        requestedTileIds: Object.freeze(exactTileIds),
        resolvedTileIds: Object.freeze(exactTileIds),
        index,
        tiles: Object.freeze(tiles),
      });
    } catch (error) {
      if (isAbort(error, loadSignal)) return Object.freeze({ status: 'cancelled' });
      return Object.freeze({ status: 'fallback', reason: 'asset-invalid' });
    }
  };

  const session: CandidateCityPackageSession = Object.freeze({
    packageId: manifest.packageId,
    index,
    resolveTileIds,
    loadTileAssets: ({ tileIds, lod, signal: loadSignal }) => loadTileAssets({
      tileIds,
      lod,
      loadSignal,
    }),
    async loadTiles({ requestedTileIds, lod, signal: loadSignal }) {
      const resolution = resolveTileIds(requestedTileIds);
      if (resolution.status !== 'ready') return resolution;
      const loaded = await loadTileAssets({
        tileIds: resolution.resolvedTileIds,
        lod,
        loadSignal,
      });
      if (loaded.status !== 'ready') return loaded;
      return Object.freeze({
        ...loaded,
        requestedTileIds: resolution.requestedTileIds,
        resolvedTileIds: resolution.resolvedTileIds,
      });
    },
  });
  return Object.freeze({
    status: 'ready',
    packageId: manifest.packageId,
    index,
    session,
  });
}

export async function loadCandidateCityTiles({
  manifest,
  requestedTileIds,
  lod,
  fetchAsset,
  signal = new AbortController().signal,
}: {
  manifest: CityPackageManifest;
  requestedTileIds: readonly string[];
  lod: 0 | 1 | 2;
  fetchAsset: CityPackageAssetFetcher;
  signal?: AbortSignal;
}): Promise<CityPackageTileLoadResult> {
  const opened = await openCandidateCityPackage({ manifest, fetchAsset, signal });
  if (opened.status !== 'ready') return opened;
  return opened.session.loadTiles({ requestedTileIds, lod, signal });
}
