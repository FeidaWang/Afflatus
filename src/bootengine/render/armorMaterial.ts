/* ============================================================
   ARMOR MATERIAL — U29 P2 (first slice): procedural detail-normal +
   localized battle-damage decals (laser burn-through hole, impact pits,
   scratches), standing in for the RNM (Reoriented Normal Mapping)
   technique the AAA framework asked for. Only touches boot.html's own
   render tree (src/bootengine/render/) — main.js and topdownCombat.js are
   untouched.

   WHY procedural instead of RNM (recap from the Urgent.md U29 downscope
   table): RNM blends two SAMPLED normal-map textures using a reoriented
   basis, and needs a clean per-vertex tangent basis to do it. This site
   has neither — no texture pipeline (kitbash hulls are procedural
   geometry, not UV-baked assets) and no guaranteed tangent basis on
   runtime-assembled parts. So there's nothing for RNM to blend.

   What this module does instead — a technique with no tangent-basis
   requirement at all: a "surface gradient" bump (Mikkelsen's method,
   using screen-space derivatives dFdx/dFdy of world position AND of a
   procedural height field) perturbs the geometric normal directly. Valid
   in any coordinate frame, costs a few dFdx/dFdy calls, and needs zero
   UV/tangent data. WebGL2 (this project's P2 render target) has dFdx/dFdy
   natively, no extension pragma required.

   Damage decals (owner ask: laser burn-through hole + impact pits/
   scratches on a small, localized area) are anchored in OBJECT-LOCAL
   space (vArmorLocalPos = `transformed`, before modelMatrix) rather than
   world space — the demo mesh rotates continuously, and a world-space
   anchor would make the damage appear to slide across the rotating
   surface instead of staying fixed to it.
   - Laser hole: an irregular-radius `discard` cutout (an actual hole, not
     a decal texture) surrounded by a molten-metal cooling gradient
     (armorLavaGradient: white-hot -> orange -> deep red -> charred black)
     that drives BOTH the emissive glow (inner half of the damage band,
     fades to nothing) AND the surface albedo itself (extends further out,
     so the charred/blackened look persists as an actual diffuse color,
     not just fading light).
   - Impact pits: negative height contribution (an actual concave dent via
     the same surface-gradient normal technique, not just a dark blob) +
     AO-darkened interior.
   - Scratches: thin distance-to-segment lines, treated as a MATERIAL
     change (brighter, lower roughness — bare metal exposed through
     scraped paint) rather than a height change, matching how a shallow
     scratch actually differs physically from a dent.

   Built via MeshStandardMaterial.onBeforeCompile rather than a from-
   scratch ShaderMaterial: keeps three's full PBR lighting model and only
   patches in the handful of chunks this technique actually changes.
   ============================================================ */

import * as THREE from 'three';

export interface ArmorMaterialOptions {
  baseColor?: THREE.ColorRepresentation;
  glowColor?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  detailStrength?: number; // how strongly the procedural bump perturbs the normal
  panelScale?: number;     // panel-seam cell density (irregular grid, not a lattice tile)
  detailScale?: number;    // spatial frequency of the fine grain/crack noise
  scorchAmount?: number;   // 0..1, how much of the surface is randomly scorched (default: none)
}

export interface ArmorMaterial {
  material: THREE.MeshStandardMaterial;
  update(elapsedSeconds: number): void;
}

