import * as THREE from 'three';
import type {
  CityEnvironmentId,
  CityEnvironmentSnapshot,
} from '../city/environmentClock.ts';
import type { CityPackageCityId } from '../city/packages.ts';
import { configureCityWindowLighting } from './cityWindowLighting';
import {
  configureCityWaterSurface,
  type CityWaterSurfaceStyle,
} from './cityWaterSurface';
import {
  blendSolarScalar,
  citySolarBlendWeights,
  type CitySolarBlendWeights,
} from './citySolarBlend';
import { cityWaterProfileForSnapshot } from './cityWaterProfiles';
import { configureAuthoredCityNightLighting } from './cityNightLighting';

type CityMaterialRole =
  | 'terrain'
  | 'buildings'
  | 'roads'
  | 'pedestrian'
  | 'water'
  | 'trees'
  | 'control'
  | 'other';

interface MaterialStyle {
  readonly inheritBase?: boolean;
  readonly color?: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly roughness?: number;
  readonly metalness?: number;
}

export interface CityStyleTwin {
  readonly id: `${CityPackageCityId}-${CityEnvironmentId}-v1`;
  readonly environment: CityEnvironmentId;
  readonly background: number;
  readonly fog: Readonly<{ color: number; near: number; far: number }>;
  readonly hemisphere: Readonly<{
    skyColor: number;
    groundColor: number;
    intensity: number;
  }>;
  readonly sun: Readonly<{
    color: number;
    intensity: number;
    followsEnvironmentClock: boolean;
  }>;
  readonly exposure: number;
  readonly iblIntensity: number;
  readonly windowLighting: Readonly<{ color: number; intensity: number }>;
  readonly waterSurface: Readonly<CityWaterSurfaceStyle>;
  readonly waterProfileId?: `${CityPackageCityId}-water-visual-v1`;
  readonly waterVisualBasis?: 'art-directed-visual-only';
  readonly materials: Readonly<Record<CityMaterialRole, MaterialStyle>>;
}

interface MaterialBaseline {
  readonly color: THREE.Color | null;
  readonly emissive: THREE.Color | null;
  readonly emissiveIntensity: number | null;
  readonly roughness: number | null;
  readonly metalness: number | null;
}

const MATERIAL_BASELINES = new WeakMap<THREE.Material, MaterialBaseline>();

const allInherited = Object.freeze({
  terrain: Object.freeze({ inheritBase: true }),
  buildings: Object.freeze({ inheritBase: true }),
  roads: Object.freeze({ inheritBase: true }),
  pedestrian: Object.freeze({ inheritBase: true }),
  water: Object.freeze({ inheritBase: true }),
  trees: Object.freeze({ inheritBase: true }),
  control: Object.freeze({ inheritBase: true }),
  other: Object.freeze({ inheritBase: true }),
});

