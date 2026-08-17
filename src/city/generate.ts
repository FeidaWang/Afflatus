import { createRng, fnv1aHash } from '../bootengine/seed';
import {
  CITY_CONCEPT_GENERATION_PROFILES,
  normalizeCityConceptProfileKey,
  type CityConceptProfileKey,
} from './profiles';
import {
  type BuildingKind,
  type CityBlock,
  type CityBuilding,
  type CityHeroLandmark,
  type CityPlan,
  type CityProfile,
  type CityRoad,
  type CityTree,
  type CityVehicle,
  type CityWater,
  type CityZone,
  type RoofKind,
} from './model';

export const SYNTHETIC_TEST_PROFILE: CityProfile = CITY_CONCEPT_GENERATION_PROFILES.sandbox;

const round = (value: number, places = 3): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

const zoneFor = (
  gridX: number,
  gridZ: number,
  parkRoll: number,
  profile: CityProfile,
): CityZone => {
  if (profile.waterChannel) {
    const perpendicularIndex = profile.waterChannel.axis === 'z' ? gridX : gridZ;
    if (perpendicularIndex === profile.waterChannel.gridIndex) return 'water';
  }
  const distance = Math.hypot(
    gridX + 0.5 - profile.coreOffset.x,
    gridZ + 0.5 - profile.coreOffset.z,
  );
  if (distance <= 1.45) return 'core';
  if (parkRoll < profile.parkProbability && distance > 2.25) return 'park';
  if (distance <= 3) return 'mixed';
  return 'residential';
};

const kindFor = (zone: CityZone, roll: number, profile: CityProfile): BuildingKind => {
  if (zone === 'core') return roll < profile.coreCylinderChance ? 'cylinder' : 'office';
  if (zone === 'mixed') return roll < 0.22 ? 'mall' : roll < 0.58 ? 'office' : 'residential';
  return roll < 0.2 ? 'mall' : 'residential';
};

const roofFor = (roll: number): RoofKind => {
  if (roll < 0.1) return 'garden';
  if (roll < 0.23) return 'spire';
  if (roll < 0.38) return 'crown';
  return 'flat';
};

const heightFor = (zone: CityZone, kind: BuildingKind, roll: number, profile: CityProfile): number => {
  let height;
  if (kind === 'mall') height = 7 + roll * 6;
  else if (kind === 'cylinder') height = 68 + roll * 46;
  else if (zone === 'core') height = 74 + roll * 78;
  else if (zone === 'mixed') height = kind === 'office' ? 34 + roll * 38 : 24 + roll * 35;
  else height = 18 + roll * 32;
  return height * profile.heightScale;
};

const capacityFor = (kind: BuildingKind, width: number, depth: number, height: number) => {
  const floors = Math.max(1, height / 3.2);
  const floorArea = width * depth * floors;
  if (kind === 'residential') return { residents: Math.round(floorArea / 42), jobs: Math.round(floorArea / 450) };
  if (kind === 'mall') return { residents: 0, jobs: Math.round(floorArea / 28) };
  return { residents: 0, jobs: Math.round(floorArea / 22) };
};

function roadSchedule(position: number, extent: number, jitter: number) {
  const normalized = Math.abs(position) / Math.max(1, extent / 2);
  const startDay = Math.max(0, round(normalized * 34 + jitter * 4, 2));
  return { startDay, endDay: round(startDay + 18 + jitter * 6, 2) };
}

function buildingSchedule(
  zone: CityZone,
  positionX: number,
  positionZ: number,
  extent: number,
  height: number,
  jitter: number,
) {
  const radial = Math.min(1, Math.hypot(positionX, positionZ) / Math.max(1, extent * 0.58));
  const zoneOffset = zone === 'core' ? 18 : zone === 'mixed' ? 38 : 58;
  const endDay = Math.min(208, round(58 + zoneOffset + radial * 78 + (jitter - 0.5) * 20, 2));
  const duration = Math.min(68, Math.max(28, 24 + height * 0.22 + jitter * 16));
  return { startDay: round(Math.max(0, endDay - duration), 2), endDay };
}

