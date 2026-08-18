import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
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

export interface CityAtmosphereProfile {
  readonly id: `${CityPackageCityId}-${CityEnvironmentId}-atmosphere-v1`;
  readonly cityId: CityPackageCityId;
  readonly environment: CityEnvironmentId;
  readonly turbidity: number;
  readonly rayleigh: number;
  readonly mieCoefficient: number;
  readonly mieDirectionalG: number;
  readonly solarBlend?: CitySolarBlendWeights;
}

type AtmosphereNumbers = Pick<
  CityAtmosphereProfile,
  'turbidity' | 'rayleigh' | 'mieCoefficient' | 'mieDirectionalG'
>;

const CITY_ATMOSPHERE_NUMBERS: Readonly<Record<
  CityPackageCityId,
  Readonly<Record<CityEnvironmentId, AtmosphereNumbers>>
>> = Object.freeze({
  shanghai: Object.freeze({
    analysis: Object.freeze({ turbidity: 8.5, rayleigh: 1.7, mieCoefficient: 0.007, mieDirectionalG: 0.88 }),
    day: Object.freeze({ turbidity: 9, rayleigh: 1.65, mieCoefficient: 0.007, mieDirectionalG: 0.88 }),
    sunset: Object.freeze({ turbidity: 12.5, rayleigh: 1.15, mieCoefficient: 0.014, mieDirectionalG: 0.9 }),
    night: Object.freeze({ turbidity: 5.5, rayleigh: 0.12, mieCoefficient: 0.002, mieDirectionalG: 0.82 }),
  }),
  melbourne: Object.freeze({
    analysis: Object.freeze({ turbidity: 4.2, rayleigh: 2.2, mieCoefficient: 0.003, mieDirectionalG: 0.77 }),
    day: Object.freeze({ turbidity: 4.5, rayleigh: 2.15, mieCoefficient: 0.003, mieDirectionalG: 0.78 }),
    sunset: Object.freeze({ turbidity: 7.5, rayleigh: 1.35, mieCoefficient: 0.009, mieDirectionalG: 0.86 }),
    night: Object.freeze({ turbidity: 3.2, rayleigh: 0.1, mieCoefficient: 0.0015, mieDirectionalG: 0.78 }),
  }),
  'hong-kong': Object.freeze({
    analysis: Object.freeze({ turbidity: 7.2, rayleigh: 1.8, mieCoefficient: 0.006, mieDirectionalG: 0.86 }),
    day: Object.freeze({ turbidity: 7.8, rayleigh: 1.75, mieCoefficient: 0.0065, mieDirectionalG: 0.87 }),
    sunset: Object.freeze({ turbidity: 10.5, rayleigh: 1.2, mieCoefficient: 0.012, mieDirectionalG: 0.89 }),
    night: Object.freeze({ turbidity: 4.8, rayleigh: 0.11, mieCoefficient: 0.002, mieDirectionalG: 0.81 }),
  }),
});

export function cityAtmosphereProfile(
  cityId: CityPackageCityId,
  environment: CityEnvironmentId,
): CityAtmosphereProfile {
  const values = CITY_ATMOSPHERE_NUMBERS[cityId]?.[environment];
  if (!values) throw new Error(`No outdoor atmosphere profile exists for ${cityId}/${environment}.`);
  return Object.freeze({
    id: `${cityId}-${environment}-atmosphere-v1`,
    cityId,
    environment,
    ...values,
  });
}

export function cityAtmosphereProfileForSnapshot(
  cityId: CityPackageCityId,
  snapshot: CityEnvironmentSnapshot,
): CityAtmosphereProfile {
  if (snapshot.environment === 'analysis') return cityAtmosphereProfile(cityId, 'analysis');
  const solarBlend = citySolarBlendWeights(snapshot.sun.altitudeDegrees);
  const day = cityAtmosphereProfile(cityId, 'day');
  const sunset = cityAtmosphereProfile(cityId, 'sunset');
  const night = cityAtmosphereProfile(cityId, 'night');
  const blend = (key: keyof AtmosphereNumbers) => blendSolarScalar(solarBlend, {
    day: day[key],
    sunset: sunset[key],
    night: night[key],
  });
  return Object.freeze({
    id: `${cityId}-${snapshot.environment}-atmosphere-v1`,
    cityId,
    environment: snapshot.environment,
    turbidity: blend('turbidity'),
    rayleigh: blend('rayleigh'),
    mieCoefficient: blend('mieCoefficient'),
    mieDirectionalG: blend('mieDirectionalG'),
    solarBlend,
  });
}

function configureSky(
  sky: Sky,
  profile: CityAtmosphereProfile,
  sunDirection: Readonly<{ x: number; y: number; z: number }>,
) {
  const material = sky.material as THREE.ShaderMaterial;
  material.uniforms.turbidity.value = profile.turbidity;
  material.uniforms.rayleigh.value = profile.rayleigh;
  material.uniforms.mieCoefficient.value = profile.mieCoefficient;
  material.uniforms.mieDirectionalG.value = profile.mieDirectionalG;
  material.uniforms.sunPosition.value.set(
    sunDirection.x,
    sunDirection.y,
    sunDirection.z,
  ).normalize();
}

export function createCityOutdoorEnvironment({
  renderer,
  scene,
  cityId,
  snapshot,
}: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  cityId: CityPackageCityId;
  snapshot: CityEnvironmentSnapshot;
}) {
  const displaySky = new Sky();
  displaySky.name = `${cityId}-procedural-outdoor-sky`;
  displaySky.scale.setScalar(10_000);
  displaySky.renderOrder = -10_000;
  scene.add(displaySky);

  const environmentScene = new THREE.Scene();
  const environmentSky = new Sky();
  environmentSky.scale.setScalar(90);
  environmentScene.add(environmentSky);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();
  let environmentTarget: THREE.WebGLRenderTarget | null = null;
  let state: Readonly<CityAtmosphereProfile>;

  const update = (nextSnapshot: CityEnvironmentSnapshot) => {
    const direction = nextSnapshot?.sun?.direction;
    if (!direction || ![direction.x, direction.y, direction.z].every(Number.isFinite)) {
      throw new Error('Outdoor environment requires a finite solar direction.');
    }
    const profile = cityAtmosphereProfileForSnapshot(cityId, nextSnapshot);
    configureSky(displaySky, profile, direction);
    configureSky(environmentSky, profile, direction);
    const nextTarget = pmremGenerator.fromScene(environmentScene, 0, 0.1, 100);
    const previousTarget = environmentTarget;
    environmentTarget = nextTarget;
    scene.environment = nextTarget.texture;
    previousTarget?.dispose();
    state = profile;
    return state;
  };

  update(snapshot);
  scene.background = null;

  return Object.freeze({
    get state() {
      return state;
    },
    update,
    destroy() {
      scene.remove(displaySky);
      if (scene.environment === environmentTarget?.texture) scene.environment = null;
      environmentTarget?.dispose();
      pmremGenerator.dispose();
      displaySky.geometry.dispose();
      (displaySky.material as THREE.Material).dispose();
      environmentSky.geometry.dispose();
      (environmentSky.material as THREE.Material).dispose();
    },
  });
}
