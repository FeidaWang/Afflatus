import type { CityPackageManifest } from './packages';
import type {
  CandidateCityPackageSession,
  CityPackageTileLoadResult,
} from './packageLoader';
import { openCandidateCityPackage } from './packageLoader';
import {
  MELBOURNE_ANALYSIS_BASELINE,
  MELBOURNE_ANALYSIS_MANIFEST_SHA256,
  MELBOURNE_ANALYSIS_MANIFEST_URL,
  melbourneCandidateSourceUrl,
  summarizeMelbourneAnalysisBaseline,
  type MelbourneAnalysisBaselineSummary,
} from './analysisPreview';

export const MELBOURNE_ANALYSIS_FAILURE_MODES = Object.freeze([
  'none',
  '404',
  'checksum',
  'offline',
] as const);

export type MelbourneAnalysisFailureMode = typeof MELBOURNE_ANALYSIS_FAILURE_MODES[number];

export type MelbourneAnalysisByteReader = (
  url: string,
  signal: AbortSignal,
) => Promise<ArrayBuffer | Uint8Array>;

export class MelbourneAnalysisRuntimeError extends Error {
  readonly code: string;
  readonly failureMode: MelbourneAnalysisFailureMode;

  constructor(code: string, message: string, failureMode: MelbourneAnalysisFailureMode = 'none') {
    super(message);
    this.name = 'MelbourneAnalysisRuntimeError';
    this.code = code;
    this.failureMode = failureMode;
  }
}

export interface MelbourneAnalysisRuntime {
  readonly manifestSha256: string;
  readonly manifest: CityPackageManifest;
  readonly session: CandidateCityPackageSession;
  readonly tileLoad: Extract<CityPackageTileLoadResult, { status: 'ready' }>;
  readonly baseline: MelbourneAnalysisBaselineSummary;
  readonly failureMode: MelbourneAnalysisFailureMode;
}

function asArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new MelbourneAnalysisRuntimeError(
      'web-crypto-unavailable',
      'Web Crypto is unavailable for candidate verification.',
    );
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeMelbourneAnalysisFailureMode(
  value: unknown,
): MelbourneAnalysisFailureMode {
  return MELBOURNE_ANALYSIS_FAILURE_MODES.includes(value as MelbourneAnalysisFailureMode)
    ? value as MelbourneAnalysisFailureMode
    : 'none';
}

function injectedReader(
  readBytes: MelbourneAnalysisByteReader,
  failureMode: MelbourneAnalysisFailureMode,
): MelbourneAnalysisByteReader {
  let injectedGlbFailure = false;
  return async (url, signal) => {
    if (failureMode === 'offline') {
      throw new MelbourneAnalysisRuntimeError(
        'injected-offline',
        'Injected offline candidate request.',
        failureMode,
      );
    }
    if (url.endsWith('.glb') && !injectedGlbFailure && failureMode === '404') {
      injectedGlbFailure = true;
      throw new MelbourneAnalysisRuntimeError(
        'injected-404',
        'Injected 404 candidate asset response.',
        failureMode,
      );
    }
    const bytes = asArrayBuffer(await readBytes(url, signal));
    if (url.endsWith('.glb') && !injectedGlbFailure && failureMode === 'checksum') {
      injectedGlbFailure = true;
      const corrupted = bytes.slice(0);
      const view = new Uint8Array(corrupted);
      view[view.byteLength - 1] ^= 0xff;
      return corrupted;
    }
    return bytes;
  };
}

function runtimeError(
  code: string,
  message: string,
  failureMode: MelbourneAnalysisFailureMode,
): MelbourneAnalysisRuntimeError {
  return new MelbourneAnalysisRuntimeError(code, message, failureMode);
}

export async function prepareMelbourneAnalysisRuntime({
  readBytes,
  signal = new AbortController().signal,
  failureMode: requestedFailureMode = 'none',
}: {
  readBytes: MelbourneAnalysisByteReader;
  signal?: AbortSignal;
  failureMode?: MelbourneAnalysisFailureMode;
}): Promise<Readonly<MelbourneAnalysisRuntime>> {
  const failureMode = normalizeMelbourneAnalysisFailureMode(requestedFailureMode);
  let manifestBytes: ArrayBuffer;
  try {
    manifestBytes = asArrayBuffer(await readBytes(MELBOURNE_ANALYSIS_MANIFEST_URL, signal));
  } catch (error) {
    if (signal.aborted) throw error;
    throw runtimeError(
      'manifest-fetch-failed',
      'Candidate manifest request failed.',
      failureMode,
    );
  }
  if (await sha256(manifestBytes) !== MELBOURNE_ANALYSIS_MANIFEST_SHA256) {
    throw runtimeError(
      'manifest-checksum-mismatch',
      'Candidate manifest does not match the frozen engineering hash.',
      failureMode,
    );
  }

  let manifest: CityPackageManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as CityPackageManifest;
  } catch {
    throw runtimeError('manifest-json-invalid', 'Candidate manifest JSON is invalid.', failureMode);
  }

  const readCandidateAsset = injectedReader(readBytes, failureMode);
  const fetchAsset = async (uri: string, assetSignal: AbortSignal) => {
    const localUrl = melbourneCandidateSourceUrl(uri);
    if (!localUrl) {
      throw runtimeError(
        'asset-uri-invalid',
        'Candidate asset URI escaped the local package root.',
        failureMode,
      );
    }
    return readCandidateAsset(localUrl, assetSignal);
  };
  const opened = await openCandidateCityPackage({ manifest, fetchAsset, signal });
  if (opened.status !== 'ready') {
    throw runtimeError(
      failureMode === 'none' ? 'package-session-failed' : `injected-${failureMode}`,
      `Candidate session returned ${opened.status}${'reason' in opened ? `:${opened.reason}` : ''}.`,
      failureMode,
    );
  }
  const tileLoad = await opened.session.loadTiles({
    requestedTileIds: MELBOURNE_ANALYSIS_BASELINE.requestedTileIds,
    lod: MELBOURNE_ANALYSIS_BASELINE.lod,
    signal,
  });
  if (tileLoad.status !== 'ready') {
    throw runtimeError(
      failureMode === 'none' ? 'baseline-load-failed' : `injected-${failureMode}`,
      `Candidate loader returned ${tileLoad.status}${'reason' in tileLoad ? `:${tileLoad.reason}` : ''}.`,
      failureMode,
    );
  }
  const baseline = summarizeMelbourneAnalysisBaseline(tileLoad);
  if (!baseline?.matchesFrozenBaseline) {
    throw runtimeError(
      'baseline-budget-mismatch',
      'First-frame budget no longer matches its frozen baseline.',
      failureMode,
    );
  }
  return Object.freeze({
    manifestSha256: MELBOURNE_ANALYSIS_MANIFEST_SHA256,
    manifest,
    session: opened.session,
    tileLoad,
    baseline,
    failureMode,
  });
}
