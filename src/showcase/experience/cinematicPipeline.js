import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const SELECTIVE_BLOOM_LAYER = 1;

const freezeProfile = (profile) => Object.freeze({ ...profile });

export const POST_PROCESSING_MATRIX = Object.freeze({
  high: freezeProfile({ selectiveBloom: true, strength: 0.52, radius: 0.16, threshold: 0.76 }),
  medium: freezeProfile({ selectiveBloom: false, strength: 0, radius: 0, threshold: 1 }),
  mobile: freezeProfile({ selectiveBloom: false, strength: 0, radius: 0, threshold: 1 }),
});

export const CINEMATIC_LIGHT_MATRIX = Object.freeze({
  high: freezeProfile({ cold: 2.35, warm: 0.2, ambient: 0.075, engine: 0.42 }),
  medium: freezeProfile({ cold: 1.9, warm: 0.15, ambient: 0.08, engine: 0.28 }),
  mobile: freezeProfile({ cold: 1.6, warm: 0.12, ambient: 0.09, engine: 0.18 }),
});

const BLOOM_OBJECT_PATTERN = /DriveGlow|DeckSignals|ScaleRef_InstancedHullWindows|ScaleRef_HangarAperture/i;

export function markSelectiveBloomObjects(root) {
  let marked = 0;
  root.traverse((object) => {
    if (!object.isMesh || !BLOOM_OBJECT_PATTERN.test(object.name)) return;
    object.layers.enable(SELECTIVE_BLOOM_LAYER);
    marked += 1;
  });
  return marked;
}

export function createCinematicLighting(THREE, { carrier, profile = 'high', scene } = {}) {
  const config = CINEMATIC_LIGHT_MATRIX[profile] || CINEMATIC_LIGHT_MATRIX.mobile;
  const group = new THREE.Group();
  group.name = 'M10_RestrainedCinematicLighting';

  const shadowFill = new THREE.AmbientLight(0x6f8290, config.ambient);
  shadowFill.name = 'ShadowDetailFill';
  group.add(shadowFill);

  const coldRim = new THREE.DirectionalLight(0x9adff4, config.cold);
  coldRim.name = 'PrimaryColdRim';
  coldRim.position.set(-7, 9, 10);
  group.add(coldRim);

  const warmReflection = new THREE.DirectionalLight(0xffb27a, config.warm);
  warmReflection.name = 'WeakWarmCelestialReflection';
  warmReflection.position.set(8, -3, -12);
  group.add(warmReflection);

  const engineLights = [];
  for (const side of [-1, 1]) {
    const engine = new THREE.PointLight(0xaeeeff, config.engine, 5.5, 2);
    engine.name = side < 0 ? 'EngineIonPoint_Port' : 'EngineIonPoint_Starboard';
    engine.position.set(side * 1.75, 0.02, -5.45);
    group.add(engine);
    engineLights.push(engine);
  }

  scene.add(group);
  const bloomObjects = markSelectiveBloomObjects(scene);
  return Object.freeze({
    bloomObjects,
    config,
    engineLights,
    group,
    update(progress) {
      const wake = Math.min(1, Math.max(0, ((Number(progress) || 0) - 0.68) / 0.16));
      engineLights.forEach((light) => { light.intensity = config.engine * (0.35 + wake * 0.65); });
    },
  });
}

const BlendShader = {
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
    }
  `,
};

export function createSelectiveBloomPipeline(THREE, {
  camera,
  profile = 'high',
  renderer,
  scene,
} = {}) {
  const config = POST_PROCESSING_MATRIX[profile] || POST_PROCESSING_MATRIX.mobile;
  let enabled = config.selectiveBloom;
  let width = 1;
  let height = 1;
  let bloomComposer = null;
  let bloomPass = null;
  let finalComposer = null;

  if (config.selectiveBloom) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      config.strength,
      config.radius,
      config.threshold,
    );
    bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomComposer.addPass(bloomPass);

    const blendPass = new ShaderPass(new THREE.ShaderMaterial({
      defines: {},
      uniforms: THREE.UniformsUtils.clone(BlendShader.uniforms),
      vertexShader: BlendShader.vertexShader,
      fragmentShader: BlendShader.fragmentShader,
    }), 'baseTexture');
    blendPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;
    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(new RenderPass(scene, camera));
    finalComposer.addPass(blendPass);
  }

  return Object.freeze({
    config,
    get enabled() { return enabled; },
    render() {
      if (!enabled || !bloomComposer || !finalComposer) {
        renderer.render(scene, camera);
        return;
      }
      const previousMask = camera.layers.mask;
      camera.layers.set(SELECTIVE_BLOOM_LAYER);
      bloomComposer.render();
      camera.layers.mask = previousMask;
      finalComposer.render();
    },
    setEnabled(nextEnabled) {
      enabled = Boolean(config.selectiveBloom && nextEnabled);
    },
    setSize(nextWidth, nextHeight) {
      width = Math.max(1, Number(nextWidth) || 1);
      height = Math.max(1, Number(nextHeight) || 1);
      bloomComposer?.setSize(width, height);
      finalComposer?.setSize(width, height);
    },
    dispose() {
      bloomPass?.dispose?.();
      bloomComposer?.dispose?.();
      finalComposer?.dispose?.();
    },
  });
}
