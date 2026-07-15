/* ============================================================
   P2 FLEET DEMO SCENE — U29 P2 second slice: wires together the three
   pieces the downscope table still listed as outstanding after the armor-
   material slice (instanced particle pools, kitbash fleet reuse, glowing
   laser weapon-fire) into one preview scene, mounted behind its own opt-in
   query flag (?p2demo=fleet — see boot.js). Not the real production combat
   scene — same "technique sanity check" posture as armorDemoScene.ts, just
   covering the remaining three pieces instead of the armor material alone.
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createKitbashFleet } from './kitbashFleet';
import { createExplosionPool, createThrusterPool, createDebrisPool } from './particles';
import type { ParticlePool } from './particles';
import { createLaserBeam } from './laserBeam';
import type { LaserBeam } from './laserBeam';
import { rngFromString } from '../seed';

// U29 P2 "cinematic light contrast" pass (owner-supplied AAA guide, 2026-
// 07-16): the guide's WebGPU/deferred/G-Buffer/POM/SSR ask is a different
// render architecture than this project's WebGL2-forward pipeline and is
// explicitly out of scope here (see Urgent.md's U29 downscope table — WebGPU
// is a P5 evaluation gate that hasn't even had its P0 device-probe spike
// run yet; a from-scratch WebGPU renderer isn't a same-session, no-visual-
// feedback-safe undertaking). What IS adopted from that guide, because it's
// achievable in the CURRENT WebGL2/three.js pipeline with real, verifiable
// effect: ACES filmic tonemapping (three ships this built-in) + a real
// bloom pass (three's own bundled EffectComposer/UnrealBloomPass, not a
// hand-rolled approximation) + a repositioned/stronger rim light for edge
// contrast. This is the "近似效果" half of that decision — the owner asked
// for this half now and the WebGPU rewrite to be logged separately for a
// dedicated future session (see Urgent.md).

export interface FleetDemoScene {
  start(): void;
  stop(): void;
  resize(w?: number, h?: number): void;
}

// Duplicated from armorDemoScene.ts on purpose rather than extracted into a
// shared module — both are small and self-contained, and this keeps the
// already-verified armor demo file untouched (surgical-changes discipline;
// see that file's own header for the technique rationale).
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

export function createFleetDemoScene({ canvas }: { canvas: HTMLCanvasElement }): FleetDemoScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setClearColor(0x03050a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES filmic tonemapping — deeper shadows, more contrast in the highlights
  // (engine glow / windows / shield rim) instead of the flat/washed default
  // linear response. Exposure tuned down slightly from 1.0 since ACES's own
  // curve already brightens mids; 1.0 read a touch hot with the new engine
  // glow's emissiveIntensity 4.5.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03050a, 0.012);
  scene.environment = buildEnvironment(renderer);

  // Pulled back + widened from the first pass: the fleet swapped to
  // wedgeCruiserHull.js (flagship length 14.4 / width 8.0, vs. the old
  // carrier's 9.6/8.3-ish), and escort formation slots moved further aft
  // to clear the new, longer flagship's stern — the old framing cropped
  // both.
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
  camera.position.set(20, 13, 27);
  camera.lookAt(0, 0, -7);

  scene.add(new THREE.AmbientLight(0x9098a0, 1.2));
  const keyLight = new THREE.DirectionalLight(0xf3f6fa, 1.5);
  keyLight.position.set(10, 12, 8);
  scene.add(keyLight);
  // Rim light pushed further to a low grazing angle and boosted (0.5 -> 0.95)
  // — the guide's "metal edges/corners should keep a sharp highlight" ask,
  // done with light placement rather than a per-material Fresnel shader
  // (that's a real next increment, not included this pass — see chat).
  const rimLight = new THREE.DirectionalLight(0xe8b380, 0.95);
  rimLight.position.set(-16, -5, -15);
  scene.add(rimLight);

  // Fixed demo seed — same fleet layout every load, matching P1's own
  // "same seed -> same result" determinism convention (see kitbashFleet.ts's
  // computeFormation for what is and isn't covered by it).
  const rng = rngFromString('afflatus:p2demo:fleet');
  const fleet = createKitbashFleet({ rng, escortCount: 4 });
  scene.add(fleet.group);

  const explosionPool: ParticlePool = createExplosionPool();
  const thrusterPool: ParticlePool = createThrusterPool();
  const debrisPool: ParticlePool = createDebrisPool();
  scene.add(explosionPool.points, thrusterPool.points, debrisPool.points);

  // A handful of concurrent beam meshes (not just one) so the fleet's
  // exchanges read as ongoing fire rather than a single blinking shot.
  const BEAM_COUNT = 3;
  const beams: LaserBeam[] = [];
  for (let i = 0; i < BEAM_COUNT; i++) {
    const beam = createLaserBeam({ coreColor: 0xffffff, glowColor: 0x66ffe8 });
    scene.add(beam.mesh);
    beams.push(beam);
  }

  // Real bloom (three's own EffectComposer/UnrealBloomPass), not a hand-
  // rolled bright-pass hack — this is what actually sells "engine glow /
  // window lights / shield rim are the brightest things on the model"
  // (guide: "this is the key to giving the model a sense of light").
  // threshold ~0.82 catches the high-emissiveIntensity parts (engine glow
  // material is 4.5, easily >1.0 post-tonemap-linear) without blooming the
  // plain gray hull. OutputPass applies renderer.toneMapping/outputColorSpace
  // at the very end of the chain — required when using EffectComposer,
  // since intermediate passes render to off-screen linear targets.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.4, 0.82);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const tmpFrom = new THREE.Vector3();
  const tmpTo = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpFwd = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();

  let nextBeamIdx = 0;
  let nextFireAt = 1.0;

  function fireRandomShot(elapsed: number) {
    if (fleet.muzzleMarkers.length < 2) return;
    const srcIdx = Math.floor(Math.random() * fleet.muzzleMarkers.length);
    let dstIdx = Math.floor(Math.random() * fleet.muzzleMarkers.length);
    if (dstIdx === srcIdx) dstIdx = (dstIdx + 1) % fleet.muzzleMarkers.length;
    fleet.muzzleMarkers[srcIdx].getWorldPosition(tmpFrom);
    fleet.muzzleMarkers[dstIdx].getWorldPosition(tmpTo);
    const beam = beams[nextBeamIdx];
    nextBeamIdx = (nextBeamIdx + 1) % beams.length;
    beam.fire(elapsed, tmpFrom, tmpTo);

    // Impact feedback at the target end: bursts from the other two pools,
    // so all three (explosion/thruster/debris) are exercised by this one
    // demo — thruster runs continuously below, these two fire on hit.
    for (let i = 0; i < 26; i++) {
      tmpDir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(1.5 + Math.random() * 2.5);
      explosionPool.spawn(elapsed, tmpTo, tmpDir);
    }
    for (let i = 0; i < 14; i++) {
      tmpDir.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5)
        .normalize().multiplyScalar(0.8 + Math.random() * 1.6);
      debrisPool.spawn(elapsed, tmpTo, tmpDir);
    }
  }

  let running = false;
  let raf = 0;
  let t0 = 0;
  let frameCount = 0;

  function loop(now: number) {
    if (!t0) t0 = now;
    const elapsed = (now - t0) / 1000;
    frameCount++;

    // Thruster exhaust: spawn from every engine marker, throttled to every
    // other frame — a continuous per-marker stream at 60fps would overrun
    // the pool's recycle rate for no visible benefit (see particles.ts).
    if (frameCount % 2 === 0) {
      for (const marker of fleet.engineMarkers) {
        marker.getWorldPosition(tmpFrom);
        marker.getWorldQuaternion(tmpQuat);
        tmpFwd.set(0, 0, -1).applyQuaternion(tmpQuat).multiplyScalar(2.2);
        tmpFwd.x += (Math.random() - 0.5) * 0.4;
        tmpFwd.y += (Math.random() - 0.5) * 0.4;
        thrusterPool.spawn(elapsed, tmpFrom, tmpFwd);
      }
    }

    if (elapsed >= nextFireAt) {
      fireRandomShot(elapsed);
      nextFireAt = elapsed + 0.9 + Math.random() * 1.1;
    }

    explosionPool.update(elapsed);
    thrusterPool.update(elapsed);
    debrisPool.update(elapsed);
    for (const beam of beams) beam.update(elapsed);

    composer.render();
    if (running) raf = requestAnimationFrame(loop);
  }

  function resize(w?: number, h?: number) {
    const W = Math.max(1, w ?? canvas.clientWidth ?? window.innerWidth);
    const H = Math.max(1, h ?? canvas.clientHeight ?? window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(dpr);
    composer.setSize(W, H);
    bloomPass.setSize(W, H);
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize,
  };
}
