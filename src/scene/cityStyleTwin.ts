import * as THREE from 'three';
import type {
  CityEnvironmentId,
  CityEnvironmentSnapshot,
} from '../city/environmentClock.ts';

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
  readonly id: `melbourne-${CityEnvironmentId}-v1`;
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
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x9ea58d, roughness: 0.96, metalness: 0 }),
      buildings: Object.freeze({ color: 0xd7d2c6, roughness: 0.82, metalness: 0.03 }),
      roads: Object.freeze({ color: 0x31363a }),
      pedestrian: Object.freeze({ color: 0x2b8f8e }),
      water: Object.freeze({ color: 0x287ba1, roughness: 0.4, metalness: 0.04 }),
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
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x92877b, roughness: 0.97, metalness: 0 }),
      buildings: Object.freeze({ color: 0xd2c0b2, roughness: 0.86, metalness: 0.02 }),
      roads: Object.freeze({ color: 0x342f35 }),
      pedestrian: Object.freeze({ color: 0x3f8e8b }),
      water: Object.freeze({ color: 0x385f7b, roughness: 0.48, metalness: 0.04 }),
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
    materials: Object.freeze({
      terrain: Object.freeze({ color: 0x46555f, roughness: 0.98, metalness: 0 }),
      buildings: Object.freeze({
        color: 0x718399,
        emissive: 0x2b4668,
        emissiveIntensity: 0.32,
        roughness: 0.88,
        metalness: 0.02,
      }),
      roads: Object.freeze({ color: 0x9aa6b4 }),
      pedestrian: Object.freeze({ color: 0x54c5c3 }),
      water: Object.freeze({ color: 0x173b58, roughness: 0.56, metalness: 0.08 }),
      trees: Object.freeze({ color: 0x243c31 }),
      control: Object.freeze({ color: 0xffa13a }),
      other: Object.freeze({ inheritBase: true }),
    }),
  }),
});

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

export function cityStyleTwinForEnvironment(environment: CityEnvironmentId): CityStyleTwin {
  const style = CITY_STYLE_TWINS[environment];
  if (!style) throw new Error(`No city style twin exists for ${String(environment)}.`);
  return style;
}

export function applyCityStyleTwin(
  root: THREE.Object3D,
  environment: CityEnvironmentSnapshot | CityEnvironmentId,
) {
  const environmentId = typeof environment === 'string' ? environment : environment.environment;
  const style = cityStyleTwinForEnvironment(environmentId);
  const materials = new Set<THREE.Material>();
  const roles = new Set<CityMaterialRole>();
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      const role = roleForMaterial(material);
      roles.add(role);
      applyMaterialStyle(material, style.materials[role]);
    }
  });
  return Object.freeze({
    styleId: style.id,
    materialCount: materials.size,
    roles: Object.freeze([...roles].sort()),
  });
}
