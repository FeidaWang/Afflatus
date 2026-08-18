import * as THREE from 'three';
import type {
  CityEnvironmentId,
  CityEnvironmentSnapshot,
} from '../city/environmentClock.ts';
import type { CityPackageCityId } from '../city/packages.ts';
import {
  blendSolarScalar,
  citySolarBlendWeights,
  type CitySolarBlendWeights,
} from './citySolarBlend';

export type AuthoredCityLightKind = 'street' | 'aviation' | 'landmark';

interface AuthoredCityLightState {
  kind: AuthoredCityLightKind;
  color: THREE.Color;
  intensity: number;
  pulseEnabled: number;
  pulsePeriod: number;
  pulseDuty: number;
  seed: number;
  timeSeconds: number;
  uniforms: {
    cityAuthoredLightPulseEnabled?: { value: number };
    cityAuthoredLightPulsePeriod?: { value: number };
    cityAuthoredLightPulseDuty?: { value: number };
    cityAuthoredLightSeed?: { value: number };
    cityAuthoredLightTime?: { value: number };
  } | null;
}

const AUTHORED_LIGHT_STATES = new WeakMap<THREE.Material, AuthoredCityLightState>();

function lightKindForName(name: string): AuthoredCityLightKind | null {
  if (name.startsWith('street-light-')) return 'street';
  if (name.startsWith('aviation-light-')) return 'aviation';
  if (name.startsWith('landmark-light-')) return 'landmark';
  return null;
}

function stableSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function cityLandmarkLightColor(cityId: CityPackageCityId, materialName: string): number {
  const name = materialName.toLowerCase();
  if (cityId === 'shanghai') {
    if (name.includes('oriental-pearl')) return 0xff416c;
    if (name.includes('shanghai-tower')) return 0xbfe9ff;
    if (name.includes('jin-mao')) return 0xffd39a;
    if (name.includes('swfc')) return 0xc5e4ff;
    if (name.includes('bund')) return 0xffb45a;
    return 0xffc477;
  }
  if (cityId === 'hong-kong') {
    if (name.includes('bank-of-china')) return 0xd8f4ff;
    if (name.includes('ifc') || name.includes('icc')) return 0xb9dcff;
    if (name.includes('clock-tower')) return 0xffc36b;
    return 0xc8e6ff;
  }
  if (name.includes('arts-centre')) return 0xfff0c4;
  if (name.includes('flinders')) return 0xffbd68;
  if (name.includes('eureka')) return 0xffd05e;
  return 0xffcf87;
}

function discreteWeights(environment: CityEnvironmentId): CitySolarBlendWeights {
  if (environment === 'night') return Object.freeze({ day: 0, sunset: 0, night: 1 });
  if (environment === 'sunset') return Object.freeze({ day: 0, sunset: 1, night: 0 });
  return Object.freeze({ day: 1, sunset: 0, night: 0 });
}

function intensityForKind(kind: AuthoredCityLightKind, weights: CitySolarBlendWeights): number {
  if (kind === 'street') {
    return blendSolarScalar(weights, { day: 0, sunset: 0.75, night: 2.4 });
  }
  if (kind === 'aviation') {
    return blendSolarScalar(weights, { day: 0.2, sunset: 1.8, night: 3.6 });
  }
  return blendSolarScalar(weights, { day: 0, sunset: 0.9, night: 2.8 });
}

