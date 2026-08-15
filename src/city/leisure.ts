import { fnv1aHash } from '../bootengine/seed';
import type { CityBounds, CityPlan, CityPoint } from './model';

export type CityLeisureAssetKind =
  | 'bench-seat'
  | 'bench-back'
  | 'bench-leg'
  | 'bike-rack-base'
  | 'bike-rack-beam'
  | 'bike-rack-post'
  | 'lamp-arm'
  | 'lamp-head'
  | 'lamp-post'
  | 'table-top'
  | 'table-leg';

export type CityLeisureAssetTone = 'pale' | 'dark' | 'orange';

export interface CityLeisureAsset {
  id: string;
  blockId: string;
  kind: CityLeisureAssetKind;
  tone: CityLeisureAssetTone;
  position: CityPoint;
  bounds: CityBounds;
  rotationY: number;
  availableDay: number;
}

export interface CityLeisurePlan {
  version: 1;
  assets: readonly CityLeisureAsset[];
}

const round = (value: number, places = 4): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function makeAsset(
  blockId: string,
  suffix: string,
  kind: CityLeisureAssetKind,
  tone: CityLeisureAssetTone,
  center: CityPoint,
  localX: number,
  localZ: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
  availableDay: number,
): CityLeisureAsset {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return Object.freeze({
    id: `${blockId}-leisure-${suffix}`,
    blockId,
    kind,
    tone,
    position: Object.freeze({
      x: round(center.x + localX * cosine + localZ * sine),
      y: round(y),
      z: round(center.z - localX * sine + localZ * cosine),
    }),
    bounds: Object.freeze({ width, height, depth }),
    rotationY: round(rotationY),
    availableDay,
  });
}

function addBench(
  assets: CityLeisureAsset[],
  blockId: string,
  center: CityPoint,
  index: number,
  localX: number,
  localZ: number,
  rotationY: number,
  availableDay: number,
): void {
  assets.push(
    makeAsset(blockId, `bench-${index}-seat`, 'bench-seat', 'pale', center, localX, localZ, 1.55, 6.2, 0.38, 1.25, rotationY, availableDay),
    makeAsset(blockId, `bench-${index}-back`, 'bench-back', 'orange', center, localX, localZ + 0.55, 2.35, 6.2, 1.25, 0.32, rotationY, availableDay),
    makeAsset(blockId, `bench-${index}-leg-left`, 'bench-leg', 'dark', center, localX - 2.15, localZ, 0.75, 0.42, 1.5, 0.78, rotationY, availableDay),
    makeAsset(blockId, `bench-${index}-leg-right`, 'bench-leg', 'dark', center, localX + 2.15, localZ, 0.75, 0.42, 1.5, 0.78, rotationY, availableDay),
  );
}

function addTable(
  assets: CityLeisureAsset[],
  blockId: string,
  center: CityPoint,
  rotationY: number,
  availableDay: number,
): void {
  assets.push(
    makeAsset(blockId, 'table-top', 'table-top', 'pale', center, 0, 3.5, 1.75, 5.2, 0.34, 3.2, rotationY, availableDay),
    makeAsset(blockId, 'table-leg-left', 'table-leg', 'dark', center, -1.6, 3.5, 0.82, 0.5, 1.64, 0.5, rotationY, availableDay),
    makeAsset(blockId, 'table-leg-right', 'table-leg', 'dark', center, 1.6, 3.5, 0.82, 0.5, 1.64, 0.5, rotationY, availableDay),
  );
}

function addLamp(
  assets: CityLeisureAsset[],
  blockId: string,
  center: CityPoint,
  index: number,
  localX: number,
  facing: -1 | 1,
  rotationY: number,
  availableDay: number,
): void {
  assets.push(
    makeAsset(blockId, `lamp-${index}-post`, 'lamp-post', 'dark', center, localX, 9, 3.1, 0.46, 6.2, 0.46, rotationY, availableDay),
    makeAsset(blockId, `lamp-${index}-arm`, 'lamp-arm', 'pale', center, localX + facing * 0.85, 9, 5.92, 1.7, 0.28, 0.38, rotationY, availableDay),
    makeAsset(blockId, `lamp-${index}-head`, 'lamp-head', 'orange', center, localX + facing * 1.68, 9, 5.72, 0.82, 0.34, 0.76, rotationY, availableDay),
  );
}

function addBikeRack(
  assets: CityLeisureAsset[],
  blockId: string,
  center: CityPoint,
  rotationY: number,
  availableDay: number,
): void {
  assets.push(
    makeAsset(blockId, 'bike-rack-base', 'bike-rack-base', 'pale', center, 0, 10.5, 0.08, 5.6, 0.16, 1.45, rotationY, availableDay),
    makeAsset(blockId, 'bike-rack-post-left', 'bike-rack-post', 'dark', center, -2.15, 10.5, 0.92, 0.28, 1.84, 0.28, rotationY, availableDay),
    makeAsset(blockId, 'bike-rack-post-center', 'bike-rack-post', 'dark', center, 0, 10.5, 0.92, 0.28, 1.84, 0.28, rotationY, availableDay),
    makeAsset(blockId, 'bike-rack-post-right', 'bike-rack-post', 'dark', center, 2.15, 10.5, 0.92, 0.28, 1.84, 0.28, rotationY, availableDay),
    makeAsset(blockId, 'bike-rack-beam', 'bike-rack-beam', 'orange', center, 0, 10.5, 1.72, 4.58, 0.24, 0.28, rotationY, availableDay),
  );
}

/**
 * Generates a small, deterministic set of large park furniture. Assets are
 * box-only so one colored instance batch and one merged outline can draw them.
 */
export function createCityLeisurePlan(plan: CityPlan): CityLeisurePlan {
  const assets: CityLeisureAsset[] = [];
  for (const block of plan.blocks) {
    if (block.zone !== 'park') continue;
    const hash = fnv1aHash(`${plan.seed}:leisure:${block.id}`);
    const rotationY = (hash % 2) * Math.PI / 2;
    const availableDay = 52 + hash % 38;
    addBench(assets, block.id, block.center, 0, -9, -6, rotationY, availableDay);
    addBench(assets, block.id, block.center, 1, 9, -6, rotationY, availableDay + 4);
    addTable(assets, block.id, block.center, rotationY, availableDay + 8);
    addLamp(assets, block.id, block.center, 0, -14, 1, rotationY, availableDay + 10);
    addLamp(assets, block.id, block.center, 1, 14, -1, rotationY, availableDay + 12);
    addBikeRack(assets, block.id, block.center, rotationY, availableDay + 14);
  }
  return Object.freeze({ version: 1, assets: Object.freeze(assets) });
}
