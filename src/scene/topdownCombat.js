/**
 * Multi-camera CIC sensor-fusion WebGL combat scene.
 * migration off the embedded Canvas-2D system in main.js.
 *
 * Inspired by the classic Top-Down View of overhead space-battle games (e.g.
 * Shattered Galaxy / 破碎银河系, 2011): a tactical battle plane viewed from high
 * above with a slight tilt, so units, tracers and explosions read in plan view
 * while keeping volumetric depth. Built on three.js with emissive materials and
 * additive sprite glows (cheap fake-bloom — no postprocessing dependency).
 *
 * This module is intentionally self-contained and side-effect free except for
 * an opt-in live harness at the bottom (gated on ?combat=topdown) so it can be
 * exercised in production without touching the live home app. Wiring it into
 * the combat-view render loop is the next migration phase (see roadmap.md).
 *
 *   const scene = createTopdownCombat({ canvas });
 *   scene.start();            // runs its own rAF battle loop
 *   scene.resize(w, h);       // css px; DPR comes from RenderBudgetCoordinator
 *   scene.stop(); scene.destroy();
 */
import * as THREE from 'three';
import { createWeaponCameraDirector } from '../combat/weaponCameraDirector.js';
import { fovForAccel, bankAngle, chaseCamPose } from '../combat/cameraMath.js';
import { createLaunchPath, createLandingPath } from '../combat/flightPath.js';
import {
  applyVanguardSurfaceTextures,
  createAfflatusInterceptorPrototype,
  createAfflatusVanguard,
  disposeVanguardSurfaceTextures,
  loadVanguardSurfaceTextures,
} from './afflatusVanguard.js';
import { projectedDiameterPx, selectProceduralLod } from '../lib/proceduralLod.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  CIC_CAPITAL_ASSET_PROFILE,
  CIC_FIGHTER_ASSET_PROFILE,
  createCombatAssetLoader,
} from './combatAssetLoader.js';
import { createCombatVfx } from './combatVfx.js';
import {
  cometTailDirection,
  cometVisualProfile,
  phaseCameraCue,
} from './topdownCombatMath.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

const MAIN_GUN_FIRE_HOLD_MS = 800;
const MAIN_GUN_FIRE_VISUAL_MS = 1000;

// U23 M1 (2026-07-13): the camera director rig is now the DEFAULT (was
// opt-in via ?combatcam=director since V14). ?combatcam=tactical opts back
// into the original hardcoded camera sway.
function cameraDirectorEnabled() {
  try { return !/[?&]combatcam=tactical\b/.test(location.search); } catch (e) { return true; }
}

function glowTexture() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createDistantBlackHole() {
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: new THREE.Vector2(172, 86) },
    uIntensity: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * uSize;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      float band(float value, float center, float width) {
        return 1.0 - smoothstep(width, width * 2.0, abs(value - center));
      }

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        p.x *= 1.82;
        float c = cos(-0.075), s = sin(-0.075);
        p = mat2(c, -s, s, c) * p;
        float radius = length(p);
        float angle = atan(p.y, p.x);

        // A thin analytic accretion band: no scene sample, loop or ray march.
        float diskRadius = abs(p.x);
        float diskWidth = 0.04 + 0.11 * (1.0 - smoothstep(0.25, 1.45, diskRadius));
        float disk = (1.0 - smoothstep(diskWidth, diskWidth + 0.07, abs(p.y)));
        disk *= smoothstep(0.31, 0.45, radius) * (1.0 - smoothstep(1.18, 1.62, diskRadius));
        float stream = 0.84 + 0.16 * sin(angle * 7.0 - uTime * 1.25 + radius * 19.0);
        disk *= stream;

        vec3 cyan = vec3(0.19, 0.68, 1.0);
        vec3 whiteHot = vec3(1.0, 0.92, 0.72);
        vec3 amber = vec3(1.0, 0.31, 0.075);
        vec3 diskColor = mix(cyan, amber, smoothstep(-1.15, 1.15, p.x));
        diskColor = mix(diskColor, whiteHot, band(radius, 0.48, 0.13) * 0.3);

        float photon = band(radius, 0.355, 0.012) + band(radius, 0.405, 0.026) * 0.48;
        float farMetric = length(vec2(p.x, p.y * 0.66));
        float farArc = band(farMetric, 0.52, 0.022) * smoothstep(-0.1, 0.26, p.y);
        float halo = (1.0 - smoothstep(0.34, 1.35, radius)) * smoothstep(0.27, 0.43, radius);
        halo *= 0.18 + 0.04 * sin(uTime * 0.7 + angle * 5.0);
        float horizon = 1.0 - smoothstep(0.305, 0.352, radius);

        vec3 photonColor = mix(vec3(0.48, 0.82, 1.0), vec3(1.0, 0.55, 0.2), smoothstep(-0.42, 0.42, p.x));
        vec3 color = diskColor * disk * 1.75;
        color += photonColor * photon * 1.2;
        color += mix(vec3(0.65, 0.86, 1.0), whiteHot, 0.55) * farArc * 0.88;
        color += mix(cyan, amber, 0.35) * halo * 0.78;
        color *= uIntensity;
        float lightAlpha = disk * 0.9 + photon + farArc * 0.82 + halo * 0.7;
        float alpha = clamp(max(horizon * 0.985, lightAlpha), 0.0, 1.0);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color * (1.0 - horizon), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = 'AlphardDistantBlackHole';
  mesh.position.set(34, 24, -218);
  mesh.frustumCulled = false;
  mesh.renderOrder = -20;
  mesh.userData.baseSize = new THREE.Vector2(172, 86);
  return mesh;
}

let surfaceSequence = 0;

