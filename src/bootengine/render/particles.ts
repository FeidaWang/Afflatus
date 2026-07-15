/* ============================================================
   PARTICLES — U29 P2: instanced GPU particle pools (explosion/thruster/
   debris), per the downscope table's "instanced GPU 粒子...顶点着色器仿真".

   GPU-driven, not JS-stepped: each particle's position at any moment is
   COMPUTED in the vertex shader from three per-instance attributes written
   once at spawn (origin, velocity, spawn time) plus the current uTime — no
   per-particle JS update loop. JS only ever writes into a fixed-size
   attribute pool on spawn(); the vertex shader hides any slot whose age is
   negative (not yet spawned this run) or past uLifetime (expired),
   regardless of how long ago that slot was last (re)used.

   Pool = ring buffer: spawn N always overwrites slot (N mod poolSize) — the
   oldest particle is silently recycled once the pool fills, no separate
   dead-list bookkeeping needed (this is the same recycle-on-death pattern
   topdownCombat.js's trailMesh already uses for its InstancedMesh, applied
   here to a Points-based pool instead).

   THREE.Points chosen over InstancedMesh: a particle IS a billboarded point
   sprite by definition, so gl_PointSize/gl_PointCoord give a free camera-
   facing quad with no extra per-instance transform math — cheaper than
   instancing an actual quad mesh for this use case. Additive-blended soft
   circular falloff is procedural (no texture asset), matching this
   project's zero-external-texture-pipeline stance (same reasoning as
   armorMaterial.ts).
   ============================================================ */

import * as THREE from 'three';

export interface ParticlePoolOptions {
  count: number;
  lifetime: number; // seconds
  pointSize: number; // base gl_PointSize at sizeStart, before perspective falloff
  colorStart: THREE.ColorRepresentation;
  colorEnd: THREE.ColorRepresentation;
  sizeStart?: number; // size multiplier at birth (default 1)
  sizeEnd?: number;   // size multiplier at death (default 0 — shrink to nothing)
  gravity?: THREE.Vector3; // world-space acceleration, default zero (no drift)
  additive?: boolean; // default true (glow pools); false = normal blending (debris)
  rng?: () => number; // cosmetic per-particle jitter seed; defaults to Math.random
}

export interface ParticlePool {
  points: THREE.Points;
  spawn(elapsedSeconds: number, origin: THREE.Vector3, velocity: THREE.Vector3): void;
  update(elapsedSeconds: number): void;
}

// Pure + testable (no THREE/GPU involved): given how many particles have
// ever been spawned and the pool size, which attribute slot the next spawn
// overwrites.
export function nextSlot(spawnCount: number, poolSize: number): number {
  return spawnCount % Math.max(1, poolSize);
}

// Pure + testable: 0 at birth, 1 at death, clamped — mirrors exactly what
// the vertex/fragment shaders compute per-fragment as `vPhase`, so this is
// the one part of the particle sim this project's no-WebGL sandbox CAN
// verify headlessly (same rationale odinHull.test.js uses for hull
// proportions — verify the math, not the pixels).
export function lifePhase(age: number, lifetime: number): number {
  if (lifetime <= 0) return 1;
  return Math.min(1, Math.max(0, age / lifetime));
}

// Pure + testable: is a slot visible this frame (spawned, not yet expired)?
export function isAlive(age: number, lifetime: number): boolean {
  return age >= 0 && age <= lifetime;
}

const VERT = /* glsl */ `
attribute float aSpawnTime;
attribute vec3 aVelocity;
attribute float aSeed;
uniform float uTime;
uniform float uLifetime;
uniform vec3 uGravity;
uniform float uSizeStart;
uniform float uSizeEnd;
uniform float uPointSize;
varying float vPhase;
varying float vSeed;
void main() {
  float age = uTime - aSpawnTime;
  vPhase = clamp(age / uLifetime, 0.0, 1.0);
  vSeed = aSeed;
  // 'position' doubles as the per-particle spawn origin — no separate
  // aOrigin attribute needed, and it keeps THREE's own bounding-sphere/
  // raycast machinery (which expects a 'position' attribute to exist)
  // pointed at something meaningful.
  vec3 pos = position + aVelocity * age + 0.5 * uGravity * age * age;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float sizeMul = mix(uSizeStart, uSizeEnd, vPhase);
  float alive = (age >= 0.0 && age <= uLifetime) ? 1.0 : 0.0;
  gl_PointSize = uPointSize * sizeMul * alive * (300.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColorStart;
uniform vec3 uColorEnd;
varying float vPhase;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float falloff = 1.0 - smoothstep(0.55, 1.0, d);
  if (falloff <= 0.001) discard;
  vec3 col = mix(uColorStart, uColorEnd, vPhase);
  // vSeed varies per-particle so a burst doesn't read as one uniform blob
  // fading in lockstep — cheap per-particle brightness variation only.
  float alpha = falloff * (1.0 - vPhase) * (0.75 + 0.25 * vSeed);
  gl_FragColor = vec4(col, alpha);
}
`;

