import { fnv1aHash } from '../bootengine/seed';
import type { BuildingKind, CityBuilding, CityPoint } from './model';

export interface CityFacadeStrip {
  id: string;
  buildingId: string;
  faceIndex: 0 | 1 | 2 | 3;
  bayIndex: number;
  bayCenter: number;
  edgeSpacing: number;
  position: CityPoint;
  rotationY: number;
  width: number;
  depth: number;
  height: number;
}

export interface CityFacadeBalcony {
  id: string;
  buildingId: string;
  faceIndex: 0 | 1 | 2 | 3;
  position: CityPoint;
  rotationY: number;
  width: number;
  depth: number;
  height: number;
}

export interface CityFacadePlan {
  version: 1;
  strips: readonly CityFacadeStrip[];
  balconies: readonly CityFacadeBalcony[];
}

export const CITY_FACADE_STRIP_WIDTH: Readonly<Record<BuildingKind, number>> = Object.freeze({
  office: 0.21,
  residential: 0.13,
  mall: 0.35,
  cylinder: 0.25,
  landmark: 0.21,
});

const FACADE_BAY_SPACING: Readonly<Record<BuildingKind, number>> = Object.freeze({
  office: 2.5,
  residential: 3.4,
  mall: 4.2,
  cylinder: 2.8,
  landmark: 2.5,
});

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const round = (value: number, places = 4): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function facadeFrame(building: CityBuilding, faceIndex: 0 | 1 | 2 | 3) {
  const rotationY = building.rotationY + faceIndex * Math.PI / 2;
  const normal = { x: Math.sin(rotationY), z: Math.cos(rotationY) };
  const right = { x: Math.cos(rotationY), z: -Math.sin(rotationY) };
  const sideFacing = faceIndex % 2 === 1;
  return {
    rotationY,
    normal,
    right,
    faceWidth: sideFacing ? building.bounds.depth : building.bounds.width,
    normalHalf: (sideFacing ? building.bounds.width : building.bounds.depth) / 2,
  };
}

function worldPosition(
  building: CityBuilding,
  frame: ReturnType<typeof facadeFrame>,
  lateral: number,
  normalDistance: number,
  y: number,
): CityPoint {
  return {
    x: round(building.position.x + frame.right.x * lateral + frame.normal.x * normalDistance),
    y: round(y),
    z: round(building.position.z + frame.right.z * lateral + frame.normal.z * normalDistance),
  };
}

function createBuildingFacade(building: CityBuilding): {
  strips: CityFacadeStrip[];
  balconies: CityFacadeBalcony[];
} {
  if (building.kind === 'landmark') return { strips: [], balconies: [] };

  const faceIndex = (fnv1aHash(building.id) % 4) as 0 | 1 | 2 | 3;
  const frame = facadeFrame(building, faceIndex);
  const bayCount = clamp(Math.floor(frame.faceWidth / FACADE_BAY_SPACING[building.buildingKind]), 2, 9);
  const edgeSpacing = frame.faceWidth / (bayCount + 1);
  const stripWidth = CITY_FACADE_STRIP_WIDTH[building.buildingKind];
  const stripDepth = building.buildingKind === 'mall' ? 0.44 : 0.34;
  const stripDistance = frame.normalHalf + stripDepth / 2 + 0.03;
  const strips: CityFacadeStrip[] = [];

  for (let bayIndex = 0; bayIndex < bayCount; bayIndex += 1) {
    const bayCenter = -frame.faceWidth / 2 + edgeSpacing * (bayIndex + 1);
    const offsets = building.buildingKind === 'residential' ? [-0.2, 0.2] : [0];
    offsets.forEach((pairOffset, pairIndex) => {
      strips.push({
        id: `${building.id}-facade-${bayIndex}-${pairIndex}`,
        buildingId: building.id,
        faceIndex,
        bayIndex,
        bayCenter: round(bayCenter),
        edgeSpacing: round(edgeSpacing),
        position: worldPosition(building, frame, bayCenter + pairOffset, stripDistance, building.bounds.height / 2),
        rotationY: round(frame.rotationY),
        width: stripWidth,
        depth: stripDepth,
        height: building.bounds.height,
      });
    });
  }

  const balconies: CityFacadeBalcony[] = [];
  const balconyRoll = fnv1aHash(`${building.id}:balconies`);
  if (building.buildingKind === 'residential' && balconyRoll % 3 === 0) {
    const balconyCount = 2 + balconyRoll % 2;
    const balconyDepth = 1.15;
    const oppositeDistance = -(frame.normalHalf + balconyDepth / 2 + 0.04);
    for (let index = 0; index < balconyCount; index += 1) {
      const y = building.bounds.height * ((index + 1.35) / (balconyCount + 1.6));
      balconies.push({
        id: `${building.id}-balcony-${index}`,
        buildingId: building.id,
        faceIndex,
        position: worldPosition(building, frame, 0, oppositeDistance, y),
        rotationY: round(frame.rotationY),
        width: round(Math.min(5.6, frame.faceWidth * 0.52)),
        depth: balconyDepth,
        height: 0.24,
      });
    }
  }

  return { strips, balconies };
}

/**
 * Builds one static, deterministic facade plan. The renderer consumes the
 * result through two InstancedMeshes and one merged line buffer, so adding
 * hundreds of strips does not add hundreds of draw calls or scene objects.
 */
export function createCityFacadePlan(buildings: readonly CityBuilding[]): CityFacadePlan {
  const strips: CityFacadeStrip[] = [];
  const balconies: CityFacadeBalcony[] = [];
  for (const building of buildings) {
    const facade = createBuildingFacade(building);
    strips.push(...facade.strips);
    balconies.push(...facade.balconies);
  }
  return Object.freeze({
    version: 1,
    strips: Object.freeze(strips),
    balconies: Object.freeze(balconies),
  });
}
