/**
 * Top-down (2.5D god's-eye) WebGL combat scene — Phase 1 of the combat-view
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
 *   scene.resize(w, h);       // css px; handles devicePixelRatio internally
 *   scene.stop(); scene.destroy();
 */
import * as THREE from 'three';
import { createNighthawk } from './nighthawk.js';
import { createWeaponCameraDirector } from '../combat/weaponCameraDirector.js';
import { fovForAccel, bankAngle, chaseCamPose } from '../combat/cameraMath.js';
import { activePhase, msUntilPhase, msRemaining } from '../combat/weaponClock.js';

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

// V18 Phase 2 (ROADMAP §4 "空间深度四件套"): the dust/speed-streak layer is
// gated by this, matching the project-wide convention (see arena.js/games.js/
// league.js/transition.js/ui/viz.js) rather than inventing a new one.
function reducedMotionPreferred() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

export function createTopdownCombat({ canvas }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const REDUCED_MOTION = reducedMotionPreferred();
  renderer.setClearColor(0x04060a, 1);
  // context-loss resilience (home runs many WebGL contexts; recover instead of black-screening)
  renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
  renderer.domElement.addEventListener('webglcontextrestored', () => { try { renderer.render(scene, camera); } catch (e) {} }, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.012);

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
  let missileLastPos = null, orbLastPos = null; // updated by launchMissile()/launchOrb() below
  function initCameraDirector() {
    const shots = {
      tacticalTopdown: {
        priority: 1,
        blendInMs: 400,
        compute(t) {
          return {
            pos: { x: CAM.x + Math.sin(t * 0.2) * 3, y: CAM.y, z: CAM.z + Math.cos(t * 0.16) * 2 },
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
          const p = orbLastPos || capital.position;
          return {
            pos: { x: capital.position.x, y: 8, z: capital.position.z - 6 },
            look: { x: p.x, y: p.y ?? 1.5, z: p.z },
          };
        },
      },
      missileTail: {
        priority: 4,
        compute() {
          const p = missileLastPos || capital.position;
          return {
            pos: { x: p.x - 4, y: p.y + 6, z: p.z + 10 },
            look: { x: p.x, y: p.y, z: p.z },
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
      // V18 Phase 1 (ROADMAP §4 "V18 实施路线"): low, over-the-shoulder chase
      // shot on the lead fighter — banking + dynamic FOV, both acceleration-
      // driven off the fighter's own analytic flight path (ph, tagged onto
      // fighters[0].userData by the strafe-formation loop below), not a
      // separate frame-differenced tracker.
      chaseCam: {
        priority: 3,
        blendInMs: 400,
        compute() {
          const f = fighters[0];
          const p = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
          const ph = f.userData.ph || 0;
          const w = 1.1; // angular rate, must match the strafe formation formula below
          const vx = -Math.sin(ph) * 16 * w, vz = Math.cos(ph) * 9 * w, vy = Math.cos(ph * 2) * 1.2 * w;
          const ax = -Math.cos(ph) * 16 * w * w, az = -Math.sin(ph) * 9 * w * w;
          const accelMag = Math.hypot(ax, az);
          const lateral = vz * ax - vx * az; // signed cross(v,a).y — turn direction
          const fov = fovForAccel(accelMag, { cruiseFov: 62, boostFov: 70, accelScale: 30 });
          const roll = bankAngle(lateral, 0.35, 0.01);
          const pose = chaseCamPose({ x: p.x, y: p.y, z: p.z }, { x: vx, y: vy, z: vz }, { back: 6, up: 2.2, side: -2.5, lookAhead: 10 });
          return { ...pose, fov, roll };
        },
      },
    };
    camDirector = createWeaponCameraDirector({ camera, shots, home: 'tacticalTopdown' });
    camDirector.requestShot('bridgeWide', { durationMs: 3200, blendInMs: 500 });
  }

  // ── lighting ───────────────────────────────────────────────────────────
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

  // ── tactical battle plane (the "god's-eye" grid) ─────────────────────────
  const grid = new THREE.GridHelper(160, 40, 0x1f6fae, 0x0e2438);
  grid.material.transparent = true; grid.material.opacity = 0.34;
  scene.add(grid);
  // soft field glow
  const field = sprite(0x123a5a, 150, 0.5); field.position.set(0, 0.2, -4);
  field.material.rotation = 0; scene.add(field);

  // starfield backdrop (well below the plane so it parallaxes)
  {
    const N = 600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = -40 - Math.random() * 80;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9fc4ff, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.7
    }));
    scene.add(pts);
  }

  // ── materials ────────────────────────────────────────────────────────────
  const hull = new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.85, roughness: 0.4 });
  const hullDk = new THREE.MeshStandardMaterial({ color: 0x4a5562, metalness: 0.9, roughness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x6b7884, metalness: 0.9, roughness: 0.35 });
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, metalness: 0.6, roughness: 0.7, emissive: 0x3a1206, emissiveIntensity: 0.5 });

  // teal armour accent echoing the Shattered Galaxy "Enforcer" plating
  const accent = new THREE.MeshStandardMaterial({ color: 0x2a6f63, metalness: 0.7, roughness: 0.5, emissive: 0x0fae8a, emissiveIntensity: 0.5 });

  // ── player capital = "ENFORCER": cigar hull, centre main cannon, rear-side
  //    thruster nacelles + tail fins, hull-line defensive turrets. (front = -Z)
  const capital = new THREE.Group();
  let cannonOrbSprite = null;
  {
    const hullBody = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 22, 22), hull);
    hullBody.rotation.x = Math.PI / 2; capital.add(hullBody);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), hull);
    nose.position.set(0, 0, -11); nose.scale.set(1, 1, 1.5); capital.add(nose);
    const tailCap = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), hullDk);
    tailCap.position.set(0, 0, 11); capital.add(tailCap);
    // dorsal spine
    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 16), trim);
    spine.position.set(0, 2.1, 0); capital.add(spine);
    // centre MAIN CANNON (forward) + charging orb at the muzzle
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 12, 16), hullDk);
    cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 2.5, -7); capital.add(cannon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.22, 10, 18), accent);
    ring.position.set(0, 2.5, -4); capital.add(ring);
    cannonOrbSprite = sprite(0x9fffe0, 4.6, 0.9); cannonOrbSprite.position.set(0, 2.5, -13.4); capital.add(cannonOrbSprite);
    // hull-line defensive turrets
    for (const z of [-6, -2, 2, 6]) for (const sx of [-1, 1]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent);
      dome.position.set(sx * 2.0, 1.5, z); capital.add(dome);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6), hullDk);
      bar.rotation.x = Math.PI / 2; bar.position.set(sx * 2.0, 1.8, z - 1.1); capital.add(bar);
    }
    // rear-side thruster nacelles + angled tail fins (back two sides)
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 4), trim); arm.position.set(sx * 3.0, 0, 9); capital.add(arm);
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 6, 16), hullDk);
      nac.rotation.x = Math.PI / 2; nac.position.set(sx * 4.3, 0, 10); capital.add(nac);
      const eg = sprite(0x7fe0ff, 7, 0.95); eg.position.set(sx * 4.3, 0, 13.6); capital.add(eg);
      const pl = new THREE.PointLight(0x6fd0ff, 6, 28); pl.position.set(sx * 4.3, 1, 13); capital.add(pl);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 3.6), trim);
      fin.position.set(sx * 4.3, 2.2, 10.6); fin.rotation.z = sx * 0.5; capital.add(fin);
    }
    capital.position.set(-2, 0, 17); // front (-Z) faces up-field toward the comet
    scene.add(capital);
  }

  // ── escort fighters = "NIGHTHAWK" (high-detail hard-surface model) ───────
  function makeFighter() {
    const nh = createNighthawk(THREE, { glowTex: GLOW });
    nh.setMode('combat');
    nh.group.scale.setScalar(0.62);   // fit the battle scale
    nh.group.userData.nh = nh;
    scene.add(nh.group);
    return nh.group;
  }
  const fighters = [makeFighter(), makeFighter(), makeFighter()];

  // ── shared scratch objects for the two per-frame instanced systems below
  // (trail ribbons + dust streaks) — both loop over dozens of instances every
  // frame, so reusing one Matrix4/Vector3/Color set instead of allocating
  // fresh ones per-instance-per-frame keeps this off the GC's hot path.
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

  // ── V18 Phase 2 item 2: near-field dust parallax + speed-stretch streaks ──
  // Fixed-size pool, one InstancedMesh (1 draw call) — respawning reuses the
  // same slot instead of allocating. Positions are genuine world-space points
  // near the camera, so ordinary parallax provides the "streaming past" read;
  // streak length/orientation comes from frame-differenced camera velocity
  // (unlike the fighters' analytic chaseCam math, the camera's own motion
  // here is director-smoothed, not closed-form, so this genuinely needs
  // differencing). `prefers-reduced-motion` halves the pool per ROADMAP §4.
  const DUST_BASE_COUNT = 36;
  const DUST_COUNT = REDUCED_MOTION ? Math.round(DUST_BASE_COUNT / 2) : DUST_BASE_COUNT;
  const DUST_MIN_R = 2.5, DUST_MAX_R = 15;
  const dustGeo = new THREE.PlaneGeometry(1, 1);
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const dustMesh = new THREE.InstancedMesh(dustGeo, dustMat, DUST_COUNT);
  dustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(dustMesh);
  function randomShellOffset(target) {
    const r = DUST_MIN_R + Math.random() * (DUST_MAX_R - DUST_MIN_R);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    target.set(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.4, Math.sin(ph) * Math.sin(th) * r);
  }
  const dustPts = Array.from({ length: DUST_COUNT }, () => {
    const off = new THREE.Vector3(); randomShellOffset(off);
    return camera.position.clone().add(off);
  });
  let camPrevPos = null, camPrevNow = 0;
  const _camVel = new THREE.Vector3(), _dustOff = new THREE.Vector3();
  function updateDust(now) {
    if (camPrevPos) {
      const dt = Math.max(0.001, (now - camPrevNow) / 1000);
      _camVel.subVectors(camera.position, camPrevPos).divideScalar(dt);
    } else { _camVel.set(0, 0, 0); }
    if (!camPrevPos) camPrevPos = new THREE.Vector3();
    camPrevPos.copy(camera.position); camPrevNow = now;

    const speed = _camVel.length();
    const dir = speed > 0.001 ? _dir.copy(_camVel).divideScalar(speed) : _dir.set(0, 0, 1);
    const len = Math.max(0.12, Math.min(3.2, speed * 0.09));
    const fade = Math.min(1, speed * 0.03); // near-idle camera → streaks fade to ~invisible, not just short

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = dustPts[i];
      if (p.distanceTo(camera.position) > DUST_MAX_R) { randomShellOffset(_dustOff); p.addVectors(camera.position, _dustOff); }
      billboardBasis(dir, p);
      _scale3.set(0.05, len, 1);
      _m4.makeBasis(_width, dir, _normal); _m4.scale(_scale3); _m4.setPosition(p);
      dustMesh.setMatrixAt(i, _m4);
      _col.copy(dustMat.color).multiplyScalar(fade);
      dustMesh.setColorAt(i, _col);
    }
    dustMesh.instanceMatrix.needsUpdate = true;
    if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
  }

  // ── V18 Phase 3 (ROADMAP §4, optional bonus item 8): sun glare + ghosts ──
  // Cheap dot-product-gated glare — no real Bloom/ACES (that's C3) — plus a
  // couple of mirrored "ghost" sprites using the standard cheap lens-flare
  // trick: project the sun's NDC screen position, then mirror+scale it
  // through screen center to place each ghost. Reuses the scene's existing
  // `key` DirectionalLight as the "sun" instead of inventing a second light.
  // Item 9 (ridge-silhouette parallax) is explicitly marked optional in the
  // roadmap text itself ("不强求") since the comet/fleet already give this
  // space scene equivalent depth cues — skipped, not forgotten.
  const SUN_DIR = key.position.clone().normalize();
  const glareSprite = sprite(0xfff4d8, 26, 0);
  scene.add(glareSprite);
  const ghostSprites = [0.35, 0.62].map((frac) => {
    const s = sprite(0xbfe0ff, 3.2, 0);
    s.userData.frac = frac;
    scene.add(s);
    return s;
  });
  const _sunFar = new THREE.Vector3(), _ndc = new THREE.Vector3(), _camFwd = new THREE.Vector3();
  function updateSunGlare() {
    camera.getWorldDirection(_camFwd);
    const facing = Math.max(0, _camFwd.dot(SUN_DIR));
    if (facing <= 0.001) {
      glareSprite.material.opacity = 0;
      ghostSprites.forEach((g) => { g.material.opacity = 0; });
      return;
    }
    _sunFar.copy(camera.position).addScaledVector(SUN_DIR, 400);
    _ndc.copy(_sunFar).project(camera);
    const inFront = _ndc.z < 1; // behind the camera → NDC z > 1, hide entirely
    const intensity = inFront ? facing * facing : 0;
    glareSprite.position.copy(_sunFar);
    glareSprite.material.opacity = intensity * 0.85;
    ghostSprites.forEach((g) => {
      if (!inFront) { g.material.opacity = 0; return; }
      const gp = new THREE.Vector3(-_ndc.x * g.userData.frac, -_ndc.y * g.userData.frac, 0.5).unproject(camera);
      g.position.copy(gp);
      g.material.opacity = intensity * 0.35;
    });
  }

  // ── comet target (1P/HALLEY) drifting across the top ─────────────────────
  const comet = new THREE.Group();
  let cometHP = 1;
  {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1),
      new THREE.MeshStandardMaterial({ color: 0x3a4452, metalness: 0.3, roughness: 0.9, flatShading: true,
        emissive: 0x14406a, emissiveIntensity: 0.45 }));
    comet.add(rock);
    const coma = sprite(0x9fe6ff, 18, 0.55); comet.add(coma);
    const tail = sprite(0x7fbaff, 30, 0.28); tail.position.set(0, 0, 16); tail.scale.set(14, 40, 1); comet.add(tail);
    comet.userData = { rock, coma };
    comet.position.set(-22, 0, -18);
    scene.add(comet);
  }

  if (camDirectorOn) initCameraDirector();

  // ── pools: tracers, missiles, explosions ─────────────────────────────────
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
  const tracers = [];
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
  function boom(pos, scale = 1, color = 0xffd9a0) {
    const s = sprite(color, 4 * scale, 1); s.position.copy(pos); scene.add(s);
    const fl = new THREE.PointLight(color, 12, 40); fl.position.copy(pos); scene.add(fl);
    explosions.push({ s, fl, life: 1, scale });
  }

  const missiles = [];
  function launchMissile() {
    const head = sprite(0xfff0d0, 2.2, 1);
    const start = new THREE.Vector3().setFromMatrixPosition(capital.matrixWorld);
    start.y = 1.5;
    head.position.copy(start);
    scene.add(head);
    missiles.push({ head, t: 0, trail: [] });
    missileLastPos = start;
    if (camDirector) camDirector.requestShot('missileTail', { durationMs: 1900, blendInMs: 350 });
  }

  // sustained LASER beams (Nighthawk strafing runs) — bright thick green lances
  const laserGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 8);
  const lasers = [];
  function fireLaser(from, to, color = 0x8dff6a) {
    const m = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(m); orient(m, from, to);
    lasers.push({ m, life: 1 });
  }

  // ENFORCER main-cannon PLASMA ORBS — big round光炮 from the centre barrel
  const orbs = [];
  function launchOrb() {
    const muzzle = new THREE.Vector3(0, 2.5, -14); capital.localToWorld(muzzle);
    const head = sprite(0x9fffe0, 5.5, 1); head.position.copy(muzzle); scene.add(head);
    const lt = new THREE.PointLight(0x6fffd0, 8, 30); lt.position.copy(muzzle); scene.add(lt);
    orbs.push({ head, lt, t: 0, trail: [] });
    orbLastPos = muzzle;
    if (cannonOrbSprite) cannonOrbSprite.material.opacity = 0.2; // discharge flash
    if (camDirector) camDirector.requestShot('mainGunAxis', { durationMs: 1500, blendInMs: 300 });
  }

  // ── animation loop ────────────────────────────────────────────────────────
  let W = 1, H = 1, raf = 0, running = false, t0 = 0, lastFire = 0, lastMissile = 0, lastLaser = 0, lastOrb = 0, lastChase = 0;
  // Real-state hooks (Phase 2b, partial): renderOnce(now, state) can pass a
  // snapshot from main.js's getBattleSnapshot(). Consumed narrowly for now —
  // kill events trigger a real explosion flash, and the comet hides while the
  // real halley is destroyed — without replacing the self-driven flight path
  // (that full migration is a separate, larger follow-up; see ROADMAP §4).
  let lastKillSeen = null, wasAlive = true;

  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h);
    const dpr = Math.min(1.75, window.devicePixelRatio || 1); // cap for retina GPU load
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }

  function tmp() { return new THREE.Vector3(); }

  function update(now, state) {
    const t = (now - t0) / 1000;
    const alive = !state || !state.halley || !state.halley.destroyed;

    // comet drifts left→right and bobs; respawns after crossing
    const cx = -26 + ((t * 4) % 52);
    comet.position.set(cx, Math.sin(t * 0.6) * 1.2, -18 + Math.sin(t * 0.4) * 3);
    comet.userData.rock.rotation.x = t * 0.5;
    comet.userData.rock.rotation.y = t * 0.7;
    comet.userData.coma.material.opacity = 0.45 + 0.15 * Math.sin(t * 6);
    const cometPos = new THREE.Vector3().setFromMatrixPosition(comet.matrixWorld);

    // real-kill tie-in: a confirmed kill (killCount incrementing) fires a big
    // warm flash at the comet's current position, distinct from routine hits
    if (state && typeof state.killCount === 'number') {
      if (lastKillSeen === null) lastKillSeen = state.killCount;
      else if (state.killCount > lastKillSeen) {
        lastKillSeen = state.killCount;
        boom(cometPos.clone(), 4, 0xffe6b0);
      }
    }
    // real-destroyed tie-in: hide the comet while the real halley is down,
    // and stop new ambient fire from targeting it; reappears once a new
    // halley spawns (alive again). In-flight tracers/orbs still decay normally.
    if (!alive && wasAlive) { boom(cometPos.clone(), 4, 0xffe6b0); }
    comet.visible = alive;
    wasAlive = alive;

    // capital slow patrol
    capital.position.x = -2 + Math.sin(t * 0.25) * 6;

    // fighters strafe in formation between capital and comet, firing tracers
    fighters.forEach((f, i) => {
      const ph = t * 1.1 + i * (Math.PI * 2 / 3);
      const ringX = Math.cos(ph) * 16 + comet.position.x * 0.3;
      const ringZ = -2 + Math.sin(ph) * 9;
      f.position.set(ringX, 1.4 + Math.sin(ph * 2) * 0.6, ringZ);
      f.userData.ph = ph; // read by the chaseCam shot (V18 Phase 1) to derive velocity/accel analytically
      // face travel direction
      const next = new THREE.Vector3(Math.cos(ph + 0.1) * 16 + comet.position.x * 0.3, f.position.y, -2 + Math.sin(ph + 0.1) * 9);
      f.lookAt(next);
      f.rotateX(Math.PI / 2);
      if (f.userData.nh) f.userData.nh.tick(t);
    });

    // tracer cadence — only aim new fire at the comet while it's alive
    if (alive && now - lastFire > 110) {
      lastFire = now;
      const f = fighters[(Math.random() * fighters.length) | 0];
      const from = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
      const jitter = cometPos.clone().add(tmp().set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4));
      fireTracer(from, jitter, 0xbfeaff);
      if (Math.random() > 0.55) boom(jitter, 0.5, 0x9fe6ff);
    }
    // capital CIWS occasional burst
    if (alive && Math.random() > 0.93) {
      const from = new THREE.Vector3().setFromMatrixPosition(capital.matrixWorld); from.y = 2;
      fireTracer(from, cometPos.clone().add(tmp().set((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5)), 0xff5c62);
      // refresh (not restart) — CIWS fires roughly every ~15 frames on average,
      // far more often than a shot's duration, so this just extends the window
      if (camDirector) camDirector.requestShot('ciwsTurret', { durationMs: 1100, blendInMs: 300, refresh: true });
    }
    // Nighthawk sustained laser strafe
    if (alive && now - lastLaser > 620) {
      lastLaser = now;
      const f = fighters[(Math.random() * fighters.length) | 0];
      const from = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
      fireLaser(from, cometPos.clone().add(tmp().set((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5)));
      boom(cometPos.clone(), 0.5, 0xd6ff9a);
    }
    // Enforcer main-cannon plasma orb (charge → fire)
    if (cannonOrbSprite) cannonOrbSprite.material.opacity = Math.min(0.95, cannonOrbSprite.material.opacity + 0.02) * (0.7 + 0.3 * Math.sin(t * 8));
    if (alive && now - lastOrb > 3200) { lastOrb = now; launchOrb(); }
    // periodic missile + big explosion
    if (alive && now - lastMissile > 2600) { lastMissile = now; launchMissile(); }
    // V18 Phase 1: periodic chaseCam pass on the lead fighter (independent of
    // the missile/orb/ciws triggers above — this is the new preset itself,
    // not yet wired into the missile narrative migration, which is a
    // separate follow-up per ROADMAP §4 item 2)
    if (alive && now - lastChase > 4400 && camDirector) { lastChase = now; camDirector.requestShot('chaseCam', { durationMs: 2200, blendInMs: 400 }); }

    // advance lasers (quick fade)
    for (let i = lasers.length - 1; i >= 0; i--) {
      const lz = lasers[i]; lz.life -= 0.07;
      lz.m.material.opacity = Math.max(0, lz.life * 0.95);
      if (lz.life <= 0) { scene.remove(lz.m); lz.m.material.dispose(); lasers.splice(i, 1); }
    }
    // advance plasma orbs toward the comet
    for (let i = orbs.length - 1; i >= 0; i--) {
      const ob = orbs[i]; ob.t += 0.02;
      const p = ob.head.position.clone().lerp(cometPos, 0.05 + ob.t * 0.05);
      ob.head.position.copy(p); ob.lt.position.copy(p);
      if (i === orbs.length - 1) orbLastPos = p;
      const sc = 5.5 + Math.sin(now * 0.02) * 0.6; ob.head.scale.set(sc, sc, 1);
      const tr = sprite(0x8fffd8, 3, 0.6); tr.position.copy(p); scene.add(tr);
      ob.trail.push({ s: tr, life: 1 });
      ob.trail.forEach(o => { o.life -= 0.06; o.s.material.opacity = Math.max(0, o.life * 0.55); });
      while (ob.trail.length && ob.trail[0].life <= 0) { const o = ob.trail.shift(); scene.remove(o.s); o.s.material.dispose(); }
      if (p.distanceTo(cometPos) < 4.5 || ob.t > 1.2) {
        boom(cometPos.clone(), 3, 0xbfffe6);
        ob.trail.forEach(o => { scene.remove(o.s); o.s.material.dispose(); });
        scene.remove(ob.head); scene.remove(ob.lt); ob.head.material.dispose(); orbs.splice(i, 1);
      }
    }

    // advance tracers
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i]; tr.life -= 0.10;
      tr.m.material.opacity = Math.max(0, tr.life);
      if (tr.life <= 0) { scene.remove(tr.m); tr.m.material.dispose(); tracers.splice(i, 1); }
    }
    // missiles
    for (let i = missiles.length - 1; i >= 0; i--) {
      const ms = missiles[i]; ms.t += 0.018;
      const p = ms.head.position.clone().lerp(cometPos, 0.06 + ms.t * 0.04);
      ms.head.position.copy(p);
      if (i === missiles.length - 1) missileLastPos = p;
      const tr = sprite(0xffcaa0, 1.4, 0.7); tr.position.copy(p); scene.add(tr);
      ms.trail.push({ s: tr, life: 1 });
      ms.trail.forEach(o => { o.life -= 0.08; o.s.material.opacity = Math.max(0, o.life * 0.7); });
      while (ms.trail.length && ms.trail[0].life <= 0) { const o = ms.trail.shift(); scene.remove(o.s); o.s.material.dispose(); }
      if (p.distanceTo(cometPos) < 4 || ms.t > 1.1) {
        boom(cometPos.clone(), 2.4, 0xfff0c4);
        ms.trail.forEach(o => { scene.remove(o.s); o.s.material.dispose(); });
        scene.remove(ms.head); ms.head.material.dispose(); missiles.splice(i, 1);
      }
    }
    // explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i]; ex.life -= 0.05;
      const sc = (1 - ex.life) * 8 * ex.scale + 2;
      ex.s.scale.set(sc, sc, 1);
      ex.s.material.opacity = Math.max(0, ex.life);
      ex.fl.intensity = Math.max(0, ex.life * 12);
      if (ex.life <= 0) { scene.remove(ex.s); scene.remove(ex.fl); ex.s.material.dispose(); explosions.splice(i, 1); }
    }

    // camera: director-driven shot state machine when ?combatcam=director is
    // set (ROADMAP §4 V14); otherwise the original hardcoded sway, unchanged.
    if (camDirector) {
      camDirector.update(now);
    } else {
      camera.position.x = CAM.x + Math.sin(t * 0.2) * 3;
      camera.position.z = CAM.z + Math.cos(t * 0.16) * 2;
      camera.lookAt(comet.position.x * 0.25, 2, -2);
    }

    // V18 Phase 2: run these after the camera update above so the dust
    // streaks read this frame's freshly-moved camera.position rather than
    // last frame's (the trail ribbons read fighters' matrixWorld, which
    // three.js only refreshes during renderer.render() right after this
    // function returns — same one-frame-lag characteristic the existing
    // tracer/laser firing code above already has, kept consistent rather
    // than special-cased).
    updateTrails(now);
    updateDust(now);
    updateSunGlare();
  }

  function loop(now) {
    if (!t0) t0 = now;
    update(now);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(loop);
  }

  // V18 Phase 1 item 2 (ROADMAP §4): drives the camera director off a
  // weaponClock timeline (see main.js's missile-launch site, which builds
  // one with drop/ignite/terminal/impact phases matching the real
  // MISSILE_DROP_MS/MISSILE_IGNITE_MS thresholds) instead of a separate
  // guessed duration — this is the first real consumer of weaponClock.js.
  // No-op if the camera director isn't enabled (?combatcam=director) or no
  // timeline was passed.
  function driveMissileTimeline(timeline, nowMs) {
    if (!camDirector || !timeline) return;
    const phase = activePhase(timeline, nowMs);
    if (phase === 'terminal' || phase === 'impact') {
      camDirector.requestShot('chaseCam', { durationMs: Math.max(400, msRemaining(timeline, nowMs)), blendInMs: 350, refresh: true });
    } else {
      // missileTail (priority 4) outranks chaseCam (priority 3) — capping its
      // duration to exactly the remaining drop+ignite window (instead of a
      // fixed refresh) means it naturally expires right as the phase flips
      // to 'terminal', so the chaseCam request above isn't blocked by
      // shouldPreempt's "lower priority must wait" rule.
      camDirector.requestShot('missileTail', { durationMs: Math.max(200, msUntilPhase(timeline, 'terminal', nowMs)), blendInMs: 300, refresh: true });
    }
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); },
    resize,
    // state: optional real-battle snapshot (see main.js getBattleSnapshot()).
    // Consumed for kill flashes + comet visibility; full state-driven flight
    // path is a separate follow-up (ROADMAP §4 Phase 2b).
    renderOnce(now = performance.now(), state = null) { if (!t0) t0 = now; update(now, state); renderer.render(scene, camera); },
    driveMissileTimeline,
    destroy() { this.stop(); renderer.dispose(); }
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
  label.textContent = 'TOP-DOWN COMBAT · 上帝视角 · WEBGL PHASE 1';
  label.style.cssText = "position:absolute;top:16px;left:16px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.34em;color:#aee0ff;pointer-events:none";
  wrap.append(cv, close, label);
  document.body.appendChild(wrap);
  const scene = createTopdownCombat({ canvas: cv });
  if (!scene) { label.textContent = 'WebGL unavailable'; return; }
  const fit = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
  fit(); addEventListener('resize', fit);
  scene.start();
  close.addEventListener('click', () => { scene.destroy(); wrap.remove(); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeMountHarness, { once: true });
  else maybeMountHarness();
}
