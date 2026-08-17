export type CityExperienceProfileId =
  | 'shanghai-lujiazui-v0'
  | 'melbourne-hoddle-grid-v0'
  | 'hong-kong-victoria-harbour-v0';
export type CityConceptProfileKey = 'sandbox' | 'shanghai' | 'melbourne' | 'hong-kong';
export type CityPublicProfileKey = Exclude<CityConceptProfileKey, 'sandbox'>;
export type CityConceptProfileId =
  | 'synthetic-test-fixture-v1'
  | 'shanghai-concept-v0'
  | 'melbourne-concept-v0'
  | 'hong-kong-concept-v0';
export type CityLandmarkForm = 'twist' | 'tapered-spire';
export type CityHeroLandmarkForm =
  | 'pearl-mast'
  | 'stepped-crown'
  | 'notched-fin'
  | 'corn-cob'
  | 'station-hall'
  | 'civic-shards'
  | 'arts-spire';

export interface CityHeroLandmarkTemplate {
  id: string;
  form: CityHeroLandmarkForm;
  labels: Readonly<{ en: string; zh: string }>;
  gridX: number;
  gridZ: number;
  width: number;
  height: number;
  depth: number;
  rotationY: number;
  endDay: number;
}
export type CityProfileStatus = 'candidate-unverified' | 'approved';
export type CityExperienceRole = 'brand-first' | 'data-first';

export interface Wgs84Point {
  latitude: number;
  longitude: number;
}

export interface Wgs84Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface CityExperienceProfile {
  id: CityExperienceProfileId;
  labels: Readonly<{ en: string; zh: string }>;
  role: CityExperienceRole;
  status: CityProfileStatus;
  sourceCrs: 'EPSG:4326';
  anchor: Readonly<Wgs84Point>;
  candidateBounds: Readonly<Wgs84Bounds>;
  trafficSide: 'left' | 'right';
  heroLandmarkIds: readonly string[];
  dataPolicy: Readonly<{
    externalDataAllowed: boolean;
    licenceReviewRequired: boolean;
    attributionRequired: boolean;
  }>;
}

export interface CityConceptGenerationProfile {
  key: CityConceptProfileKey;
  id: CityConceptProfileId;
  labels: Readonly<{ en: string; zh: string }>;
  experienceProfileId: CityExperienceProfileId | null;
  truthClass: 'generated-concept';
  radius: number;
  blockSize: number;
  roadWidth: number;
  pitch: number;
  totalDays: number;
  heightScale: number;
  landmarkHeight: number;
  landmarkForm: CityLandmarkForm;
  residentialBuildingCount: 2 | 3;
  coreBuildingCount: 2 | 3;
  mixedBuildingCount: 2 | 3;
  vehicleCount: number;
  parkProbability: number;
  coreCylinderChance: number;
  coreOffset: Readonly<{ x: number; z: number }>;
  landmarkGrid: Readonly<{ x: number; z: number }>;
  trafficSide: 'left' | 'right';
  waterChannel: Readonly<{
    axis: 'x' | 'z';
    gridIndex: number;
  }> | null;
  ridgeBackdrop: Readonly<{
    axis: 'x' | 'z';
    side: -1 | 1;
    distance: number;
    span: number;
    peakCount: number;
    maxHeight: number;
  }> | null;
  heroLandmarks: readonly CityHeroLandmarkTemplate[];
}

const guardedDataPolicy = Object.freeze({
  externalDataAllowed: false,
  licenceReviewRequired: true,
  attributionRequired: true,
});

