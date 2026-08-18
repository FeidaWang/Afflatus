import * as THREE from 'three';

export interface CityWindowLightingStyle {
  readonly color: number;
  readonly intensity: number;
}

interface WindowLightingState {
  color: THREE.Color;
  intensity: number;
  seed: number;
  uniforms: {
    cityWindowColor?: { value: THREE.Color };
    cityWindowIntensity?: { value: number };
    cityWindowSeed?: { value: number };
  } | null;
}

const WINDOW_STATES = new WeakMap<THREE.Material, WindowLightingState>();

function materialSeed(material: THREE.Material): number {
  const input = material.name || material.uuid;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function configureCityWindowLighting(
  material: THREE.Material,
  style: CityWindowLightingStyle,
): boolean {
  if (!(material instanceof THREE.MeshStandardMaterial)) return false;
  let state = WINDOW_STATES.get(material);
  if (!state) {
    state = {
      color: new THREE.Color(style.color),
      intensity: style.intensity,
      seed: materialSeed(material),
      uniforms: null,
    };
    WINDOW_STATES.set(material, state);
    const installedState = state;
    const previousCompile = material.onBeforeCompile.bind(material);
    const previousCacheKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer);
      shader.uniforms.cityWindowColor = { value: installedState.color };
      shader.uniforms.cityWindowIntensity = { value: installedState.intensity };
      shader.uniforms.cityWindowSeed = { value: installedState.seed };
      installedState.uniforms = shader.uniforms;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vCityWindowPosition;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvCityWindowPosition = transformed;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vCityWindowPosition;\nuniform vec3 cityWindowColor;\nuniform float cityWindowIntensity;\nuniform float cityWindowSeed;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float cityFacade = 1.0 - step(0.58, abs(normal.y));
          float cityAxis = mix(vCityWindowPosition.x, vCityWindowPosition.z, step(abs(normal.z), abs(normal.x)));
          vec2 cityCell = floor(vec2(cityAxis * 0.16, vCityWindowPosition.y * 0.27));
          vec2 cityWithin = fract(vec2(cityAxis * 0.16, vCityWindowPosition.y * 0.27));
          float cityPane = step(0.16, cityWithin.x) * step(cityWithin.x, 0.78)
            * step(0.2, cityWithin.y) * step(cityWithin.y, 0.76);
          float cityRandom = fract(sin(dot(cityCell + cityWindowSeed * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
          float cityOccupied = step(0.47, cityRandom);
          totalEmissiveRadiance += cityWindowColor
            * cityWindowIntensity * cityFacade * cityPane * cityOccupied;`,
        );
    };
    material.customProgramCacheKey = () => `${previousCacheKey()}|afflatus-city-windows-v1`;
    material.needsUpdate = true;
  }
  state.color.setHex(style.color);
  state.intensity = Math.max(0, style.intensity);
  if (state.uniforms?.cityWindowColor) state.uniforms.cityWindowColor.value.copy(state.color);
  if (state.uniforms?.cityWindowIntensity) {
    state.uniforms.cityWindowIntensity.value = state.intensity;
  }
  return true;
}

export function getCityWindowLightingState(material: THREE.Material) {
  const state = WINDOW_STATES.get(material);
  return state ? Object.freeze({
    color: state.color.getHex(),
    intensity: state.intensity,
    seed: state.seed,
    compiled: Boolean(state.uniforms),
  }) : null;
}
