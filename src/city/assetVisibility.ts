export type CityAssetCategoryKey =
  | 'structures'
  | 'facades'
  | 'infrastructure'
  | 'landscape'
  | 'mobility'
  | 'cranes';

export interface CityAssetCategoryDefinition {
  key: CityAssetCategoryKey;
  labels: Readonly<{ en: string; zh: string }>;
  descriptions: Readonly<{ en: string; zh: string }>;
}

export type CityAssetVisibility = Readonly<Record<CityAssetCategoryKey, boolean>>;

export const CITY_ASSET_CATEGORIES: readonly CityAssetCategoryDefinition[] = Object.freeze([
  Object.freeze({
    key: 'structures',
    labels: Object.freeze({ en: 'Structures', zh: '结构体' }),
    descriptions: Object.freeze({ en: 'Shells, construction phases, roofs and hero landmarks', zh: '建筑外壳、施工阶段、屋顶与英雄地标' }),
  }),
  Object.freeze({
    key: 'facades',
    labels: Object.freeze({ en: 'Facades', zh: '立面' }),
    descriptions: Object.freeze({ en: 'Curtain-wall strips, balconies and their structure lines', zh: '幕墙条、阳台及其结构线' }),
  }),
  Object.freeze({
    key: 'infrastructure',
    labels: Object.freeze({ en: 'Roads + water', zh: '道路与水体' }),
    descriptions: Object.freeze({ en: 'Growing road network, lane marks and waterfront channels', zh: '生长路网、车道线与水岸通道' }),
  }),
  Object.freeze({
    key: 'landscape',
    labels: Object.freeze({ en: 'Landscape', zh: '绿化' }),
    descriptions: Object.freeze({ en: 'LOD-governed street and park trees', zh: '受 LOD 管理的行道树与公园树' }),
  }),
  Object.freeze({
    key: 'mobility',
    labels: Object.freeze({ en: 'Mobility', zh: '交通载具' }),
    descriptions: Object.freeze({ en: 'Road vehicles and the survey helicopter', zh: '道路车辆与巡检直升机' }),
  }),
  Object.freeze({
    key: 'cranes',
    labels: Object.freeze({ en: 'Cranes', zh: '塔吊' }),
    descriptions: Object.freeze({ en: 'Scheduled construction cranes and rigging lines', zh: '按排期出现的施工塔吊与吊索' }),
  }),
]);

export function createCityAssetVisibility(
  overrides: Partial<Record<CityAssetCategoryKey, boolean>> = {},
): CityAssetVisibility {
  return Object.freeze(Object.fromEntries(CITY_ASSET_CATEGORIES.map(({ key }) => [
    key,
    typeof overrides[key] === 'boolean' ? overrides[key] : true,
  ])) as Record<CityAssetCategoryKey, boolean>);
}

export function setCityAssetCategoryVisibility(
  current: CityAssetVisibility,
  key: CityAssetCategoryKey,
  visible: boolean,
): CityAssetVisibility {
  if (!CITY_ASSET_CATEGORIES.some((category) => category.key === key)) return current;
  if (current[key] === visible) return current;
  return createCityAssetVisibility({ ...current, [key]: visible });
}

export function countVisibleCityAssetCategories(visibility: CityAssetVisibility): number {
  return CITY_ASSET_CATEGORIES.reduce((count, { key }) => count + Number(visibility[key]), 0);
}
