/* ============================================================
   SECTORS STARFIELD — U42 "Two Sigma 式交互数据星域" (42c slices ②③), the
   3D-Points alternative to the existing 2D force-directed graph
   (sectorsGraphView.js / U30 R3). Ships behind `?fx=starfield3d` (same
   flag-gate convention as alphardForge.js's `?fx=stage`) — the R3 graph
   stays the shipped default; this is the opt-in replacement candidate
   pending the station owner's real-device call (U42 42c slice ④).

   Two THREE.Points layers, one draw call each:
     - background dust (~3000, halved on mobile): pure ambiance, no data
       meaning, vertex shader does perspective size falloff + far-dark/
       near-bright depth shading (same gl_PointSize formula family as
       alphardForge.js's nebula particles).
     - data layer (~40-50, from src/lib/dataToSpace.js): larger + glow,
       brightness scaled by real confidence, color = US cyan-white vs CN
       amber (dual color-temperature discipline, semantic use per U42 42a
       — deliberately NOT the same blue/red as the 2D graph's faction
       colors, since that's a flat pole-affinity read and this is a
       "which camp is this real reading closer to" read).

   Camera is a damped 3-axis orbit (azimuth/elevation/distance, all eased
   with src/combat/cameraMath.js's smoothDamp — same primitive as the 3D
   combat camera, not a bespoke lerp) around a "focus point" that starts at
   the data cloud's centroid and animates ("flies") to a clicked node's
   position + a closer distance; ESC or a double-click on empty space
   flies back to the overview centroid. Hover raycasts the data layer only
   (dust is decorative, never pickable) and shows a plain DOM tooltip —
   simpler and cheaper than a texture-atlas text sprite for ~50 labels.

   prefers-reduced-motion: idle auto-drift and the dust/data "breathe"
   jitter are skipped entirely; all camera moves (fly-to on click/deselect)
   use a near-zero smoothTime so they resolve in ~1 frame instead of
   easing — direct-manipulation feedback stays instant, no continuous
   ambient motion runs on its own (same split sectorsGraphView.js already
   makes: dragging/clicking still work under RM, "breathing" does not).
   ============================================================ */
import * as THREE from 'three';
import { smoothDamp } from '../combat/cameraMath.js';
import { buildSpaceData } from '../lib/dataToSpace.js';

const COLOR_US = new THREE.Color(0x8fe9ff); // cyan-white
const COLOR_CN = new THREE.Color(0xf5c400); // amber
const WORLD_SCALE = 60; // data-space unit -> world unit
const DUST_N_DESKTOP = 3000, DUST_N_MOBILE = 1500;
const IDLE_MS = 15000, IDLE_OMEGA = 0.05; // rad/s, "极慢自动漂移"
const OVERVIEW_DISTANCE = 260, FOCUS_DISTANCE = 90;
const SMOOTH_TIME = 0.5; // seconds, camera orbit/fly-to ease

/* ── vertex/fragment shaders (same gl_PointSize-by-view-depth family as
   alphardForge.js's PT_VERT, just parameterized per-layer) ─────────────── */
const DUST_VERT = `
attribute float aSize; attribute float aSeed;
uniform float uTime;
varying float vDepth;
void main(){
  vec3 p = position;
  p.x += sin(uTime*0.02 + aSeed)*3.0;
  p.y += cos(uTime*0.017 + aSeed*1.3)*3.0;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = aSize * (240.0 / max(1.0,-mv.z));
  gl_Position = projectionMatrix * mv;
  vDepth = clamp((-mv.z - 40.0) / 900.0, 0.0, 1.0); // 0 near -> 1 far
}`;
const DUST_FRAG = `
precision mediump float; varying float vDepth;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  float bright = mix(0.85, 0.12, vDepth); // near bright, far dark
  gl_FragColor = vec4(vec3(0.75,0.86,1.0) * bright, a * bright * 0.55);
}`;
const DATA_VERT = `
attribute float aSize; attribute float aBright; attribute vec3 aColor;
uniform float uTime;
varying float vBright; varying vec3 vColor;
void main(){
  vec3 p = position;
  p.x += sin(uTime*0.35 + aSize)*0.6;
  p.z += cos(uTime*0.3 + aSize*1.7)*0.6;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = aSize * (320.0 / max(1.0,-mv.z));
  gl_Position = projectionMatrix * mv;
  vBright = aBright; vColor = aColor;
}`;
const DATA_FRAG = `
precision mediump float; varying float vBright; varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.05, d);
  float glow = pow(smoothstep(0.5, 0.0, d), 2.2);
  vec3 c = vColor * (0.6 + 0.6 * vBright);
  gl_FragColor = vec4(c, (core * 0.9 + glow * 0.4) * (0.55 + 0.45 * vBright));
}`;