export function generateSandboxCity(
  seed = 'afflatus-city-001',
  profileKey: CityConceptProfileKey = 'sandbox',
): CityPlan {
  const profile = CITY_CONCEPT_GENERATION_PROFILES[normalizeCityConceptProfileKey(profileKey)];
  const seedHash = fnv1aHash(seed);
  const rng = createRng(seedHash);
  const blocks: CityBlock[] = [];
  const roads: CityRoad[] = [];
  const buildings: CityBuilding[] = [];
  const trees: CityTree[] = [];
  const vehicles: CityVehicle[] = [];
  const water: CityWater[] = [];
  const heroLandmarks: CityHeroLandmark[] = [];
  const extent = profile.pitch * profile.radius * 2 + profile.roadWidth;

  if (profile.waterChannel) {
    const channelPosition = (profile.waterChannel.gridIndex + 0.5) * profile.pitch;
    water.push({
      id: `${profile.key}-water-0`,
      kind: 'water',
      axis: profile.waterChannel.axis,
      position: profile.waterChannel.axis === 'x'
        ? { x: 0, y: 0, z: channelPosition }
        : { x: channelPosition, y: 0, z: 0 },
      width: profile.blockSize,
      length: extent,
    });
  }

  for (let line = -profile.radius; line <= profile.radius; line += 1) {
    const position = line * profile.pitch;
    const length = extent;
    const xJitter = rng();
    const zJitter = rng();
    roads.push({
      id: `road-x-${line + profile.radius}`,
      kind: 'road',
      axis: 'x',
      position,
      length,
      width: profile.roadWidth,
      schedule: roadSchedule(position, extent, xJitter),
    });
    roads.push({
      id: `road-z-${line + profile.radius}`,
      kind: 'road',
      axis: 'z',
      position,
      length,
      width: profile.roadWidth,
      schedule: roadSchedule(position, extent, zJitter),
    });
  }

  let landmarkId = '';
  for (let gridZ = -profile.radius; gridZ < profile.radius; gridZ += 1) {
    for (let gridX = -profile.radius; gridX < profile.radius; gridX += 1) {
      const blockId = `block-${gridX + profile.radius}-${gridZ + profile.radius}`;
      const centerX = (gridX + 0.5) * profile.pitch;
      const centerZ = (gridZ + 0.5) * profile.pitch;
      const zone = zoneFor(gridX, gridZ, rng(), profile);
      blocks.push({
        id: blockId,
        gridX,
        gridZ,
        center: { x: centerX, y: 0, z: centerZ },
        zone,
      });

      if (zone === 'water') continue;

      const heroTemplate = profile.heroLandmarks.find((entry) => (
        entry.gridX === gridX && entry.gridZ === gridZ
      ));
      if (heroTemplate) {
        const duration = Math.max(42, heroTemplate.height * 0.48);
        heroLandmarks.push({
          id: heroTemplate.id,
          kind: 'hero-landmark',
          form: heroTemplate.form,
          labels: heroTemplate.labels,
          blockId,
          position: { x: centerX, y: 0, z: centerZ },
          bounds: {
            width: heroTemplate.width,
            height: heroTemplate.height,
            depth: heroTemplate.depth,
          },
          rotationY: heroTemplate.rotationY,
          schedule: {
            startDay: round(Math.max(0, heroTemplate.endDay - duration), 2),
            endDay: heroTemplate.endDay,
          },
          truthClass: 'generated-concept',
        });
        continue;
      }

      if (zone === 'park') {
        const treeCount = 5 + Math.floor(rng() * 4);
        for (let index = 0; index < treeCount; index += 1) {
          trees.push({
            id: `${blockId}-tree-${index}`,
            kind: 'tree',
            blockId,
            position: {
              x: round(centerX + (rng() - 0.5) * (profile.blockSize - 10)),
              y: 0,
              z: round(centerZ + (rng() - 0.5) * (profile.blockSize - 10)),
            },
            radius: round(2.2 + rng() * 1.1),
            height: round(5.5 + rng() * 3.5),
            availableDay: round(34 + rng() * 42, 2),
          });
        }
        continue;
      }

      const isLandmarkBlock = (
        gridX === profile.landmarkGrid.x
        && gridZ === profile.landmarkGrid.z
      );
      const count = isLandmarkBlock
        ? 1
        : zone === 'core'
          ? profile.coreBuildingCount
          : zone === 'mixed'
            ? profile.mixedBuildingCount
          : profile.residentialBuildingCount;
      const slots = count === 1
        ? [[0, 0]]
        : count === 2
          ? [[-10, -7], [10, 8]]
          : [[-11, -10], [11, -8], [0, 11]];

      for (let index = 0; index < count; index += 1) {
        const [slotX, slotZ] = slots[index];
        const landmark = isLandmarkBlock && index === 0;
        const buildingKind: BuildingKind = landmark ? 'landmark' : kindFor(zone, rng(), profile);
        // Three-building residential blocks use tighter footprints so no
        // generated shell can bleed into the surrounding road reserve.
        const compactLot = count === 3;
        const width = landmark
          ? 22
          : compactLot
            ? round(8 + rng() * 6)
            : round(10 + rng() * (buildingKind === 'mall' ? 12 : 10));
        const depth = landmark
          ? 22
          : compactLot
            ? round(8 + rng() * 6)
            : round(10 + rng() * (buildingKind === 'mall' ? 12 : 10));
        const height = landmark ? profile.landmarkHeight : round(heightFor(zone, buildingKind, rng(), profile));
        const x = round(centerX + slotX + (rng() - 0.5) * 3);
        const z = round(centerZ + slotZ + (rng() - 0.5) * 3);
        const id = landmark ? 'landmark-cbd' : `${blockId}-building-${index}`;
        const schedule = landmark
          ? { startDay: 0, endDay: 147 }
          : buildingSchedule(zone, x, z, extent, height, rng());
        buildings.push({
          id,
          kind: landmark ? 'landmark' : 'building',
          buildingKind,
          blockId,
          zone,
          position: { x, y: 0, z },
          bounds: { width, height, depth },
          rotationY: round((rng() - 0.5) * 0.16),
          roofKind: landmark && profile.landmarkForm === 'tapered-spire'
            ? 'spire'
            : landmark
              ? 'crown'
              : roofFor(rng()),
          capacity: capacityFor(buildingKind, width, depth, height),
          schedule,
        });
        if (landmark) landmarkId = id;
      }
    }
  }

  for (let index = 0; index < profile.vehicleCount; index += 1) {
    const axis = index % 2 === 0 ? 'x' : 'z';
    const roadIndex = Math.floor(rng() * (profile.radius * 2 + 1));
    const direction = rng() > 0.5 ? 1 : -1;
    const trafficSide = profile.trafficSide === 'left' ? -1 : 1;
    const lane = (roadIndex - profile.radius) * profile.pitch + direction * trafficSide * 2.1;
    vehicles.push({
      id: `vehicle-${index}`,
      kind: 'vehicle',
      roadId: `road-${axis}-${roadIndex}`,
      axis,
      lane: round(lane),
      direction,
      offset: round(rng() * extent),
      speed: round(5 + rng() * 5),
      availableDay: round(48 + rng() * 32, 2),
    });
  }

  return Object.freeze({
    version: 1,
    seed,
    seedHash,
    profile,
    extent,
    blocks,
    roads,
    buildings,
    trees,
    vehicles,
    water,
    heroLandmarks,
    landmarkId,
  });
}
