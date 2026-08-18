import * as THREE from 'three';
import type {
  CityEnvironmentId,
  CityEnvironmentSnapshot,
} from '../city/environmentClock.ts';
import type { CityPackageCityId } from '../city/packages.ts';
import type { CityWaterSurfaceStyle } from './cityWaterSurface';
import {
  blendSolarScalar,
  citySolarBlendWeights,
  type CitySolarBlendWeights,
} from './citySolarBlend';

interface WaterEnvironmentNumbers {
  readonly color: number;
  readonly roughness: number;
  readonly reflectionIntensity: number;
  readonly rippleStrength: number;
  readonly rippleScale: number;
  readonly flowSpeed: number;
  readonly flowDirection: Readonly<{ x: number; z: number }>;
}

export interface CityWaterVisualProfile {
  readonly id: `${CityPackageCityId}-water-visual-v1`;
  readonly cityId: CityPackageCityId;
  readonly environment: Exclude<CityEnvironmentId, 'analysis'>;
  readonly basis: 'art-directed-visual-only';
  readonly color: number;
  readonly roughness: number;
  readonly surface: CityWaterSurfaceStyle;
  readonly solarBlend: CitySolarBlendWeights;
}

const CITY_WATER_NUMBERS: Readonly<Record<
  CityPackageCityId,
  Readonly<Record<'day' | 'sunset' | 'night', WaterEnvironmentNumbers>>
>> = Object.freeze({
  shanghai: Object.freeze({
    day: Object.freeze({
      color: 0x486c63,
      roughness: 0.2,
      reflectionIntensity: 1.12,
      rippleStrength: 0.1,
      rippleScale: 0.035,
      flowSpeed: 0.42,
      flowDirection: Object.freeze({ x: 0.35, z: -0.94 }),
    }),
    sunset: Object.freeze({
      color: 0x5b5047,
      roughness: 0.23,
      reflectionIntensity: 1.05,
      rippleStrength: 0.085,
      rippleScale: 0.033,
      flowSpeed: 0.38,
      flowDirection: Object.freeze({ x: 0.35, z: -0.94 }),
    }),
    night: Object.freeze({
      color: 0x182f37,
      roughness: 0.27,
      reflectionIntensity: 0.88,
      rippleStrength: 0.065,
      rippleScale: 0.031,
      flowSpeed: 0.32,
      flowDirection: Object.freeze({ x: 0.35, z: -0.94 }),
    }),
  }),
  'hong-kong': Object.freeze({
    day: Object.freeze({
      color: 0x236b78,
      roughness: 0.15,
      reflectionIntensity: 1.35,
      rippleStrength: 0.14,
      rippleScale: 0.055,
      flowSpeed: 0.8,
      flowDirection: Object.freeze({ x: 1, z: 0.08 }),
    }),
    sunset: Object.freeze({
      color: 0x38566b,
      roughness: 0.18,
      reflectionIntensity: 1.25,
      rippleStrength: 0.12,
      rippleScale: 0.052,
      flowSpeed: 0.7,
      flowDirection: Object.freeze({ x: 1, z: 0.08 }),
    }),
    night: Object.freeze({
      color: 0x102d42,
      roughness: 0.21,
      reflectionIntensity: 1.08,
      rippleStrength: 0.095,
      rippleScale: 0.048,
      flowSpeed: 0.58,
      flowDirection: Object.freeze({ x: 1, z: 0.08 }),
    }),
  }),
  melbourne: Object.freeze({
    day: Object.freeze({
      color: 0x52634b,
      roughness: 0.26,
      reflectionIntensity: 1.05,
      rippleStrength: 0.08,
      rippleScale: 0.032,
      flowSpeed: 0.28,
      flowDirection: Object.freeze({ x: -1, z: 0.06 }),
    }),
    sunset: Object.freeze({
      color: 0x4b493d,
      roughness: 0.28,
      reflectionIntensity: 0.98,
      rippleStrength: 0.07,
      rippleScale: 0.03,
      flowSpeed: 0.25,
      flowDirection: Object.freeze({ x: -1, z: 0.06 }),
    }),
    night: Object.freeze({
      color: 0x172c2b,
      roughness: 0.31,
      reflectionIntensity: 0.82,
      rippleStrength: 0.055,
      rippleScale: 0.028,
      flowSpeed: 0.2,
      flowDirection: Object.freeze({ x: -1, z: 0.06 }),
    }),
  }),
});

function blendHex(
  weights: CitySolarBlendWeights,
  values: Readonly<Record<'day' | 'sunset' | 'night', number>>,
): number {
  const day = new THREE.Color(values.day);
  const sunset = new THREE.Color(values.sunset);
  const night = new THREE.Color(values.night);
  return new THREE.Color(
    blendSolarScalar(weights, { day: day.r, sunset: sunset.r, night: night.r }),
    blendSolarScalar(weights, { day: day.g, sunset: sunset.g, night: night.g }),
    blendSolarScalar(weights, { day: day.b, sunset: sunset.b, night: night.b }),
  ).getHex();
}

export function cityWaterProfileForSnapshot(
  cityId: CityPackageCityId,
  snapshot: CityEnvironmentSnapshot,
): CityWaterVisualProfile | null {
  if (snapshot.environment === 'analysis') return null;
  const values = CITY_WATER_NUMBERS[cityId];
  const solarBlend = citySolarBlendWeights(snapshot.sun.altitudeDegrees);
  const scalar = (key: Exclude<keyof WaterEnvironmentNumbers, 'color' | 'flowDirection'>) => (
    blendSolarScalar(solarBlend, {
      day: values.day[key],
      sunset: values.sunset[key],
      night: values.night[key],
    })
  );
  const direction = new THREE.Vector2(
    blendSolarScalar(solarBlend, {
      day: values.day.flowDirection.x,
      sunset: values.sunset.flowDirection.x,
      night: values.night.flowDirection.x,
    }),
    blendSolarScalar(solarBlend, {
      day: values.day.flowDirection.z,
      sunset: values.sunset.flowDirection.z,
      night: values.night.flowDirection.z,
    }),
  ).normalize();
  return Object.freeze({
    id: `${cityId}-water-visual-v1`,
    cityId,
    environment: snapshot.environment,
    basis: 'art-directed-visual-only',
    color: blendHex(solarBlend, {
      day: values.day.color,
      sunset: values.sunset.color,
      night: values.night.color,
    }),
    roughness: scalar('roughness'),
    surface: Object.freeze({
      reflectionIntensity: scalar('reflectionIntensity'),
      rippleStrength: scalar('rippleStrength'),
      rippleScale: scalar('rippleScale'),
      flowSpeed: scalar('flowSpeed'),
      flowDirection: Object.freeze({ x: direction.x, z: direction.y }),
    }),
    solarBlend,
  });
}