export const CITY_STYLE_TWINS: Readonly<Record<CityEnvironmentId, CityStyleTwin>> = Object.freeze({
  analysis: Object.freeze({
    id: 'melbourne-analysis-v1',
    environment: 'analysis',
    background: 0xe8ebe8,
    fog: Object.freeze({ color: 0xe8ebe8, near: 850, far: 1700 }),
    hemisphere: Object.freeze({ skyColor: 0xffffff, groundColor: 0x7c8580, intensity: 2.4 }),
    sun: Object.freeze({ color: 0xffffff, intensity: 2.8, followsEnvironmentClock: false }),
    exposure: 1.08,
    iblIntensity: 1.15,
    windowLighting: Object.freeze({ color: 0xffd7a0, intensity: 0 }),
    waterSurface: Object.freeze({
      reflectionIntensity: 0.9,
      rippleStrength: 0,
      rippleScale: 0.045,
      flowSpeed: 0,
      flowDirection: Object.freeze({ x: 1, z: 0 }),
    }),
    materials: allInherited,
  }),
  day: Object.freeze({
    id: 'melbourne-day-v1',
    environment: 'day',
    background: 0xc9dceb,
    fog: Object.freeze({ color: 0xc9dceb, near: 900, far: 1850 }),
    hemisphere: Object.freeze({ skyColor: 0xeaf6ff, groundColor: 0x777267, intensity: 2.05 }),
    sun: Object.freeze({ color: 0xfff4da, intensity: 3.35, followsEnvironmentClock: true }),
    exposure: 1.02,
    iblIntensity: 1,
    windowLighting: Object.freeze({ color: 0xffd7a0, intensity: 0 }),
    waterSurface: Object.freeze({
      reflectionIntensity: 1.25,
      rippleStrength: 0.12,
      rippleScale: 0.045,
      flowSpeed: 0.7,
      flowDirection: Object.freeze({ x: 1, z: 0 }),
    }),
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x9ea58d, roughness: 0.96, metalness: 0 }),
      buildings: Object.freeze({ color: 0xd7d2c6, roughness: 0.82, metalness: 0.03 }),
      roads: Object.freeze({ color: 0x31363a }),
      pedestrian: Object.freeze({ color: 0x2b8f8e }),
      water: Object.freeze({ color: 0x287ba1, roughness: 0.18, metalness: 0 }),
      trees: Object.freeze({ color: 0x3f7145 }),
      control: Object.freeze({ color: 0xf07a24 }),
      other: Object.freeze({ inheritBase: true }),
    }),
  }),
  sunset: Object.freeze({
    id: 'melbourne-sunset-v1',
    environment: 'sunset',
    background: 0xd7aa98,
    fog: Object.freeze({ color: 0xd7aa98, near: 760, far: 1620 }),
    hemisphere: Object.freeze({ skyColor: 0xffdbc4, groundColor: 0x686271, intensity: 2 }),
    sun: Object.freeze({ color: 0xffc29a, intensity: 2.7, followsEnvironmentClock: true }),
    exposure: 0.98,
    iblIntensity: 0.82,
    windowLighting: Object.freeze({ color: 0xffd7a0, intensity: 0.22 }),
    waterSurface: Object.freeze({
      reflectionIntensity: 1.15,
      rippleStrength: 0.1,
      rippleScale: 0.041,
      flowSpeed: 0.55,
      flowDirection: Object.freeze({ x: 1, z: 0 }),
    }),
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x92877b, roughness: 0.97, metalness: 0 }),
      buildings: Object.freeze({ color: 0xd2c0b2, roughness: 0.86, metalness: 0.02 }),
      roads: Object.freeze({ color: 0x342f35 }),
      pedestrian: Object.freeze({ color: 0x3f8e8b }),
      water: Object.freeze({ color: 0x385f7b, roughness: 0.22, metalness: 0 }),
      trees: Object.freeze({ color: 0x445f3d }),
      control: Object.freeze({ color: 0xffb24d }),
      other: Object.freeze({ inheritBase: true }),
    }),
  }),
  night: Object.freeze({
    id: 'melbourne-night-v1',
    environment: 'night',
    background: 0x111927,
    fog: Object.freeze({ color: 0x111927, near: 660, far: 1520 }),
    hemisphere: Object.freeze({ skyColor: 0x95b2db, groundColor: 0x343c4b, intensity: 1.65 }),
    sun: Object.freeze({ color: 0x8fa9cc, intensity: 0.18, followsEnvironmentClock: true }),
    exposure: 1.06,
    iblIntensity: 0.42,
    windowLighting: Object.freeze({ color: 0xffc982, intensity: 1.45 }),
    waterSurface: Object.freeze({
      reflectionIntensity: 0.95,
      rippleStrength: 0.08,
      rippleScale: 0.038,
      flowSpeed: 0.42,
      flowDirection: Object.freeze({ x: 1, z: 0 }),
    }),
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x46555f, roughness: 0.98, metalness: 0 }),
      buildings: Object.freeze({
        color: 0x718399,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.88,
        metalness: 0.02,
      }),
      roads: Object.freeze({ color: 0x9aa6b4 }),
      pedestrian: Object.freeze({ color: 0x54c5c3 }),
      water: Object.freeze({ color: 0x173b58, roughness: 0.25, metalness: 0 }),
      trees: Object.freeze({ color: 0x243c31 }),
      control: Object.freeze({ color: 0xffa13a }),
      other: Object.freeze({ inheritBase: true }),
    }),
  }),
});

const SOLAR_ENVIRONMENTS = Object.freeze(['day', 'sunset', 'night'] as const);
const MATERIAL_ROLES = Object.freeze([
  'terrain',
  'buildings',
  'roads',
  'pedestrian',
  'water',
  'trees',
  'control',
  'other',
] as const satisfies readonly CityMaterialRole[]);

function solarValues<T>(read: (style: CityStyleTwin) => T): Readonly<Record<
  'day' | 'sunset' | 'night',
  T
>> {
  return Object.freeze({
    day: read(CITY_STYLE_TWINS.day),
    sunset: read(CITY_STYLE_TWINS.sunset),
    night: read(CITY_STYLE_TWINS.night),
  });
}

function blendHex(weights: CitySolarBlendWeights, values: Readonly<Record<
  'day' | 'sunset' | 'night',
  number
>>): number {
  const colors = {
    day: new THREE.Color(values.day),
    sunset: new THREE.Color(values.sunset),
    night: new THREE.Color(values.night),
  };
  return new THREE.Color(
    blendSolarScalar(weights, {
      day: colors.day.r,
      sunset: colors.sunset.r,
      night: colors.night.r,
    }),
    blendSolarScalar(weights, {
      day: colors.day.g,
      sunset: colors.sunset.g,
      night: colors.night.g,
    }),
    blendSolarScalar(weights, {
      day: colors.day.b,
      sunset: colors.sunset.b,
      night: colors.night.b,
    }),
  ).getHex();
}

