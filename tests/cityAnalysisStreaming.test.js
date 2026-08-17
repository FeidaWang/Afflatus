import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MELBOURNE_ANALYSIS_STREAMING_BUDGET,
  melbourneAnalysisLodForDistance,
  selectMelbourneAnalysisLruEvictions,
  selectMelbourneAnalysisStreamingSet,
} from '../src/city/analysisStreaming.ts';

const index = JSON.parse(readFileSync(resolve(
  import.meta.dirname,
  '../data/city/candidates/melbourne-flinders-federation-v1/entities-index.json',
), 'utf8'));

describe('Melbourne Analysis spatial streaming policy', () => {
  it('selects the fixed first-frame tile with direct ownership dependencies only', () => {
    const selection = selectMelbourneAnalysisStreamingSet(index, {
      target: { x: 0, z: 125 },
      cameraDistance: 800,
    });
    expect(selection).toMatchObject({
      primaryTileId: 'tile-c01-r02',
      lod: 0,
      resolvedTileIds: [
        'tile-c00-r01',
        'tile-c00-r02',
        'tile-c01-r01',
        'tile-c01-r02',
      ],
      assetBytes: 428448,
      drawCalls: 22,
      triangles: 6640,
      withinBudget: true,
    });
  });

  it('uses hysteresis around the camera-distance LOD thresholds', () => {
    expect(melbourneAnalysisLodForDistance(280, null)).toBe(2);
    expect(melbourneAnalysisLodForDistance(340, 2)).toBe(2);
    expect(melbourneAnalysisLodForDistance(380, 2)).toBe(1);
    expect(melbourneAnalysisLodForDistance(700, 1)).toBe(1);
    expect(melbourneAnalysisLodForDistance(780, 1)).toBe(0);
    expect(melbourneAnalysisLodForDistance(600, 0)).toBe(0);
    expect(melbourneAnalysisLodForDistance(560, 0)).toBe(1);
  });

  it('keeps every primary tile and LOD dependency set inside the visible budget', () => {
    for (const tile of index.tiles) {
      const x = (tile.boundsLocal.minX + tile.boundsLocal.maxX) / 2;
      const z = (tile.boundsLocal.minZ + tile.boundsLocal.maxZ) / 2;
      for (const [lod, cameraDistance] of [[0, 900], [1, 500], [2, 120]]) {
        const selection = selectMelbourneAnalysisStreamingSet(index, {
          target: { x, z },
          cameraDistance,
          previousLod: lod,
        });
        expect(selection.primaryTileId).toBe(tile.id);
        expect(selection.lod).toBe(lod);
        expect(selection.assetBytes).toBeLessThanOrEqual(
          MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleAssetBytes,
        );
        expect(selection.drawCalls).toBeLessThanOrEqual(
          MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleDrawCalls,
        );
        expect(selection.triangles).toBeLessThanOrEqual(
          MELBOURNE_ANALYSIS_STREAMING_BUDGET.maximumVisibleTriangles,
        );
      }
    }
  });

  it('clamps an out-of-precinct target to the nearest edge tile', () => {
    expect(selectMelbourneAnalysisStreamingSet(index, {
      target: { x: 900, z: 900 },
      cameraDistance: 900,
    }).primaryTileId).toBe('tile-c03-r04');
  });

  it('evicts only unreferenced decoded assets in deterministic LRU order', () => {
    const records = [
      { key: 'active', byteLength: 700, referenceCount: 1, lastUsed: 1 },
      { key: 'old-b', byteLength: 500, referenceCount: 0, lastUsed: 2 },
      { key: 'old-a', byteLength: 500, referenceCount: 0, lastUsed: 2 },
      { key: 'new', byteLength: 500, referenceCount: 0, lastUsed: 3 },
    ];
    expect(selectMelbourneAnalysisLruEvictions(records, {
      maximumResidentBytes: 1300,
      maximumResidentAssets: 3,
    })).toEqual(['old-a', 'old-b']);
    expect(selectMelbourneAnalysisLruEvictions([
      { key: 'active', byteLength: 2000, referenceCount: 1, lastUsed: 1 },
    ], {
      maximumResidentBytes: 1000,
      maximumResidentAssets: 1,
    })).toEqual([]);
  });
});
