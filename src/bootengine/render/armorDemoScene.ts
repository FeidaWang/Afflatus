/* ============================================================
   ARMOR DEMO SCENE — U29 P2 (first slice): a minimal, self-contained
   THREE.js scene whose only job is to show armorMaterial.ts on a rotating
   hull mesh. Deliberately NOT the real kitbash-fleet/particle renderer —
   this is a materials sanity check, mounted behind a query flag (see
   boot.js) so the real bridge scene (topdownCombat.js, shared with the
   production homepage) is completely untouched.

   Same factory shape as scene/topdownCombat.js's createTopdownCombat —
   createArmorDemoScene({ canvas }) → { start, stop, resize } | null (null
   on WebGL context creation failure) — so boot.js can swap between the two
   scenes without caring which one it got.
   ============================================================ */

import * as THREE from 'three';
import { createArmorMaterial } from './armorMaterial';

export interface ArmorDemoScene {
  start(): void;
  stop(): void;
  resize(w?: number, h?: number): void;
}

// Kept from the previous pass, but dialed back per owner direction ("你不
// 需要在示例战舰装甲板上做出反射的效果" — reflections aren't the point of
// this demo): the material's own envMapIntensity default is now 0.5, and
// roughness/metalness moved back toward moderate values so the diffuse
// albedo (the actual #8C969E the owner wants to see) dominates what's
// visible instead of environment-reflected hues. No image assets (matches
// this project's zero-external-texture-pipeline stance): a small
// procedural gradient "sky" (dark floor → pale cool zenith) rendered once
// through PMREMGenerator, assigned via `scene.environment`.
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 top = vec3(0.74, 0.80, 0.87);
        vec3 horizon = vec3(0.40, 0.44, 0.49);
        vec3 bottom = vec3(0.035, 0.04, 0.05);
        vec3 col = h > 0.5 ? mix(horizon, top, (h - 0.5) * 2.0) : mix(bottom, horizon, h * 2.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), skyMat);
  envScene.add(sky);
  const target = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  skyMat.dispose();
  sky.geometry.dispose();
  return target.texture;
}

export function createArmorDemoScene({ canvas }: { canvas: HTMLCanvasElement }): ArmorDemoScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setClearColor(0x04060a, 1);
  // explicit rather than relying on the default — a materials-reference
  // demo (owner asked for the true #8C969E to read correctly) shouldn't
  // leave color-space handling implicit.
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.03);
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  // 3/4 elevated angle — shows plate tops AND sides, so the bump/scorch
  // technique reads across multiple face orientations instead of one flat
  // frontal face. Pulled closer + narrower FOV than the first pass so the
  // plates fill more of the frame (owner feedback "像素太低" — the subject
  // was too small a fraction of the canvas, wasting resolution on empty
  // background either side of it).
  camera.position.set(2.0, 2.1, 4.6);
  camera.lookAt(0, 0, 0);

  // dual color-temperature lighting (charter ⑤), toned down from the
  // first pass: a fully-saturated cyan key light (#9ae5ff) at high
  // intensity was tinting the material's true FS 595C gray blue — a
  // materials-reference demo needs near-neutral light so the albedo reads
  // correctly. Key light is now a pale, barely-cool white; ambient/fill
  // raised so the base color isn't lost in shadow.
  scene.add(new THREE.AmbientLight(0x9098a0, 1.6));
  const keyLight = new THREE.DirectionalLight(0xf3f6fa, 1.6);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xe8b380, 0.6);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  // color/roughness/metalness/detail all use armorMaterial.ts's tuned
  // defaults (FS 36176 #8C969E, lower bump strength, tighter scorch edge)
  // — only the glow tint is demo-specific.
  const armor = createArmorMaterial({ glowColor: 0x66ffe8 });

  // A smooth subdivided sphere reads as "planet" (round silhouette + the
  // scorch mask looking like continents) — wrong test bed entirely. A
  // small greybox cluster of flat plates reads as ship armor instead, and
  // still shows the material technique across several face angles.
  const group = new THREE.Group();
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 2.2, 6, 2, 4), armor.material);
  group.add(basePlate);
  const insetPlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.32, 1.1, 3, 2, 2), armor.material);
  insetPlate.position.set(-0.4, 0.41, 0.15);
  group.add(insetPlate);
  const finPlate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 1.9, 2, 1, 4), armor.material);
  finPlate.position.set(1.35, 0.37, -0.1);
  finPlate.rotation.y = 0.35;
  group.add(finPlate);
  scene.add(group);
  const mesh = group;

  let running = false;
  let raf = 0;
  let t0 = 0;

  function loop(now: number) {
    if (!t0) t0 = now;
    const elapsed = (now - t0) / 1000;
    mesh.rotation.y = elapsed * 0.18;
    mesh.rotation.x = Math.sin(elapsed * 0.11) * 0.15;
    armor.update(elapsed);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(loop);
  }

  function resize(w?: number, h?: number) {
    const W = Math.max(1, w ?? canvas.clientWidth ?? window.innerWidth);
    const H = Math.max(1, h ?? canvas.clientHeight ?? window.innerHeight);
    // No 1.75 cap here (unlike topdownCombat.js, which caps for a busy
    // scene with many objects): this is a single-mesh materials-reference
    // demo, GPU cost is trivial, and a soft/undersharp render defeats its
    // purpose. Cap at 3 purely as a sanity ceiling, not a real limit.
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
  };
}