// Cheap value-noise + panel-line height field, no textures. Kept as GLSL
// string fragments (not JS) — this only runs on the GPU, per-fragment.
const NOISE_GLSL = /* glsl */ `
float armorHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float armorNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = armorHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = armorHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = armorHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = armorHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = armorHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = armorHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = armorHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = armorHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
float armorHash1(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}
// Irregular AXIS-ALIGNED grid (not Voronoi): one seam line per unit cell
// on each axis, each line's position jittered independently — cell WIDTH/
// HEIGHT ends up irregular (real aircraft panels are uneven rectangles)
// while the topology stays a plain 4-neighbor rectangular grid. Voronoi
// was tried and rejected — it statistically biases toward hexagonal
// cells ("turtle shell").
float armorPanelEdge(vec2 p) {
  float jx = (armorHash1(floor(p.x) * 3.1 + 11.0) - 0.5) * 0.56;
  float jz = (armorHash1(floor(p.y) * 5.7 + 41.0) - 0.5) * 0.56;
  vec2 f = abs(fract(p) - 0.5 - vec2(jx, jz));
  return min(f.x, f.y);
}
// Single source of truth for "how line-y is this fragment" — used by both
// the bump and the diffuse/roughness darkening, so the two never disagree
// on width. fwidth() sizes the AA band to the actual screen-space pixel
// footprint, so the seam stays a crisp ~1px hairline at any zoom/distance.
float armorPanelLine(vec2 p) {
  float edge = armorPanelEdge(p);
  float aa = max(fwidth(edge), 0.0008);
  return 1.0 - smoothstep(0.0, aa * 1.3, edge);
}
// point-to-segment distance, for scratch lines.
float armorSegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float t = clamp(dot(pa, ba) / max(1e-6, dot(ba, ba)), 0.0, 1.0);
  return length(pa - ba * t);
}
// three small hand-placed dents near the impact anchor (object-local XZ
// offset). Returns 0..~1, used to carve armorHeight() inward.
float armorPitMask(vec2 rel) {
  // smoothstep(edge0, edge1, x) requires edge0 < edge1 — "1.0 minus a
  // rising step" (not a falling step with swapped args, which is
  // undefined behavior per the GLSL spec) is the correct way to get a
  // falloff that's 1.0 at the center and 0.0 at the radius.
  float pit = 1.0 - smoothstep(0.0, 0.09, length(rel));
  pit = max(pit, (1.0 - smoothstep(0.0, 0.07, length(rel - vec2(0.16, 0.05)))) * 0.85);
  pit = max(pit, (1.0 - smoothstep(0.0, 0.06, length(rel - vec2(-0.08, 0.14)))) * 0.7);
  return pit;
}
// two short scratch grooves near the same impact anchor — a MATERIAL
// change (bare metal exposed) rather than a height change, see header.
float armorScratchMask(vec2 rel) {
  float aa = 0.006;
  float s1 = 1.0 - smoothstep(0.010, 0.010 + aa, armorSegDist(rel, vec2(-0.22, -0.20), vec2(0.06, -0.02)));
  float s2 = 1.0 - smoothstep(0.008, 0.008 + aa, armorSegDist(rel, vec2(0.02, 0.22), vec2(0.24, 0.09)));
  return max(s1, s2);
}
float armorHeight(vec3 p, vec3 localP) {
  float panelLine = armorPanelLine(p.xz * uPanelScale);
  float grain = armorNoise(p * 8.0) * 0.035;
  float pit = armorPitMask(localP.xz - uImpactCenter.xz);
  return panelLine * 0.22 + grain - pit * 0.55;
}
// Molten-metal cooling gradient: lava orange -> deep red -> charred black,
// as t goes 0 (right at the burn edge) -> 1 (fully cooled). Deepened twice
// now per owner feedback — first from a pale near-white center, then this
// pass lowered every stop's overall value/saturation again since the
// still-lightish orange read as too pale for "molten metal". step()+mix()
// instead of if/else — same result, no branching.
vec3 armorLavaGradient(float t) {
  vec3 c0 = vec3(0.78, 0.22, 0.01);
  vec3 c1 = vec3(0.62, 0.11, 0.01);
  vec3 c2 = vec3(0.36, 0.045, 0.01);
  vec3 c3 = vec3(0.03, 0.015, 0.01);
  vec3 col = mix(c0, c1, clamp(t / 0.25, 0.0, 1.0));
  col = mix(col, c2, step(0.25, t) * clamp((t - 0.25) / 0.35, 0.0, 1.0));
  col = mix(col, c3, step(0.6, t) * clamp((t - 0.6) / 0.4, 0.0, 1.0));
  return col;
}
`;

