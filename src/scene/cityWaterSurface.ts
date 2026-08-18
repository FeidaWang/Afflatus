import * as THREE from 'three';

export interface CityWaterSurfaceStyle {
  readonly reflectionIntensity: number;
  readonly rippleStrength: number;
  readonly rippleScale: number;
  readonly flowSpeed: number;
  readonly flowDirection: Readonly<{ x: number; z: number }>;
}

interface WaterSurfaceState {
  reflectionIntensity: number;
  rippleStrength: number;
  rippleScale: number;
  flowSpeed: number;
  flowDirection: THREE.Vector2;
  timeSeconds: number;
  uniforms: {
    cityWaterTime?: { value: number };
    cityWaterRippleStrength?: { value: number };
    cityWaterRippleScale?: { value: number };
    cityWaterFlowSpeed?: { value: number };
    cityWaterFlowDirection?: { value: THREE.Vector2 };
  } | null;
}

const WATER_STATES = new WeakMap<THREE.Material, WaterSurfaceState>();

export function configureCityWaterSurface(
  material: THREE.Material,
  style: CityWaterSurfaceStyle,
): boolean {
  if (!(material instanceof THREE.MeshStandardMaterial)) return false;
  let state = WATER_STATES.get(material);
  if (!state) {
    state = {
      reflectionIntensity: style.reflectionIntensity,
      rippleStrength: style.rippleStrength,
      rippleScale: style.rippleScale,
      flowSpeed: style.flowSpeed,
      flowDirection: new THREE.Vector2(style.flowDirection.x, style.flowDirection.z).normalize(),
      timeSeconds: 0,
      uniforms: null,
    };
    WATER_STATES.set(material, state);
    const installedState = state;
    const previousCompile = material.onBeforeCompile.bind(material);
    const previousCacheKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer);
      shader.uniforms.cityWaterTime = { value: installedState.timeSeconds };
      shader.uniforms.cityWaterRippleStrength = { value: installedState.rippleStrength };
      shader.uniforms.cityWaterRippleScale = { value: installedState.rippleScale };
      shader.uniforms.cityWaterFlowSpeed = { value: installedState.flowSpeed };
      shader.uniforms.cityWaterFlowDirection = { value: installedState.flowDirection };
      installedState.uniforms = shader.uniforms;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vCityWaterPosition;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvCityWaterPosition = transformed;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vCityWaterPosition;\nuniform float cityWaterTime;\nuniform float cityWaterRippleStrength;\nuniform float cityWaterRippleScale;\nuniform float cityWaterFlowSpeed;\nuniform vec2 cityWaterFlowDirection;',
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          vec2 cityWaterDirection = normalize(cityWaterFlowDirection);
          vec2 cityWaterAcross = vec2(-cityWaterDirection.y, cityWaterDirection.x);
          vec2 cityWaterCoordinates = vec2(
            dot(vCityWaterPosition.xz, cityWaterDirection),
            dot(vCityWaterPosition.xz, cityWaterAcross)
          );
          float cityWaterPhaseA = sin(
            (cityWaterCoordinates.x + cityWaterCoordinates.y * 0.37) * cityWaterRippleScale
            + cityWaterTime * cityWaterFlowSpeed
          );
          float cityWaterPhaseB = sin(
            (cityWaterCoordinates.y - cityWaterCoordinates.x * 0.21) * cityWaterRippleScale * 1.73
            - cityWaterTime * cityWaterFlowSpeed * 0.71
          );
          float cityWaterRipple = (cityWaterPhaseA + cityWaterPhaseB) * 0.5;
          roughnessFactor = clamp(
            roughnessFactor + cityWaterRipple * cityWaterRippleStrength,
            0.06,
            0.72
          );`,
        );
    };
    material.customProgramCacheKey = () => `${previousCacheKey()}|afflatus-city-water-v1`;
    material.needsUpdate = true;
  }

  state.reflectionIntensity = Math.max(0, style.reflectionIntensity);
  state.rippleStrength = Math.max(0, style.rippleStrength);
  state.rippleScale = Math.max(0.0001, style.rippleScale);
  state.flowSpeed = Math.max(0, style.flowSpeed);
  state.flowDirection.set(style.flowDirection.x, style.flowDirection.z);
  if (state.flowDirection.lengthSq() < 1e-8) state.flowDirection.set(1, 0);
  state.flowDirection.normalize();
  material.envMapIntensity = state.reflectionIntensity;
  if (state.uniforms?.cityWaterRippleStrength) {
    state.uniforms.cityWaterRippleStrength.value = state.rippleStrength;
  }
  if (state.uniforms?.cityWaterRippleScale) {
    state.uniforms.cityWaterRippleScale.value = state.rippleScale;
  }
  if (state.uniforms?.cityWaterFlowSpeed) {
    state.uniforms.cityWaterFlowSpeed.value = state.flowSpeed;
  }
  if (state.uniforms?.cityWaterFlowDirection) {
    state.uniforms.cityWaterFlowDirection.value.copy(state.flowDirection);
  }
  return true;
}

export function updateCityWaterSurfaceTime(material: THREE.Material, timeSeconds: number): boolean {
  const state = WATER_STATES.get(material);
  if (!state || !Number.isFinite(timeSeconds)) return false;
  state.timeSeconds = Math.max(0, timeSeconds);
  if (state.uniforms?.cityWaterTime) state.uniforms.cityWaterTime.value = state.timeSeconds;
  return true;
}

export function collectCityWaterSurfaceMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const materials = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    for (const material of list) {
      if (material instanceof THREE.MeshStandardMaterial && WATER_STATES.has(material)) {
        materials.add(material);
      }
    }
  });
  return [...materials];
}

export function getCityWaterSurfaceState(material: THREE.Material) {
  const state = WATER_STATES.get(material);
  return state ? Object.freeze({
    reflectionIntensity: state.reflectionIntensity,
    rippleStrength: state.rippleStrength,
    rippleScale: state.rippleScale,
    flowSpeed: state.flowSpeed,
    flowDirection: Object.freeze({ x: state.flowDirection.x, z: state.flowDirection.y }),
    timeSeconds: state.timeSeconds,
    compiled: Boolean(state.uniforms),
  }) : null;
}
