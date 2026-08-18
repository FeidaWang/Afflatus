import type {
  CityPackageCityId,
  CityPackageManifest,
  CityPackageRegistryReference,
} from './packages';
import type {
  CityPackageSession,
  CityPackageTileLoadResult,
} from './packageLoader';
import { openProductionCityPackage } from './packageLoader';
import { selectCityPackageStreamingSet } from './packageStreaming';

export type CityProductionRuntimeFailureReason =
  | 'registry-reference-invalid'
  | 'manifest-fetch-failed'
  | 'manifest-checksum-mismatch'
  | 'manifest-json-invalid'
  | 'manifest-identity-mismatch'
  | 'package-session-failed';

export type CityProductionRuntimeResult = Readonly<{
  status: 'ready';
  manifestSha256: string;
  manifest: CityPackageManifest;
  session: CityPackageSession;
}> | Readonly<{
  status: 'cancelled';
}> | Readonly<{
  status: 'fallback';
  reason: CityProductionRuntimeFailureReason;
}>;

export type CityProductionByteReader = (
  url: string,
  signal: AbortSignal,
) => Promise<ArrayBuffer | Uint8Array>;

export interface CityProductionCameraPreset {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly fov: number;
}

export type CityProductionFirstFrameResult = Readonly<{
  status: 'ready';
  tileLoad: Extract<CityPackageTileLoadResult, { status: 'ready' }>;
  cameraPreset: CityProductionCameraPreset;
}> | Readonly<{
  status: 'cancelled';
}> | Readonly<{
  status: 'fallback';
  reason: 'index-invalid' | 'view-invalid' | 'selection-invalid' | 'tile-load-failed' | 'selection-mismatch';
}>;

const LOCAL_MANIFEST_PATH_RE = /^public\/assets\/city\/packages\/[a-z0-9-]+\/manifest\.json$/;

export function cityPackageManifestUrl(manifestPath: string): string | null {
  return LOCAL_MANIFEST_PATH_RE.test(manifestPath)
    ? manifestPath.replace(/^public/, '')
    : null;
}

function asArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function cancelled(signal: AbortSignal, error?: unknown): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError');
}

export async function prepareCityProductionRuntime({
  cityId,
  packageReference,
  readBytes,
  signal = new AbortController().signal,
}: {
  cityId: CityPackageCityId;
  packageReference: CityPackageRegistryReference;
  readBytes: CityProductionByteReader;
  signal?: AbortSignal;
}): Promise<CityProductionRuntimeResult> {
  const manifestUrl = cityPackageManifestUrl(packageReference.manifestPath);
  if (!manifestUrl) return Object.freeze({ status: 'fallback', reason: 'registry-reference-invalid' });
  let manifestBytes: ArrayBuffer;
  try {
    manifestBytes = asArrayBuffer(await readBytes(manifestUrl, signal));
  } catch (error) {
    return cancelled(signal, error)
      ? Object.freeze({ status: 'cancelled' })
      : Object.freeze({ status: 'fallback', reason: 'manifest-fetch-failed' });
  }

  let manifestSha256: string;
  try {
    manifestSha256 = await sha256(manifestBytes);
  } catch (error) {
    return cancelled(signal, error)
      ? Object.freeze({ status: 'cancelled' })
      : Object.freeze({ status: 'fallback', reason: 'manifest-checksum-mismatch' });
  }
  if (manifestSha256 !== packageReference.manifestSha256) {
    return Object.freeze({ status: 'fallback', reason: 'manifest-checksum-mismatch' });
  }

  let manifest: CityPackageManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as CityPackageManifest;
  } catch {
    return Object.freeze({ status: 'fallback', reason: 'manifest-json-invalid' });
  }
  if (
    manifest.packageId !== packageReference.packageId
    || manifest.cityId !== cityId
    || manifest.status !== 'production-approved'
  ) return Object.freeze({ status: 'fallback', reason: 'manifest-identity-mismatch' });

  const opened = await openProductionCityPackage({
    manifest,
    signal,
    fetchAsset: (uri, assetSignal) => readBytes(uri, assetSignal),
  });
  if (opened.status === 'cancelled') return Object.freeze({ status: 'cancelled' });
  if (opened.status !== 'ready') {
    return Object.freeze({ status: 'fallback', reason: 'package-session-failed' });
  }
  return Object.freeze({
    status: 'ready',
    manifestSha256,
    manifest,
    session: opened.session,
  });
}

export async function loadCityProductionFirstFrame({
  runtime,
  signal = new AbortController().signal,
}: {
  runtime: Extract<CityProductionRuntimeResult, { status: 'ready' }>;
  signal?: AbortSignal;
}): Promise<CityProductionFirstFrameResult> {
  const index = runtime.session.index as any;
  const bounds = index?.tileScheme?.boundsLocal;
  if (
    !bounds
    || !['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(bounds[key]))
    || !(bounds.minX < bounds.maxX)
    || !(bounds.minZ < bounds.maxZ)
  ) return Object.freeze({ status: 'fallback', reason: 'index-invalid' });

  const view = runtime.manifest.canonicalViews?.[0];
  if (!view) return Object.freeze({ status: 'fallback', reason: 'view-invalid' });
  const target = Object.freeze({ ...view.targetLocal });
  const cameraPreset = Object.freeze({
    position: Object.freeze({ ...view.positionLocal }),
    target,
    fov: view.verticalFovDegrees,
  });
  const cameraDistance = Math.hypot(
    cameraPreset.position.x - target.x,
    cameraPreset.position.y - target.y,
    cameraPreset.position.z - target.z,
  );
  const selection = selectCityPackageStreamingSet(index, {
    target,
    cameraDistance,
    previousLod: 0,
  });
  if (!selection) return Object.freeze({ status: 'fallback', reason: 'selection-invalid' });
  const tileLoad = await runtime.session.loadTiles({
    requestedTileIds: [selection.primaryTileId],
    lod: selection.lod,
    signal,
  });
  if (tileLoad.status === 'cancelled') return Object.freeze({ status: 'cancelled' });
  if (tileLoad.status !== 'ready') {
    return Object.freeze({ status: 'fallback', reason: 'tile-load-failed' });
  }
  if (
    tileLoad.resolvedTileIds.join(',') !== selection.resolvedTileIds.join(',')
    || tileLoad.tiles.some(({ lod }) => lod !== selection.lod)
  ) return Object.freeze({ status: 'fallback', reason: 'selection-mismatch' });
  return Object.freeze({ status: 'ready', tileLoad, cameraPreset });
}