const VARYING_AND_UNIFORMS_GLSL = /* glsl */ `
varying vec3 vArmorWorldPos;
varying vec3 vArmorLocalPos;
uniform float uTime;
uniform float uDetailStrength;
uniform float uPanelScale;
uniform float uDetailScale;
uniform vec3 uGlowColor;
uniform float uScorchAmount;
uniform vec3 uLaserCenter;
uniform vec3 uImpactCenter;
float armorScorchMask;   // written early (clipping_planes_fragment injection), read later
float armorSeamMask;     // 1.0 right on a panel seam, 0.0 deep inside a panel
float armorPitMaskV;     // 1.0 in a dent's deepest point
float armorScratchMaskV; // 1.0 right on a scratch line
float armorHoleGlowV;    // active emissive intensity, 1.0 right at the burn edge, fades by mid-band
float armorHoleCharV;    // charred/darkened extent, reaches further out than the glow
vec3 armorHoleColorV;    // armorLavaGradient(t) — white-hot near the edge, black by the band's end
float armorHeightV;      // procedural height field, reused by the normal-perturbation step below
${NOISE_GLSL}
`;

// Actual hole cutout — must run BEFORE the rest of the fragment does any
// (wasted) shading work, so this is injected at the very first fragment
// chunk, not alongside the normal/roughness/emissive work below. Distance
// test is in OBJECT-LOCAL XZ, so the hole rotates with the mesh instead of
// drifting across it. No Y check: a real burn-through hole shows on both
// faces of a thin plate, which is the more honest reading of "dissolved
// with a hole" than a one-sided decal.
//
// BUG FIX (owner: "熔融渐变放到最上层，目前看不清楚" — put the molten
// gradient on top, it isn't showing): three's actual fragment chunk order
// is clipping_planes_fragment -> ... -> roughnessmap_fragment ->
// metalnessmap_fragment -> normal_fragment_begin -> normal_fragment_maps ->
// ... -> emissivemap_fragment. All the decal masks (armorHoleColorV/
// armorHoleCharV included) were previously computed inside the
// normal_fragment_maps injection, but READ by the roughnessmap_fragment
// injection — which runs EARLIER in program order. That earlier read saw
// each global before this fragment ever assigned it (undefined per the
// GLSL spec), so the diffuse-albedo lava tint silently never applied; only
// the emissive contribution (added after normal_fragment_maps) actually
// worked, which is why a faint glow was visible but no surrounding
// charred/blackened surface. Fix: compute every mask here, at the very
// first fragment chunk, so both the roughness/diffuse injection AND the
// normal injection AND the emissive injection all read already-finished
// values.
const HOLE_DISCARD_GLSL = /* glsl */ `
{
  vec2 relLaser = vArmorLocalPos.xz - uLaserCenter.xz;
  float distL = length(relLaser);
  // Owner: "激光武器穿透应聚焦于一个类圆形" — the hole should read as a
  // roughly circular burn-through, not a lumpy blob. The previous version
  // sampled noise at the fragment's raw position (armorNoise(localPos*9)),
  // which has no relationship to the angle around the laser center — the
  // implicit boundary "distL < f(position)" it produced was an arbitrary
  // irregular shape, not a wobbly circle. Fixed by sampling noise along a
  // fixed-radius circle parameterized by the angle around the center
  // instead, so the perturbation is purely angular (a proper "wobbly
  // circle" silhouette); amplitude also reduced so it stays clearly round.
  float angleL = atan(relLaser.y, relLaser.x);
  float holeNoise = armorNoise(vec3(cos(angleL) * 3.0, sin(angleL) * 3.0, 50.0));
  float holeRadius = 0.19 + (holeNoise - 0.5) * 0.04;
  if (distL < holeRadius) discard;

  vec3 armorP = vArmorWorldPos * uDetailScale;
  armorHeightV = armorHeight(armorP, vArmorLocalPos);

  armorSeamMask = armorPanelLine(armorP.xz * uPanelScale);
  armorPitMaskV = armorPitMask(vArmorLocalPos.xz - uImpactCenter.xz);
  armorScratchMaskV = armorScratchMask(vArmorLocalPos.xz - uImpactCenter.xz);

  // wide band (0.30 units) so "lava color transitioning to black" actually
  // reads as a visible spatial gradient, not a thin ring — owner feedback
  // was the previous version didn't clearly show this transition.
  float armorHoleT = clamp((distL - holeRadius) / 0.30, 0.0, 1.0);
  armorHoleGlowV = pow(max(0.0, 1.0 - armorHoleT / 0.5), 1.6); // active glow fades out by mid-band
  armorHoleCharV = 1.0 - smoothstep(0.55, 1.0, armorHoleT);    // charred darkening extends further
  armorHoleColorV = armorLavaGradient(armorHoleT);

  // fwidth-based AA — a fixed range read as hard/banded up close and too
  // soft from a distance; adaptive width keeps this a consistent, smooth
  // transition regardless of zoom.
  float scorchNoise = armorNoise(vArmorWorldPos * 0.35);
  float scorchEdge = scorchNoise - (1.0 - uScorchAmount);
  float scorchAA = max(fwidth(scorchEdge), 0.012);
  armorScorchMask = smoothstep(0.0, scorchAA * 1.5, scorchEdge);
}
`;

