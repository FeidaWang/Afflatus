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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWeaponCameraDirector } from '../combat/weaponCameraDirector.js';
import { fovForAccel, bankAngle, chaseCamPose } from '../combat/cameraMath.js';
import { createLaunchPath, createLandingPath } from '../combat/flightPath.js';
import {
  createAfflatusInterceptorPrototype,
  createAfflatusVanguard,
} from './afflatusVanguard.js';
import { projectedDiameterPx, selectProceduralLod } from '../lib/proceduralLod.js';
import { getRenderBudgetCoordinator } from '../lib/renderBudgetCoordinator.js';
import {
  canAcquireWebGLContext,
  createWebGLContextLifecycle,
  disposeThreeScene,
} from '../lib/webglLifecycle.js';

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
  return t;
}

function distantBlackHoleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const halo = ctx.createRadialGradient(cx, cy, 72, cx, cy, 246);
  halo.addColorStop(0, 'rgba(255,232,183,.2)');
  halo.addColorStop(.3, 'rgba(215,177,113,.13)');
  halo.addColorStop(.62, 'rgba(111,169,205,.075)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-.08);
  for (let i = 18; i >= 0; i -= 1) {
    const u = i / 18;
    const diskGradient = ctx.createLinearGradient(-330, 0, 330, 0);
    diskGradient.addColorStop(0, `rgba(113,178,218,${.028 + (1 - u) * .034})`);
    diskGradient.addColorStop(.34, `rgba(219,190,137,${.045 + (1 - u) * .065})`);
    diskGradient.addColorStop(.56, `rgba(255,244,214,${.08 + (1 - u) * .11})`);
    diskGradient.addColorStop(1, `rgba(173,124,73,${.018 + (1 - u) * .03})`);
    ctx.strokeStyle = diskGradient;
    ctx.lineWidth = 2.4 + i * .72;
    ctx.beginPath();
    ctx.moveTo(-338, 8 + i * .24);
    ctx.bezierCurveTo(-164, -40 - i * .45, 138, 42 + i * .28, 342, -4 - i * .16);
    ctx.stroke();
  }

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, 82, 0, Math.PI * 2);
  ctx.fill();

  // The upper arc is the lensed far side of the disc, not an orbital ring.
  for (let i = 0; i < 8; i += 1) {
    ctx.strokeStyle = `rgba(${205 + i * 6},${213 + i * 5},${202 + i * 6},${.04 + i * .021})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 1, 87 + i * 2.2, 103 + i * 1.2, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  for (let i = 0; i < 7; i += 1) {
    ctx.strokeStyle = `rgba(${207 + i * 6},${198 + i * 7},${166 + i * 10},${.05 + i * .024})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 3, 184 + i * 3, 28 + i * 1.2, 0, .08, Math.PI - .08);
    ctx.stroke();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let surfaceSequence = 0;