export function createParticlePool(opts: ParticlePoolOptions): ParticlePool {
  const count = Math.max(1, Math.floor(opts.count));
  const rng = opts.rng ?? Math.random;

  const geo = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const aVelocity = new Float32Array(count * 3);
  // -1e6 seconds before "now" — guarantees age = uTime - aSpawnTime is a
  // huge positive number for any never-spawned slot, i.e. always past
  // uLifetime, i.e. hidden, without a separate "alive" attribute.
  const aSpawnTime = new Float32Array(count).fill(-1e6);
  const aSeed = new Float32Array(count);

  geo.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(aVelocity, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSpawnTime', new THREE.BufferAttribute(aSpawnTime, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLifetime: { value: opts.lifetime },
      uGravity: { value: (opts.gravity ?? new THREE.Vector3()).clone() },
      uSizeStart: { value: opts.sizeStart ?? 1 },
      uSizeEnd: { value: opts.sizeEnd ?? 0 },
      uPointSize: { value: opts.pointSize },
      uColorStart: { value: new THREE.Color(opts.colorStart) },
      uColorEnd: { value: new THREE.Color(opts.colorEnd) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  // Positions are computed per-vertex from spawn origin + velocity*age, not
  // from the static `position` attribute alone — the real extent can't be
  // known from the buffer's own bounding sphere, so skip frustum culling
  // rather than risk particles popping out mid-flight.
  points.frustumCulled = false;

  let spawnCounter = 0;

  return {
    points,
    spawn(elapsedSeconds, origin, velocity) {
      const slot = nextSlot(spawnCounter, count);
      spawnCounter++;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const velAttr = geo.getAttribute('aVelocity') as THREE.BufferAttribute;
      const spawnAttr = geo.getAttribute('aSpawnTime') as THREE.BufferAttribute;
      const seedAttr = geo.getAttribute('aSeed') as THREE.BufferAttribute;
      posAttr.setXYZ(slot, origin.x, origin.y, origin.z);
      velAttr.setXYZ(slot, velocity.x, velocity.y, velocity.z);
      spawnAttr.setX(slot, elapsedSeconds);
      seedAttr.setX(slot, rng());
      posAttr.needsUpdate = true;
      velAttr.needsUpdate = true;
      spawnAttr.needsUpdate = true;
      seedAttr.needsUpdate = true;
    },
    update(elapsedSeconds) {
      material.uniforms.uTime.value = elapsedSeconds;
    },
  };
}

// ---- three tuned presets (explosion / thruster / debris pools) ----------
// All three share the one shader above; only lifetime/color/gravity/size
// differ, matching how real particle systems configure one GPU sim for
// many effect "flavors" rather than writing three separate shaders.

export function createExplosionPool(rng?: () => number): ParticlePool {
  return createParticlePool({
    count: 400,
    lifetime: 0.9,
    pointSize: 90,
    sizeStart: 0.5,
    sizeEnd: 1.6, // grows into a puff as it fades, not a shrinking dot
    colorStart: 0xfff2c4,
    colorEnd: 0xff4a10,
    additive: true,
    rng,
  });
}

export function createThrusterPool(rng?: () => number): ParticlePool {
  return createParticlePool({
    count: 600,
    lifetime: 0.6,
    pointSize: 46,
    sizeStart: 1.0,
    sizeEnd: 0.15, // exhaust puffs shrink and dissipate behind the ship
    colorStart: 0xcfeeff,
    colorEnd: 0x2f6fbf,
    additive: true,
    rng,
  });
}

export function createDebrisPool(rng?: () => number): ParticlePool {
  return createParticlePool({
    count: 250,
    lifetime: 2.2,
    pointSize: 14,
    sizeStart: 1.0,
    sizeEnd: 0.8,
    colorStart: 0x3a332c,
    colorEnd: 0x0d0b09,
    gravity: new THREE.Vector3(0, -0.6, 0), // slight settle, for visual weight — not real physics
    additive: false,
    rng,
  });
}