function installPulseShader(material: THREE.Material, state: AuthoredCityLightState) {
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    shader.uniforms.cityAuthoredLightPulseEnabled = { value: state.pulseEnabled };
    shader.uniforms.cityAuthoredLightPulsePeriod = { value: state.pulsePeriod };
    shader.uniforms.cityAuthoredLightPulseDuty = { value: state.pulseDuty };
    shader.uniforms.cityAuthoredLightSeed = { value: state.seed };
    shader.uniforms.cityAuthoredLightTime = { value: state.timeSeconds };
    state.uniforms = shader.uniforms;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float cityAuthoredLightPulseEnabled;\nuniform float cityAuthoredLightPulsePeriod;\nuniform float cityAuthoredLightPulseDuty;\nuniform float cityAuthoredLightSeed;\nuniform float cityAuthoredLightTime;',
    );
    const pulseCode = `
      float cityAuthoredLightPhase = fract(
        cityAuthoredLightTime / max(cityAuthoredLightPulsePeriod, 0.01)
        + cityAuthoredLightSeed
      );
      float cityAuthoredLightPulse = 1.0 - step(cityAuthoredLightPulseDuty, cityAuthoredLightPhase);`;
    if (material instanceof THREE.MeshStandardMaterial) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>${pulseCode}
        totalEmissiveRadiance *= mix(
          1.0,
          cityAuthoredLightPulse,
          cityAuthoredLightPulseEnabled
        );`,
      );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>${pulseCode}
        diffuseColor.rgb *= mix(
          1.0,
          cityAuthoredLightPulse,
          cityAuthoredLightPulseEnabled
        );`,
      );
    }
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|afflatus-authored-city-light-v1`;
  material.needsUpdate = true;
}

export function configureAuthoredCityNightLighting(
  material: THREE.Material,
  cityId: CityPackageCityId,
  environment: CityEnvironmentSnapshot | CityEnvironmentId,
): AuthoredCityLightKind | null {
  const kind = lightKindForName(material.name.toLowerCase());
  if (!kind) return null;
  if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.PointsMaterial)) {
    return null;
  }
  const weights = typeof environment === 'string'
    ? discreteWeights(environment)
    : citySolarBlendWeights(environment.sun.altitudeDegrees);
  const color = kind === 'aviation'
    ? 0xff2f35
    : kind === 'street'
      ? 0xffc56a
      : cityLandmarkLightColor(cityId, material.name);
  const intensity = intensityForKind(kind, weights);
  let state = AUTHORED_LIGHT_STATES.get(material);
  if (!state) {
    state = {
      kind,
      color: new THREE.Color(color),
      intensity,
      pulseEnabled: kind === 'aviation' ? 1 : 0,
      pulsePeriod: 1.6,
      pulseDuty: 0.22,
      seed: stableSeed(material.name || material.uuid),
      timeSeconds: 0,
      uniforms: null,
    };
    AUTHORED_LIGHT_STATES.set(material, state);
    installPulseShader(material, state);
  }
  state.kind = kind;
  state.color.setHex(color);
  state.intensity = intensity;
  state.pulseEnabled = kind === 'aviation' ? 1 : 0;
  if (material instanceof THREE.MeshStandardMaterial) {
    material.emissive.copy(state.color);
    material.emissiveIntensity = intensity;
  } else {
    material.color.copy(state.color).multiplyScalar(Math.max(0, intensity));
  }
  if (state.uniforms?.cityAuthoredLightPulseEnabled) {
    state.uniforms.cityAuthoredLightPulseEnabled.value = state.pulseEnabled;
  }
  return kind;
}

export function collectAuthoredCityNightLightMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of list) {
      if (material && AUTHORED_LIGHT_STATES.has(material)) materials.add(material);
    }
  });
  return [...materials];
}

export function updateAuthoredCityNightLightTime(
  material: THREE.Material,
  timeSeconds: number,
): boolean {
  const state = AUTHORED_LIGHT_STATES.get(material);
  if (!state || !Number.isFinite(timeSeconds)) return false;
  state.timeSeconds = Math.max(0, timeSeconds);
  if (state.uniforms?.cityAuthoredLightTime) {
    state.uniforms.cityAuthoredLightTime.value = state.timeSeconds;
  }
  return true;
}

export function getAuthoredCityNightLightState(material: THREE.Material) {
  const state = AUTHORED_LIGHT_STATES.get(material);
  return state ? Object.freeze({
    kind: state.kind,
    color: state.color.getHex(),
    intensity: state.intensity,
    pulseEnabled: Boolean(state.pulseEnabled),
    pulsePeriod: state.pulsePeriod,
    pulseDuty: state.pulseDuty,
    seed: state.seed,
    timeSeconds: state.timeSeconds,
    compiled: Boolean(state.uniforms),
    basis: 'authored-light-geometry-only' as const,
  }) : null;
}