export function createTopdownCombat({ canvas, surfaceId }) {
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
      mainGunAxis: {
        priority: 3,
        compute() {
          const p = comet.position;
          return {
            pos: { x: capital.position.x, y: 8, z: capital.position.z - 6 },
            look: { x: p.x, y: p.y ?? 1.5, z: p.z },
          };
        },
      },
      missileTail: {
        priority: 4,
        compute(t) {
          const p = missileLastPos || capital.position;
          const v = missileLastVel || new THREE.Vector3(0, 0, -1);
          const dir = v.clone().normalize();
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
          };
        },
      },
      // ── U24 (24b) flight-event shots. All four read flightLastPos/Vel
      //    (fed by the update() flight sampler) via closure — the same
      //    live-object pattern as missileTail/mainGunAxis above. ──────────
      deckCam: {           // deck-edge pedestal watching the catapult run / touchdown
        priority: 6,
        blendInMs: 250,
        compute() {
          const dp = capital.position;
          const f = flightLastPos || { x: dp.x, y: 3, z: dp.z - 4 };
          const pos = clampOutsideHull({ x: dp.x + 4.6, y: 3.8, z: dp.z - 1.5 });
          return { pos, look: { x: f.x, y: f.y, z: f.z }, fov: 52 };
        },
      },
      chaseLaunch: {       // tail-chase on the launching fighter — FOV/bank from real accel
        priority: 6,
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
        priority: 6,
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
        priority: 6,
        blendInMs: 300,
        compute() {
          const dp = capital.position;
          const f = flightLastPos || { x: dp.x, y: 3, z: dp.z + 10 };
          return { pos: { x: dp.x + 1.2, y: 7.4, z: dp.z + 4.2 }, look: { x: f.x, y: f.y, z: f.z }, fov: 38 };
        },
      },
      flybyCam: {          // fixed point the fighter sweeps past (classic flyby)
        priority: 6,
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

  // ── lighting ───────────────────────────────────────────────────────────
  // No autonomous nebula, fog or lens treatment: the sensor picture only
  // contains tracked craft, weapons, impacts and a fixed stellar reference.
  scene.add(new THREE.AmbientLight(0x2a3850, 1.4));
  const key = new THREE.DirectionalLight(0xbcd4ff, 1.5); key.position.set(20, 60, 30); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4d7bd6, 0.8); rim.position.set(-30, 20, -30); scene.add(rim);

  const GLOW = glowTexture();
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

  const approachBlackHole = new THREE.Sprite(new THREE.SpriteMaterial({
    map: distantBlackHoleTexture(),
    transparent: true,
    opacity: .88,
    depthWrite: false,
  }));
  approachBlackHole.name = 'AlphardDistantBlackHole';
  approachBlackHole.position.set(34, 24, -218);
  approachBlackHole.scale.set(172, 86, 1);
  approachBlackHole.userData.baseScale = new THREE.Vector2(172, 86);
  scene.add(approachBlackHole);

  // A sparse velocity layer makes forward motion legible without turning the
  // sensor picture into a warp tunnel. Each line occupies its own x/y/z
  // coordinate, so the streaks retain depth rather than forming a flat sheet.
  const streakCount = 74;
  const streakPositions = new Float32Array(streakCount * 6);
  function resetStreak(index, initial = false) {
    const offset = index * 6;
    const z = initial ? -310 + Math.random() * 480 : -310;
    const length = 1.4 + Math.random() * 5.4;
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
    opacity: .2,
    depthWrite: false,
  }));
  flightStreaks.name = 'ForwardVelocityReferences';
  scene.add(flightStreaks);

  // ── materials ────────────────────────────────────────────────────────────
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, metalness: 0.6, roughness: 0.7, emissive: 0x3a1206, emissiveIntensity: 0.5 });

  // ── AFFLATUS VANGUARD command ship. The procedural version is a genuine
  //    full-silhouette fallback while the bounded GLB streams in; the old
  //    cylinder/sphere/box placeholder no longer exists on this path. ──────
  const capital = new THREE.Group();
  let shipAnchors = null;
  let shipModelStatus = 'procedural';
  let authoredShip = null;
  const fallbackShip = createAfflatusVanguard(THREE, { detail: 'full', forwardNegativeZ: true });
  fallbackShip.group.name = 'VanguardProceduralFallback';
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
  const shieldShell = new THREE.Mesh(
    new THREE.SphereGeometry(5.25, 28, 18),
    new THREE.MeshBasicMaterial({ color: 0x70ddff, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shieldShell.scale.set(1.0, 0.23, 1.45);
  capital.add(shieldShell);
  let shieldPulse = 0;
  const damageScars = [];
  for (const [x, z] of [[-1.65, -0.9], [1.9, 0.7], [-0.4, 2.25]]) {
    const scar = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x080000, transparent: true, opacity: 0, depthWrite: false }));
    scar.position.set(x, 0.78, z);
    scar.scale.set(1.6, 1.6, 1);
    capital.add(scar);
    damageScars.push(scar);
  }
  let damageScarIndex = 0;
  new GLTFLoader().load(
    '/assets/combat/afflatus-command.glb',
    (gltf) => {
      fallbackShip.group.visible = false;
      const model = gltf.scene;
      model.name = 'AfflatusCommandGLB';
      model.scale.setScalar(1);
      capital.add(model);
      authoredShip = model;
      shipAnchors = {
        main: model.getObjectByName('Muzzle_Main'),
        ciwsPort: model.getObjectByName('Muzzle_CIWS_Port'),
        ciwsStarboard: model.getObjectByName('Muzzle_CIWS_Starboard'),
        missile: model.getObjectByName('MissileBay'),
      };
      shipModelStatus = 'glb';
      applyAuthoredGeometryQuality();
    },
    undefined,
    () => {
      shipAnchors = null;
      shipModelStatus = 'fallback';
    },
  );

  // ── LANCER interceptors: six shared surface buffers per craft, complete
  //    top/bottom volume, canopy, gun rails, wing roots and vectoring drives.
  const fighterPrototype = createAfflatusInterceptorPrototype(THREE);
  function makeFighter() {
    const fighter = fighterPrototype.group.clone(true);
    fighter.scale.setScalar(0.43);
    scene.add(fighter);
    return fighter;
  }
  const fighters = [makeFighter(), makeFighter(), makeFighter()];
  fighters.forEach((fighter) => { fighter.visible = false; });
  let liveCombatState = null;
  let capitalLodTier = 'medium';
  const fighterLodTiers = fighters.map(() => 'medium');

  function escortWorldSample(escort, state = liveCombatState) {
    if (!escort || !state) return null;
    const viewportWidth = state.telemetry?.viewportWidth || 1;
    const viewportHeight = state.telemetry?.viewportHeight || 1;
    return {
      pos: {
        x: (escort.x / viewportWidth - 0.5) * 52,
        y: escort.type === 'b2' ? 1.8 : 1.25,
        z: -28 + (escort.y / viewportHeight) * 45,
      },
      vel: {
        x: (escort.vx || 0) / viewportWidth * 52 * 60,
        y: 0,
        z: (escort.vy || 0) / viewportHeight * 45 * 60,
      },
    };
  }

  function projectileWorldPosition(projectile, state = liveCombatState) {
    if (!projectile || !state) return null;
    const viewportWidth = state.telemetry?.viewportWidth || 1;
    const viewportHeight = state.telemetry?.viewportHeight || 1;
    return new THREE.Vector3(
      (projectile.x / viewportWidth - 0.5) * 52,
      1.35,
      -28 + (projectile.y / viewportHeight) * 45,
    );
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

  function applyAuthoredGeometryQuality() {
    if (!authoredShip) return;
    const low = renderPolicy.qualityTier === 'low';
    authoredShip.traverse((child) => {
      if (child.isMesh && ['MachinedEdges', 'MechanicalRecesses'].includes(child.name)) {
        child.visible = !low;
      }
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
  function updateProceduralLods(viewportHeight) {
    capital.updateMatrixWorld(true);
    for (const fighter of fighters) fighter.updateMatrixWorld(true);
    capitalLodTier = selectObjectLod(fallbackShip.group, 7.8, capitalLodTier, viewportHeight);
    applySurfaceTier(fallbackShip.group, capitalLodTier, capitalLodRules);
    fighters.forEach((fighter, index) => {
      fighterLodTiers[index] = selectObjectLod(fighter, 4.5, fighterLodTiers[index], viewportHeight);
      applySurfaceTier(fighter, fighterLodTiers[index], fighterLodRules);
    });
  }
  applySurfaceTier(fallbackShip.group, capitalLodTier, capitalLodRules);
  fighters.forEach((fighter) => applySurfaceTier(fighter, 'medium', fighterLodRules));

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
  // It enters the optical picture only after the real target-acquisition
  // event. The old beige fragments + polyline tail looked like an unexplained
  // yellow marker and a wire hanging through space, so the target is now a
  // dark irregular body with a sparse, circular-point dust wake.
  const comet = new THREE.Group();
  let cometHP = 1;
  let targetRevealStartedAt = 0;
  {
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x30373b,
      emissive: 0x071018,
      emissiveIntensity: .34,
      metalness: .04,
      roughness: .96,
      flatShading: true,
      transparent: true,
      opacity: 0,
    });
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), rockMaterial);
    rock.scale.set(1.8, .82, .9);
    comet.add(rock);
    const dustCount = 42;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const u = (i + 1) / dustCount;
      dustPositions[i * 3] = (Math.random() - .5) * (0.3 + u * 2.4);
      dustPositions[i * 3 + 1] = (Math.random() - .5) * (0.2 + u * 1.35);
      dustPositions[i * 3 + 2] = 1.2 + u * u * 22;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      map: GLOW,
      color: 0xa8c5d3,
      size: .58,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      alphaTest: .02,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    comet.add(dust);
    const coma = sprite(0xb8d9e8, 5.6, 0);
    comet.add(coma);
    comet.userData = { rock, dust, coma };
    comet.position.set(-22, 0, -18);
    comet.visible = false;
    scene.add(comet);
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
  function boom(pos, scale = 1, color = 0xffd9a0) {
    const s = sprite(color, 3.2 * scale, 1); s.position.copy(pos); scene.add(s);
    const halo = sprite(color, 6.2 * scale, 0.42); halo.position.copy(pos); scene.add(halo);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.02, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.copy(pos); scene.add(ring);
    const fl = new THREE.PointLight(color, 12, 40); fl.position.copy(pos); scene.add(fl);
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
    explosions.push({ s, halo, ring, fl, fragments, velocities, life: 1, scale });
  }

  const missiles = [];
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
  function launchMissile({ nuclear = false, nowMs = performance.now() } = {}) {
    const model = missileModel(nuclear);
    const head = model.group;
    const fallback = new THREE.Vector3().setFromMatrixPosition(capital.matrixWorld);
    fallback.y = 1.5;
    const start = worldAnchor(shipAnchors?.missile, fallback);
    head.position.copy(start);
    scene.add(head);
    const initialVelocity = comet.position.clone().sub(start).normalize();
    missiles.push({ head, flare: model.flare, trail: [], nuclear, velocity: initialVelocity, lastTrailAt: nowMs });
    missileLastPos = start;
    missileLastVel = initialVelocity;
    if (camDirector) {
      camDirector.requestShot('missileTail', {
        durationMs: 7000,
        blendInMs: 180,
        now: nowMs,
      });
    }
  }
  function removeMissileAt(index) {
    const missile = missiles[index];
    if (!missile) return;
    missile.trail.forEach((point) => {
      scene.remove(point.s);
      point.s.material.dispose();
    });
    scene.remove(missile.head);
    missile.flare.material.dispose();
    missiles.splice(index, 1);
  }

  // ENFORCER is an event-bound axial lance, not an autonomous plasma body.
  const lances = [];
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
      lances.push({ mesh: lance, life: 1, baseOpacity: opacity, radius });
    }
    if (camDirector) camDirector.requestShot('mainGunAxis', { durationMs: 1500, blendInMs: 300, now: nowMs });
  }

  // ── animation loop ────────────────────────────────────────────────────────
  let W = 1, H = 1, raf = 0, running = false, t0 = 0, previousUpdateAt = 0;
  let sized = false, wantsLoop = false, surfaceActive = false, renderSurface = null, loopLastT = 0, renderOnceLastT = 0;
  let lastEventSeen = 0;
  let targetScreen = null;
  let currentFlightPhase = null;
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
    W = Math.max(1, (w ?? canvas.clientWidth) || window.innerWidth);
    H = Math.max(1, (h ?? canvas.clientHeight) || window.innerHeight);
    sized = true;
    const dpr = renderPolicy.computeDpr(W, H, { minDpr: 0.6, maxDpr: 1.75 });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }

  function tmp() { return new THREE.Vector3(); }

  // ── U24 flight lifecycle plumbing ─────────────────────────────────────
  // The flight path joins the live escort position carried by CombatState.
  // There is no autonomous orbit or separate formation clock in this scene.
  function formationFnFor(i) {
    return () => escortWorldSample(liveCombatState?.escorts?.[i]) || {
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
    const liveStart = escortWorldSample(liveCombatState?.escorts?.[0], liveCombatState);
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
    if (state) liveCombatState = state;
    const alive = Boolean(state?.target);
    const unseenEvents = (state?.events || []).filter((event) => event.id > lastEventSeen);
    const revealEvent = unseenEvents.find((event) => event.type === 'target:acquired' || event.type === 'weapon:fire');
    if (alive && !targetRevealStartedAt && (state?.target?.locked || revealEvent)) {
      const eventAge = revealEvent ? Math.max(0, (state?.now || revealEvent.at) - revealEvent.at) : 0;
      targetRevealStartedAt = now - Math.min(900, eventAge);
    } else if (!alive) {
      targetRevealStartedAt = 0;
    }

    if (state?.target) {
      const viewportWidth = state.telemetry?.viewportWidth || 1;
      const viewportHeight = state.telemetry?.viewportHeight || 1;
      comet.position.set(
        (state.target.x / viewportWidth - 0.5) * 52,
        0.5 + state.target.collisionRisk * 1.6,
        -28 + (state.target.y / viewportHeight) * 32,
      );
    }
    const cometPos = new THREE.Vector3().setFromMatrixPosition(comet.matrixWorld);
    const targetReveal = targetRevealStartedAt ? THREE.MathUtils.clamp((now - targetRevealStartedAt) / 720, 0, 1) : 0;
    const revealEase = targetReveal * targetReveal * (3 - 2 * targetReveal);
    comet.visible = alive && revealEase > .002;
    comet.scale.setScalar(.72 + revealEase * .28);
    comet.userData.rock.material.opacity = revealEase;
    comet.userData.dust.material.opacity = revealEase * .26;
    comet.userData.coma.material.opacity = revealEase * .11;
    comet.userData.rock.rotation.x += .003 * frameScale;
    comet.userData.rock.rotation.y += .004 * frameScale;

    shieldPulse *= 0.9;
    shieldShell.material.opacity = Math.max(0, shieldPulse * (0.18 + Math.sin(now * 0.035) * 0.08));
    shieldShell.rotation.y += 0.006;

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
    const streakAdvance = .24 * frameScale;
    for (let i = 0; i < streakCount; i += 1) {
      const offset = i * 6;
      velocityValues[offset + 2] += streakAdvance;
      velocityValues[offset + 5] += streakAdvance;
      if (velocityValues[offset + 2] > 180) resetStreak(i);
    }
    velocityPositions.needsUpdate = true;
    approachBlackHole.position.z = Math.min(-155, approachBlackHole.position.z + .0035 * frameScale);
    const gravityPulse = 1 + Math.sin(now * .00022) * .018;
    approachBlackHole.scale.set(
      approachBlackHole.userData.baseScale.x * gravityPulse,
      approachBlackHole.userData.baseScale.y * (2 - gravityPulse),
      1,
    );
    approachBlackHole.material.opacity = .78 + Math.sin(now * .00017) * .055;

    // The command ship is the stable reference frame. Fighters exist only
    // when the authoritative snapshot reports an escort; otherwise their
    // meshes and trails are absent from the sensor picture.
    capital.position.x = -2;
    fighters.forEach((f, i) => {
      const escort = state?.escorts?.[i];
      const flightControlled = i === 0 && Boolean(flightEvent);
      f.visible = Boolean(escort) || flightControlled;
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
      if (event.type === 'flight:launch' || event.type === 'flight:landing') {
        const kind = event.type.split(':')[1];
        const eventAgeMs = Math.max(0, (state?.now || event.at) - event.at);
        startFlight(kind, now - eventAgeMs);
      } else if (event.type === 'fleet:damage') {
        shieldPulse = 1;
        const scar = damageScars[damageScarIndex % damageScars.length];
        damageScarIndex += 1;
        scar.material.opacity = Math.min(0.72, scar.material.opacity + 0.36);
        const hits = Math.min(Number(event.count) || 1, fighters.length);
        for (let i = 0; i < hits; i += 1) boom(fighters[i].position.clone(), 0.52, 0xff874f);
      } else if (event.type === 'weapon:fire' && alive) {
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
          camDirector?.requestShot('ciwsTurret', { durationMs: 1200, blendInMs: 260, now });
        } else if (event.weapon === 'missile') {
          launchMissile({ nowMs: now });
        } else if (event.weapon === 'nuke') {
          launchMissile({ nuclear: true, nowMs: now });
        } else if (event.weapon === 'enforcer') {
          launchOrb(now);
        }
      } else if (event.type === 'weapon:impact') {
        const scale = event.weapon === 'nuke' ? 4.8 : event.weapon === 'enforcer' ? 3.2 : 1.4;
        const color = event.weapon === 'nuke' ? 0xff5148 : event.weapon === 'enforcer' ? 0xbfffe6 : 0xffe6b0;
        boom(cometPos.clone(), scale, color);
        camDirector?.requestShot('impactOrbit', { durationMs: event.weapon === 'nuke' ? 1800 : 1050, blendInMs: 110, now });
      } else if (event.type === 'target:destroyed') {
        boom(cometPos.clone(), 5.2, 0xffe6b0);
      }
    }

    for (let i = lances.length - 1; i >= 0; i -= 1) {
      const lance = lances[i];
      lance.life -= 0.035 * frameScale;
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
      const tr = tracers[i]; tr.life -= 0.10 * frameScale;
      tr.m.material.opacity = Math.max(0, tr.life);
      if (tr.life <= 0) { scene.remove(tr.m); tr.m.material.dispose(); tracers.splice(i, 1); }
    }
    // Missiles mirror the authoritative 2D projectile snapshot exactly. The
    // renderer does not invent its own guidance curve, impact time or speed.
    const liveProjectiles = {
      missile: (state?.projectiles || []).filter((item) => item.type === 'missile'),
      nuke: (state?.projectiles || []).filter((item) => item.type === 'nuke'),
    };
    const ordinals = { missile: 0, nuke: 0 };
    for (let i = 0; i < missiles.length; i += 1) {
      const ms = missiles[i];
      const type = ms.nuclear ? 'nuke' : 'missile';
      const projectile = liveProjectiles[type][ordinals[type]++];
      if (!projectile) {
        removeMissileAt(i);
        i -= 1;
        continue;
      }
      const p = projectileWorldPosition(projectile, state);
      const previous = ms.head.position.clone();
      const velocity = p.clone().sub(previous);
      ms.head.position.copy(p);
      if (velocity.lengthSq() > 1e-6) {
        ms.velocity.copy(velocity);
        ms.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), velocity.clone().normalize());
      }
      const engineScale = projectile.stage === 'drop' ? 0.18 : projectile.stage === 'ignite' ? 0.82 : 1;
      ms.flare.scale.setScalar(engineScale);
      missileLastPos = p;
      missileLastVel = ms.velocity;
      if (projectile.stage !== 'drop' && now - ms.lastTrailAt >= (renderPolicy.qualityTier === 'low' ? 90 : 50)) {
        ms.lastTrailAt = now;
        const trail = sprite(ms.nuclear ? 0xff5148 : 0xffcaa0, ms.nuclear ? 2.2 : 1.4, 0.7);
        trail.position.copy(p);
        scene.add(trail);
        ms.trail.push({ s: trail, bornAt: now });
      }
      ms.trail.forEach((point) => {
        point.s.material.opacity = Math.max(0, (1 - (now - point.bornAt) / 620) * 0.7);
      });
      while (ms.trail.length && now - ms.trail[0].bornAt >= 620) {
        const point = ms.trail.shift();
        scene.remove(point.s);
        point.s.material.dispose();
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
        fragmentMatrix.makeRotationFromEuler(new THREE.Euler(age * (j + 1), age * 2, age * 0.7));
        fragmentMatrix.setPosition(v.x * age * ex.scale, v.y * age * ex.scale - age * age, v.z * age * ex.scale);
        ex.fragments.setMatrixAt(j, fragmentMatrix);
      }
      ex.fragments.instanceMatrix.needsUpdate = true;
      ex.fragments.material.opacity = Math.max(0, ex.life * 0.9);
      ex.fl.intensity = Math.max(0, ex.life * 12);
      if (ex.life <= 0) {
        scene.remove(ex.s, ex.halo, ex.ring, ex.fl, ex.fragments);
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
    updateProceduralLods(H);
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

  function loop(now) {
    const frameMs = loopLastT ? now - loopLastT : 0;
    loopLastT = now;
    if (!t0) t0 = now;
    update(now);
    renderer.render(scene, camera);
    renderSurface?.reportFrame(frameMs, {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    if (running) raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running || !surfaceActive) return;
    running = true;
    loopLastT = 0;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const webglLifecycle = createWebGLContextLifecycle({
    id: lifecycleId,
    canvas,
    onLost() {
      contextReady = false;
      surfaceActive = false;
      stopLoop();
    },
    onRestore() {
      renderer.resetState?.();
      contextReady = true;
      surfaceActive = budgetActive;
      if (sized) resize();
      if (wantsLoop) startLoop();
      else renderer.render(scene, camera);
    },
    onFallback() {
      contextReady = false;
      surfaceActive = false;
      stopLoop();
    },
  });
  if (!webglLifecycle.canInitialize) {
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
      trailMesh.visible = !pressureMode;
      for (const layer of starLayers) {
        layer.material.opacity = pressureMode
          ? layer.userData.baseOpacity * .52
          : layer.userData.baseOpacity;
      }
      flightStreaks.material.opacity = pressureMode ? .1 : .2;
      applyAuthoredGeometryQuality();
      updateProceduralLods(H);
    },
    onDispose() {
      webglLifecycle.dispose();
      disposeThreeScene(scene, renderer);
    },
  });

  return {
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
      if (!t0) t0 = now;
      if (renderPolicy.qualityTier === 'low' && renderOnceLastT && now-renderOnceLastT<32) return;
      const frameMs=renderOnceLastT?now-renderOnceLastT:0;
      renderOnceLastT=now;
      update(now, state);
      renderer.render(scene, camera);
      renderSurface?.reportFrame(frameMs, {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
    },
    getDiagnostics() {
      return Object.freeze({
        shipModelStatus,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        qualityTier: renderPolicy.qualityTier,
        cameraShot: camDirector?.currentShotId || 'commandChase',
        flightKind: flightEvent?.kind || null,
        flightPhase: currentFlightPhase,
        targetScreen: targetScreen ? Object.freeze({ ...targetScreen }) : null,
        cameraInteractive: true,
        cameraManual: userCamera.blend > .05,
        activeEscortCount: liveCombatState?.escorts?.length || 0,
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
