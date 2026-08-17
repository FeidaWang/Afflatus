import type { CityPackageTileLoadResult } from './packageLoader';

export const MELBOURNE_ANALYSIS_PACKAGE_ID = 'melbourne-flinders-federation-v1';
export const MELBOURNE_ANALYSIS_MANIFEST_SHA256 = '6ba99fc6830c46c42f740ff5de241040c971295ca79d18257cb3009adb8a7b60';
export const MELBOURNE_ANALYSIS_MANIFEST_URL = `/data/city/candidates/${MELBOURNE_ANALYSIS_PACKAGE_ID}/manifest.json`;

export const MELBOURNE_ANALYSIS_BASELINE = Object.freeze({
  id: 'melbourne-analysis-first-frame-v1',
  requestedTileIds: Object.freeze(['tile-c01-r02']),
  lod: 0 as const,
  expectedResolvedTileCount: 4,
  expectedAssetBytes: 428_448,
  expectedDrawCalls: 22,
  expectedTriangles: 6_640,
  camera: Object.freeze({
    position: Object.freeze({ x: 520, y: 360, z: 700 }),
    target: Object.freeze({ x: 0, y: 18, z: 125 }),
    fov: 42,
  }),
});

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const PACKAGE_ASSET_PREFIX = `/assets/city/packages/${MELBOURNE_ANALYSIS_PACKAGE_ID}/`;
const SAFE_FILENAME_RE = /^[a-z0-9-]+\.(?:json|glb)$/;

export function isMelbourneAnalysisPreviewAllowed({
  dev,
  hostname,
}: {
  dev: boolean;
  hostname: string;
}): boolean {
  return dev === true && LOCAL_HOSTS.has(String(hostname).toLowerCase());
}

export function melbourneCandidateSourceUrl(uri: string): string | null {
  if (!uri.startsWith(PACKAGE_ASSET_PREFIX)) return null;
  const filename = uri.slice(PACKAGE_ASSET_PREFIX.length);
  if (!SAFE_FILENAME_RE.test(filename)) return null;
  return `/data/city/candidates/${MELBOURNE_ANALYSIS_PACKAGE_ID}/${filename}`;
}

export interface MelbourneAnalysisBaselineSummary {
  tileCount: number;
  bytes: number;
  drawCalls: number;
  triangles: number;
  lineSegments: number;
  points: number;
  matchesFrozenBaseline: boolean;
}

export function summarizeMelbourneAnalysisBaseline(
  result: CityPackageTileLoadResult,
): MelbourneAnalysisBaselineSummary | null {
  if (result.status !== 'ready') return null;
  const summary = result.tiles.reduce((total, tile) => ({
    tileCount: total.tileCount + 1,
    bytes: total.bytes + tile.bytes.byteLength,
    drawCalls: total.drawCalls + tile.statistics.drawCalls,
    triangles: total.triangles + tile.statistics.triangles,
    lineSegments: total.lineSegments + tile.statistics.lineSegments,
    points: total.points + tile.statistics.points,
  }), {
    tileCount: 0,
    bytes: 0,
    drawCalls: 0,
    triangles: 0,
    lineSegments: 0,
    points: 0,
  });
  return Object.freeze({
    ...summary,
    matchesFrozenBaseline: (
      summary.tileCount === MELBOURNE_ANALYSIS_BASELINE.expectedResolvedTileCount
      && summary.bytes === MELBOURNE_ANALYSIS_BASELINE.expectedAssetBytes
      && summary.drawCalls === MELBOURNE_ANALYSIS_BASELINE.expectedDrawCalls
      && summary.triangles === MELBOURNE_ANALYSIS_BASELINE.expectedTriangles
    ),
  });
}
