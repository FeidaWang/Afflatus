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
  sourceUrl: string | null;
  datasetVersion: string;
  licence: string;
  licenceSnapshotSha256: string | null;
  sourceArtifactSha256: string | null;
  attribution: string;
  sourceCrs: string;
  capturedAt: string | null;
  approvalStatus: 'generated' | 'production-approved';
}

export interface CityEntity {
  id: string;
  kind: CityEntityKind;
  assetId: string;
  lodProfile: CityLodProfile;
  sources: readonly [Readonly<CityProvenance>, ...Readonly<CityProvenance>[]];
  value: CityEntityValue;
}

export interface CityScene {
  version: 1;
  id: string;
  seed: string;
  profileId: string;
  truthClass: 'generated-concept' | 'licensed-real-data';
  packageId: string | null;
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
  const sourceUrl = input.sourceUrl == null ? null : requiredText(input.sourceUrl, 'sourceUrl');
  const licenceSnapshotSha256 = input.licenceSnapshotSha256;
  const sourceArtifactSha256 = input.sourceArtifactSha256;
  if (truthClass === 'licensed-real-data') {
    if (!sourceUrl?.startsWith('https://')) throw new Error('Licensed real data requires an HTTPS sourceUrl.');
    if (!/^[a-f0-9]{64}$/.test(String(licenceSnapshotSha256 || ''))) {
      throw new Error('Licensed real data requires a licenceSnapshotSha256.');
    }
    if (!/^[a-f0-9]{64}$/.test(String(sourceArtifactSha256 || ''))) {
      throw new Error('Licensed real data requires a sourceArtifactSha256.');
    }
    if (input.approvalStatus !== 'production-approved') {
      throw new Error('Licensed real data requires production approval.');
    }
  } else if (input.approvalStatus !== 'generated') {
    throw new Error('Generated provenance must use generated approval status.');
  }
  return Object.freeze({
    truthClass,
    sourceId: requiredText(input.sourceId, 'sourceId'),
    sourceUrl,
    datasetVersion: requiredText(input.datasetVersion, 'datasetVersion'),
    licence: requiredText(input.licence, 'licence'),
    licenceSnapshotSha256,
    sourceArtifactSha256,
    attribution: requiredText(input.attribution, 'attribution'),
    sourceCrs,
    capturedAt: input.capturedAt == null ? null : requiredText(input.capturedAt, 'capturedAt'),
    approvalStatus: input.approvalStatus,
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
  sources: Object.freeze([source]) as readonly [Readonly<CityProvenance>],
  value,
});

export function createGeneratedCityScene(plan: CityPlan): Readonly<CityScene> {
  const source = createCityProvenance({
    truthClass: 'generated-concept',
    sourceId: 'afflatus-city-generator',
    sourceUrl: null,
    datasetVersion: `city-plan-v${plan.version}`,
    licence: 'project-authored',
    licenceSnapshotSha256: null,
    sourceArtifactSha256: null,
    attribution: 'Project Afflatus procedural city generator',
    sourceCrs: 'LOCAL:PLAN',
    capturedAt: null,
    approvalStatus: 'generated',
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
    packageId: null,
    extent: plan.extent,
    totalDays: plan.profile.totalDays,
    entities: Object.freeze(entities),
  });
}

export const createSandboxCityScene = createGeneratedCityScene;