// surface-gradient normal perturbation (Mikkelsen) only — masks are already
// computed above (HOLE_DISCARD_GLSL), by the time this chunk runs.
const NORMAL_INJECT_GLSL = /* glsl */ `
{
  vec3 dPdx = dFdx(vArmorWorldPos);
  vec3 dPdy = dFdy(vArmorWorldPos);
  float dHdx = dFdx(armorHeightV);
  float dHdy = dFdy(armorHeightV);
  vec3 r1 = cross(dPdy, normal);
  vec3 r2 = cross(normal, dPdx);
  float det = dot(dPdx, r1);
  float sgn = det < 0.0 ? -1.0 : 1.0;
  vec3 surfGrad = sgn * (dHdx * r1 + dHdy * r2);
  normal = normalize(abs(det) * normal - uDetailStrength * surfGrad);
}
`;

const ROUGHNESS_INJECT_GLSL = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 1.0, armorScorchMask);
roughnessFactor = mix(roughnessFactor, min(1.0, roughnessFactor * 1.15), armorSeamMask);
roughnessFactor = mix(roughnessFactor, 0.35, armorScratchMaskV); // scratch = bare metal, shinier
roughnessFactor = mix(roughnessFactor, min(1.0, roughnessFactor * 1.3), armorPitMaskV * 0.6);
roughnessFactor = mix(roughnessFactor, 0.92, armorHoleCharV); // charred = rough, no more sheen

