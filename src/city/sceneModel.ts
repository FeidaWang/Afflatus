import type {
  CityBlock,
  CityBuilding,
  CityHeroLandmark,
  CityPlan,
  CityRoad,
  CityTree,
  CityVehicle,
  CityWater,
} from './model';

export type CityEntityKind =
  | 'block'
  | 'road'
  | 'building'
  | 'hero-landmark'
  | 'tree'
  | 'vehicle'
  | 'water';

export type CityLodProfile = 'structure' | 'infrastructure' | 'landscape' | 'mobility';
export type CityEntityValue =
  | CityBlock
  | CityRoad
  | CityBuilding
  | CityHeroLandmark
  | CityTree
  | CityVehicle
  | CityWater;

export interface CityProvenance {
  truthClass: 'generated-concept' | 'licensed-real-data';
  sourceId: string;
  datasetVersion: string;
  licence: string;
  attribution: string;
  sourceCrs: string;
  capturedAt: string | null;
}

export interface CityEntity {
  id: string;
  kind: CityEntityKind;
  assetId: string;
  lodProfile: CityLodProfile;
  source: Readonly<CityProvenance>;
  value: CityEntityValue;
}

export interface CityScene {
  version: 1;
  id: string;
  seed: string;
  profileId: string;
  truthClass: 'generated-concept';
  extent: number;
  totalDays: number;
  entities: readonly Readonly<CityEntity>[];
}

const requiredText = (value: unknown, field: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`City provenance requires ${field}.`);
  return normalized;
};

export function createCityProvenance(input: CityProvenance): Readonly<CityProvenance> {
  const truthClass = input?.truthClass;
  if (truthClass !== 'generated-concept' && truthClass !== 'licensed-real-data') {
    throw new Error('City provenance requires a recognized truthClass.');
  }
  const sourceCrs = requiredText(input.sourceCrs, 'sourceCrs');
  if (truthClass === 'licensed-real-data' && sourceCrs === 'LOCAL:PLAN') {
    throw new Error('Licensed real data requires an explicit source CRS.');
  }
  return Object.freeze({
    truthClass,
    sourceId: requiredText(input.sourceId, 'sourceId'),
    datasetVersion: requiredText(input.datasetVersion, 'datasetVersion'),
    licence: requiredText(input.licence, 'licence'),
    attribution: requiredText(input.attribution, 'attribution'),
    sourceCrs,
    capturedAt: input.capturedAt == null ? null : requiredText(input.capturedAt, 'capturedAt'),
  });
}

const entity = (
  value: CityEntityValue,
  kind: CityEntityKind,
  assetId: string,
  lodProfile: CityLodProfile,
  source: Readonly<CityProvenance>,
): Readonly<CityEntity> => Object.freeze({
  id: value.id,
  kind,
  assetId,
  lodProfile,
  source,
  value,
});

export function createSandboxCityScene(plan: CityPlan): Readonly<CityScene> {
  const source = createCityProvenance({
    truthClass: 'generated-concept',
    sourceId: 'afflatus-city-generator',
    datasetVersion: `city-plan-v${plan.version}`,
    licence: 'project-authored',
    attribution: 'Project Afflatus procedural city generator',
    sourceCrs: 'LOCAL:PLAN',
    capturedAt: null,
  });
  const entities: Readonly<CityEntity>[] = [
    ...plan.blocks.map((value) => entity(value, 'block', `block:${value.zone}`, 'structure', source)),
    ...plan.roads.map((value) => entity(value, 'road', 'road:local-grid', 'infrastructure', source)),
    ...plan.buildings.map((value) => entity(
      value,
      'building',
      `building:${value.buildingKind}:${value.roofKind}`,
      'structure',
      source,
    )),
    ...plan.heroLandmarks.map((value) => entity(
      value,
      'hero-landmark',
      `hero:${value.form}`,
      'structure',
      source,
    )),
    ...plan.trees.map((value) => entity(value, 'tree', 'tree:low-poly', 'landscape', source)),
    ...plan.vehicles.map((value) => entity(value, 'vehicle', 'vehicle:road', 'mobility', source)),
    ...plan.water.map((value) => entity(value, 'water', 'water:channel', 'infrastructure', source)),
  ];
  const ids = new Set(entities.map(({ id }) => id));
  if (ids.size !== entities.length) throw new Error('City scene entity IDs must be globally unique.');

  return Object.freeze({
    version: 1,
    id: `${plan.profile.id}:${plan.seedHash}`,
    seed: plan.seed,
    profileId: plan.profile.id,
    truthClass: 'generated-concept',
    extent: plan.extent,
    totalDays: plan.profile.totalDays,
    entities: Object.freeze(entities),
  });
}
