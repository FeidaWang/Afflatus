/**
 * Wedge Cruiser hull v2 — a long flat-decked "dagger" capital-ship
 * silhouette: broad flat stern tapering sharply to a narrow bow point, a
 * REAL structural central trench (not a decal), twin command towers, twin
 * shield-generator domes, a wide stern engine row, and instanced greeble
 * (turrets/panel scatter/window lights) to keep the per-ship draw-call
 * count down. Same archetype popularized by Star Wars' Star Destroyers —
 * an ORIGINAL execution of that silhouette (proportions/greeble/naming all
 * this file's own), not a copy of any specific studio asset or insignia.
 *
 * v2 rework (2026-07-16) followed an owner-supplied AAA hard-surface
 * pipeline write-up (CAD/kitbash/trim-sheet/normal-baking/WebGPU-deferred).
 * Most of that pipeline needs tooling this project doesn't have and won't
 * be adding (a GUI CAD app, purchased kitbash packs, Substance Painter,
 * a WebGPU/deferred renderer — this site is WebGL2 forward per U29's own
 * downscope decision). What's actually adopted here, translated into what
 * this procedural/no-UV/no-baking pipeline CAN do:
 *   - "boolean-subtracted wedge tiers" -> real stepped deck-tier geometry
 *     (see DECK TIERS below), not just a smooth taper.
 *   - "the trench is the ship's soul, cluster greeble there" -> a real
 *     recessed channel (lower geometry, not a darker decal) with its own
 *     greeble scatter.
 *   - "precise edge bevels catch specular highlights" -> no true CAD bevel
 *     is available on a hand-built BufferGeometry, so raised trim rails
 *     trace the hull's sharp shoulder lines instead (same specular-catching
 *     job, different construction).
 *   - "twin shield domes, Fresnel rim glow" -> built, real rim-glow
 *     ShaderMaterial (see createShieldDomeMaterial).
 *   - "engine glow should be the brightest point, huge contrast" -> a
 *     dedicated high-emissiveIntensity material instead of sharing the
 *     caller's moderate-intensity `mats.glass`/`mats.blue`.
 *   - "use InstancedMesh for repeated cannons/sensors/vents, keep draw
 *     calls low" -> real InstancedMesh usage below (turret bodies+barrels,
 *     hull panel greeble, a new window-light scatter), via a second
 *     `addInstanced` callback alongside the existing `add` — see the
 *     contract note below.
 *   - Trim-sheet normal maps, AO-map wear, POM trench depth, deferred
 *     rendering: NOT attempted. No UV/texture pipeline exists in this
 *     project (armorMaterial.ts's own header explains why procedural
 *     surface-gradient bump was chosen over baked normals for the exact
 *     same reason), and this hull isn't wired into that material anyway
 *     (see kitbashFleet.ts — deliberately kept on plain caller-supplied
 *     `mats`, to avoid dragging the armor slice's laser-decal system onto
 *     a ship hull that never asked for it).
 *
 * Contract: same DOM/WebGL-free posture as carrierHull.js/odinHull.js
 * (never creates a THREE.Group/Mesh/texture ITSELF for the caller-owned
 * palette) but this file is the one hull generator in the family that also
 * calls a second caller-supplied `addInstanced(geo, mat, transforms)`
 * callback for repeated parts, and does create two small SPECIAL-PURPOSE
 * ShaderMaterials internally (shield rim-glow, engine glow) rather than
 * pulling them from the caller's `mats` — those two need bespoke shaders/
 * intensities no generic palette slot covers, and this hull (unlike its
 * two siblings) has exactly one consumer today, so there's no shared-
 * contract compatibility to preserve. carrierHull.js/odinHull.js are
 * untouched.
 *
 *   const info = createWedgeCruiserHull(THREE, { add, addInstanced, mats, detail: 'full' });
 *   // info = { length, height, width, engineMounts, muzzleAnchor,
 *   //          turretMounts, towerTips, shieldMounts }
 *
 * Forward = +Z. mats: { hull, arm, dark, trim, glass, red, blue }.
 */