export const CITY_CONCEPT_GENERATION_PROFILES: Readonly<Record<CityConceptProfileKey, CityConceptGenerationProfile>> = Object.freeze({
  sandbox: Object.freeze({
    key: 'sandbox',
    id: 'synthetic-test-fixture-v1',
    labels: Object.freeze({ en: 'Synthetic test fixture', zh: '合成测试基准' }),
    experienceProfileId: null,
    truthClass: 'generated-concept',
    radius: 4,
    blockSize: 46,
    roadWidth: 10,
    pitch: 56,
    totalDays: 210,
    heightScale: 1,
    landmarkHeight: 132,
    landmarkForm: 'twist',
    residentialBuildingCount: 3,
    coreBuildingCount: 2,
    mixedBuildingCount: 2,
    vehicleCount: 18,
    parkProbability: 0.12,
    coreCylinderChance: 0.28,
    coreOffset: Object.freeze({ x: 0, z: 0 }),
    landmarkGrid: Object.freeze({ x: 0, z: 0 }),
    trafficSide: 'right',
    waterChannel: null,
    ridgeBackdrop: null,
    heroLandmarks: Object.freeze([]),
  }),
  shanghai: Object.freeze({
    key: 'shanghai',
    id: 'shanghai-concept-v0',
    labels: Object.freeze({ en: 'Shanghai concept', zh: '上海概念' }),
    experienceProfileId: 'shanghai-lujiazui-v0',
    truthClass: 'generated-concept',
    radius: 4,
    blockSize: 46,
    roadWidth: 10,
    pitch: 56,
    totalDays: 210,
    heightScale: 1.22,
    landmarkHeight: 158,
    landmarkForm: 'twist',
    residentialBuildingCount: 3,
    coreBuildingCount: 2,
    mixedBuildingCount: 2,
    vehicleCount: 18,
    parkProbability: 0.08,
    coreCylinderChance: 0.4,
    coreOffset: Object.freeze({ x: 0, z: 0 }),
    landmarkGrid: Object.freeze({ x: 0, z: 0 }),
    trafficSide: 'right',
    waterChannel: Object.freeze({ axis: 'z', gridIndex: -4 }),
    ridgeBackdrop: null,
    heroLandmarks: Object.freeze([
      Object.freeze({
        id: 'shanghai-pearl-concept',
        form: 'pearl-mast',
        labels: Object.freeze({ en: 'Pearl broadcast tower concept', zh: '明珠广播塔概念轮廓' }),
        gridX: 1,
        gridZ: 0,
        width: 20,
        height: 118,
        depth: 20,
        rotationY: 0,
        endDay: 142,
      }),
      Object.freeze({
        id: 'shanghai-stepped-crown-concept',
        form: 'stepped-crown',
        labels: Object.freeze({ en: 'Stepped crown tower concept', zh: '阶梯冠顶塔概念轮廓' }),
        gridX: 0,
        gridZ: -1,
        width: 19,
        height: 112,
        depth: 19,
        rotationY: 0.08,
        endDay: 154,
      }),
      Object.freeze({
        id: 'shanghai-corn-curve-concept',
        form: 'corn-cob',
        labels: Object.freeze({ en: 'Corn-cob curve tower concept', zh: '玉米形曲线塔概念轮廓' }),
        gridX: 1,
        gridZ: -1,
        width: 18,
        height: 104,
        depth: 18,
        rotationY: -0.06,
        endDay: 162,
      }),
    ]),
  }),
  melbourne: Object.freeze({
    key: 'melbourne',
    id: 'melbourne-concept-v0',
    labels: Object.freeze({ en: 'Melbourne concept', zh: '墨尔本概念' }),
    experienceProfileId: 'melbourne-hoddle-grid-v0',
    truthClass: 'generated-concept',
    radius: 4,
    blockSize: 40,
    roadWidth: 10,
    pitch: 50,
    totalDays: 210,
    heightScale: 0.78,
    landmarkHeight: 108,
    landmarkForm: 'tapered-spire',
    residentialBuildingCount: 2,
    coreBuildingCount: 2,
    mixedBuildingCount: 2,
    vehicleCount: 18,
    parkProbability: 0.16,
    coreCylinderChance: 0.12,
    coreOffset: Object.freeze({ x: 0, z: 0 }),
    landmarkGrid: Object.freeze({ x: 0, z: 0 }),
    trafficSide: 'left',
    waterChannel: Object.freeze({ axis: 'x', gridIndex: 2 }),
    ridgeBackdrop: null,
    heroLandmarks: Object.freeze([
      Object.freeze({
        id: 'melbourne-station-hall-concept',
        form: 'station-hall',
        labels: Object.freeze({ en: 'Long station hall concept', zh: '长站房概念轮廓' }),
        gridX: 0,
        gridZ: -1,
        width: 38,
        height: 20,
        depth: 20,
        rotationY: 0.04,
        endDay: 118,
      }),
      Object.freeze({
        id: 'melbourne-civic-shards-concept',
        form: 'civic-shards',
        labels: Object.freeze({ en: 'Civic shard complex concept', zh: '城市折面建筑群概念轮廓' }),
        gridX: 1,
        gridZ: -1,
        width: 34,
        height: 24,
        depth: 26,
        rotationY: -0.12,
        endDay: 132,
      }),
      Object.freeze({
        id: 'melbourne-arts-spire-concept',
        form: 'arts-spire',
        labels: Object.freeze({ en: 'Arts spire concept', zh: '艺术中心尖塔概念轮廓' }),
        gridX: -1,
        gridZ: 0,
        width: 16,
        height: 96,
        depth: 16,
        rotationY: 0,
        endDay: 148,
      }),
    ]),
  }),
  'hong-kong': Object.freeze({
    key: 'hong-kong',
    id: 'hong-kong-concept-v0',
    labels: Object.freeze({ en: 'Hong Kong concept', zh: '香港概念' }),
    experienceProfileId: 'hong-kong-victoria-harbour-v0',
    truthClass: 'generated-concept',
    radius: 4,
    blockSize: 38,
    roadWidth: 8,
    pitch: 46,
    totalDays: 210,
    heightScale: 1.14,
    landmarkHeight: 148,
    landmarkForm: 'tapered-spire',
    residentialBuildingCount: 3,
    coreBuildingCount: 3,
    mixedBuildingCount: 3,
    vehicleCount: 26,
    parkProbability: 0.05,
    coreCylinderChance: 0.16,
    coreOffset: Object.freeze({ x: 0, z: -2 }),
    landmarkGrid: Object.freeze({ x: 2, z: 1 }),
    trafficSide: 'left',
    waterChannel: Object.freeze({ axis: 'x', gridIndex: -1 }),
    ridgeBackdrop: Object.freeze({
      axis: 'x',
      side: -1,
      distance: 270,
      span: 380,
      peakCount: 9,
      maxHeight: 126,
    }),
    heroLandmarks: Object.freeze([
      Object.freeze({
        id: 'hong-kong-harbour-fin-concept',
        form: 'notched-fin',
        labels: Object.freeze({ en: 'Harbour financial fin concept', zh: '海港金融折面塔概念轮廓' }),
        gridX: -1,
        gridZ: -2,
        width: 18,
        height: 104,
        depth: 18,
        rotationY: -0.08,
        endDay: 148,
      }),
      Object.freeze({
        id: 'hong-kong-stepped-harbour-crown-concept',
        form: 'stepped-crown',
        labels: Object.freeze({ en: 'Stepped harbour crown concept', zh: '维港阶梯冠顶塔概念轮廓' }),
        gridX: 0,
        gridZ: -2,
        width: 19,
        height: 112,
        depth: 19,
        rotationY: 0.06,
        endDay: 158,
      }),
      Object.freeze({
        id: 'hong-kong-waterfront-cultural-podium-concept',
        form: 'civic-shards',
        labels: Object.freeze({ en: 'Waterfront cultural podium concept', zh: '海滨文化折面裙楼概念轮廓' }),
        gridX: 1,
        gridZ: -2,
        width: 34,
        height: 24,
        depth: 26,
        rotationY: -0.1,
        endDay: 126,
      }),
    ]),
  }),
});