function blendMaterialStyle(
  role: CityMaterialRole,
  weights: CitySolarBlendWeights,
): MaterialStyle {
  const styles = solarValues((style) => style.materials[role]);
  if (SOLAR_ENVIRONMENTS.every((environment) => styles[environment].inheritBase)) {
    return Object.freeze({ inheritBase: true });
  }
  const result: {
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  } = {};
  for (const key of ['color', 'emissive'] as const) {
    const values = solarValues((style) => style.materials[role][key] ?? 0);
    if (SOLAR_ENVIRONMENTS.some((environment) => styles[environment][key] !== undefined)) {
      result[key] = blendHex(weights, values);
    }
  }
  for (const key of ['emissiveIntensity', 'roughness', 'metalness'] as const) {
    if (SOLAR_ENVIRONMENTS.some((environment) => styles[environment][key] !== undefined)) {
      result[key] = blendSolarScalar(
        weights,
        solarValues((style) => style.materials[role][key] ?? 0),
      );
    }
  }
  return Object.freeze(result);
}

export function cityStyleTwinForSnapshot(
  snapshot: CityEnvironmentSnapshot,
  cityId: CityPackageCityId = 'melbourne',
): CityStyleTwin {
  if (snapshot.environment === 'analysis') return cityStyleTwinForEnvironment('analysis', cityId);
  const weights = citySolarBlendWeights(snapshot.sun.altitudeDegrees);
  const materials = Object.fromEntries(
    MATERIAL_ROLES.map((role) => [role, blendMaterialStyle(role, weights)]),
  ) as Record<CityMaterialRole, MaterialStyle>;
  const waterProfile = cityWaterProfileForSnapshot(cityId, snapshot);
  if (waterProfile) {
    materials.water = Object.freeze({
      ...materials.water,
      color: waterProfile.color,
      roughness: waterProfile.roughness,
      metalness: 0,
    });
  }
  const blendedWaterSurface = Object.freeze({
    reflectionIntensity: blendSolarScalar(
      weights,
      solarValues((style) => style.waterSurface.reflectionIntensity),
    ),
    rippleStrength: blendSolarScalar(
      weights,
      solarValues((style) => style.waterSurface.rippleStrength),
    ),
    rippleScale: blendSolarScalar(
      weights,
      solarValues((style) => style.waterSurface.rippleScale),
    ),
    flowSpeed: blendSolarScalar(
      weights,
      solarValues((style) => style.waterSurface.flowSpeed),
    ),
    flowDirection: Object.freeze({ x: 1, z: 0 }),
  });
  return Object.freeze({
    id: `${cityId}-${snapshot.environment}-v1`,
    environment: snapshot.environment,
    background: blendHex(weights, solarValues((style) => style.background)),
    fog: Object.freeze({
      color: blendHex(weights, solarValues((style) => style.fog.color)),
      near: blendSolarScalar(weights, solarValues((style) => style.fog.near)),
      far: blendSolarScalar(weights, solarValues((style) => style.fog.far)),
    }),
    hemisphere: Object.freeze({
      skyColor: blendHex(weights, solarValues((style) => style.hemisphere.skyColor)),
      groundColor: blendHex(weights, solarValues((style) => style.hemisphere.groundColor)),
      intensity: blendSolarScalar(weights, solarValues((style) => style.hemisphere.intensity)),
    }),
    sun: Object.freeze({
      color: blendHex(weights, solarValues((style) => style.sun.color)),
      intensity: blendSolarScalar(weights, solarValues((style) => style.sun.intensity)),
      followsEnvironmentClock: true,
    }),
    exposure: blendSolarScalar(weights, solarValues((style) => style.exposure)),
    iblIntensity: blendSolarScalar(weights, solarValues((style) => style.iblIntensity)),
    windowLighting: Object.freeze({
      color: blendHex(weights, solarValues((style) => style.windowLighting.color)),
      intensity: blendSolarScalar(weights, solarValues((style) => style.windowLighting.intensity)),
    }),
    waterSurface: waterProfile?.surface ?? blendedWaterSurface,
    waterProfileId: waterProfile?.id,
    waterVisualBasis: waterProfile?.basis,
    materials: Object.freeze(materials),
  });
}

function roleForMaterial(material: THREE.Material): CityMaterialRole {
  const name = material.name.toLowerCase();
  if (name.startsWith('terrain-')) return 'terrain';
  if (name.startsWith('buildings-')) return 'buildings';
  if (name.startsWith('roads-')) return 'roads';
  if (name.startsWith('pedestrian-')) return 'pedestrian';
  if (name.startsWith('water-')) return 'water';
  if (name.startsWith('trees-')) return 'trees';
  if (name.startsWith('survey-control-')) return 'control';
  return 'other';
}