function sphericalOffset(azimuth, elevation, distance) {
  const ce = Math.cos(elevation);
  return {
    x: distance * ce * Math.sin(azimuth),
    y: distance * Math.sin(elevation),
    z: distance * ce * Math.cos(azimuth),
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{sectorsData?: object, universeData?: object}} data
 * @param {{onSelect?:(node:object|null)=>void, onHover?:(node:object|null)=>void}} [opts]
 * @returns {{update:(data:object)=>void, destroy:()=>void}|null}
 */
export function initSectorsStarfield(canvas, data, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : () => {};
  const onHover = typeof opts.onHover === 'function' ? opts.onHover : () => {};

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setClearColor(0x0a0c12, 1);
  renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
  renderer.domElement.addEventListener('webglcontextrestored', () => { try { size(); render(performance.now()); } catch (e) {} }, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);

  function isMobile() { return (canvas.getBoundingClientRect().width || innerWidth) < 640; }

  // ── background dust (ambiance only, never pickable) ──
  const dustGeo = new THREE.BufferGeometry();
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  function buildDust() {
    const n = isMobile() ? DUST_N_MOBILE : DUST_N_DESKTOP;
    const pos = new Float32Array(n * 3), siz = new Float32Array(n), sed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1800;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2600;
      siz[i] = 1.0 + Math.random() * 2.2;
      sed[i] = Math.random() * 100;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(sed, 1));
  }
  buildDust();

  // ── data layer (from dataToSpace.js — real coordinates, real meaning) ──
  const dataUniforms = { uTime: { value: 0 } };
  const dataMat = new THREE.ShaderMaterial({
    vertexShader: DATA_VERT, fragmentShader: DATA_FRAG, uniforms: dataUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dataGeo = new THREE.BufferGeometry();
  const dataPoints = new THREE.Points(dataGeo, dataMat);
  scene.add(dataPoints);

  let nodes = [];
  let focusDefault = { x: 0, y: 0, z: 0 };
  let overviewDistance = OVERVIEW_DISTANCE;

  function buildDataLayer(raw) {
    const { nodes: n } = buildSpaceData(raw || {});
    nodes = n;
    const count = Math.max(1, nodes.length);
    const pos = new Float32Array(count * 3), siz = new Float32Array(count), bri = new Float32Array(count), col = new Float32Array(count * 3);
    let cx = 0, cy = 0, cz = 0, maxR = 0.1;
    nodes.forEach((node, i) => {
      const wx = node.x * WORLD_SCALE, wy = (node.y - 0.5) * WORLD_SCALE * 1.4, wz = node.z * WORLD_SCALE;
      pos[i * 3] = wx; pos[i * 3 + 1] = wy; pos[i * 3 + 2] = wz;
      siz[i] = node.kind === 'vendor' ? 3.2 : 1.9;
      bri[i] = node.hasConfidence ? node.confidence : 0.35; // unscored nodes render dimmer, not a faked confident glow
      const c = node.market === 'CN' ? COLOR_CN : COLOR_US;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      cx += wx; cy += wy; cz += wz;
      node._wx = wx; node._wy = wy; node._wz = wz;
    });
    cx /= count; cy /= count; cz /= count;
    nodes.forEach((node) => { maxR = Math.max(maxR, Math.hypot(node._wx - cx, node._wy - cy, node._wz - cz)); });
    dataGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dataGeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    dataGeo.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
    dataGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    focusDefault = { x: cx, y: cy, z: cz };
    overviewDistance = Math.max(140, maxR * 2.6);
  }
  buildDataLayer(data);

  // ── camera orbit state (azimuth/elevation/distance around a focus point) ──
  let azimuth = 0.5, azimuthTarget = 0.5, azimuthVel = { v: 0 };
  let elevation = 0.35, elevationTarget = 0.35, elevationVel = { v: 0 };
  let distance = overviewDistance, distanceTarget = overviewDistance, distanceVel = { v: 0 };
  let focus = { ...focusDefault }, focusTarget = { ...focusDefault };
  const focusVel = { x: { v: 0 }, y: { v: 0 }, z: { v: 0 } };
  distanceTarget = overviewDistance;

  let focused = null;
  function flyTo(node) {
    focused = node;
    focusTarget = { x: node._wx, y: node._wy, z: node._wz };
    distanceTarget = FOCUS_DISTANCE;
    onSelect(node);
  }
  function flyToOverview() {
    focused = null;
    focusTarget = { ...focusDefault };
    distanceTarget = overviewDistance;
    onSelect(null);
  }

  // ── interaction: pointer orbit-drag, wheel/pinch dolly, click select,
  // hover ray-pick, idle auto-drift, ESC/dblclick-empty = deselect ──
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 6 };
  const ndc = new THREE.Vector2();
  let lastInteractAt = performance.now();
  function markActive() { lastInteractAt = performance.now(); }

  const pointers = new Map(); // pointerId -> {x,y}
  let dragMoved = false, downX = 0, downY = 0;
  let pinchStart = 0, pinchDistanceStart = overviewDistance;

  function relXY(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }

  function pick(px, py, w, h) {
    if (!nodes.length) return null;
    ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(dataPoints);
    if (!hits.length) return null;
    return nodes[hits[0].index] || null;
  }

  function onPointerDown(e) {
    markActive();
    const p = relXY(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) { dragMoved = false; downX = p.x; downY = p.y; }
    else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchDistanceStart = distanceTarget;
    }
  }
  function onPointerMove(e) {
    const p = relXY(e);
    if (!pointers.has(e.pointerId)) { // hover only (no button down)
      const hit = pick(p.x, p.y, p.w, p.h);
      onHover(hit);
      return;
    }
    markActive();
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      distanceTarget = Math.min(overviewDistance * 1.6, Math.max(FOCUS_DISTANCE * 0.6, pinchDistanceStart * (pinchStart / Math.max(1, d))));
      return;
    }
    const dx = p.x - prev.x, dy = p.y - prev.y;
    if (Math.hypot(p.x - downX, p.y - downY) > 4) dragMoved = true;
    azimuthTarget -= dx * 0.006;
    elevationTarget = Math.max(-1.3, Math.min(1.3, elevationTarget + dy * 0.006));
  }
  function onPointerUp(e) {
    const p = relXY(e);
    const wasSingle = pointers.size === 1 && pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (wasSingle && !dragMoved) {
      const hit = pick(p.x, p.y, p.w, p.h);
      if (hit) flyTo(hit); else flyToOverview();
    }
  }
  function onWheel(e) {
    e.preventDefault(); markActive();
    const factor = Math.exp(e.deltaY * 0.0012);
    distanceTarget = Math.min(overviewDistance * 1.6, Math.max(FOCUS_DISTANCE * 0.6, distanceTarget * factor));
  }
  function onDblClick(e) {
    const p = relXY(e);
    if (!pick(p.x, p.y, p.w, p.h)) flyToOverview();
  }
  function onKeyDown(e) { if (e.key === 'Escape') flyToOverview(); }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
  addEventListener('keydown', onKeyDown);

  // ── render loop, IO-gated (alphardForge/sectorsGraphView convention) ──
  let W = 1, H = 1;
  function size() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(isMobile() ? 1.5 : 2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }

  let lastT = 0;
  function render(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016; lastT = t;
    const tm = t * 0.001;
    if (!reduce) {
      if (performance.now() - lastInteractAt > IDLE_MS && !focused) azimuthTarget += IDLE_OMEGA * dt;
      dustMat.uniforms.uTime.value = tm; dataUniforms.uTime.value = tm;
    }
    const st = reduce ? 0.0001 : SMOOTH_TIME;
    azimuth = smoothDamp(azimuth, azimuthTarget, azimuthVel, st, dt);
    elevation = smoothDamp(elevation, elevationTarget, elevationVel, st, dt);
    distance = smoothDamp(distance, distanceTarget, distanceVel, st, dt);
    focus.x = smoothDamp(focus.x, focusTarget.x, focusVel.x, st, dt);
    focus.y = smoothDamp(focus.y, focusTarget.y, focusVel.y, st, dt);
    focus.z = smoothDamp(focus.z, focusTarget.z, focusVel.z, st, dt);
    const off = sphericalOffset(azimuth, elevation, distance);
    camera.position.set(focus.x + off.x, focus.y + off.y, focus.z + off.z);
    camera.lookAt(focus.x, focus.y, focus.z);
    renderer.render(scene, camera);
  }

  size();
  let running = false, raf = 0;
  function loop(t) { render(t); if (running) raf = requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0 });
  io.observe(canvas);
  render(performance.now());
  addEventListener('resize', () => { size(); if (!running) render(performance.now()); }, { passive: true });

  return {
    update(newData) { buildDataLayer(newData); },
    destroy() {
      stop(); io.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDblClick);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('resize', size);
      renderer.dispose();
    },
  };
}