export function createTopdownCombat({
  canvas,
  surfaceId,
  shouldLoadAuthoredAssets = () => true,
  preloadAuthoredFighters = true,
}) {
  const renderCoordinator = getRenderBudgetCoordinator();
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'high', targetFps: 60 });
  const lifecycleId = surfaceId || `combat:topdown:${++surfaceSequence}`;
  if (!canAcquireWebGLContext(lifecycleId)) return null;
  let budgetActive = false;
  let contextReady = true;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x04060a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const authoredAssetLoader = createCombatAssetLoader(renderer, { workerLimit: 2 });
  const performanceProbeEnabled = (() => {
    try { return /[?&]combatPerfProbe=1\b/.test(location.search); } catch { return false; }
  })();
  function markPerformanceStage(name) {
    if (!performanceProbeEnabled) return;
    const at = performance.now();
    const key = `cic${name.charAt(0).toUpperCase()}${name.slice(1)}At`;
    document.documentElement.dataset[key] = at.toFixed(2);
    try { performance.mark(`cic:${name}`, { startTime: at }); } catch {}
  }
  markPerformanceStage('surfaceCreated');

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  const CAM = new THREE.Vector3(0, 74, 30);
  camera.position.copy(CAM);
  camera.lookAt(0, 2, -2);

  // ── camera director (V14, opt-in via ?combatcam=director) ───────────────
  // Shot compute functions read live scene objects via closure (capital,
  // comet, fighters are declared further below but are in scope by the time
  // update()/loop() actually run each frame). `t` is seconds since the shot
  // itself became active, not scene time.
  const camDirectorOn = cameraDirectorEnabled();
  let camDirector = null;
  let missileLastPos = null, missileLastVel = null; // live shot feeds
  const defaultMissileDirection = new THREE.Vector3(0, 0, -1);
  const missileCameraDirection = new THREE.Vector3();
  let activeMissileCameraTrackId = null;
  let missileTrackSequence = 0;

  // Camera feeds must retain their own storage. In particular, the projectile
  // sampler below deliberately reuses scratch vectors for every missile, so
  // assigning those vectors here would make a two-missile frame point the
  // camera at whichever missile was updated last.
  function updateMissileCameraFeed(position, velocity) {
    if (!missileLastPos) missileLastPos = new THREE.Vector3();
    if (!missileLastVel) missileLastVel = new THREE.Vector3();
    missileLastPos.copy(position);
    missileLastVel.copy(velocity);
  }

  // ── U24 flight event state (launch/landing lifecycle for fighters[0]) ──
  // flightLastPos/Vel are the shot-compute feeds (missileLastPos pattern);
  // accel is derived from consecutive analytic velocities, only consumed by
  // chaseLaunch's FOV/banking so light smoothing needs are already covered
  // by the director's own smoothDamp.
  let flightEvent = null;
  let flightLastPos = null, flightLastVel = null, flightPrevVel = null, flightPrevT = 0;
  let flightAccelV = { x: 0, y: 0, z: 0 };
  let flybyAnchor = null;

  // keep any camera pedestal outside the capital's hull (U24 防穿模)
  function clampOutsideHull(pos, R = 7.2) {
    const c = capital.position;
    const dx = pos.x - c.x, dy = pos.y - c.y, dz = pos.z - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= R || d === 0) return pos;
    const k = R / d;
    return { x: c.x + dx * k, y: c.y + dy * k, z: c.z + dz * k };
  }
  function initCameraDirector() {
    const shots = {
      commandChase: {
        priority: 1,
        blendInMs: 500,
        compute() {
          const c = capital.position;
          const q = comet.position;
          if (!liveCombatState?.target) {
            return {
              pos: { x: c.x + 10.5, y: c.y + 7.2, z: c.z + 14.5 },
              look: { x: c.x, y: c.y + .65, z: c.z - 1.4 },
              fov: 42,
              roll: 0,
            };
          }
          return {
            pos: { x: c.x + 12, y: c.y + 10.5, z: c.z + 17 },
            look: {
              x: c.x + (q.x - c.x) * 0.48,
              y: 1.2,
              z: c.z + (q.z - c.z) * 0.48,
            },
            fov: 56,
            roll: 0,
          };
        },
      },
      tacticalTopdown: {
        priority: 1,
        blendInMs: 400,
        compute() {
          return {
            pos: { x: CAM.x, y: CAM.y, z: CAM.z },
            look: { x: comet.position.x * 0.25, y: 2, z: -2 },
          };
        },
      },
      bridgeWide: {
        priority: 1,
        compute() {
          return {
            pos: { x: capital.position.x * 0.4, y: CAM.y * 1.55, z: CAM.z * 1.7 },
            look: { x: capital.position.x, y: 1, z: capital.position.z * 0.3 },
          };
        },
      },
      mainGunBroadside: {
        priority: 3,
        blendInMs: 420,
        compute() {
          const c = capital.position;
          return {
            // The carrier faces -Z, so +Z is aft. Pulling well aft and to
            // starboard keeps the complete Venator (and its procedural
            // fallback) in frame while the muzzle charge remains readable.
            pos: { x: c.x + 15, y: c.y + 10.5, z: c.z + 23 },
            look: { x: c.x, y: c.y + .7, z: c.z - 1.8 },
            fov: 50,
            roll: -.018,
          };
        },
      },
      mainGunAxis: {
        priority: 4,
        compute() {
          const c = capital.position;
          const p = comet.position;
          return {
            // Rear-quarter axial composition retains the complete flagship
            // silhouette while the beam leads the eye toward the threat.
            pos: { x: c.x + 12.5, y: c.y + 7.8, z: c.z + 15.5 },
            look: {
              x: c.x + (p.x - c.x) * 0.34,
              y: c.y + 1.05 + ((p.y ?? 1.5) - c.y) * 0.18,
              z: c.z + (p.z - c.z) * 0.34,
            },
            fov: 52,
            roll: -0.012,
          };
        },
      },
      missileTail: {
        priority: 4,
        compute(t) {
          const p = missileLastPos || capital.position;
          const v = missileLastVel || defaultMissileDirection;
          const dir = missileCameraDirection.copy(v).normalize();
          return {
            pos: { x: p.x - dir.x * 4.4, y: p.y - dir.y * 4.4 + 1.15, z: p.z - dir.z * 4.4 },
            look: { x: p.x + dir.x * 13, y: p.y + dir.y * 13, z: p.z + dir.z * 13 },
            fov: 74,
            roll: 0.035 * Math.sin(t * 6),
          };
        },
      },
      impactOrbit: {
        priority: 5,
        blendInMs: 120,
        compute() {
          const p = comet.position;
          return {
            pos: { x: p.x + 8.5, y: p.y + 6.5, z: p.z + 9.5 },
            look: { x: p.x, y: p.y + 0.3, z: p.z },
            fov: 58,
            roll: 0,
          };
        },
      },
      ciwsTurret: {
        priority: 2,
        compute() {
          return {
            pos: { x: capital.position.x + 6, y: 4, z: capital.position.z + 2 },
            look: { x: comet.position.x, y: 1, z: comet.position.z },
            fov: 58,
          };
        },
      },
      offlineWide: {
        priority: 2,
        compute() {
          const c = capital.position;
          return {
            pos: { x: c.x + 20, y: c.y + 14, z: c.z + 26 },
            look: { x: c.x, y: c.y + 1, z: c.z - 6 },
            fov: 48,
            roll: 0,
          };
        },
      },
      nukeEscort: {
        priority: 5,
        compute() {
          const b = bomber.visible ? bomber.position : capital.position;
          return {
            pos: { x: b.x + 13, y: b.y + 8.5, z: b.z + 17 },
            look: {
              x: b.x + (comet.position.x - b.x) * 0.22,
              y: b.y + 0.45,
              z: b.z + (comet.position.z - b.z) * 0.22,
            },
            fov: 55,
            roll: 0.018,
          };
        },
      },
      nukeTerminal: {
        priority: 5,
        blendInMs: 140,
        compute(t) {
          const p = missileLastPos || comet.position;
          const v = missileLastVel || defaultMissileDirection;
          const dir = missileCameraDirection.copy(v).normalize();
          return {
            pos: { x: p.x - dir.x * 6.8 + 2.1, y: p.y - dir.y * 6.8 + 2.6, z: p.z - dir.z * 6.8 },
            look: { x: p.x + dir.x * 17, y: p.y + dir.y * 17, z: p.z + dir.z * 17 },
            fov: 68,
            roll: 0.045 * Math.sin(t * 5.2),
          };
        },
      },
      // ── U24 (24b) flight-event shots. All four read flightLastPos/Vel
      //    (fed by the update() flight sampler) via closure — the same
      //    live-object pattern as missileTail/mainGunAxis above. Flight beats
      //    the idle bridge view but always yields to an authoritative weapon
      //    shot (CIWS 2 → main gun 3/4 → impact 5). ──────────
      deckCam: {           // deck-edge pedestal watching the catapult run / touchdown
        priority: 1.5,
        blendInMs: 250,
        compute() {
          const dp = capital.position;
          const f = flightLastPos || { x: dp.x, y: 3, z: dp.z - 4 };
          const pos = clampOutsideHull({ x: dp.x + 4.6, y: 3.8, z: dp.z - 1.5 });
          return { pos, look: { x: f.x, y: f.y, z: f.z }, fov: 52 };
        },
      },
      chaseLaunch: {       // tail-chase on the launching fighter — FOV/bank from real accel
        priority: 1.5,
        blendInMs: 350,
        compute() {
          const p = flightLastPos || capital.position;
          const v = flightLastVel || { x: 0, y: 0, z: -6 };
          const a = flightAccelV;
          const fov = fovForAccel(Math.hypot(a.x, a.z), { cruiseFov: 60, boostFov: 72, accelScale: 14 });
          const roll = bankAngle(v.z * a.x - v.x * a.z, 0.3, 0.02);
          const pose = chaseCamPose({ x: p.x, y: p.y, z: p.z }, v, { back: 7, up: 2.4, side: 2.2, lookAhead: 12 });
          return { ...pose, fov, roll };
        },
      },
      pilotLaunch: {       // canopy/helmet camera: the fighter and HUD own the launch beat
        priority: 1.5,
        blendInMs: 130,
        compute() {
          const p = flightLastPos || capital.position;
          const v = flightLastVel || { x: 0, y: 0, z: -1 };
          const len = Math.hypot(v.x, v.y, v.z) || 1;
          const d = { x: v.x / len, y: v.y / len, z: v.z / len };
          const accel = Math.hypot(flightAccelV.x, flightAccelV.y, flightAccelV.z);
          return {
            pos: { x: p.x - d.x * 0.24, y: p.y + 0.48 - d.y * 0.24, z: p.z - d.z * 0.24 },
            look: { x: p.x + d.x * 18, y: p.y + d.y * 18 + 0.18, z: p.z + d.z * 18 },
            fov: fovForAccel(accel, { cruiseFov: 70, boostFov: 84, accelScale: 16 }),
            roll: bankAngle(v.z * flightAccelV.x - v.x * flightAccelV.z, 0.32, 0.018),
          };
        },
      },
      towerCam: {          // LSO/tower long lens tracking the approach
        priority: 1.5,
        blendInMs: 300,
        compute() {
          const dp = capital.position;
          const f = flightLastPos || { x: dp.x, y: 3, z: dp.z + 10 };
          return { pos: { x: dp.x + 1.2, y: 7.4, z: dp.z + 4.2 }, look: { x: f.x, y: f.y, z: f.z }, fov: 38 };
        },
      },
      flybyCam: {          // fixed point the fighter sweeps past (classic flyby)
        priority: 1.5,
        blendInMs: 250,
        compute() {
          const f = flightLastPos || capital.position;
          const anchor = flybyAnchor || { x: f.x + 5, y: f.y + 1.2, z: f.z + 2 };
          return { pos: anchor, look: { x: f.x, y: f.y, z: f.z }, fov: 58 };
        },
      },
    };
    camDirector = createWeaponCameraDirector({ camera, shots, home: 'commandChase' });
  }

  // Three non-shadow-casting lights provide a cheap image-based-lighting
  // approximation: cool stellar sky, neutral key and warm accretion-disc rim.
  scene.add(new THREE.HemisphereLight(0x78bfff, 0x05070c, 1.18));
  const key = new THREE.DirectionalLight(0xd9e8ff, 2.15); key.position.set(22, 54, 34); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9f62, 1.05); rim.position.set(-34, 18, -42); scene.add(rim);

  const GLOW = glowTexture();
  // r160-compatible port of the Three.js linked-particle, fire/smoke and
  // emissive-bloom examples. All effect families share three bounded draws;
  // authoritative CombatState events below are the only spawn source.
  const combatVfx = createCombatVfx(THREE, {
    scene,
    glowTexture: GLOW,
    qualityTier: renderPolicy.qualityTier,
  });
  // Do not make the first CIC frame compile all three VFX shader families.
  // They are warmed one material at a time after the lightweight sensor frame.
  combatVfx.setVisible?.(false);
  let combatEffectsReady = false;
  let combatEffectsWarmPromise = null;
  markPerformanceStage('vfxCreated');
  const combatVfxBufferSize = new THREE.Vector2();
  const sprite = (color, size, opacity = 1) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    m.scale.set(size, size, 1);
    return m;
  };

  // A true camera-surrounding volume. The former y=-40 plane projected as a
  // flat star carpet; these two depth layers occupy the full view frustum and
  // pass aft along the ship's forward axis.
  const starLayers = [];
  function addStarVolume(count, { size, opacity, drift, spreadX, spreadY }) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0xc9e6ff), new THREE.Color(0x8fb7d8), new THREE.Color(0xffdfb5)];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - .5) * spreadX;
      positions[i * 3 + 1] = (Math.random() - .46) * spreadY;
      positions[i * 3 + 2] = -320 + Math.random() * 500;
      const color = palette[Math.random() < .72 ? 0 : Math.random() < .82 ? 1 : 2];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      vertexColors: true,
      map: GLOW,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
      alphaTest: 0.025,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    points.userData = { drift, spreadX, spreadY, baseOpacity: opacity };
    starLayers.push(points);
    scene.add(points);
  }
  addStarVolume(920, { size: .62, opacity: .72, drift: .095, spreadX: 520, spreadY: 310 });
  addStarVolume(240, { size: 1.25, opacity: .5, drift: .17, spreadX: 360, spreadY: 230 });

  // One analytic draw: event horizon, photon ring and Doppler-shifted disc.
  // It intentionally avoids a composer or scene-depth sampling.
  const approachBlackHole = createDistantBlackHole();
  scene.add(approachBlackHole);

  // A sparse velocity layer makes forward motion legible without turning the
  // sensor picture into a warp tunnel. Each line occupies its own x/y/z
  // coordinate, so the streaks retain depth rather than forming a flat sheet.
  const streakCount = 96;
  const streakPositions = new Float32Array(streakCount * 6);
  function resetStreak(index, initial = false) {
    const offset = index * 6;
    const z = initial ? -310 + Math.random() * 480 : -310;
    const length = 2.4 + Math.random() * 7.2;
    const x = (Math.random() - .5) * 380;
    const y = (Math.random() - .46) * 230;
    streakPositions[offset] = x;
    streakPositions[offset + 1] = y;
    streakPositions[offset + 2] = z;
    streakPositions[offset + 3] = x;
    streakPositions[offset + 4] = y;
    streakPositions[offset + 5] = z - length;
  }
  for (let i = 0; i < streakCount; i += 1) resetStreak(i, true);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const flightStreaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({
    color: 0xb8dcf2,
    transparent: true,
    opacity: .24,
    depthWrite: false,
  }));
  flightStreaks.name = 'ForwardVelocityReferences';
  scene.add(flightStreaks);
  markPerformanceStage('backdropCreated');

  // ── materials ────────────────────────────────────────────────────────────
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, metalness: 0.6, roughness: 0.7, emissive: 0x3a1206, emissiveIntensity: 0.5 });

  // ── AFFLATUS VANGUARD command ship. The procedural version is a genuine
  //    full-silhouette fallback while the bounded GLB streams in; the old
  //    cylinder/sphere/box placeholder no longer exists on this path. ──────
  const capital = new THREE.Group();
  let shipAnchors = null;
  let shipModelStatus = 'procedural';
  let shipTextureStatus = 'idle';
  let shipSurfaceTextures = null;
  let shipSurfaceTexturePromise = null;
  let sceneDisposed = false;
  let authoredShip = null;
  let shipAssetHandle = null;
  let shipModelPromise = null;
  let shipModelTerminalFailure = false;
  let proceduralFramePresented = false;
  let authoredWarmGeneration = 0;
  const fallbackShip = createAfflatusVanguard(THREE, { detail: 'full', forwardNegativeZ: true });
  markPerformanceStage('fallbackShipCreated');
  fallbackShip.group.name = 'VanguardProceduralFallback';
  // The procedural carrier is visible for roughly one second while the CIC
  // LOD streams. A shared analytic silhouette avoids compiling eight PBR
  // variants (including transmission) just to discard them at the GLB swap.
  const fallbackBootHullMaterial = new THREE.MeshBasicMaterial({ color: 0x536878 });
  const fallbackBootGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x91efff, toneMapped: false });
  const fallbackOriginalMaterials = new Set();
  fallbackShip.group.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    originals.forEach((material) => fallbackOriginalMaterials.add(material));
    child.material = /drive|glow|emission|thruster/i.test(child.name)
      ? fallbackBootGlowMaterial
      : fallbackBootHullMaterial;
  });
  fallbackOriginalMaterials.forEach((material) => material.dispose());
  fallbackOriginalMaterials.clear();
  capital.add(fallbackShip.group);
  capital.scale.setScalar(1.55);
  capital.position.set(-2, 0, 17); // front (-Z) faces up-field toward the comet
  scene.add(capital);
  const fallbackAnchors = {
    main: fallbackShip.group.getObjectByName('Muzzle_Main'),
    ciwsPort: fallbackShip.group.getObjectByName('Muzzle_CIWS_Port'),
    ciwsStarboard: fallbackShip.group.getObjectByName('Muzzle_CIWS_Starboard'),
    missile: fallbackShip.group.getObjectByName('MissileBay'),
  };
  shipAnchors = fallbackAnchors;
  function applyShipSurfaceQuality() {
    if (!shipSurfaceTextures) return;
    applyVanguardSurfaceTextures(fallbackShip.group, shipSurfaceTextures, renderPolicy.qualityTier);
  }
  function ensureShipSurfaceTextures() {
    // The short-lived fallback intentionally uses analytic materials; loading
    // a second KTX2 surface set would duplicate work immediately before the
    // authored CIC model replaces it.
    if (fallbackBootHullMaterial) {
      shipTextureStatus = 'analytic-fallback';
      return;
    }
    if (renderPolicy.qualityTier === 'low' || shipSurfaceTexturePromise || dataSaverEnabled()) return;
    shipTextureStatus = 'loading';
    shipSurfaceTexturePromise = loadVanguardSurfaceTextures(THREE, renderer)
      .then((textures) => {
        if (sceneDisposed) {
          disposeVanguardSurfaceTextures(textures);
          return;
        }
        shipSurfaceTextures = textures;
        shipTextureStatus = 'ktx2';
        applyShipSurfaceQuality();
      })
      .catch(() => { shipTextureStatus = 'fallback'; });
  }
  // One low-poly shell and one fragment pass replace the old wire sphere.
  // The shader stays dormant between authoritative fleet:damage events; when
  // hit, its local-space pattern provides a Fresnel rim, a hex energy lattice
  // and a single expanding wave without particles, textures or postprocessing.
  const shieldMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x70ddff) },
      uPulse: { value: 0 },
      uHitDirection: { value: new THREE.Vector3(0, 0.08, -1).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vViewDirV;
      varying vec3 vShieldDirection;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPosition.xyz);
        vShieldDirection = normalize(position);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPulse;
      uniform vec3 uHitDirection;
      varying vec3 vNormalV;
      varying vec3 vViewDirV;
      varying vec3 vShieldDirection;

      float hexEnergyGrid(vec2 point) {
        const vec2 cellSize = vec2(1.0, 1.7320508);
        vec2 cellA = mod(point, cellSize) - cellSize * 0.5;
        vec2 cellB = mod(point - cellSize * 0.5, cellSize) - cellSize * 0.5;
        vec2 cell = dot(cellA, cellA) < dot(cellB, cellB) ? cellA : cellB;
        vec2 edgePoint = abs(cell);
        float edgeDistance = abs(0.5 - max(edgePoint.x, dot(edgePoint, vec2(0.5, 0.8660254))));
        return 1.0 - smoothstep(0.015, 0.055, edgeDistance);
      }

      void main() {
        float pulse = clamp(uPulse, 0.0, 1.0);
        vec3 direction = normalize(vShieldDirection);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormalV), normalize(vViewDirV))), 2.35);

        // Chord distance avoids an acos per fragment while still tracing a
        // circular wave across the curved shield from the actual hit side.
        float hitDistance = length(direction - normalize(uHitDirection));
        float progress = 1.0 - pulse;
        float rippleRadius = 0.04 + progress * 1.55;
        float rippleWidth = 0.05 + progress * 0.025;
        float ripple = 1.0 - smoothstep(rippleWidth, rippleWidth + 0.075, abs(hitDistance - rippleRadius));
        float impact = (1.0 - smoothstep(0.0, 0.22, hitDistance)) * smoothstep(0.55, 1.0, pulse);

        float grid = hexEnergyGrid(direction.xz * 6.0);
        float energizedGrid = grid * (0.12 + ripple * 0.88);
        float alpha = pulse * (0.09 * fresnel + 0.11 * energizedGrid + 0.68 * ripple + 0.52 * impact);
        vec3 baseColor = uColor * (0.55 + fresnel * 0.8);
        vec3 hotColor = vec3(0.84, 0.97, 1.0);
        vec3 color = mix(baseColor, hotColor, clamp(ripple * 0.78 + impact, 0.0, 1.0));
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.86));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const shieldShell = new THREE.Mesh(
    new THREE.SphereGeometry(5.25, 28, 18),
    shieldMaterial,
  );
  shieldShell.name = 'ImpactEnergyShield';
  shieldShell.scale.set(1.0, 0.23, 1.45);
  shieldShell.visible = false;
  capital.add(shieldShell);
  const shieldHitDirection = shieldMaterial.uniforms.uHitDirection.value;
  const shieldWorldHitDirection = new THREE.Vector3();
  const shieldWorldImpact = new THREE.Vector3();
  let shieldPulse = 0;
  const damageScars = [];
  for (const [x, z] of [[-1.65, -0.9], [1.9, 0.7], [-0.4, 2.25]]) {
    const scar = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x080000, transparent: true, opacity: 0, depthWrite: false }));
    scar.position.set(x, 0.78, z);
    scar.scale.set(1.6, 1.6, 1);
    capital.add(scar);
    scar.visible = false;
    damageScars.push(scar);
  }
  let damageScarIndex = 0;

  function addCapitalWeaponAnchors(root) {
    const definitions = {
      main: ['Muzzle_Main', [0, 1.0, 5.4]],
      ciwsPort: ['Muzzle_CIWS_Port', [-2.1, 0.65, 2.8]],
      ciwsStarboard: ['Muzzle_CIWS_Starboard', [2.1, 0.65, 2.8]],
      missile: ['MissileBay', [0, 0.65, 0.8]],
    };
    return Object.fromEntries(Object.entries(definitions).map(([keyName, [name, position]]) => {
      const anchor = new THREE.Object3D();
      anchor.name = name;
      anchor.position.fromArray(position);
      root.add(anchor);
      return [keyName, anchor];
    }));
  }

  let authoredShipAnchors = null;
  function prepareAuthoredMaterials(root) {
    root.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material || material.transparent || material.opacity < 1) continue;
        if (material.side !== THREE.FrontSide) {
          material.side = THREE.FrontSide;
          material.needsUpdate = true;
        }
      }
    });
  }

  function authoredWarmCurrent(generation) {
    return generation === authoredWarmGeneration && !sceneDisposed && contextReady;
  }

  function authoredSurfaceRequested() {
    try {
      return surfaceActive
        && document.visibilityState !== 'hidden'
        && authoredAssetsAllowed()
        && shouldLoadAuthoredAssets(liveCombatState);
    } catch {
      return false;
    }
  }

  function nextAssetFrame(generation) {
    return new Promise((resolve) => {
      const waitStartedAt = performance.now();
      const wait = () => {
        if (!authoredWarmCurrent(generation)) {
          resolve(false);
          return;
        }
        if (!authoredAssetsAllowed()) {
          resolve(false);
          return;
        }
        let settled = false;
        let rafId = 0;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timerId);
          if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
          if (!authoredWarmCurrent(generation)) {
            resolve(false);
            return;
          }
          if (!authoredSurfaceRequested()) {
            if (performance.now() - waitStartedAt >= 2000) {
              resolve(false);
              return;
            }
            wait();
            return;
          }
          resolve(true);
        };
        const timerId = setTimeout(finish, 120);
        if (authoredSurfaceRequested() && typeof requestAnimationFrame === 'function') {
          rafId = requestAnimationFrame(finish);
        }
      };
      wait();
    });
  }

  function authoredTextures(root) {
    const textures = new Set();
    root.traverse((child) => {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    });
    return [...textures];
  }

  async function prewarmAuthoredGeometry(root, generation) {
    const meshes = [];
    root.traverse((child) => { if (child.isMesh) meshes.push(child); });
    if (!meshes.length) return true;

    const originalState = meshes.map((mesh) => ({
      mesh,
      visible: mesh.visible,
      frustumCulled: mesh.frustumCulled,
    }));
    const stagingScene = new THREE.Scene();
    const stagingMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const stagingTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    stagingScene.overrideMaterial = stagingMaterial;
    stagingScene.add(root);
    for (const mesh of meshes) {
      mesh.visible = false;
      mesh.frustumCulled = false;
    }

    try {
      // WebGLRenderer.compile() prepares programs but not vertex/index buffers.
      // Render two hidden meshes into a 1px target per refresh so the first
      // visible authored frame does not absorb every geometry upload at once.
      for (let index = 0; index < meshes.length; index += 1) {
        const batch = meshes.slice(index, index + 1);
        batch.forEach((mesh) => { mesh.visible = true; });
        const previousTarget = renderer.getRenderTarget();
        try {
          renderer.setRenderTarget(stagingTarget);
          renderer.render(stagingScene, camera);
        } finally {
          renderer.setRenderTarget(previousTarget);
          batch.forEach((mesh) => { mesh.visible = false; });
        }
        if (!await nextAssetFrame(generation)) return false;
      }
      return true;
    } finally {
      stagingScene.remove(root);
      for (const state of originalState) {
        state.mesh.visible = state.visible;
        state.mesh.frustumCulled = state.frustumCulled;
      }
      stagingTarget.dispose();
      stagingMaterial.dispose();
    }
  }

  async function prewarmAuthoredPrograms(root, generation) {
    const meshes = [];
    root.traverse((child) => { if (child.isMesh && child.material) meshes.push(child); });
    for (const mesh of meshes) {
      if (!authoredWarmCurrent(generation)) return false;
      // r160's compileAsync can poll an orphaned WebGLProgram forever after
      // context loss. One synchronous material compile per refresh is bounded
      // and still prevents a whole-model program burst on the swap frame.
      renderer.compile(mesh, camera, scene);
      if (!await nextAssetFrame(generation)) return false;
    }
    return true;
  }

  async function prewarmAuthoredAsset(root, generation) {
    if (!authoredWarmCurrent(generation)) return 'cancelled';
    const textures = authoredTextures(root);
    try {
      if (!await nextAssetFrame(generation)) return 'cancelled';
      // Upload one compressed texture per refresh instead of presenting one
      // frame that absorbs the entire KTX2 upload burst.
      for (let index = 0; index < textures.length; index += 1) {
        renderer.initTexture(textures[index]);
        if (!await nextAssetFrame(generation)) return 'cancelled';
      }
      if (!await prewarmAuthoredGeometry(root, generation)) return 'cancelled';
      // Compile one incoming material per refresh while borrowing the live
      // scene's lights/environment for the correct PBR program variants.
      if (!await prewarmAuthoredPrograms(root, generation)) return 'cancelled';
      return 'ready';
    } catch (error) {
      // The procedural fleet remains visible until every warmup stage passes.
      if (!authoredWarmCurrent(generation)) return 'cancelled';
      root.userData.prewarmError = error instanceof Error ? error.message : String(error);
      return 'failed';
    }
  }

  function authoredAssetsAllowed() {
    if (dataSaverEnabled()) return false;
    // Low includes reduced-motion and constrained hardware. Keep that tier on
    // the procedural fleet so it never pays the authored models' network,
    // decode or GPU-memory cost merely because the viewport is desktop-sized.
    return renderPolicy.qualityTier !== 'low';
  }

  function syncShipAssetVisibility() {
    const useAuthored = Boolean(authoredShip && authoredAssetsAllowed());
    fallbackShip.group.visible = !useAuthored;
    if (authoredShip) authoredShip.visible = useAuthored;
    shipAnchors = useAuthored ? authoredShipAnchors : fallbackAnchors;
  }

  function dataSaverEnabled() {
    try { return Boolean(navigator.connection?.saveData); } catch { return false; }
  }

  async function ensureAuthoredShip() {
    if (shipModelPromise || shipModelTerminalFailure || sceneDisposed || !contextReady || !authoredAssetsAllowed()) return shipModelPromise;
    const generation = authoredWarmGeneration;
    let retryable = true;
    shipModelStatus = 'loading-venator';
    markPerformanceStage('shipLoadStart');
    shipModelPromise = authoredAssetLoader.load(CIC_CAPITAL_ASSET_PROFILE)
      .then(async (asset) => {
        markPerformanceStage('shipDecoded');
        if (sceneDisposed) {
          asset.dispose();
          return null;
        }
        const root = asset.root;
        root.name = 'VenatorClassStarDestroyerCCBY';
        prepareAuthoredMaterials(root);
        // Combat convention is +Z, while the fixed carrier faces up-field -Z.
        root.rotation.y += Math.PI;
        const anchors = addCapitalWeaponAnchors(root);
        applyAuthoredGeometryQuality(root);
        const prewarmResult = await prewarmAuthoredAsset(root, generation);
        if (prewarmResult !== 'ready') {
          asset.dispose();
          retryable = prewarmResult === 'cancelled';
          if (prewarmResult === 'failed') shipModelTerminalFailure = true;
          if (!sceneDisposed) shipModelStatus = 'procedural-fallback';
          return null;
        }
        shipAssetHandle = asset;
        authoredShip = root;
        authoredShipAnchors = anchors;
        markPerformanceStage('shipWarm');
        capital.add(root);
        shipModelStatus = 'venator-ready';
        syncShipAssetVisibility();
        markPerformanceStage('shipSwap');
        return asset;
      })
      .catch((error) => {
        retryable = false;
        shipModelTerminalFailure = true;
        shipModelStatus = 'procedural-fallback';
        capital.userData.shipAssetError = error instanceof Error ? error.message : String(error);
        syncShipAssetVisibility();
        ensureShipSurfaceTextures();
        return null;
      })
      .finally(() => {
        if (!shipAssetHandle && retryable && !sceneDisposed) shipModelPromise = null;
      });
    return shipModelPromise;
  }

  // Licensed sixth-generation fighters replace the procedural Lancers after
  // their bounded GLB has loaded. The Lancers remain the low-tier, loading and
  // failure fallback so combat never waits on a network asset.
  const fighterPrototype = createAfflatusInterceptorPrototype(THREE);
  function makeFighter() {
    const fighter = new THREE.Group();
    const fallback = fighterPrototype.group.clone(true);
    fighter.add(fallback);
    fighter.userData.fallback = fallback;
    fighter.userData.authored = null;
    fighter.scale.setScalar(0.43);
    scene.add(fighter);
    return fighter;
  }
  const fighters = [makeFighter(), makeFighter(), makeFighter()];
  fighters.forEach((fighter) => { fighter.visible = false; });

  // The nuclear platform is a distinct, deliberately light flying-wing proxy.
  // It must not consume a fourth 43k-triangle fighter clone merely to make the
  // B2 release beat readable in the CIC feed.
  function makeB2Proxy() {
    const outline = [
      [0, 0.02, 4.8], [2.5, 0.02, 2.15], [7.2, 0, 0.35],
      [4.55, -0.04, -0.65], [2.15, -0.02, -1.72], [0.9, 0, -3.15],
      [0, 0, -2.52], [-0.9, 0, -3.15], [-2.15, -0.02, -1.72],
      [-4.55, -0.04, -0.65], [-7.2, 0, 0.35], [-2.5, 0.02, 2.15],
    ];
    const positions = [0, 0.34, 0];
    for (const point of outline) positions.push(...point);
    const indices = [];
    for (let index = 0; index < outline.length; index += 1) {
      indices.push(0, index + 1, ((index + 1) % outline.length) + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: 0x242d39,
      emissive: 0x071627,
      emissiveIntensity: 0.75,
      metalness: 0.82,
      roughness: 0.31,
      side: THREE.DoubleSide,
    });
    const proxy = new THREE.Group();
    const wing = new THREE.Mesh(geometry, material);
    wing.name = 'B2FlyingWingSurface';
    proxy.name = 'B2NuclearPlatformProxy';
    proxy.userData.wing = wing;
    proxy.add(wing);
    proxy.scale.setScalar(0.72);
    proxy.visible = false;
    scene.add(proxy);
    return proxy;
  }
  const bomber = makeB2Proxy();
  markPerformanceStage('fallbackFleetCreated');
  let fighterAssetHandle = null;
  let fighterModelPromise = null;
  let fighterModelTerminalFailure = false;
  let combatAssetLoadPromise = null;
  let fighterModelStatus = 'procedural';

  function syncFighterAssetVisibility() {
    const useAuthored = Boolean(fighterAssetHandle && authoredAssetsAllowed());
    for (const fighter of fighters) {
      fighter.userData.fallback.visible = !useAuthored;
      if (fighter.userData.authored) fighter.userData.authored.visible = useAuthored;
    }
  }

  async function ensureAuthoredFighters() {
    if (fighterModelPromise || fighterModelTerminalFailure || sceneDisposed || !contextReady || !authoredAssetsAllowed()) return fighterModelPromise;
    const generation = authoredWarmGeneration;
    let retryable = true;
    fighterModelStatus = 'loading-sixth-gen';
    markPerformanceStage('fighterLoadStart');
    fighterModelPromise = authoredAssetLoader.load(CIC_FIGHTER_ASSET_PROFILE)
      .then(async (asset) => {
        markPerformanceStage('fighterDecoded');
        if (sceneDisposed) {
          asset.dispose();
          return null;
        }
        prepareAuthoredMaterials(asset.root);
        const prewarmResult = await prewarmAuthoredAsset(asset.root, generation);
        if (prewarmResult !== 'ready') {
          asset.dispose();
          retryable = prewarmResult === 'cancelled';
          if (prewarmResult === 'failed') fighterModelTerminalFailure = true;
          if (!sceneDisposed) fighterModelStatus = 'procedural-fallback';
          return null;
        }
        fighterAssetHandle = asset;
        fighters.forEach((fighter, index) => {
          const model = index === 0 ? asset.root : asset.root.clone(true);
          model.name = `FictionalSixthGenFighterCCBY_${index + 1}`;
          fighter.userData.authored = model;
          fighter.add(model);
        });
        fighterModelStatus = 'sixth-gen-ready';
        syncFighterAssetVisibility();
        markPerformanceStage('fighterSwap');
        return asset;
      })
      .catch((error) => {
        retryable = false;
        fighterModelTerminalFailure = true;
        fighterModelStatus = 'procedural-fallback';
        scene.userData.fighterAssetError = error instanceof Error ? error.message : String(error);
        syncFighterAssetVisibility();
        return null;
      })
      .finally(() => {
        if (!fighterAssetHandle && retryable && !sceneDisposed) fighterModelPromise = null;
      });
    return fighterModelPromise;
  }

  function ensureAuthoredCombatAssets(state) {
    if (!proceduralFramePresented || !contextReady || !authoredAssetsAllowed() || !shouldLoadAuthoredAssets(state)) return;
    const fighterDemand = preloadAuthoredFighters
      || Boolean(state?.escorts?.some((escort) => escort.type === 'f47'));
    const needsShip = !shipModelPromise;
    const needsFighters = fighterDemand && !fighterModelPromise;
    if (!needsShip && !needsFighters) return;
    if (combatAssetLoadPromise) return;
    // KTX2Loader owns a worker pool. Stream the two authored models through
    // one active loader at a time as soon as the CIC scene exists. Waiting for
    // a target made the Command standby frame look unchanged and left the first
    // engagement showing fallbacks throughout most of its short timeline.
    combatAssetLoadPromise = Promise.resolve(shipSurfaceTexturePromise)
      .catch(() => null)
      .then(() => ensureAuthoredShip())
      .then(() => {
        const latestFighterDemand = preloadAuthoredFighters
          || Boolean(liveCombatState?.escorts?.some((escort) => escort.type === 'f47'));
        return latestFighterDemand && shouldLoadAuthoredAssets(liveCombatState)
          ? ensureAuthoredFighters()
          : null;
      })
      .finally(() => { combatAssetLoadPromise = null; });
  }

  function beginDeferredCombatWarmup() {
    void ensureCombatEffectsWarm()
      .catch(() => false)
      .then(() => ensureAuthoredCombatAssets(liveCombatState));
  }

  function invalidateAuthoredAssetsForContextLoss() {
    authoredWarmGeneration += 1;
    combatEffectsReady = false;
    combatEffectsWarmPromise = null;
    syncCombatEffectsVisibility();
    if (shipAssetHandle) {
      shipAssetHandle.dispose();
      shipAssetHandle = null;
      authoredShip = null;
      authoredShipAnchors = null;
      shipModelPromise = null;
      shipModelStatus = 'procedural-fallback';
    }
    if (fighterAssetHandle) {
      for (const fighter of fighters) {
        const model = fighter.userData.authored;
        if (model) fighter.remove(model);
        fighter.userData.authored = null;
      }
      fighterAssetHandle.dispose();
      fighterAssetHandle = null;
      fighterModelPromise = null;
      fighterModelStatus = 'procedural-fallback';
    }
    syncShipAssetVisibility();
    syncFighterAssetVisibility();
  }

  let liveCombatState = null;
  let fighterEscortSlots = [];
  let bomberEscort = null;
  let capitalLodTier = 'medium';
  const fighterLodTiers = fighters.map(() => 'medium');
  const COMBAT_WORLD_WIDTH = 52;
  const COMBAT_WORLD_DEPTH = 32;
  const COMBAT_WORLD_Z_ORIGIN = -28;

  function screenToCombatWorld(x, y, state = liveCombatState, elevation = 1.35, out = new THREE.Vector3()) {
    const viewportWidth = state?.telemetry?.viewportWidth || 1;
    const viewportHeight = state?.telemetry?.viewportHeight || 1;
    return out.set(
      (x / viewportWidth - 0.5) * COMBAT_WORLD_WIDTH,
      elevation,
      COMBAT_WORLD_Z_ORIGIN + (y / viewportHeight) * COMBAT_WORLD_DEPTH,
    );
  }

  function syncEscortSlots(state = liveCombatState) {
    const escorts = state?.escorts || [];
    fighterEscortSlots = escorts.filter((escort) => escort.type === 'f47').slice(0, fighters.length);
    bomberEscort = escorts.find((escort) => escort.type === 'b2') || null;
  }

  function escortWorldSample(escort, state = liveCombatState) {
    if (!escort || !state) return null;
    const viewportWidth = state.telemetry?.viewportWidth || 1;
    const viewportHeight = state.telemetry?.viewportHeight || 1;
    return {
      pos: screenToCombatWorld(escort.x, escort.y, state, escort.type === 'b2' ? 1.8 : 1.25),
      vel: {
        x: (escort.vx || 0) / viewportWidth * COMBAT_WORLD_WIDTH * 60,
        y: 0,
        z: (escort.vy || 0) / viewportHeight * COMBAT_WORLD_DEPTH * 60,
      },
    };
  }

  function projectileWorldPosition(projectile, state = liveCombatState, out = new THREE.Vector3()) {
    if (!projectile || !state) return null;
    return screenToCombatWorld(projectile.x, projectile.y, state, 1.35, out);
  }

  function applySurfaceTier(root, tier, { mediumExcludes, silhouetteIncludes }) {
    root.traverse((child) => {
      if (!child.isMesh) return;
      if (tier === 'high') child.visible = true;
      else if (tier === 'medium') child.visible = !mediumExcludes.includes(child.name);
      else child.visible = silhouetteIncludes.includes(child.name);
    });
    root.userData.lodTier = tier;
  }

  function applyAuthoredGeometryQuality(root = authoredShip) {
    if (!root) return;
    const high = renderPolicy.qualityTier === 'high';
    const balancedDetail = /trench[_ -]*greebles|bottom[_ -]*greebles|turbolaser/i;
    root.traverse((child) => {
      if (!child.isMesh) return;
      const label = `${child.name} ${child.parent?.name || ''}`;
      child.visible = high || !balancedDetail.test(label);
    });
  }

  const lodCameraPosition = new THREE.Vector3();
  const lodObjectPosition = new THREE.Vector3();
  const lodObjectScale = new THREE.Vector3();
  function selectObjectLod(root, radius, previousTier, viewportHeight) {
    camera.getWorldPosition(lodCameraPosition);
    root.getWorldPosition(lodObjectPosition);
    root.getWorldScale(lodObjectScale);
    return selectProceduralLod({
      projectedPixels: projectedDiameterPx({
        radius: radius * Math.max(lodObjectScale.x, lodObjectScale.y, lodObjectScale.z),
        distance: lodCameraPosition.distanceTo(lodObjectPosition),
        verticalFovDegrees: camera.fov,
        viewportHeight,
      }),
      previousTier,
      qualityTier: renderPolicy.qualityTier,
    });
  }

  const capitalLodRules = {
    mediumExcludes: ['MachinedEdges', 'MechanicalRecesses', 'ThreatMarkers'],
    silhouetteIncludes: ['CommandHull', 'ArmorPlates', 'DriveGlow'],
  };
  const fighterLodRules = {
    mediumExcludes: ['InterceptorRecesses', 'InterceptorWarnings'],
    silhouetteIncludes: ['InterceptorHull', 'InterceptorArmor', 'InterceptorEmission'],
  };
  let previousLodUpdateAt = -Infinity;
  let lodSelectionDirty = true;
  function updateProceduralLods(viewportHeight, now = performance.now(), force = false) {
    if (!force && !lodSelectionDirty && now - previousLodUpdateAt < 250) return false;
    if (!force && now - previousLodUpdateAt < 250) return false;
    previousLodUpdateAt = now;
    lodSelectionDirty = false;
    capital.updateMatrixWorld(true);
    for (const fighter of fighters) fighter.updateMatrixWorld(true);
    const nextCapitalTier = selectObjectLod(fallbackShip.group, 7.8, capitalLodTier, viewportHeight);
    if (nextCapitalTier !== capitalLodTier) {
      capitalLodTier = nextCapitalTier;
      applySurfaceTier(fallbackShip.group, capitalLodTier, capitalLodRules);
    }
    fighters.forEach((fighter, index) => {
      const nextTier = selectObjectLod(fighter, 4.5, fighterLodTiers[index], viewportHeight);
      if (nextTier === fighterLodTiers[index]) return;
      fighterLodTiers[index] = nextTier;
      applySurfaceTier(fighter.userData.fallback, nextTier, fighterLodRules);
    });
    return true;
  }
  applySurfaceTier(fallbackShip.group, capitalLodTier, capitalLodRules);
  fighters.forEach((fighter) => applySurfaceTier(fighter.userData.fallback, 'medium', fighterLodRules));

  // ── U27 (27b-2): Homeworld-style tactical lines — opt-in via ?tacticalines=1
  // (owner adjudication 2026-07-14: flag-gated, default off, no verification-
  // backlog exposure per R3 exception). Two LineSegments pools, one draw call
  // each: formation lines (wingman → wingman → capital, so the ring reads as
  // a formation instead of three independent orbits) and a target-lock lead
  // line (capital → comet) only while a real lock is active. Thin, dim,
  // additive — information, not decoration (charter③ 运动即信息).
  const TACTICAL_LINES = (() => {
    try { return /[?&]tacticalines=1\b/.test(location.search); } catch (e) { return false; }
  })();
  let formationLines = null, lockLine = null;
  if (TACTICAL_LINES) {
    const flMat = new THREE.LineBasicMaterial({ color: 0x6fb8d8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const flGeo = new THREE.BufferGeometry();
    flGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((fighters.length + 1) * 2 * 3), 3));
    formationLines = new THREE.LineSegments(flGeo, flMat);
    formationLines.frustumCulled = false;
    scene.add(formationLines);
    const lkMat = new THREE.LineDashedMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.4, dashSize: 1.4, gapSize: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const lkGeo = new THREE.BufferGeometry();
    lkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    lockLine = new THREE.Line(lkGeo, lkMat);
    lockLine.visible = false;
    scene.add(lockLine);
  }

  // ── shared scratch objects for the per-frame instanced trail-ribbon system
  // below — it loops over dozens of instances every frame, so reusing one
  // Matrix4/Vector3/Color set instead of allocating fresh ones
  // per-instance-per-frame keeps this off the GC's hot path. (U28 28d: the
  // dust-streak system that used to share this pool was deleted.)
  const _m4 = new THREE.Matrix4(), _zero4 = new THREE.Matrix4().makeScale(0, 0, 0);
  const _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _toCam = new THREE.Vector3();
  const _width = new THREE.Vector3(), _normal = new THREE.Vector3(), _scale3 = new THREE.Vector3();
  const _col = new THREE.Color();
  // Orients {_width, _normal} so a quad built from them always faces the
  // camera regardless of shot angle — a fixed horizontal or vertical ribbon
  // plane goes edge-on (and effectively disappears) depending on whether the
  // active shot is near-top-down (tacticalTopdown) or near-horizontal
  // (chaseCam); billboarding is the one orientation that reads in both.
  function billboardBasis(dir, mid) {
    _toCam.subVectors(camera.position, mid).normalize();
    _width.crossVectors(dir, _toCam);
    if (_width.lengthSq() < 1e-6) _width.set(1, 0, 0); else _width.normalize();
    _normal.crossVectors(_width, dir).normalize();
  }

  // ── V18 Phase 2 item 1: engine trail ribbons ──────────────────────────────
  // One InstancedMesh across ALL fighters — a single draw call for the whole
  // trail system (comfortably inside the "≤1 draw call per instanced asset
  // class" perf red line, §4 视觉验收清单). Each fighter samples its own tail
  // point into a capped, age-pruned ring buffer; unused instance slots collapse
  // to a zero-scale matrix (invisible) rather than being added/removed.
  const TRAIL_LIFE_MS = 1200, TRAIL_SAMPLE_MS = 45, TRAIL_MAX_PTS = 18;
  const TRAIL_SEG_CAP = TRAIL_MAX_PTS - 1;
  const TRAIL_MID_COLOR = new THREE.Color(0x6fe0ff), TRAIL_TAIL_COLOR = new THREE.Color(0x3f72ff), TRAIL_WHITE = new THREE.Color(0xffffff);
  const trailGeo = new THREE.PlaneGeometry(1, 1);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, fighters.length * TRAIL_SEG_CAP);
  trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trailMesh.visible = false;
  scene.add(trailMesh);
  const fighterTrails = fighters.map(() => ({ pts: [], lastSample: 0 }));
  const TRAIL_TAIL_LOCAL = new THREE.Vector3(0, 0.12, -3.8); // just behind the nighthawk's twin nozzles

  function updateTrails(now) {
    let idx = 0;
    fighters.forEach((f, fi) => {
      const st = fighterTrails[fi];
      if (!f.visible) {
        st.pts.length = 0;
        for (let j = 0; j < TRAIL_SEG_CAP; j++, idx++) trailMesh.setMatrixAt(idx, _zero4);
        return;
      }
      if (now - st.lastSample > TRAIL_SAMPLE_MS) {
        st.lastSample = now;
        const p = TRAIL_TAIL_LOCAL.clone(); f.localToWorld(p);
        st.pts.push({ pos: p, t: now });
        while (st.pts.length > TRAIL_MAX_PTS) st.pts.shift();
      }
      // age-prune independent of sample cadence, so a fighter that stops
      // moving still fades its trail out instead of it freezing forever
      while (st.pts.length && now - st.pts[0].t > TRAIL_LIFE_MS) st.pts.shift();

      const pts = st.pts;
      for (let j = 0; j < TRAIL_SEG_CAP; j++, idx++) {
        if (j >= pts.length - 1) { trailMesh.setMatrixAt(idx, _zero4); continue; }
        const a = pts[j].pos, b = pts[j + 1].pos;
        _mid.addVectors(a, b).multiplyScalar(0.5);
        _dir.subVectors(b, a);
        const len = _dir.length();
        if (len < 0.001) { trailMesh.setMatrixAt(idx, _zero4); continue; }
        _dir.normalize();
        billboardBasis(_dir, _mid);
        const u = Math.max(0, Math.min(1, (now - pts[j].t) / TRAIL_LIFE_MS)); // age fraction, newest segment = 0
        const width = 0.5 * (1 - u) + 0.05; // narrows with age
        _scale3.set(width, Math.max(len, 0.01), 1);
        _m4.makeBasis(_width, _dir, _normal); _m4.scale(_scale3); _m4.setPosition(_mid);
        trailMesh.setMatrixAt(idx, _m4);
        // white core → cyan → blue haze as it ages, additionally darkened
        // toward black — with AdditiveBlending, darker reads as "more faded"
        // since built-in materials don't expose per-instance alpha.
        if (u < 0.35) _col.copy(TRAIL_WHITE).lerp(TRAIL_MID_COLOR, u / 0.35);
        else _col.copy(TRAIL_MID_COLOR).lerp(TRAIL_TAIL_COLOR, (u - 0.35) / 0.65);
        _col.multiplyScalar(1 - u);
        trailMesh.setColorAt(idx, _col);
      }
    });
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
  }

  // ── comet target (1P/HALLEY) ─────────────────────────────────────────────
  // The optical signature is deliberately readable before fire-control lock.
  // Authoritative radius controls scale and authoritative velocity rotates the
  // cyan ion / amber dust wake, so it remains legible in oblique chase shots.
  const comet = new THREE.Group();
  let cometHP = 1;
  let targetRevealStartedAt = 0;
  const cometTailAxis = new THREE.Vector3(0, 0, 1);
  const cometTailVector = new THREE.Vector3(0, 0, 1);
  {
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x70818c,
      emissive: 0x123842,
      emissiveIntensity: 1.05,
      metalness: .04,
      roughness: .91,
      flatShading: true,
      transparent: true,
      opacity: 0,
    });
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), rockMaterial);
    rock.scale.set(1.8, .82, .9);
    comet.add(rock);
    const dustCount = 58;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const u = (i + 1) / dustCount;
      dustPositions[i * 3] = (Math.random() - .5) * (0.45 + u * 3.4);
      dustPositions[i * 3 + 1] = (Math.random() - .5) * (0.3 + u * 2.1);
      dustPositions[i * 3 + 2] = 1.15 + Math.pow(u, 1.45) * 23;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      map: GLOW,
      color: 0xffb45d,
      size: 1.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      alphaTest: .02,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    comet.add(dust);

    const ionCount = 64;
    const ionPositions = new Float32Array(ionCount * 3);
    for (let i = 0; i < ionCount; i += 1) {
      const u = (i + 1) / ionCount;
      ionPositions[i * 3] = (Math.random() - .5) * (0.18 + u * 1.15);
      ionPositions[i * 3 + 1] = (Math.random() - .5) * (0.14 + u * .72);
      ionPositions[i * 3 + 2] = 1.05 + Math.pow(u, 1.18) * 31;
    }
    const ionGeometry = new THREE.BufferGeometry();
    ionGeometry.setAttribute('position', new THREE.BufferAttribute(ionPositions, 3));
    const ionMaterial = new THREE.PointsMaterial({
      map: GLOW,
      color: 0x7cf7ff,
      size: 1.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      alphaTest: .018,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ion = new THREE.Points(ionGeometry, ionMaterial);
    comet.add(ion);
    const coma = sprite(0xbaf6ff, 6.8, 0);
    comet.add(coma);
    comet.userData = { rock, dust, ion, coma };
    comet.position.set(-22, 0, -18);
    comet.visible = false;
    scene.add(comet);
  }

  function combatEffectWarmupObjects() {
    const representatives = [...(combatVfx.getWarmupObjects?.() || [])];
    const seenMaterials = new Set(representatives.map((object) => object.material).filter(Boolean));
    const addRepresentatives = (root) => root?.traverse?.((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (materials.every((material) => seenMaterials.has(material))) return;
      materials.forEach((material) => seenMaterials.add(material));
      representatives.push(child);
    });
    addRepresentatives(comet);
    addRepresentatives(shieldShell);
    addRepresentatives(damageScars[0]);
    addRepresentatives(fighters[0]);
    addRepresentatives(bomber);
    addRepresentatives(trailMesh);
    return representatives;
  }

  function syncCombatEffectsVisibility() {
    combatVfx.setVisible?.(combatEffectsReady);
    trailMesh.visible = combatEffectsReady && renderPolicy.qualityTier !== 'low';
  }

  function ensureCombatEffectsWarm() {
    if (combatEffectsReady || combatEffectsWarmPromise || sceneDisposed || !contextReady) {
      return combatEffectsWarmPromise || Promise.resolve(combatEffectsReady);
    }
    const generation = authoredWarmGeneration;
    combatEffectsWarmPromise = (async () => {
      for (const object of combatEffectWarmupObjects()) {
        if (!await nextAssetFrame(generation)) return false;
        renderer.compile(object, camera, scene);
      }
      if (!authoredWarmCurrent(generation)) return false;
      combatEffectsReady = true;
      syncCombatEffectsVisibility();
      markPerformanceStage('effectsWarm');
      return true;
    })().finally(() => {
      if (!combatEffectsReady) combatEffectsWarmPromise = null;
    });
    return combatEffectsWarmPromise;
  }

  if (camDirectorOn) initCameraDirector();

  // ── pools: tracers, missiles, explosions ─────────────────────────────────
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
  const tracers = [];
  function worldAnchor(anchor, fallback) {
    if (!anchor) return fallback.clone();
    return anchor.getWorldPosition(new THREE.Vector3());
  }
  const pooledPlume = combatVfx.plume?.bind(combatVfx);
  function emitPooledPlume({ emitterId, at, velocity, color, lifeMs, scale, nuclear = false }) {
    if (pooledPlume) {
      return pooledPlume({ emitterId, at, velocity, color, lifeMs, scale, nuclear, continuous: true });
    }
    return combatVfx.fireSmoke({ at, velocity, color, lifeMs, scale, nuclear, continuous: true });
  }
  function fireTracer(from, to, color) {
    const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
    m.material.color = new THREE.Color(color);
    scene.add(m);
    tracers.push({ m, life: 1, from: from.clone(), to: to.clone() });
    orient(m, from, to);
  }
  function orient(m, a, b) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a); const len = dir.length();
    m.position.copy(mid);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  const explosions = [];
  const fragmentGeo = new THREE.TetrahedronGeometry(0.16, 0);
  const fragmentMat = new THREE.MeshBasicMaterial({ color: 0xffb06d, transparent: true, opacity: 0.9 });
  const fragmentMatrix = new THREE.Matrix4();
  const fragmentEuler = new THREE.Euler();
  function boom(pos, scale = 1, color = 0xffd9a0) {
    const s = sprite(color, 3.2 * scale, 1); s.position.copy(pos); scene.add(s);
    const halo = sprite(color, 6.2 * scale, 0.42); halo.position.copy(pos); scene.add(halo);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.02, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.copy(pos); scene.add(ring);
    const count = renderPolicy.qualityTier === 'low' ? 6 : 14;
    const fragments = new THREE.InstancedMesh(fragmentGeo, fragmentMat.clone(), count);
    fragments.position.copy(pos);
    fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const velocities = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.sin(i * 9.17) * 0.45;
      const lift = 0.35 + (i % 4) * 0.16;
      const speed = 1.8 + (i % 5) * 0.42;
      return new THREE.Vector3(Math.cos(a) * speed, lift, Math.sin(a) * speed);
    });
    scene.add(fragments);
    explosions.push({ s, halo, ring, fragments, velocities, life: 1, scale });
  }

  const missiles = [];
  // The authoritative 2D projectile list contains at most a few entries,
  // therefore a tiny reusable id list is faster and quieter than allocating a
  // Set plus filtered array each 60 Hz frame. The vectors are intentionally
  // shared only inside the synchronous update loop; camera feeds copy them.
  const claimedProjectileIds = [];
  const projectileUpdateScratch = {
    position: new THREE.Vector3(),
    candidatePosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    exhaustVelocity: new THREE.Vector3(),
  };
  const missileForward = new THREE.Vector3(0, 0, 1);
  const missileBodyGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.3, 10);
  const missileNoseGeo = new THREE.ConeGeometry(0.18, 0.62, 10);
  const missileFinGeo = new THREE.BoxGeometry(0.52, 0.035, 0.52);
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xbcc5cc, metalness: 0.82, roughness: 0.28 });
  const missileDark = new THREE.MeshStandardMaterial({ color: 0x171c22, metalness: 0.75, roughness: 0.5 });
  const missileNuclear = new THREE.MeshStandardMaterial({ color: 0x6c2728, metalness: 0.68, roughness: 0.42, emissive: 0x2a0607, emissiveIntensity: 0.6 });
  function missileModel(nuclear) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(missileBodyGeo, nuclear ? missileNuclear : missileMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const nose = new THREE.Mesh(missileNoseGeo, nuclear ? missileNuclear : missileMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 1.42;
    group.add(nose);
    for (const r of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(missileFinGeo, missileDark);
      fin.position.z = -0.85;
      fin.rotation.z = r;
      group.add(fin);
    }
    const flare = sprite(nuclear ? 0xff6658 : 0xffc274, nuclear ? 1.35 : 0.9, 0.92);
    flare.position.z = -1.38;
    group.add(flare);
    group.scale.setScalar(nuclear ? 1.25 : 0.88);
    return { group, flare };
  }
  function projectileLaunchSource(nuclear, sourceCraftId) {
    if (nuclear && bomber.visible) {
      const release = new THREE.Vector3(0, -0.42, -0.35);
      bomber.localToWorld(release);
      return release;
    }
    const sourceIndex = fighterEscortSlots.findIndex((escort) => escort.id === sourceCraftId);
    const fighter = fighters[sourceIndex >= 0 ? sourceIndex : 0];
    if (!nuclear && fighter?.visible) {
      const release = new THREE.Vector3(0, -0.3, -0.45);
      fighter.localToWorld(release);
      return release;
    }
    const fallback = new THREE.Vector3().setFromMatrixPosition(capital.matrixWorld);
    fallback.y = 1.5;
    return worldAnchor(shipAnchors?.missile, fallback);
  }

  function missileTracksProjectile(projectileId) {
    for (let index = 0; index < missiles.length; index += 1) {
      if (missiles[index].projectileId === projectileId) return true;
    }
    return false;
  }

  function closestUntrackedProjectile(type, start, state) {
    let closest = null;
    let closestDistance = Infinity;
    for (const projectile of state?.projectiles || []) {
      if (projectile.type !== type || missileTracksProjectile(projectile.id)) continue;
      const position = projectileWorldPosition(projectile, state, projectileUpdateScratch.candidatePosition);
      const distance = position.distanceToSquared(start);
      if (distance >= closestDistance) continue;
      closest = projectile;
      closestDistance = distance;
    }
    return closest;
  }

  function launchMissile({
    nuclear = false,
    nowMs = performance.now(),
    sourceCraftId = null,
    state = liveCombatState,
    eventId = 0,
  } = {}) {
    const model = missileModel(nuclear);
    const head = model.group;
    const start = projectileLaunchSource(nuclear, sourceCraftId);
    head.position.copy(start);
    scene.add(head);
    const initialVelocity = comet.position.clone().sub(start).normalize();
    const projectileType = nuclear ? 'nuke' : 'missile';
    const projectile = closestUntrackedProjectile(projectileType, start, state);
    const trackId = `${projectileType}:${eventId || ++missileTrackSequence}`;
    missiles.push({
      head,
      flare: model.flare,
      nuclear,
      velocity: initialVelocity,
      projectileId: projectile?.id || null,
      trackId,
      stage: projectile?.stage || 'drop',
      lastPlumeAt: nowMs,
    });
    combatVfx.bloom({
      at: start,
      color: nuclear ? 0xff6257 : 0xffb65f,
      size: nuclear ? 2.2 : 1.25,
      lifeMs: nuclear ? 420 : 240,
    });
    emitPooledPlume({
      emitterId: `${trackId}:launch`,
      at: start,
      velocity: initialVelocity.clone().multiplyScalar(-1.25),
      color: nuclear ? 0xff5b4d : 0xff9f42,
      lifeMs: nuclear ? 980 : 650,
      scale: nuclear ? 1.35 : 0.72,
      nuclear,
    });
    if (camDirector) {
      const accepted = camDirector.requestShot('missileTail', {
        durationMs: 7000,
        blendInMs: 180,
        now: nowMs,
      });
      // A second equal-priority missile must not steal the first missile's
      // live camera feed. Nuclear terminal mode may deliberately replace it.
      if (accepted || !activeMissileCameraTrackId || nuclear) activeMissileCameraTrackId = trackId;
    }
    if (trackId === activeMissileCameraTrackId) {
      updateMissileCameraFeed(start, initialVelocity);
    }
  }
  function removeMissileAt(index) {
    const missile = missiles[index];
    if (!missile) return;
    scene.remove(missile.head);
    missile.flare.material.dispose();
    missiles.splice(index, 1);
  }

  function projectileIdIsClaimed(projectileId) {
    for (let index = 0; index < claimedProjectileIds.length; index += 1) {
      if (claimedProjectileIds[index] === projectileId) return true;
    }
    return false;
  }

  function matchProjectileForMissile(missile, type, state) {
    const projectiles = state?.projectiles || [];
    const projectileId = missile.projectileId;
    for (let index = 0; index < projectiles.length; index += 1) {
      const projectile = projectiles[index];
      if (projectile.type !== type || projectile.id !== projectileId || projectileIdIsClaimed(projectile.id)) continue;
      return projectile;
    }

    let nearest = null;
    let nearestDistance = Infinity;
    for (let index = 0; index < projectiles.length; index += 1) {
      const projectile = projectiles[index];
      if (projectile.type !== type || projectileIdIsClaimed(projectile.id)) continue;
      projectileWorldPosition(projectile, state, projectileUpdateScratch.candidatePosition);
      const distance = projectileUpdateScratch.candidatePosition.distanceToSquared(missile.head.position);
      if (distance >= nearestDistance) continue;
      nearest = projectile;
      nearestDistance = distance;
    }
    return nearest;
  }

  let previousEnginePlumeAt = -Infinity;
  function emitLocalEnginePlume(root, anchorLocal, outwardLocal, options) {
    const at = new THREE.Vector3(...anchorLocal);
    const outward = new THREE.Vector3(...outwardLocal);
    root.localToWorld(at);
    root.localToWorld(outward);
    const velocity = outward.sub(at).normalize().multiplyScalar(options.speed);
    emitPooledPlume({
      emitterId: options.emitterId,
      at,
      velocity,
      color: options.color,
      lifeMs: options.lifeMs,
      scale: options.scale,
    });
  }

  function updateEnginePlumes(now) {
    const tier = renderPolicy.qualityTier;
    const cadence = tier === 'high' ? 180 : tier === 'low' ? 320 : 235;
    if (now - previousEnginePlumeAt < cadence) return;
    previousEnginePlumeAt = now;

    const capitalEngines = fallbackShip.info.engineMounts.filter((mount) => Math.abs(mount.x) < 2);
    for (const [index, mount] of capitalEngines.entries()) {
      emitLocalEnginePlume(
        fallbackShip.group,
        [mount.x, mount.y, mount.z],
        [mount.x, mount.y, mount.z - 1.25],
        { emitterId: `capital-drive-${index}`, color: 0xb9f7ff, speed: 2.25, lifeMs: 820, scale: 0.74 },
      );
    }

    for (const [fighterIndex, fighter] of fighters.entries()) {
      if (!fighter.visible) continue;
      const nozzles = tier === 'high' ? [-0.58, 0.58] : [0];
      for (const [nozzleIndex, x] of nozzles.entries()) {
        emitLocalEnginePlume(
          fighter,
          [x, 0.02, -3.12],
          [x, 0.02, -4.25],
          { emitterId: `fighter-${fighterIndex}-drive-${nozzleIndex}`, color: 0x55dfff, speed: 2.85, lifeMs: 680, scale: tier === 'high' ? 0.33 : 0.42 },
        );
      }
    }

    if (bomber.visible) {
      const nozzles = tier === 'low' ? [0] : [-2.1, 2.1];
      for (const [nozzleIndex, x] of nozzles.entries()) {
        emitLocalEnginePlume(
          bomber,
          [x, 0, -2.2],
          [x, 0, -3.55],
          { emitterId: `b2-drive-${nozzleIndex}`, color: 0xd7a8ff, speed: 2.45, lifeMs: 860, scale: 0.58 },
        );
      }
    }
  }

  // ENFORCER is an event-bound axial lance, not an autonomous plasma body.
  const lances = [];
  let mainGunFireHoldUntil = 0;
  let pendingMainGunImpactShot = null;
  function launchOrb(nowMs = performance.now()) {
    const fallback = new THREE.Vector3(0, 2.5, -14); capital.localToWorld(fallback);
    const muzzle = worldAnchor(shipAnchors?.main, fallback);
    for (const [radius, color, opacity] of [[0.22, 0x55e8ff, 0.36], [0.075, 0xffffff, 0.94]]) {
      const lance = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 1, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      scene.add(lance);
      orient(lance, muzzle, comet.position);
      lances.push({ mesh: lance, bornAt: nowMs, life: 1, lifeMs: MAIN_GUN_FIRE_VISUAL_MS, baseOpacity: opacity, radius });
    }
    combatVfx.linkedBeam({ from: muzzle, to: comet.position, color: 0x8dfff3, lifeMs: MAIN_GUN_FIRE_VISUAL_MS, jitter: 0.18 });
    combatVfx.bloom({ at: muzzle, color: 0xeaffff, size: 2.65, lifeMs: 420 });
    mainGunFireHoldUntil = nowMs + MAIN_GUN_FIRE_HOLD_MS;
    if (camDirector) camDirector.requestShot('mainGunAxis', { durationMs: 1500, blendInMs: 300, refresh: true, now: nowMs });
  }

  // ── animation loop ────────────────────────────────────────────────────────
  let W = 1, H = 1, raf = 0, running = false, t0 = 0, previousUpdateAt = 0;
  let sized = false, wantsLoop = false, surfaceActive = false, renderSurface = null;
  const resizeCache = { width: 0, height: 0, dpr: 0 };
  let lastEventSeen = 0;
  let targetScreen = null;
  let currentFlightPhase = null;
  let currentCombatPhase = '';
  let pendingPhaseCameraCue = null;
  const userCamera = {
    active: false,
    blend: 0,
    yaw: .5,
    pitch: .34,
    radius: 28,
    lastInputAt: -Infinity,
  };
  const orbitFocus = new THREE.Vector3();
  const orbitPosition = new THREE.Vector3();
  const orbitBaseQuaternion = new THREE.Quaternion();
  const orbitTargetQuaternion = new THREE.Quaternion();

  function updatePhaseCamera(now, state) {
    const phase = String(state?.phase || 'standby');
    if (phase !== currentCombatPhase) {
      currentCombatPhase = phase;
      pendingPhaseCameraCue = phaseCameraCue(phase);
      if (phase === 'nemp') {
        const nuclearTrack = missiles.find((missile) => missile.nuclear);
        if (nuclearTrack) activeMissileCameraTrackId = nuclearTrack.trackId;
      }
    }
    if (!camDirector || !pendingPhaseCameraCue) return;
    const cue = pendingPhaseCameraCue;
    const accepted = camDirector.requestShot(cue.shot, {
      durationMs: cue.durationMs,
      blendInMs: cue.blendInMs,
      refresh: camDirector.currentShotId === cue.shot,
      now,
    });
    if (accepted) pendingPhaseCameraCue = null;
  }

  function cameraFocusPoint() {
    orbitFocus.copy(capital.position);
    if (comet.visible) orbitFocus.lerp(comet.position, .32);
    else orbitFocus.z -= 11;
    orbitFocus.y = Math.max(1.5, orbitFocus.y + 1.2);
    return orbitFocus;
  }

  function beginCameraOrbit(now = performance.now()) {
    const focus = cameraFocusPoint();
    orbitPosition.subVectors(camera.position, focus);
    const radius = Math.max(8, orbitPosition.length());
    userCamera.radius = Math.min(72, radius);
    userCamera.yaw = Math.atan2(orbitPosition.x, orbitPosition.z);
    userCamera.pitch = Math.asin(THREE.MathUtils.clamp(orbitPosition.y / radius, -.92, .92));
    userCamera.active = true;
    userCamera.blend = 1;
    userCamera.lastInputAt = now;
  }

  function orbitCameraBy(deltaX = 0, deltaY = 0, now = performance.now()) {
    userCamera.yaw -= deltaX * .0052;
    userCamera.pitch = THREE.MathUtils.clamp(userCamera.pitch + deltaY * .0044, -.18, 1.22);
    userCamera.active = true;
    userCamera.blend = 1;
    userCamera.lastInputAt = now;
  }

  function zoomCameraBy(delta = 0, now = performance.now()) {
    userCamera.radius = THREE.MathUtils.clamp(userCamera.radius * Math.exp(delta * .001), 10, 72);
    userCamera.blend = 1;
    userCamera.lastInputAt = now;
  }

  function endCameraOrbit(now = performance.now()) {
    userCamera.active = false;
    userCamera.lastInputAt = now;
  }

  function resetCameraOrbit() {
    userCamera.active = false;
    userCamera.blend = 0;
    userCamera.lastInputAt = -Infinity;
  }

  function applyUserCamera(now, frameScale) {
    const scriptedShot = camDirector && camDirector.currentShotId !== 'commandChase';
    const hold = userCamera.active || now - userCamera.lastInputAt < 2600;
    const targetBlend = scriptedShot ? 0 : hold ? 1 : 0;
    const rate = targetBlend > userCamera.blend ? .16 : .045;
    userCamera.blend += (targetBlend - userCamera.blend) * Math.min(1, rate * frameScale);
    if (userCamera.blend < .001) return;

    const focus = cameraFocusPoint();
    const horizontal = Math.cos(userCamera.pitch) * userCamera.radius;
    orbitPosition.set(
      focus.x + Math.sin(userCamera.yaw) * horizontal,
      focus.y + Math.sin(userCamera.pitch) * userCamera.radius,
      focus.z + Math.cos(userCamera.yaw) * horizontal,
    );
    orbitBaseQuaternion.copy(camera.quaternion);
    camera.position.lerp(orbitPosition, userCamera.blend);
    camera.lookAt(focus);
    orbitTargetQuaternion.copy(camera.quaternion);
    camera.quaternion.copy(orbitBaseQuaternion).slerp(orbitTargetQuaternion, userCamera.blend);
  }

  function resize(w, h) {
    const nextWidth = Math.max(1, Math.round((w ?? canvas.clientWidth) || window.innerWidth));
    const nextHeight = Math.max(1, Math.round((h ?? canvas.clientHeight) || window.innerHeight));
    const dpr = renderPolicy.computeDpr(nextWidth, nextHeight, { minDpr: 0.6, maxDpr: 1.35 });
    const dimensionsChanged = nextWidth !== resizeCache.width || nextHeight !== resizeCache.height;
    const dprChanged = Math.abs(dpr - resizeCache.dpr) > 0.001;
    W = nextWidth;
    H = nextHeight;
    sized = true;
    if (!dimensionsChanged && !dprChanged) return false;
    if (dprChanged) renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    resizeCache.width = W;
    resizeCache.height = H;
    resizeCache.dpr = dpr;
    if (dimensionsChanged) {
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    renderer.getDrawingBufferSize(combatVfxBufferSize);
    lodSelectionDirty = true;
    return true;
  }

  function tmp() { return new THREE.Vector3(); }

  // ── U24 flight lifecycle plumbing ─────────────────────────────────────
  // The flight path joins the live escort position carried by CombatState.
  // There is no autonomous orbit or separate formation clock in this scene.
  function formationFnFor(i) {
    return () => escortWorldSample(fighterEscortSlots[i]) || {
      pos: { x: capital.position.x, y: 4.8, z: capital.position.z - 34 },
      vel: { x: 0, y: 0.8, z: -10 },
    };
  }
  function deckFn(tMs) {
    return {
      pos: { x: -2, y: 3.0, z: 17 },
      vel: { x: 0, y: 0, z: 0 },
    };
  }
  const DECK_DIR = { x: 0, y: 0, z: -1 }; // carrier front = -Z

  function startFlight(kind, nowMs) {
    const mk = kind === 'landing' ? createLandingPath : createLaunchPath;
    const liveStart = escortWorldSample(fighterEscortSlots[0], liveCombatState);
    const heldStart = liveStart || {
      pos: { x: fighters[0].position.x, y: fighters[0].position.y, z: fighters[0].position.z },
      vel: flightLastVel ? { ...flightLastVel } : { x: 0, y: 0, z: -8 },
    };
    const formation = kind === 'landing' ? (() => heldStart) : formationFnFor(0);
    const path = mk({ deck: deckFn, deckDir: DECK_DIR, formation, t0: nowMs });
    if (kind === 'landing') {
      const mid = path.sample(nowMs + 2900); // mid-approach → flyby pedestal beside the glide slope
      flybyAnchor = { x: mid.pos.x + 5, y: mid.pos.y + 1.2, z: mid.pos.z + 2 };
    }
    const cues = kind === 'landing'
      ? [{ at: 0, shot: 'towerCam', dur: 1600 }, { at: 1600, shot: 'flybyCam', dur: 2600 }, { at: 4200, shot: 'deckCam', dur: 1000 }]
      : [
        { at: 0, shot: 'deckCam', dur: 700 },
        { at: 700, shot: 'pilotLaunch', dur: 2320 },
        { at: 3020, shot: 'chaseLaunch', dur: 2180 },
      ];
    flightEvent = { kind, path, cues, fired: new Set(), t0: nowMs };
    flightPrevVel = null;
  }

  // Drives fighters[0] while a flight event is live. Returns true if the
  // caller should skip the authoritative snapshot placement for this one
  // craft. Once the scripted launch/landing completes, control hands back
  // to the current CombatState escort position without an autonomous loop.
  function driveFlightFighter(f, nowMs, t) {
    if (!flightEvent) return false;
    const smp = flightEvent.path.sample(nowMs);
    if (smp.done) { flightEvent = null; return false; }
    // camera cues (phase-scheduled, fired once each)
    if (camDirector) {
      for (const c of flightEvent.cues) {
        const key = c.shot + c.at;
        if (!flightEvent.fired.has(key) && nowMs >= flightEvent.t0 + c.at) {
          const remainingMs = Math.max(0, flightEvent.t0 + c.at + c.dur - nowMs);
          const accepted = remainingMs > 0 && camDirector.requestShot(c.shot, { durationMs: remainingMs, blendInMs: 300, now: nowMs });
          if (accepted) flightEvent.fired.add(key);
        }
      }
    }
    // shot feeds + analytic accel (from consecutive analytic velocities)
    flightLastPos = smp.pos; flightLastVel = smp.vel;
    if (flightPrevVel) {
      const dt = Math.max(0.001, (nowMs - flightPrevT) / 1000);
      flightAccelV = {
        x: (smp.vel.x - flightPrevVel.x) / dt,
        y: (smp.vel.y - flightPrevVel.y) / dt,
        z: (smp.vel.z - flightPrevVel.z) / dt,
      };
    }
    flightPrevVel = smp.vel; flightPrevT = nowMs;
    // Place + orient the fighter. The rebuilt Lancer's authored forward axis
    // is +Z, matching Object3D.lookAt, so no legacy 90° correction is needed.
    f.position.set(smp.pos.x, smp.pos.y, smp.pos.z);
    const sp = Math.hypot(smp.vel.x, smp.vel.y, smp.vel.z);
    if (sp > 0.15) {
      f.lookAt(smp.pos.x + smp.vel.x, smp.pos.y + smp.vel.y, smp.pos.z + smp.vel.z);
      f.rotateZ(bankAngle(smp.vel.z * flightAccelV.x - smp.vel.x * flightAccelV.z, 0.28, 0.018));
    }
    if (f.userData.nh) f.userData.nh.tick(t);
    return true;
  }

  function update(now, state) {
    const t = (now - t0) / 1000;
    const frameScale = previousUpdateAt ? Math.max(0, Math.min(3, (now - previousUpdateAt) / (1000 / 60))) : 1;
    previousUpdateAt = now;
    // Sync the event-spawn clock before processing this frame. A combat feed
    // may resume after seconds offscreen; using the previous render time would
    // make freshly spawned short-lived effects expire in the same frame.
    combatVfx.beginFrame(now);
    if (state) {
      liveCombatState = state;
      syncEscortSlots(state);
    }
    ensureAuthoredCombatAssets(liveCombatState);
    const alive = Boolean(state?.target);
    if (alive && !targetRevealStartedAt) targetRevealStartedAt = now;
    else if (!alive) targetRevealStartedAt = 0;

    if (state?.target) {
      const viewportWidth = state.telemetry?.viewportWidth || 1;
      const viewportHeight = state.telemetry?.viewportHeight || 1;
      screenToCombatWorld(
        state.target.x,
        state.target.y,
        state,
        0.5 + state.target.collisionRisk * 1.6,
        comet.position,
      );
      const tailDirection = cometTailDirection(state.target, viewportWidth, viewportHeight);
      cometTailVector.set(tailDirection.x, tailDirection.y, tailDirection.z);
      comet.quaternion.setFromUnitVectors(cometTailAxis, cometTailVector);
    }
    const cometPos = comet.position.clone();
    const targetReveal = targetRevealStartedAt ? THREE.MathUtils.clamp((now - targetRevealStartedAt) / 420, 0, 1) : 0;
    const revealEase = targetReveal * targetReveal * (3 - 2 * targetReveal);
    const cometProfile = cometVisualProfile(state?.target);
    // Never start from zero: optical sensors see a useful pre-lock signature
    // on the very first target snapshot, then settle over 420 ms.
    const arrival = alive ? 0.62 + revealEase * 0.38 : 0;
    comet.visible = alive && combatEffectsReady;
    const authoredCometScale = cometProfile.scale * (0.9 + revealEase * 0.1);
    const projectedCometPixels = projectedDiameterPx({
      radius: 2.45 * authoredCometScale,
      distance: camera.position.distanceTo(comet.position),
      verticalFovDegrees: camera.fov,
      viewportHeight: H,
    });
    const minimumCometPixels = renderPolicy.qualityTier === 'high' ? 28 : renderPolicy.qualityTier === 'low' ? 20 : 24;
    const readableCometScale = authoredCometScale * Math.max(1, minimumCometPixels / Math.max(1, projectedCometPixels));
    comet.scale.setScalar(Math.min(4.2, readableCometScale));
    comet.userData.rock.material.opacity = cometProfile.rockOpacity * arrival;
    comet.userData.ion.material.opacity = cometProfile.ionOpacity * arrival;
    comet.userData.dust.material.opacity = cometProfile.dustOpacity * arrival;
    comet.userData.coma.material.opacity = cometProfile.comaOpacity * arrival;
    comet.userData.rock.rotation.x += .003 * frameScale;
    comet.userData.rock.rotation.y += .004 * frameScale;

    shieldPulse *= Math.pow(0.9, frameScale);
    shieldMaterial.uniforms.uPulse.value = shieldPulse;
    // Skip even the transparent draw call while no impact is active.
    shieldShell.visible = combatEffectsReady && shieldPulse > 0.008;

    // The bridge is never parked in space. Both stellar volumes pass aft at
    // different rates, providing near/far parallax around every camera shot.
    for (const layer of starLayers) {
      const stellarPosition = layer.geometry.attributes.position;
      const values = stellarPosition.array;
      const advance = layer.userData.drift * frameScale;
      for (let i = 2; i < values.length; i += 3) {
        values[i] += advance;
        if (values[i] > 180) {
          values[i - 2] = (Math.random() - .5) * layer.userData.spreadX;
          values[i - 1] = (Math.random() - .46) * layer.userData.spreadY;
          values[i] = -320;
        }
      }
      stellarPosition.needsUpdate = true;
    }
    const velocityPositions = flightStreaks.geometry.attributes.position;
    const velocityValues = velocityPositions.array;
    const travelBoost = flightEvent || missiles.length ? 1 : 0;
    const streakAdvance = (.28 + travelBoost * .42) * frameScale;
    flightStreaks.material.opacity = renderPolicy.qualityTier === 'low'
      ? .12
      : .24 + travelBoost * .1;
    for (let i = 0; i < streakCount; i += 1) {
      const offset = i * 6;
      velocityValues[offset + 2] += streakAdvance;
      velocityValues[offset + 5] += streakAdvance;
      if (velocityValues[offset + 2] > 180) resetStreak(i);
    }
    velocityPositions.needsUpdate = true;
    approachBlackHole.position.z = Math.min(-155, approachBlackHole.position.z + .0035 * frameScale);
    const gravityPulse = 1 + Math.sin(now * .00022) * .018;
    approachBlackHole.material.uniforms.uTime.value = now * .001;
    approachBlackHole.material.uniforms.uSize.value.set(
      approachBlackHole.userData.baseSize.x * gravityPulse,
      approachBlackHole.userData.baseSize.y * (2 - gravityPulse),
    );
    approachBlackHole.material.uniforms.uIntensity.value = renderPolicy.qualityTier === 'low' ? .82 : 1;

    // The command ship is the stable reference frame. Fighters exist only
    // when the authoritative snapshot reports an escort; otherwise their
    // meshes and trails are absent from the sensor picture.
    capital.position.x = -2;
    fighters.forEach((f, i) => {
      const escort = fighterEscortSlots[i];
      const flightControlled = i === 0 && Boolean(flightEvent);
      f.visible = combatEffectsReady && (Boolean(escort) || flightControlled);
      if (flightControlled && driveFlightFighter(f, now, t)) return;
      if (!escort) {
        fighterTrails[i].pts.length = 0;
        return;
      }
      const sample = escortWorldSample(escort, state);
      f.position.set(sample.pos.x, sample.pos.y, sample.pos.z);
      const speed = Math.hypot(sample.vel.x, sample.vel.y, sample.vel.z);
      if (speed > 0.08) {
        f.lookAt(
          sample.pos.x + sample.vel.x,
          sample.pos.y + sample.vel.y,
          sample.pos.z + sample.vel.z,
        );
      }
      if (f.userData.nh) f.userData.nh.tick(t);
    });

    bomber.visible = combatEffectsReady && Boolean(bomberEscort);
    if (bomberEscort) {
      const sample = escortWorldSample(bomberEscort, state);
      bomber.position.set(sample.pos.x, sample.pos.y, sample.pos.z);
      const speed = Math.hypot(sample.vel.x, sample.vel.y, sample.vel.z);
      if (speed > 0.08) {
        bomber.lookAt(
          sample.pos.x + sample.vel.x,
          sample.pos.y + sample.vel.y,
          sample.pos.z + sample.vel.z,
        );
      }
    }
    updateEnginePlumes(now);
    updatePhaseCamera(now, state);

    // U27 (27b-2): update tactical line vertex buffers from the REAL
    // (post-movement) fighter/capital/comet positions computed just above —
    // reads live objects, invents nothing (charter②).
    if (TACTICAL_LINES) {
      const pos = formationLines.geometry.attributes.position.array;
      let o = 0;
      for (let i = 0; i < fighters.length; i++) {
        const a = fighters[i].position, b = fighters[(i + 1) % fighters.length].position;
        pos[o++] = a.x; pos[o++] = a.y; pos[o++] = a.z;
        pos[o++] = b.x; pos[o++] = b.y; pos[o++] = b.z;
      }
      const cp = capital.position;
      pos[o++] = cp.x; pos[o++] = cp.y + 1; pos[o++] = cp.z;
      pos[o++] = fighters[0].position.x; pos[o++] = fighters[0].position.y; pos[o++] = fighters[0].position.z;
      formationLines.geometry.attributes.position.needsUpdate = true;

      const locked = alive && !!state.target.locked;
      lockLine.visible = locked;
      if (locked) {
        const lp = lockLine.geometry.attributes.position.array;
        const cp2 = capital.position;
        lp[0] = cp2.x; lp[1] = cp2.y + 2; lp[2] = cp2.z;
        lp[3] = cometPos.x; lp[4] = cometPos.y; lp[5] = cometPos.z;
        lockLine.geometry.attributes.position.needsUpdate = true;
        lockLine.computeLineDistances();
      }
    }

    // Weapon VFX and camera shots consume the same ordered CombatState event
    // stream as the radar and battle feed. No periodic fire and no random
    // camera cut exists in this renderer.
    for (const event of state?.events || []) {
      if (event.id <= lastEventSeen) continue;
      lastEventSeen = event.id;
      const eventAgeMs = Math.max(0, Number(state?.now || event.at) - Number(event.at || 0));
      const eventTtlMs = event.type === 'weapon:charge'
        ? (Number(event.durationMs) || 4500) + 900
        : event.type === 'flight:launch' || event.type === 'flight:landing'
          ? 7000
          : 2600;
      // Dynamic imports and hidden HUD modes can deliver an older snapshot.
      // Advance the event cursor, but never replay a long-expired flash,
      // explosion or camera cut after the scene becomes visible again.
      if (eventAgeMs > eventTtlMs) continue;
      if (event.type === 'flight:launch' || event.type === 'flight:landing') {
        const kind = event.type.split(':')[1];
        startFlight(kind, now - eventAgeMs);
      } else if (event.type === 'target:acquired' && alive) {
        combatVfx.bloom({ at: cometPos, color: 0x8ff5ff, size: 2.2, lifeMs: 320 });
      } else if (event.type === 'fleet:damage') {
        shieldPulse = 1;
        shieldMaterial.uniforms.uPulse.value = shieldPulse;
        shieldShell.visible = true;
        // fleet:damage currently carries no impact coordinates. Its source is
        // the tracked threat's near-blast, so aim the response at that real
        // scene direction and account for the shell's ellipsoid scale.
        shieldWorldHitDirection.copy(comet.position).sub(capital.position);
        if (shieldWorldHitDirection.lengthSq() < 0.0001) shieldWorldHitDirection.set(0, 0.08, -1);
        shieldWorldHitDirection.normalize();
        shieldHitDirection.copy(shieldWorldHitDirection);
        shieldHitDirection.set(
          shieldHitDirection.x / shieldShell.scale.x,
          shieldHitDirection.y / shieldShell.scale.y,
          shieldHitDirection.z / shieldShell.scale.z,
        );
        if (shieldHitDirection.lengthSq() < 0.0001) shieldHitDirection.set(0, 0.08, -1);
        shieldHitDirection.normalize();
        shieldWorldImpact.copy(shieldHitDirection).multiplyScalar(5.25);
        shieldShell.localToWorld(shieldWorldImpact);
        const shieldWorldRadius = shieldWorldImpact.distanceTo(capital.position);
        combatVfx.shieldArc({
          center: capital.position,
          hitDirection: shieldWorldHitDirection,
          radius: shieldWorldRadius,
          color: 0x70ddff,
          lifeMs: 680,
        });
        combatVfx.bloom({
          at: shieldWorldImpact,
          color: 0xd9fbff,
          size: 2.8,
          lifeMs: 420,
        });
        const scar = damageScars[damageScarIndex % damageScars.length];
        damageScarIndex += 1;
        scar.visible = true;
        scar.material.opacity = Math.min(0.72, scar.material.opacity + 0.36);
        const hits = Math.min(Number(event.count) || 1, fighters.length);
        for (let i = 0; i < hits; i += 1) boom(fighters[i].position.clone(), 0.52, 0xff874f);
      } else if (event.type === 'weapon:charge' && event.weapon === 'nuke' && alive) {
        const chargeRemainingMs = (Number(event.durationMs) || 3000) - eventAgeMs;
        if (chargeRemainingMs <= 0) continue;
        for (const fighter of fighters) {
          if (!fighter.visible) continue;
          combatVfx.linkedBeam({
            from: fighter.position,
            to: cometPos,
            color: 0xff5f69,
            lifeMs: chargeRemainingMs,
            jitter: 0.035,
          });
        }
        if (bomber.visible) combatVfx.bloom({ at: bomber.position, color: 0xe1b3ff, size: 1.4, lifeMs: 520 });
        camDirector?.requestShot('nukeEscort', {
          durationMs: chargeRemainingMs,
          blendInMs: 320,
          refresh: true,
          now,
        });
      } else if (event.type === 'weapon:charge' && event.weapon === 'enforcer' && alive) {
        const chargeRemainingMs = (Number(event.durationMs) || 4500) - eventAgeMs;
        if (chargeRemainingMs <= 0) continue;
        const fallback = new THREE.Vector3(0, 2.5, -14);
        capital.localToWorld(fallback);
        const muzzle = worldAnchor(shipAnchors?.main, fallback);
        combatVfx.charge({
          at: muzzle,
          color: 0x72fff0,
          lifeMs: chargeRemainingMs,
          radius: 3.6,
        });
        const chargeTip = muzzle.clone().add(
          cometPos.clone().sub(muzzle).normalize().multiplyScalar(7.5),
        );
        combatVfx.linkedBeam({
          from: muzzle,
          to: chargeTip,
          color: 0xa5fff4,
          lifeMs: chargeRemainingMs,
          jitter: 0.16,
        });
        combatVfx.bloom({ at: muzzle, color: 0xe9ffff, size: 2.7, lifeMs: chargeRemainingMs });
        camDirector?.requestShot('mainGunBroadside', { durationMs: chargeRemainingMs, blendInMs: 420, now });
      } else if (event.type === 'weapon:fire') {
        // The event is authoritative even if the tracked target leaves the
        // viewport during a long charge. Use the last resolved comet pose so
        // the muzzle flash and weapon camera are never silently discarded.
        if (event.weapon === 'cannon') {
          const fallback = new THREE.Vector3().setFromMatrixPosition(capital.matrixWorld);
          fallback.y = 2;
          const anchors = [
            worldAnchor(shipAnchors?.ciwsPort, fallback),
            worldAnchor(shipAnchors?.ciwsStarboard, fallback),
          ];
          const rounds = renderPolicy.qualityTier === 'low' ? 5 : 10;
          for (let round = 0; round < rounds; round += 1) {
            const phase = (round / rounds - 0.5) * 0.16;
            const target = cometPos.clone().add(tmp().set(Math.sin(phase) * 3, Math.cos(phase * 2), phase * 12));
            fireTracer(anchors[round % anchors.length], target, round % 2 ? 0xffc878 : 0x9ae5ff);
          }
          anchors.forEach((anchor, index) => {
            const color = index ? 0xffc878 : 0x9ae5ff;
            combatVfx.linkedBeam({ from: anchor, to: cometPos, color, lifeMs: 560, jitter: 0.1 });
            combatVfx.bloom({ at: anchor, color, size: 0.82, lifeMs: 340 });
          });
          camDirector?.requestShot('ciwsTurret', { durationMs: 1800, blendInMs: 260, refresh: true, now });
        } else if (event.weapon === 'missile') {
          launchMissile({
            nowMs: now,
            sourceCraftId: event.craft || null,
            state,
            eventId: event.id,
          });
        } else if (event.weapon === 'nuke') {
          launchMissile({ nuclear: true, nowMs: now, state, eventId: event.id });
        } else if (event.weapon === 'enforcer') {
          launchOrb(now);
        }
      } else if (event.type === 'weapon:impact') {
        const scale = event.weapon === 'nuke' ? 4.8 : event.weapon === 'enforcer' ? 3.2 : 1.4;
        const color = event.weapon === 'nuke' ? 0xff5148 : event.weapon === 'enforcer' ? 0xbfffe6 : 0xffe6b0;
        boom(cometPos.clone(), scale, color);
        combatVfx.bloom({ at: cometPos, color, size: scale * 2.1, lifeMs: event.weapon === 'nuke' ? 820 : 420 });
        combatVfx.fireSmoke({
          at: cometPos,
          velocity: event.weapon === 'enforcer' ? [0, 1.4, 0] : [0, 0.75, 0],
          color,
          lifeMs: event.weapon === 'nuke' ? 2100 : 980,
          scale: event.weapon === 'nuke' ? 3.2 : event.weapon === 'enforcer' ? 1.8 : 0.9,
          nuclear: event.weapon === 'nuke',
        });
        const impactShot = { durationMs: event.weapon === 'nuke' ? 1800 : 1050, blendInMs: 110 };
        if (camDirector && event.weapon === 'enforcer' && now < mainGunFireHoldUntil) {
          pendingMainGunImpactShot = {
            ...impactShot,
            notBefore: mainGunFireHoldUntil,
            expiresAt: mainGunFireHoldUntil + impactShot.durationMs + 500,
          };
        } else {
          camDirector?.requestShot('impactOrbit', { ...impactShot, now });
        }
      } else if (event.type === 'target:destroyed') {
        boom(cometPos.clone(), 5.2, 0xffe6b0);
        combatVfx.fireSmoke({ at: cometPos, velocity: [0, 1.1, 0], color: 0xffb05c, lifeMs: 2400, scale: 3.4, nuclear: true });
      }
    }

    if (pendingMainGunImpactShot && now >= pendingMainGunImpactShot.notBefore) {
      const { notBefore, expiresAt, ...shot } = pendingMainGunImpactShot;
      if (now > expiresAt || !camDirector) {
        pendingMainGunImpactShot = null;
      } else if (camDirector.requestShot('impactOrbit', { ...shot, now })) {
        // Equal-priority impact shots may briefly reject one another. Keep
        // retrying until accepted, but never replay a stale cut after a long
        // offscreen/device pause (expiresAt bounds that recovery window).
        pendingMainGunImpactShot = null;
      }
    }

    for (let i = lances.length - 1; i >= 0; i -= 1) {
      const lance = lances[i];
      lance.life = Math.max(0, 1 - (now - lance.bornAt) / lance.lifeMs);
      lance.mesh.material.opacity = Math.max(0, lance.life * lance.baseOpacity);
      if (lance.life <= 0) {
        scene.remove(lance.mesh);
        lance.mesh.geometry.dispose();
        lance.mesh.material.dispose();
        lances.splice(i, 1);
      }
    }

    // advance tracers
    for (let i = tracers.length - 1; i >= 0; i--) {
      // Keep the alternating CIWS barrage readable for roughly two thirds of
      // a second at 60 Hz. The former ten-frame flash was easy to miss even
      // though its camera shot remained active for 1.8 seconds.
      const tr = tracers[i]; tr.life -= 0.025 * frameScale;
      tr.m.material.opacity = Math.max(0, tr.life);
      if (tr.life <= 0) { scene.remove(tr.m); tr.m.material.dispose(); tracers.splice(i, 1); }
    }
    // Missiles mirror the authoritative 2D projectile snapshot exactly. The
    // renderer does not invent its own guidance curve, impact time or speed.
    claimedProjectileIds.length = 0;
    for (let i = 0; i < missiles.length; i += 1) {
      const ms = missiles[i];
      const type = ms.nuclear ? 'nuke' : 'missile';
      const projectile = matchProjectileForMissile(ms, type, state);
      if (!projectile) {
        removeMissileAt(i);
        i -= 1;
        continue;
      }
      claimedProjectileIds.push(projectile.id);
      ms.projectileId = projectile.id;
      const p = projectileWorldPosition(projectile, state, projectileUpdateScratch.position);
      const velocity = projectileUpdateScratch.velocity.subVectors(p, ms.head.position);
      ms.head.position.copy(p);
      if (velocity.lengthSq() > 1e-6) {
        ms.velocity.copy(velocity);
        ms.head.quaternion.setFromUnitVectors(missileForward, velocity.normalize());
      }
      const engineScale = projectile.stage === 'drop' ? 0.18 : projectile.stage === 'ignite' ? 0.82 : 1;
      ms.flare.scale.setScalar(engineScale);
      if (projectile.stage !== ms.stage) {
        ms.stage = projectile.stage;
        if (projectile.stage === 'ignite') {
          combatVfx.bloom({
            at: p,
            color: ms.nuclear ? 0xff6a5f : 0xffcf78,
            size: ms.nuclear ? 2.5 : 1.45,
            lifeMs: ms.nuclear ? 460 : 280,
          });
        }
      }
      if (ms.trackId === activeMissileCameraTrackId) {
        updateMissileCameraFeed(p, ms.velocity);
      }
      const plumeCadence = renderPolicy.qualityTier === 'high' ? 95 : renderPolicy.qualityTier === 'low' ? 175 : 130;
      if (projectile.stage !== 'drop' && now - ms.lastPlumeAt >= plumeCadence) {
        ms.lastPlumeAt = now;
        const exhaustVelocity = projectileUpdateScratch.exhaustVelocity;
        if (ms.velocity.lengthSq() > 1e-6) {
          exhaustVelocity.copy(ms.velocity).normalize().multiplyScalar(ms.nuclear ? -2.2 : -1.65);
        } else {
          exhaustVelocity.set(0, 0.15, 0.5);
        }
        emitPooledPlume({
          emitterId: `${ms.trackId}:engine`,
          at: p,
          velocity: exhaustVelocity,
          color: ms.nuclear ? 0xff584f : 0xffa85a,
          lifeMs: ms.nuclear ? 1050 : 720,
          scale: ms.nuclear ? 1.15 : 0.62,
          nuclear: false,
        });
      }
    }
    // explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i]; ex.life -= 0.05 * frameScale;
      const age = 1 - ex.life;
      const sc = age * 7.5 * ex.scale + 1.4;
      ex.s.scale.set(sc, sc, 1);
      ex.s.material.opacity = Math.max(0, ex.life);
      const haloScale = sc * (1.7 + age * 0.8);
      ex.halo.scale.set(haloScale, haloScale, 1);
      ex.halo.material.opacity = Math.max(0, ex.life * 0.34);
      ex.ring.lookAt(camera.position);
      ex.ring.scale.setScalar(1 + age * 8 * ex.scale);
      ex.ring.material.opacity = Math.max(0, ex.life * 0.72);
      for (let j = 0; j < ex.velocities.length; j += 1) {
        const v = ex.velocities[j];
        fragmentEuler.set(age * (j + 1), age * 2, age * 0.7);
        fragmentMatrix.makeRotationFromEuler(fragmentEuler);
        fragmentMatrix.setPosition(v.x * age * ex.scale, v.y * age * ex.scale - age * age, v.z * age * ex.scale);
        ex.fragments.setMatrixAt(j, fragmentMatrix);
      }
      ex.fragments.instanceMatrix.needsUpdate = true;
      ex.fragments.material.opacity = Math.max(0, ex.life * 0.9);
      if (ex.life <= 0) {
        scene.remove(ex.s, ex.halo, ex.ring, ex.fragments);
        ex.s.material.dispose(); ex.halo.material.dispose(); ex.ring.geometry.dispose(); ex.ring.material.dispose(); ex.fragments.material.dispose();
        explosions.splice(i, 1);
      }
    }

    // camera: director-driven shot state machine when ?combatcam=director is
    // set (ROADMAP §4 V14); otherwise the original hardcoded sway, unchanged.
    if (camDirector) {
      camDirector.update(now);
    } else {
      camera.position.copy(CAM);
      camera.lookAt(comet.position.x * 0.25, 2, -2);
    }
    applyUserCamera(now, frameScale);

    camera.updateMatrixWorld();
    combatVfx.update(now, camera, combatVfxBufferSize.y || Math.max(1, H * (resizeCache.dpr || 1)));
    updateProceduralLods(H, now);
    comet.updateMatrixWorld();
    if (comet.visible) {
      const projected = comet.getWorldPosition(new THREE.Vector3()).project(camera);
      targetScreen = {
        x: (projected.x * 0.5 + 0.5) * W,
        y: (-projected.y * 0.5 + 0.5) * H,
        visible: projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1,
        locked: Boolean(state?.target?.locked),
      };
    } else {
      targetScreen = null;
    }
    currentFlightPhase = flightEvent ? flightEvent.path.sample(now).phase : null;

    // V18 Phase 2: run after the camera update above so the trail ribbons
    // read this frame's freshly-moved camera.position rather than last
    // frame's (they read fighters' matrixWorld, which three.js only
    // refreshes during renderer.render() right after this function returns —
    // same one-frame-lag characteristic the existing tracer/laser firing
    // code above already has, kept consistent rather than special-cased).
    // U28 28d (2026-07-14): the near-field dust-parallax streaks and the
    // sun-glare/lens-ghost sprites (former V18 Phase 2 item 2 / Phase 3)
    // were the stray floating semi-transparent elements visible drifting
    // behind Combat View in the owner's screenshot — deleted outright, not
    // flag-gated ("station master: these should never have existed").
    if (renderPolicy.qualityTier !== 'low') updateTrails(now);
  }

  const proceduralBootScene = new THREE.Scene();
  const proceduralBootTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
  });
  let proceduralBootObjects = null;
  let proceduralBootIndex = 0;
  function collectProceduralBootObjects() {
    const representatives = [];
    const seenMaterials = new Set();
    const add = (object) => {
      if (!object?.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every((material) => seenMaterials.has(material))) return;
      materials.forEach((material) => seenMaterials.add(material));
      const clone = object.clone(false);
      clone.visible = true;
      clone.frustumCulled = false;
      representatives.push(clone);
    };
    add(starLayers[0]);
    add(approachBlackHole);
    fallbackShip.group.traverse((child) => { if (child.isMesh && child.visible) add(child); });
    return representatives;
  }

  function warmNextProceduralObject() {
    if (!proceduralBootObjects) proceduralBootObjects = collectProceduralBootObjects();
    const object = proceduralBootObjects[proceduralBootIndex];
    if (!object) return true;
    proceduralBootIndex += 1;
    proceduralBootScene.add(object);
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(proceduralBootTarget);
      renderer.render(proceduralBootScene, camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
      proceduralBootScene.remove(object);
    }
    return proceduralBootIndex >= proceduralBootObjects.length;
  }

  function resetProceduralWarmup() {
    proceduralBootIndex = 0;
    proceduralBootObjects = null;
    proceduralFramePresented = false;
  }

  function renderFrame(now, state) {
    if (!t0) t0 = now;
    const renderStartedAt = performance.now();
    update(now, state);
    if (!proceduralFramePresented && !warmNextProceduralObject()) {
      renderSurface?.reportFrame(performance.now() - renderStartedAt, {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      return false;
    }
    renderer.render(scene, camera);
    if (!proceduralFramePresented) {
      proceduralFramePresented = true;
      markPerformanceStage('proceduralFrame');
      queueMicrotask(beginDeferredCombatWarmup);
    }
    renderSurface?.reportFrame(performance.now() - renderStartedAt, {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    return true;
  }

  function loop(now) {
    renderFrame(now, null);
    if (running) raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running || !surfaceActive) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  markPerformanceStage('sceneBuilt');
  const webglLifecycle = createWebGLContextLifecycle({
    id: lifecycleId,
    canvas,
    onLost() {
      contextReady = false;
      surfaceActive = false;
      resetProceduralWarmup();
      stopLoop();
      invalidateAuthoredAssetsForContextLoss();
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      surfaceActive = budgetActive;
      if (sized) {
        resizeCache.dpr = 0;
        resize();
      }
      if (wantsLoop) startLoop();
    },
    onFallback() {
      contextReady = false;
      surfaceActive = false;
      resetProceduralWarmup();
      stopLoop();
    },
  });
  if (!webglLifecycle.canInitialize) {
    sceneDisposed = true;
    authoredWarmGeneration += 1;
    webglLifecycle.dispose();
    authoredAssetLoader.dispose();
    combatVfx.dispose();
    proceduralBootTarget.dispose();
    disposeThreeScene(scene, renderer);
    return null;
  }

  renderSurface = renderCoordinator.register({
    id: lifecycleId,
    element: canvas,
    observe: false,
    cost: 'high',
    targetFps: 60,
    onResume() {
      budgetActive = true;
      surfaceActive = contextReady;
      if (wantsLoop) startLoop();
    },
    onPause() {
      budgetActive = false;
      surfaceActive = false;
      stopLoop();
    },
    onResize() {
      if (sized) resize();
    },
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
      const pressureMode = nextPolicy.qualityTier === 'low';
      // The coordinator emits policy and resize synchronously while this
      // candidate canvas is still detached. Wait for the CIC viewport to pass
      // its exact CSS dimensions instead of allocating an entire-window buffer
      // here and reallocating it again on the first visible frame.
      if (sized) resize(W, H);
      combatVfx.setQuality(nextPolicy.qualityTier);
      syncCombatEffectsVisibility();
      for (const layer of starLayers) {
        layer.material.opacity = pressureMode
          ? layer.userData.baseOpacity * .52
          : layer.userData.baseOpacity;
      }
      flightStreaks.material.opacity = pressureMode ? .12 : .24;
      if (shipModelStatus === 'procedural-fallback') ensureShipSurfaceTextures();
      applyShipSurfaceQuality();
      applyAuthoredGeometryQuality();
      syncShipAssetVisibility();
      syncFighterAssetVisibility();
      ensureAuthoredCombatAssets(liveCombatState);
      lodSelectionDirty = true;
      if (sized) updateProceduralLods(H, performance.now(), true);
    },
    onDispose() {
      sceneDisposed = true;
      authoredWarmGeneration += 1;
      webglLifecycle.dispose();
      authoredAssetLoader.dispose();
      combatVfx.dispose();
      proceduralBootTarget.dispose();
      disposeThreeScene(scene, renderer);
    },
  });
  markPerformanceStage('surfaceRegistered');

  return {
    available() {
      return contextReady && surfaceActive && !sceneDisposed;
    },
    start() {
      wantsLoop = true;
      startLoop();
    },
    stop() {
      wantsLoop = false;
      stopLoop();
    },
    resize,
    beginCameraOrbit,
    orbitCameraBy,
    zoomCameraBy,
    endCameraOrbit,
    resetCameraOrbit,
    // state: optional authoritative combat snapshot (see main.js getBattleSnapshot()).
    // Drives targets, escorts, projectiles, weapon events, and flight lifecycle.
    renderOnce(now = performance.now(), state = null) {
      if (!surfaceActive) return;
      renderFrame(now, state);
    },
    getPresentationState() {
      return Object.freeze({
        hasPresented: proceduralFramePresented,
        shipModelStatus,
        fighterModelStatus,
        qualityTier: renderPolicy.qualityTier,
        cameraShot: camDirector?.currentShotId || 'commandChase',
        combatPhase: currentCombatPhase || 'standby',
        flightKind: flightEvent?.kind || null,
        flightPhase: currentFlightPhase,
        targetScreen: targetScreen ? Object.freeze({ ...targetScreen }) : null,
      });
    },
    getDiagnostics() {
      return Object.freeze({
        hasPresented: proceduralFramePresented,
        shipModelStatus,
        fighterModelStatus,
        shipTextureStatus,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        qualityTier: renderPolicy.qualityTier,
        contextReady,
        cameraShot: camDirector?.currentShotId || 'commandChase',
        flightKind: flightEvent?.kind || null,
        flightPhase: currentFlightPhase,
        targetScreen: targetScreen ? Object.freeze({ ...targetScreen }) : null,
        cameraInteractive: true,
        cameraManual: userCamera.blend > .05,
        activeEscortCount: liveCombatState?.escorts?.length || 0,
        authoredAssets: Object.freeze({
          ship: shipAssetHandle?.diagnostics || null,
          fighter: fighterAssetHandle?.diagnostics || null,
          dataSaver: dataSaverEnabled(),
        }),
        vfx: Object.freeze(combatVfx.getDiagnostics()),
        proceduralLod: Object.freeze({
          capital: capitalLodTier,
          fighters: Object.freeze([...fighterLodTiers]),
        }),
        lastEventSeen,
      });
    },
    destroy() {
      wantsLoop = false;
      stopLoop();
      renderSurface.dispose();
    },
  };
}

// ── opt-in live harness (production-reachable, zero impact otherwise) ───────
// Visit /?combat=topdown to preview the top-down combat scene full-screen.
function maybeMountHarness() {
  try {
    if (!/[?&]combat=topdown\b/.test(location.search)) return;
  } catch (e) { return; }
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#04060a';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;height:100%;display:block';
  const close = document.createElement('button');
  close.textContent = 'CLOSE COMBAT LAB';
  close.style.cssText = "position:absolute;top:14px;right:14px;z-index:1;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;color:#bfe3ff;background:rgba(6,12,20,.7);border:1px solid rgba(150,210,255,.4);padding:8px 12px;cursor:pointer";
  const label = document.createElement('div');
  label.textContent = 'CIC SENSOR FUSION · 舰桥传感融合 · WEBGL';
  label.style.cssText = "position:absolute;top:16px;left:16px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.34em;color:#aee0ff;pointer-events:none";
  wrap.append(cv, close, label);
  document.body.appendChild(wrap);
  const scene = createTopdownCombat({ canvas: cv, surfaceId: 'lab:topdown-combat' });
  if (!scene) { label.textContent = 'WebGL unavailable'; return; }
  const fit = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
  fit();
  scene.start();
  close.addEventListener('click', () => { scene.destroy(); wrap.remove(); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeMountHarness, { once: true });
  else maybeMountHarness();
}