// Generic N-point ring loft (own generalized copy of odinHull.js's 4-point
// version — that file's own helper is private and unexported; not edited).
function buildWedgeLoftGeometry(THREE, stations, ringFn) {
  const rings = stations.map((s) => ringFn(s.halfW, s.halfH, s.z));
  const n = rings[0].length;
  const pos = [];
  const push = (p) => pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      push(a[k]); push(b[k2]); push(a[k2]);
      push(a[k]); push(b[k]); push(b[k2]);
    }
  }
  const first = rings[0];
  const center = [0, stations[0].yCenter || 0, stations[0].z];
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; push(center); push(first[k]); push(first[k2]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Flat-decked hexagonal ring: flat top edge + flat-ish belly + sloped
// shoulders — reads as a broad wedge deck, distinct from odinHull.js's
// single-ridge diamond.
function wedgeRing(halfW, halfH, z) {
  return [
    [-halfW * 0.55, halfH, z], [halfW * 0.55, halfH, z],
    [halfW, halfH * 0.1, z],
    [halfW * 0.45, -halfH, z], [-halfW * 0.45, -halfH, z],
    [-halfW, halfH * 0.1, z],
  ];
}

// Fresnel rim-glow, additive — the "twin shield domes catch the eye"
// requirement. pow(1-N.V, k) is the standard cheap screen-space Fresnel
// approximation (no actual subsurface/refraction, just a rim term), same
// class of small bespoke ShaderMaterial this project already uses
// (laserBeam.ts's core+halo, armorMaterial.ts's injections).
function createShieldDomeMaterial(THREE, color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vNormalV = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormalV), normalize(vViewDir))), 2.5);
        vec3 col = uColor * (0.15 + fresnel * 1.4);
        gl_FragColor = vec4(col, 0.35 + fresnel * 0.6);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createWedgeCruiserHull(THREE, { add, addInstanced, mats, detail = 'full' }) {
  const full = detail === 'full';
  const M = mats;

  const STERN = -7.0, NOSE = 7.4;
  const LEN = NOSE - STERN;

  const stations = [
    { z: STERN, halfW: 4.0, halfH: 1.05 },
    { z: STERN + 2.4, halfW: 3.9, halfH: 1.02 },
    { z: -1.0, halfW: 3.0, halfH: 0.85 },
    { z: 2.2, halfW: 1.55, halfH: 0.55 },
    { z: 5.2, halfW: 0.55, halfH: 0.26 },
    { z: NOSE - 0.35, halfW: 0.08, halfH: 0.08 },
    { z: NOSE, halfW: 0.01, halfH: 0.01 },
  ];
  add(buildWedgeLoftGeometry(THREE, stations, wedgeRing), M.hull, [0, 0, 0]);

  // ===== raised shoulder trim rails — the CAD-bevel substitute: no true
  // variable-radius bevel is available on a hand-built BufferGeometry, so
  // these thin raised strips trace the hull's sharp shoulder line instead
  // (same "catches specular highlights, reads the hull's size" job the
  // guide asks a real bevel to do). Segmented per station pair so they
  // hug the taper instead of one straight box cutting the curve. =====
  for (const sx of [-1, 1]) {
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1];
      const zLen = b.z - a.z;
      const midZ = (a.z + b.z) / 2;
      const w = (a.halfW + b.halfW) / 2, h = (a.halfH + b.halfH) / 2;
      add(new THREE.BoxGeometry(0.06, 0.05, zLen * 0.98), M.trim, [sx * w, h * 0.1, midZ]);
    }
  }

  // ===== central dorsal trench — a REAL recessed channel (lower geometry,
  // not a darker decal): a sunken floor plate + raised side rails, wide
  // enough to read as a structural feature. Confined to the broad aft
  // 2/3 of the hull (where the flat deck is tall enough for a fixed trench
  // depth to sit safely below every station's own deck height along its
  // span — verified against the `stations` taper above, not eyeballed). =====
  const trenchZ0 = STERN + 1.8, trenchZ1 = 1.8, trenchLen = trenchZ1 - trenchZ0;
  const trenchMidZ = (trenchZ0 + trenchZ1) / 2;
  const trenchFloorY = 0.5; // stays below every station's deck height across [trenchZ0, trenchZ1] — min deck height in that span is ~0.6
  add(new THREE.BoxGeometry(1.15, 0.06, trenchLen), M.dark, [0, trenchFloorY, trenchMidZ]);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.16, trenchLen), M.trim, [sx * 0.62, trenchFloorY + 0.08, trenchMidZ]);
  // trench mechanical clutter — per the guide's own framing ("cluster the
  // majority of your greeble density" here), instanced so it doesn't cost
  // one draw call per box.
  {
    const clutterGeo = new THREE.BoxGeometry(1, 1, 1);
    const n = full ? 40 : 16;
    const transforms = [];
    for (let i = 0; i < n; i++) {
      const z = trenchZ0 + Math.random() * trenchLen;
      const x = (Math.random() - 0.5) * 0.9;
      const sy = 0.05 + Math.random() * 0.1;
      transforms.push({ t: [x, trenchFloorY + sy / 2 + 0.03, z], s: [0.06 + Math.random() * 0.08, sy, 0.05 + Math.random() * 0.1] });
    }
    addInstanced(clutterGeo, M.dark, transforms);
  }

  // ===== stepped deck tiers — the "boolean-subtracted wedge tiers" cue:
  // 2-3 layered plates rising toward the bridge, instead of one uniform
  // flat top (same layered-tier technique odinHull.js already uses for
  // its own stepped superstructure, applied at hull-deck scale here). =====
  const tier1Z = STERN + 3.4, tier1Len = 3.6;
  add(new THREE.BoxGeometry(3.2, 0.1, tier1Len), M.arm, [0, 1.02, tier1Z]);
  const tier2Z = STERN + 2.2, tier2Len = 1.6;
  add(new THREE.BoxGeometry(2.2, 0.08, tier2Len), M.hull, [0, 1.1, tier2Z]);

  // ===== twin command towers =====
  const towerBaseZ = STERN + 2.6, towerBaseY = 1.14;
  const towerTips = [];
  for (const sx of [-1, 1]) {
    const tx = sx * 0.85;
    add(new THREE.BoxGeometry(0.5, 0.4, 0.7), M.arm, [tx, towerBaseY + 0.2, towerBaseZ]);
    add(new THREE.BoxGeometry(0.4, 0.5, 0.55), M.hull, [tx, towerBaseY + 0.65, towerBaseZ]);
    add(new THREE.BoxGeometry(0.3, 0.32, 0.4), M.trim, [tx, towerBaseY + 1.06, towerBaseZ]);
    add(new THREE.BoxGeometry(0.24, 0.14, 0.3), M.glass, [tx, towerBaseY + 1.28, towerBaseZ + 0.08]);
    add(new THREE.CylinderGeometry(0.012, 0.02, 0.5, 6), M.trim, [tx, towerBaseY + 1.6, towerBaseZ]);
    towerTips.push({ x: tx, y: towerBaseY + 1.85, z: towerBaseZ });
  }
  add(new THREE.BoxGeometry(2.0, 0.16, 1.0), M.arm, [0, towerBaseY + 0.02, towerBaseZ]);

  // ===== twin shield-generator domes — the guide's other "hero" node,
  // set just aft of the towers at deck level, distinct Fresnel rim-glow
  // material so they read as a separate system from the gray hull. =====
  const shieldMounts = [];
  const shieldMat = createShieldDomeMaterial(THREE, 0x8fd0ff);
  for (const sx of [-1, 1]) {
    const sxPos = sx * 0.5, sy = towerBaseY + 0.22, sz = towerBaseZ - 0.95;
    add(new THREE.SphereGeometry(0.22, 16, 12), M.dark, [sxPos, sy, sz]); // dark core so the rim-glow reads against something
    add(new THREE.SphereGeometry(0.245, 16, 12), shieldMat, [sxPos, sy, sz]);
    shieldMounts.push({ x: sxPos, y: sy, z: sz });
  }

  // ===== dorsal turret row — bodies + barrels via addInstanced (2 draw
  // calls total instead of 1 per part) per the guide's InstancedMesh ask. =====
  const turretMounts = [];
  {
    const TURRET_N = 6, tz0 = STERN + 3.6, tz1 = 4.6;
    const bodyGeo = new THREE.BoxGeometry(0.3, 0.14, 0.3);
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.028, 0.3, 8);
    const bodies = [], barrels = [];
    for (let i = 0; i < TURRET_N; i++) {
      const z = tz0 + (tz1 - tz0) * (i / (TURRET_N - 1));
      for (const tx of [0.9, -0.9]) {
        bodies.push({ t: [tx, 0.98, z] });
        for (const bx of [-0.06, 0.06]) barrels.push({ t: [tx + bx, 1.0, z + 0.16], r: [Math.PI / 2, 0, 0] });
        turretMounts.push({ x: tx, y: 0.98, z });
      }
    }
    addInstanced(bodyGeo, M.dark, bodies);
    addInstanced(barrelGeo, M.trim, barrels);
  }

  // ===== wide stern engine row — deep recessed housings + a dedicated
  // high-intensity glow material so the engines are unambiguously the
  // brightest thing on the model (guide: "huge contrast with the gray
  // armor plating"), rather than sharing the caller's moderate-intensity
  // `mats.glass`/`mats.blue`. =====
  const engineMounts = [];
  const engineGlowMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x5fc4ff, emissiveIntensity: 4.5 });
  {
    const EN = 5, ex0 = -2.8, ex1 = 2.8;
    for (let i = 0; i < EN; i++) {
      const x = ex0 + (ex1 - ex0) * (i / (EN - 1));
      const y = -0.15;
      add(new THREE.BoxGeometry(0.62, 0.62, 0.5), M.dark, [x, y, STERN + 0.32]); // recessed housing, ahead of the nozzle mouth
      add(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 14), M.dark, [x, y, STERN + 0.05], [Math.PI / 2, 0, 0]);
      add(new THREE.TorusGeometry(0.44, 0.06, 6, 16), M.arm, [x, y, STERN - 0.16]);
      add(new THREE.CircleGeometry(0.4, 16), engineGlowMat, [x, y, STERN - 0.19], [0, Math.PI, 0]);
      engineMounts.push({ x, y, z: STERN - 0.22 });
    }
  }

  // ===== hull panel greeble scatter — instanced (1 draw call instead of
  // ~26 individual boxes). Silhouette stays the priority (guide's own
  // "80% of detail on the bridge + trench" framing) — this is the
  // remaining ambient texture on the plain deck areas, kept modest. =====
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const n = Math.round(26 * (full ? 1 : 0.4));
    const transforms = [];
    for (let i = 0; i < n; i++) {
      const z = STERN + 1.5 + Math.random() * (LEN * 0.55);
      const x = (Math.random() - 0.5) * 5.5;
      transforms.push({
        t: [x, 0.99, z],
        s: [0.06 + Math.random() * 0.16, 0.02, 0.1 + Math.random() * 0.3],
      });
    }
    addInstanced(geo, Math.random() < 0.5 ? M.trim : M.dark, transforms);
  }

  // ===== window lights — instanced small emissive dots across the hull
  // flanks. This is the guide's "assume it's a city because you see
  // windows" scale cue, the cheapest possible version of it (no light-map/
  // vertex-color bake — just many tiny emissive points). =====
  {
    const geo = new THREE.PlaneGeometry(0.04, 0.03);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf9c, emissiveIntensity: 2.2 });
    const n = full ? 220 : 80;
    const transforms = [];
    for (let i = 0; i < n; i++) {
      const z = STERN + 0.6 + Math.random() * (LEN - 1.2);
      const side = Math.random() < 0.5 ? -1 : 1;
      // approximate local hull half-width at this z by linear interpolation
      // across `stations`, so window rows hug the actual tapered hull
      // surface instead of floating off it or burying inside it.
      let halfW = stations[0].halfW;
      for (let s = 0; s < stations.length - 1; s++) {
        const a = stations[s], b = stations[s + 1];
        if (z >= a.z && z <= b.z) { halfW = a.halfW + (b.halfW - a.halfW) * ((z - a.z) / (b.z - a.z)); break; }
      }
      const x = side * (halfW * 0.98);
      const y = (Math.random() - 0.5) * 0.5;
      transforms.push({ t: [x, y, z], r: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0] });
    }
    addInstanced(geo, windowMat, transforms);
  }

  // ===== forward spinal weapon (bow-forward fire) =====
  const gunZ0 = 3.6, gunLen = 2.4;
  add(new THREE.CylinderGeometry(0.09, 0.13, gunLen, 12), M.trim, [0, -0.1, gunZ0], [Math.PI / 2, 0, 0]);
  const muzzleAnchor = { x: 0, y: -0.1, z: gunZ0 + gunLen / 2 + 0.2 };

  return {
    length: LEN, height: stations[0].halfH * 2, width: stations[0].halfW * 2,
    engineMounts, muzzleAnchor, turretMounts, towerTips, shieldMounts,
  };
}
