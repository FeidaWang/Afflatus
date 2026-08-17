export type MelbourneAnalysisLod = 0 | 1 | 2;

export const MELBOURNE_ANALYSIS_STREAMING_BUDGET = Object.freeze({
  maximumVisibleAssetBytes: 1_100_000,
  maximumVisibleDrawCalls: 36,
  maximumVisibleTriangles: 40_000,
  maximumResidentBytes: 2_500_000,
  maximumResidentAssets: 18,
});

export interface MelbourneAnalysisStreamingSelection {
  key: string;
  primaryTileId: string;
  resolvedTileIds: readonly string[];
  lod: MelbourneAnalysisLod;
  assetBytes: number;
  drawCalls: number;
  triangles: number;
  withinBudget: boolean;
}

export interface MelbourneAnalysisResidentRecord {
  key: string;
  byteLength: number;
  referenceCount: number;
  lastUsed: number;
}

export function selectMelbourneAnalysisLruEvictions(
  records: readonly MelbourneAnalysisResidentRecord[],
  budget = MELBOURNE_ANALYSIS_STREAMING_BUDGET,
): readonly string[] {
  let residentBytes = records.reduce((total, record) => total + record.byteLength, 0);
  let residentAssets = records.length;
  const evictions: string[] = [];
  const candidates = records
    .filter(({ referenceCount }) => referenceCount === 0)
    .sort((left, right) => left.lastUsed - right.lastUsed || left.key.localeCompare(right.key));
  while (
    candidates.length > 0
    && (
      residentBytes > budget.maximumResidentBytes
      || residentAssets > budget.maximumResidentAssets
    )
  ) {
    const record = candidates.shift() as MelbourneAnalysisResidentRecord;
    evictions.push(record.key);
    residentBytes -= record.byteLength;
    residentAssets -= 1;
  }
  return Object.freeze(evictions);
}

interface RuntimeReference {
  byteLength: number;
  statistics: { drawCalls: number; triangles: number };
}

interface StreamingTile {
  id: string;
  boundsLocal: { minX: number; maxX: number; minZ: number; maxZ: number };
  dependencyTileIds: string[];
  lods: Array<{ lod: MelbourneAnalysisLod; runtimeAsset: RuntimeReference }>;
}

interface StreamingIndex {
  tiles: StreamingTile[];
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

function distanceToTileSquared(tile: StreamingTile, x: number, z: number): number {
  const nearestX = clamp(x, tile.boundsLocal.minX, tile.boundsLocal.maxX);
  const nearestZ = clamp(z, tile.boundsLocal.minZ, tile.boundsLocal.maxZ);
  return (nearestX - x) ** 2 + (nearestZ - z) ** 2;
}

function primaryTileForTarget(tiles: StreamingTile[], x: number, z: number): StreamingTile | null {
  const containing = tiles.find((tile) => (
    x >= tile.boundsLocal.minX
    && x < tile.boundsLocal.maxX
    && z >= tile.boundsLocal.minZ
    && z < tile.boundsLocal.maxZ
  ));
  if (containing) return containing;
  return [...tiles].sort((left, right) => (
    distanceToTileSquared(left, x, z) - distanceToTileSquared(right, x, z)
    || left.id.localeCompare(right.id)
  ))[0] ?? null;
}

export function melbourneAnalysisLodForDistance(
  distance: number,
  previousLod: MelbourneAnalysisLod | null = null,
): MelbourneAnalysisLod {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : Number.POSITIVE_INFINITY;
  if (previousLod === 2) return safeDistance <= 360 ? 2 : (safeDistance < 650 ? 1 : 0);
  if (previousLod === 1) {
    if (safeDistance < 260) return 2;
    return safeDistance <= 760 ? 1 : 0;
  }
  if (previousLod === 0) return safeDistance < 580 ? (safeDistance < 260 ? 2 : 1) : 0;
  if (safeDistance < 300) return 2;
  if (safeDistance < 650) return 1;
  return 0;
}

function summarizeSelection(
  tilesById: Map<string, StreamingTile>,
  tileIds: readonly string[],
  lod: MelbourneAnalysisLod,
) {
  let assetBytes = 0;
  let drawCalls = 0;
  let triangles = 0;
  for (const tileId of tileIds) {
    const reference = tilesById.get(tileId)?.lods.find((entry) => entry.lod === lod)?.runtimeAsset;
    if (!reference) return null;
    assetBytes += reference.byteLength;
    drawCalls += reference.statistics.drawCalls;
    triangles += reference.statistics.triangles;
  }
  const withinBudget = (
    assetBytes <= MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleAssetBytes
    && drawCalls <= MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleDrawCalls
    && triangles <= MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleTriangles
  );
  return { assetBytes, drawCalls, triangles, withinBudget };
}

export function selectMelbourneAnalysisStreamingSet(
  index: unknown,
  {
    target,
    cameraDistance,
    previousLod = null,
  }: {
    target: { x: number; z: number };
    cameraDistance: number;
    previousLod?: MelbourneAnalysisLod | null;
  },
): MelbourneAnalysisStreamingSelection | null {
  const candidate = index as StreamingIndex;
  if (!Array.isArray(candidate?.tiles) || candidate.tiles.length === 0) return null;
  const tilesById = new Map(candidate.tiles.map((tile) => [tile.id, tile]));
  const primary = primaryTileForTarget(candidate.tiles, target.x, target.z);
  if (!primary || !Array.isArray(primary.dependencyTileIds)) return null;
  const resolvedTileIds = [...new Set([primary.id, ...primary.dependencyTileIds])].sort();
  if (resolvedTileIds.some((tileId) => !tilesById.has(tileId))) return null;

  let lod = melbourneAnalysisLodForDistance(cameraDistance, previousLod);
  let summary = summarizeSelection(tilesById, resolvedTileIds, lod);
  while (summary && !summary.withinBudget && lod > 0) {
    lod = (lod - 1) as MelbourneAnalysisLod;
    summary = summarizeSelection(tilesById, resolvedTileIds, lod);
  }
  if (!summary) return null;
  return Object.freeze({
    key: `${primary.id}:lod${lod}:${resolvedTileIds.join(',')}`,
    primaryTileId: primary.id,
    resolvedTileIds: Object.freeze(resolvedTileIds),
    lod,
    ...summary,
  });
}
