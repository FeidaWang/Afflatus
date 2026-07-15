/* ============================================================
   LASER BEAM — U29 P2: the weapon-fire beam itself (a glowing energy rod
   flying from muzzle to target), distinct from armorMaterial.ts's laser-
   HOLE decal (a burn mark on a surface that's already been hit). The
   downscope table's "发光激光" (glowing laser) line covers both; this file
   is the other half.

   topdownCombat.js already has a laser beam (`fireLaser`, a stretched
   CylinderGeometry with a flat MeshBasicMaterial + AdditiveBlending — see
   research notes) — that one is a cheap, correct-enough tracer for a busy
   combat scene with many simultaneous shots. This is a from-scratch
   ShaderMaterial instead, deliberately: this P2 slice's ask is specifically
   a more dynamic, "actually glowing" beam (core+halo radial falloff +
   a travelling energy pulse), not a replacement for the production tracer,
   and it does not touch topdownCombat.js.

   Shape: a CylinderGeometry oriented along its local Y axis by default; a
   cylinder's UV.x sweeps once around the circumference, so `abs(uv.x-0.5)`
   gives a cheap "distance from the camera-facing centerline" proxy without
   any actual view-direction math — bright core where the tube faces the
   camera, dimming toward the silhouette edges. UV.y (0 at one end, 1 at the
   other) drives the travelling pulse along the beam's length.
   ============================================================ */

import * as THREE from 'three';

export interface LaserBeam {
  mesh: THREE.Mesh;
  // Orients + scales the beam to span from -> to, and (re)starts its fade
  // envelope at the given elapsed time. Call once per shot.
  fire(elapsedSeconds: number, from: THREE.Vector3, to: THREE.Vector3): void;
  update(elapsedSeconds: number): void;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
uniform float uTime;
uniform float uFireTime;
uniform float uFadeDuration;
varying vec2 vUv;
void main() {
  float centerDist = abs(vUv.x - 0.5) * 2.0; // 0 at the visually-facing centerline, 1 at the silhouette edge
  float core = 1.0 - smoothstep(0.0, 0.35, centerDist);
  float halo = 1.0 - smoothstep(0.0, 1.0, centerDist);
  vec3 col = mix(uGlowColor, uCoreColor, core);
  // travelling energy pulse along the beam's length, plus the base halo —
  // a static beam reads as a painted-on cylinder, a moving highlight reads
  // as energy actually flowing muzzle -> target.
  float pulse = 0.6 + 0.4 * sin(vUv.y * 18.0 - uTime * 14.0);
  float intensity = (halo * 0.55 + core * 0.9 * pulse);
  float age = uTime - uFireTime;
  float fade = 1.0 - clamp(age / max(0.001, uFadeDuration), 0.0, 1.0);
  gl_FragColor = vec4(col * intensity, intensity * fade);
}
`;

export function createLaserBeam(opts: { coreColor?: THREE.ColorRepresentation; glowColor?: THREE.ColorRepresentation; radius?: number } = {}): LaserBeam {
  const radius = opts.radius ?? 0.045;
  // Unit-length cylinder along local Y — scaled per-shot to the actual
  // muzzle->target distance rather than rebuilding geometry every shot.
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 10, 1, true);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCoreColor: { value: new THREE.Color(opts.coreColor ?? 0xffffff) },
      uGlowColor: { value: new THREE.Color(opts.glowColor ?? 0x66ffe8) },
      uTime: { value: 0 },
      uFireTime: { value: -1e6 },
      uFadeDuration: { value: 0.18 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.visible = false;
  mesh.frustumCulled = false;

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    mesh,
    fire(elapsedSeconds, fromV, toV) {
      from.copy(fromV);
      to.copy(toV);
      dir.subVectors(to, from);
      const len = dir.length();
      if (len < 1e-5) { mesh.visible = false; return; }
      dir.normalize();
      mid.addVectors(from, to).multiplyScalar(0.5);
      mesh.position.copy(mid);
      mesh.scale.set(1, len, 1);
      mesh.quaternion.setFromUnitVectors(up, dir);
      material.uniforms.uFireTime.value = elapsedSeconds;
      mesh.visible = true;
    },
    update(elapsedSeconds) {
      material.uniforms.uTime.value = elapsedSeconds;
      const age = elapsedSeconds - material.uniforms.uFireTime.value;
      if (age > material.uniforms.uFadeDuration.value) mesh.visible = false;
    },
  };
}