diffuseColor.rgb *= mix(1.0, 0.35, armorScorchMask);
diffuseColor.rgb *= mix(1.0, 0.82, armorSeamMask); // subtle recessed-seam darkening, independent of light angle
diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * 1.6 + 0.05), armorScratchMaskV);
diffuseColor.rgb *= mix(1.0, 0.45, armorPitMaskV); // dent interior in shadow
// the surface albedo itself shifts through the lava gradient too (not
// just emissive light on top) — by the cooled/black end of the band this
// IS the visible surface color, no glow required, which is what makes it
// read as "charred metal" rather than "a shrinking spotlight".
diffuseColor.rgb = mix(diffuseColor.rgb, armorHoleColorV, armorHoleCharV);
`;

const EMISSIVE_INJECT_GLSL = /* glsl */ `
{
  // static spatial sample, uniform global pulse — no position-dependent
  // phase (a position-dependent phase is a travelling wave, sin(k*x+w*t),
  // and read as the surface "flowing"). All cracks pulse in unison, in place.
  float crackNoise = armorNoise(vArmorWorldPos * uDetailScale * 3.0);
  float crackGlow = smoothstep(0.94, 0.99, crackNoise) * armorScorchMask
    * (0.55 + 0.25 * sin(uTime * 1.6));
  totalEmissiveRadiance += uGlowColor * crackGlow * 2.0;
  // lava-gradient color, not a fixed hue — saturated lava orange right at
  // the burn edge, shifting through red as armorHoleGlowV fades out over
  // the inner half of the damage band; the outer half carries no more
  // glow, only the charred diffuse tint above. Multiplier raised (2.6 ->
  // 4.2): a saturated orange is inherently lower-luminance than the old
  // pale near-white center, so the intensity needs to be pushed up to
  // still read as "glowing", not just "colored".
  totalEmissiveRadiance += armorHoleColorV * armorHoleGlowV * 4.2;
}
`;

const VERTEX_VARYING_GLSL = /* glsl */ `
varying vec3 vArmorWorldPos;
varying vec3 vArmorLocalPos;`;
const VERTEX_ASSIGN_GLSL = /* glsl */ `
vArmorWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vArmorLocalPos = transformed;`;

export function createArmorMaterial(opts: ArmorMaterialOptions = {}): ArmorMaterial {
  const material = new THREE.MeshStandardMaterial({
    // Owner moved off the literal FS 36176 reference toward a darker
    // "space gray" — deliberate creative direction, not a fidelity bug:
    // #4E5257 is roughly half the luminance of #8C969E, cool-neutral, in
    // the same family as the FS 595C low-observable grays but noticeably
    // deeper. Metalness/roughness below stay moderate so this albedo (not
    // environment-reflected hues) is what actually shows.
    color: opts.baseColor ?? 0x4e5257,
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.45,
  });
  material.envMapIntensity = opts.envMapIntensity ?? 0.5;

  const uniforms = {
    uTime: { value: 0 },
    uDetailStrength: { value: opts.detailStrength ?? 0.16 },
    // cell size ≈ 1/uPanelScale world units.
    uPanelScale: { value: opts.panelScale ?? 0.7 },
    uDetailScale: { value: opts.detailScale ?? 1 },
    uGlowColor: { value: new THREE.Color(opts.glowColor ?? 0x66ffe8) },
    // default OFF: the random whole-surface scorch pattern is a separate,
    // less controlled effect from the localized laser-hole/impact-pit
    // decals below, and competes with them visually. Set > 0 to re-enable.
    uScorchAmount: { value: opts.scorchAmount ?? 0 },
    // fixed object-local anchors, both on the basePlate's top face only
    // (chosen well outside the smaller inset/fin plates' own local
    // bounds, so only one plate shows each decal — see armorDemoScene.ts
    // for the three plates' actual dimensions).
    uLaserCenter: { value: new THREE.Vector3(1.3, 0.25, 0.4) },
    uImpactCenter: { value: new THREE.Vector3(-1.0, 0.25, -0.6) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_VARYING_GLSL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_ASSIGN_GLSL}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${VARYING_AND_UNIFORMS_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${HOLE_DISCARD_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL_INJECT_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS_INJECT_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${EMISSIVE_INJECT_GLSL}`);
  };
  // dFdx/dFdy/fwidth on a varying is only well-defined with standard
  // derivatives, which WebGL2 (this project's P2 render target) provides
  // natively.
  material.customProgramCacheKey = () => 'armorMaterialV2';

  return {
    material,
    update(elapsedSeconds: number) {
      uniforms.uTime.value = elapsedSeconds;
    },
  };
}