export const PUBLIC_CITY_CONCEPT_PROFILE_KEYS: readonly CityPublicProfileKey[] = Object.freeze([
  'shanghai',
  'melbourne',
  'hong-kong',
]);

export function normalizeCityConceptProfileKey(value: unknown): CityConceptProfileKey {
  const key = String(value || '').toLowerCase();
  return key === 'shanghai' || key === 'melbourne' || key === 'hong-kong' ? key : 'sandbox';
}

export function normalizePublicCityConceptProfileKey(value: unknown): CityPublicProfileKey {
  const key = String(value || '').toLowerCase();
  return key === 'melbourne' || key === 'hong-kong' ? key : 'shanghai';
}

/**
 * Spatial candidates only: these bounds are deliberately not treated as an
 * approved GIS source. Provider, licence, CRS and control-point review must
 * pass before any profile may load remote or bundled real-city data.
 */
export const CITY_EXPERIENCE_PROFILES: Readonly<Record<CityExperienceProfileId, CityExperienceProfile>> = Object.freeze({
  'shanghai-lujiazui-v0': Object.freeze({
    id: 'shanghai-lujiazui-v0',
    labels: Object.freeze({ en: 'Shanghai · Lujiazui', zh: '上海 · 陆家嘴' }),
    role: 'brand-first',
    status: 'candidate-unverified',
    sourceCrs: 'EPSG:4326',
    anchor: Object.freeze({ latitude: 31.238, longitude: 121.497 }),
    candidateBounds: Object.freeze({ west: 121.47, south: 31.215, east: 121.525, north: 31.265 }),
    trafficSide: 'right',
    heroLandmarkIds: Object.freeze(['oriental-pearl', 'shanghai-tower', 'jin-mao', 'swfc']),
    dataPolicy: guardedDataPolicy,
  }),
  'melbourne-hoddle-grid-v0': Object.freeze({
    id: 'melbourne-hoddle-grid-v0',
    labels: Object.freeze({ en: 'Melbourne · Hoddle Grid', zh: '墨尔本 · 霍德尔方格' }),
    role: 'data-first',
    status: 'candidate-unverified',
    sourceCrs: 'EPSG:4326',
    anchor: Object.freeze({ latitude: -37.815, longitude: 144.963 }),
    candidateBounds: Object.freeze({ west: 144.945, south: -37.835, east: 144.99, north: -37.795 }),
    trafficSide: 'left',
    heroLandmarkIds: Object.freeze(['flinders-street', 'federation-square', 'arts-centre-spire']),
    dataPolicy: guardedDataPolicy,
  }),
  'hong-kong-victoria-harbour-v0': Object.freeze({
    id: 'hong-kong-victoria-harbour-v0',
    labels: Object.freeze({ en: 'Hong Kong · Victoria Harbour', zh: '香港 · 维多利亚港' }),
    role: 'brand-first',
    status: 'candidate-unverified',
    sourceCrs: 'EPSG:4326',
    anchor: Object.freeze({ latitude: 22.285, longitude: 114.17 }),
    candidateBounds: Object.freeze({ west: 114.13, south: 22.26, east: 114.21, north: 22.315 }),
    trafficSide: 'left',
    heroLandmarkIds: Object.freeze(['harbour-fin', 'stepped-harbour-crown', 'waterfront-cultural-podium']),
    dataPolicy: guardedDataPolicy,
  }),
});

export function canLoadRealCityData(profile: CityExperienceProfile): boolean {
  return profile.status === 'approved'
    && profile.dataPolicy.externalDataAllowed
    && !profile.dataPolicy.licenceReviewRequired;
}

export function validateCityExperienceProfile(profile: CityExperienceProfile): string[] {
  const errors: string[] = [];
  const { anchor, candidateBounds: bounds } = profile;
  if (profile.sourceCrs !== 'EPSG:4326') errors.push('sourceCrs');
  if (!(bounds.west < bounds.east && bounds.south < bounds.north)) errors.push('candidateBounds');
  if (bounds.west < -180 || bounds.east > 180 || bounds.south < -90 || bounds.north > 90) errors.push('candidateBoundsRange');
  if (
    anchor.longitude < bounds.west
    || anchor.longitude > bounds.east
    || anchor.latitude < bounds.south
    || anchor.latitude > bounds.north
  ) errors.push('anchor');
  if (!profile.labels.en.trim() || !profile.labels.zh.trim()) errors.push('labels');
  if (new Set(profile.heroLandmarkIds).size !== profile.heroLandmarkIds.length) errors.push('heroLandmarkIds');
  return errors;
}