function baselineFor(material: THREE.Material): MaterialBaseline {
  const existing = MATERIAL_BASELINES.get(material);
  if (existing) return existing;
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  };
  const baseline = Object.freeze({
    color: candidate.color?.clone() ?? null,
    emissive: candidate.emissive?.clone() ?? null,
    emissiveIntensity: Number.isFinite(candidate.emissiveIntensity)
      ? candidate.emissiveIntensity as number
      : null,
    roughness: Number.isFinite(candidate.roughness) ? candidate.roughness as number : null,
    metalness: Number.isFinite(candidate.metalness) ? candidate.metalness as number : null,
  });
  MATERIAL_BASELINES.set(material, baseline);
  return baseline;
}

function restoreBaseline(material: THREE.Material, baseline: MaterialBaseline) {
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  };
  if (candidate.color && baseline.color) candidate.color.copy(baseline.color);
  if (candidate.emissive && baseline.emissive) candidate.emissive.copy(baseline.emissive);
  if (candidate.emissiveIntensity !== undefined && baseline.emissiveIntensity !== null) {
    candidate.emissiveIntensity = baseline.emissiveIntensity;
  }
  if (candidate.roughness !== undefined && baseline.roughness !== null) {
    candidate.roughness = baseline.roughness;
  }
  if (candidate.metalness !== undefined && baseline.metalness !== null) {
    candidate.metalness = baseline.metalness;
  }
}

function applyMaterialStyle(material: THREE.Material, style: MaterialStyle) {
  const baseline = baselineFor(material);
  restoreBaseline(material, baseline);
  if (style.inheritBase) return;
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  };
  if (candidate.color && style.color !== undefined) candidate.color.setHex(style.color);
  if (candidate.emissive) candidate.emissive.setHex(style.emissive ?? 0x000000);
  if (candidate.emissiveIntensity !== undefined) {
    candidate.emissiveIntensity = style.emissiveIntensity ?? 0;
  }
  if (candidate.roughness !== undefined && style.roughness !== undefined) {
    candidate.roughness = style.roughness;
  }
  if (candidate.metalness !== undefined && style.metalness !== undefined) {
    candidate.metalness = style.metalness;
  }
}

export function cityStyleTwinForEnvironment(
  environment: CityEnvironmentId,
  cityId: CityPackageCityId = 'melbourne',
): CityStyleTwin {
  const style = CITY_STYLE_TWINS[environment];
  if (!style) throw new Error(`No city style twin exists for ${String(environment)}.`);
  if (cityId === 'melbourne') return style;
  return Object.freeze({ ...style, id: `${cityId}-${environment}-v1` });
}

export function applyCityStyleTwin(
  root: THREE.Object3D,
  environment: CityEnvironmentSnapshot | CityEnvironmentId,
  cityId: CityPackageCityId = 'melbourne',
) {
  const environmentId = typeof environment === 'string' ? environment : environment.environment;
  const style = typeof environment === 'string'
    ? cityStyleTwinForEnvironment(environmentId, cityId)
    : cityStyleTwinForSnapshot(environment, cityId);
  const materials = new Set<THREE.Material>();
  const roles = new Set<CityMaterialRole>();
  let windowLightingMaterials = 0;
  let physicalWaterMaterials = 0;
  let streetLightMaterials = 0;
  let aviationLightMaterials = 0;
  let landmarkLightMaterials = 0;
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      const role = roleForMaterial(material);
      roles.add(role);
      applyMaterialStyle(material, style.materials[role]);
      if (role === 'buildings' && configureCityWindowLighting(material, style.windowLighting)) {
        windowLightingMaterials += 1;
      }
      if (role === 'water' && configureCityWaterSurface(material, style.waterSurface)) {
        physicalWaterMaterials += 1;
      }
      const authoredLightKind = configureAuthoredCityNightLighting(material, cityId, environment);
      if (authoredLightKind === 'street') streetLightMaterials += 1;
      if (authoredLightKind === 'aviation') aviationLightMaterials += 1;
      if (authoredLightKind === 'landmark') landmarkLightMaterials += 1;
    }
  });
  return Object.freeze({
    styleId: style.id,
    materialCount: materials.size,
    windowLightingMaterials,
    physicalWaterMaterials,
    authoredNightLightMaterials: (
      streetLightMaterials + aviationLightMaterials + landmarkLightMaterials
    ),
    streetLightMaterials,
    aviationLightMaterials,
    landmarkLightMaterials,
    roles: Object.freeze([...roles].sort()),
  });
}
