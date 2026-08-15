import { fnv1aHash } from '../bootengine/seed';
import type { CityBounds, CityBuilding, CityPoint } from './model';

export type CityRooftopAssetKind =
  | 'antenna-mast'
  | 'crown-tier'
  | 'equipment-room'
  | 'equipment-vent'
  | 'garden-lawn'
  | 'garden-pergola'
  | 'garden-planter'
  | 'helipad-deck'
  | 'helipad-mark';

export type CityRooftopAssetTone = 'white' | 'pale' | 'green' | 'orange';

export interface CityRooftopAsset {
  id: string;
  buildingId: string;
  kind: CityRooftopAssetKind;
  tone: CityRooftopAssetTone;
  position: CityPoint;
  bounds: CityBounds;
  rotationY: number;
  revealStart: number;
}

export interface CityRooftopPlan {
  version: 1;
  assets: readonly CityRooftopAsset[];
}

const round = (value: number, places = 4): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function worldPosition(
  building: CityBuilding,
  localX: number,
  localZ: number,
  y: number,
): CityPoint {
  const cosine = Math.cos(building.rotationY);
  const sine = Math.sin(building.rotationY);
  return {
    x: round(building.position.x + localX * cosine + localZ * sine),
    y: round(y),
    z: round(building.position.z - localX * sine + localZ * cosine),
  };
}

function asset(
  building: CityBuilding,
  suffix: string,
  kind: CityRooftopAssetKind,
  tone: CityRooftopAssetTone,
  localX: number,
  localZ: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  revealStart: number,
): CityRooftopAsset {
  return Object.freeze({
    id: `${building.id}-roof-${suffix}`,
    buildingId: building.id,
    kind,
    tone,
    position: worldPosition(building, localX, localZ, y),
    bounds: Object.freeze({
      width: round(width),
      height: round(height),
      depth: round(depth),
    }),
    rotationY: building.rotationY,
    revealStart,
  });
}

function gardenAssets(building: CityBuilding): CityRooftopAsset[] {
  const { width, height, depth } = building.bounds;
  const lawnWidth = width * 0.72;
  const lawnDepth = depth * 0.72;
  const planterWidth = Math.min(1.2, width * 0.1);
  const inset = Math.max(0, lawnWidth / 2 - planterWidth / 2);
  return [
    asset(
      building,
      'lawn',
      'garden-lawn',
      'green',
      0,
      0,
      height + 1.52,
      lawnWidth,
      0.18,
      lawnDepth,
      0.16,
    ),
    asset(
      building,
      'planter-west',
      'garden-planter',
      'white',
      -inset,
      0,
      height + 1.72,
      planterWidth,
      0.4,
      lawnDepth,
      0.36,
    ),
    asset(
      building,
      'planter-east',
      'garden-planter',
      'white',
      inset,
      0,
      height + 1.72,
      planterWidth,
      0.4,
      lawnDepth,
      0.52,
    ),
    asset(
      building,
      'pergola-west',
      'garden-pergola',
      'pale',
      -lawnWidth * 0.22,
      lawnDepth * 0.18,
      height + 2.82,
      0.42,
      2.6,
      0.42,
      0.64,
    ),
    asset(
      building,
      'pergola-east',
      'garden-pergola',
      'pale',
      lawnWidth * 0.22,
      lawnDepth * 0.18,
      height + 2.82,
      0.42,
      2.6,
      0.42,
      0.7,
    ),
    asset(
      building,
      'pergola-beam',
      'garden-pergola',
      'white',
      0,
      lawnDepth * 0.18,
      height + 4.18,
      lawnWidth * 0.52,
      0.28,
      1.1,
      0.78,
    ),
  ];
}

function crownAssets(building: CityBuilding): CityRooftopAsset[] {
  const { width, height, depth } = building.bounds;
  return [
    asset(building, 'crown-middle', 'crown-tier', 'pale', 0, 0, height + 2.05, width * 0.46, 1.3, depth * 0.46, 0.24),
    asset(building, 'crown-upper', 'crown-tier', 'white', 0, 0, height + 3.1, width * 0.3, 0.8, depth * 0.3, 0.5),
    asset(building, 'antenna', 'antenna-mast', 'orange', 0, 0, height + 6.5, 0.36, 6, 0.36, 0.68),
  ];
}

function helipadAssets(building: CityBuilding): CityRooftopAsset[] {
  const { width, height, depth } = building.bounds;
  const size = Math.min(width, depth) * 0.56;
  const bar = Math.max(0.22, size * 0.075);
  return [
    asset(building, 'helipad-deck', 'helipad-deck', 'pale', 0, 0, height + 1.57, size, 0.28, size, 0.16),
    asset(building, 'helipad-mark-left', 'helipad-mark', 'orange', -size * 0.2, 0, height + 1.74, bar, 0.08, size * 0.48, 0.42),
    asset(building, 'helipad-mark-right', 'helipad-mark', 'orange', size * 0.2, 0, height + 1.74, bar, 0.08, size * 0.48, 0.5),
    asset(building, 'helipad-mark-cross', 'helipad-mark', 'orange', 0, 0, height + 1.74, size * 0.4, 0.08, bar, 0.58),
  ];
}

function equipmentAssets(building: CityBuilding, hash: number): CityRooftopAsset[] {
  const { width, height, depth } = building.bounds;
  const footprintScale = building.roofKind === 'crown' ? 0.58 : 0.82;
  const usableWidth = width * footprintScale;
  const usableDepth = depth * footprintScale;
  const roomWidth = Math.min(usableWidth * 0.5, 7.2);
  const roomDepth = Math.min(usableDepth * 0.46, 6.4);
  const offsetX = ((hash >>> 4) % 2 ? 1 : -1) * Math.max(0, usableWidth * 0.16);
  const offsetZ = ((hash >>> 6) % 2 ? 1 : -1) * Math.max(0, usableDepth * 0.12);
  const roomHeight = 1.9 + (hash % 5) * 0.18;
  const ventSize = Math.min(1.15, Math.min(usableWidth, usableDepth) * 0.09);
  return [
    asset(
      building,
      'equipment-room',
      'equipment-room',
      'pale',
      offsetX,
      offsetZ,
      height + 1.4 + roomHeight / 2,
      roomWidth,
      roomHeight,
      roomDepth,
      0.2,
    ),
    asset(
      building,
      'equipment-vent',
      'equipment-vent',
      'orange',
      -offsetX * 0.8,
      -offsetZ * 0.8,
      height + 1.4 + ventSize / 2,
      ventSize,
      ventSize,
      ventSize,
      0.55,
    ),
  ];
}

/**
 * Derives bounded rooftop detail without touching simulation truth. Every part
 * remains a box so the renderer can batch the entire plan in one InstancedMesh.
 */
export function createCityRooftopPlan(buildings: readonly CityBuilding[]): CityRooftopPlan {
  const assets: CityRooftopAsset[] = [];
  for (const building of buildings) {
    if (building.roofKind === 'spire') continue;
    if (building.roofKind === 'garden') {
      assets.push(...gardenAssets(building));
      continue;
    }
    if (building.roofKind === 'crown') {
      assets.push(...crownAssets(building));
      continue;
    }

    const hash = fnv1aHash(`${building.id}:rooftop`);
    const supportsHelipad = building.bounds.width >= 14
      && building.bounds.depth >= 14
      && building.buildingKind !== 'residential';
    if (supportsHelipad && hash % 7 === 0) assets.push(...helipadAssets(building));
    else if (hash % 3 !== 0) assets.push(...equipmentAssets(building, hash));
  }

  return Object.freeze({ version: 1, assets: Object.freeze(assets) });
}
