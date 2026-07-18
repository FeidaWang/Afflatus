/* ============================================================
   SECTORS STARFIELD V2 — U42 "Two Sigma 式交互数据星域" (Urgent.md U42
   42-1..42-6), the 3D-Points alternative to the existing 2D force-directed
   graph (sectorsGraphView.js / U30 R3). Ships behind `?fx=starfield3d` — the
   2D graph stays the shipped default; this is the opt-in replacement
   candidate pending the station owner's real-device call (U42 slice ⑧).

   V2 rewrite (2026-07-18): V1 used sparse glowing dust in a small inline
   canvas panel; two real-device rounds (a size/distance tuning pass, then
   the station owner supplying twosigma.com reference screenshots) showed
   the actual target look is dense FLAT SOLID DISCS + an orthogonal
   Manhattan line matrix + a minimal wireframe HUD, presented full-screen.
   This file owns the whole experience: it injects its own `.sfStage`
   overlay into <body> (so non-flag visitors carry zero extra DOM/bytes),
   builds the WebGL scene, and wires the HUD (play/pause, filter, D-pad,
   exit, info modal). The data-space mapping (src/lib/dataToSpace.js,
   Charter 2 — no faked readings) is unchanged from V1.

   Two THREE.Points layers (dust: decorative, unpickable; data: real nodes,
   pickable) share ONE shader pair — solid disc, NormalBlending (not
   additive: the reference has no glow), per-vertex depth fog. A third
   THREE.LineSegments layer draws axis-aligned ("Manhattan") connectors
   between nearby dust points for the reference's grid/maze look, using
   THREE's built-in scene.fog (the points layers do their own fog math in
   the fragment shader instead, since ShaderMaterial doesn't get the
   automatic fog chunk).

   Camera is a damped 3-axis orbit (azimuth/elevation/distance, eased with
   src/combat/cameraMath.js's smoothDamp) around a focus point. The D-pad
   pans that focus along the camera's own right/up vectors (also
   smoothDamp'd, so releasing a held button coasts to a stop for free — no
   GSAP needed). Clicking a data particle flies the focus/distance to it
   and opens the info modal (content supplied by the host page via
   `opts.buildDetail`, matching sectors.html's existing detail-lookup
   logic instead of a second copy). Play/pause owns ambient motion (idle
   azimuth drift + point drift) instead of V1's 15s-idle timer. Esc /
   double-click on empty space steps back one layer at a time: modal, then
   filter panel, then exits full-screen.

   prefers-reduced-motion: starts paused (no ambient motion at all); all
   camera moves (fly-to/D-pad/filter) still work since they're direct
   manipulation, just with a near-zero smoothTime so they resolve in ~1
   frame instead of easing.
   ============================================================ */
import * as THREE from 'three';
import { smoothDamp } from '../combat/cameraMath.js';
import { buildSpaceData } from '../lib/dataToSpace.js';

const COLOR_US = new THREE.Color(0x00c3d7);       // cyan — US camp
const COLOR_CN = new THREE.Color(0xf5d76e);       // gold — CN camp
const COLOR_UNSCORED = new THREE.Color(0xffffff); // white — arena-universe filler, no vendor correlation call
const DUST_PALETTE = [COLOR_UNSCORED, COLOR_UNSCORED, COLOR_UNSCORED, COLOR_US, COLOR_CN]; // mostly white, some cyan/gold — decorative only, no data meaning

const WORLD_SCALE = 60;         // data-space unit -> world unit (unchanged from V1)
const FIELD = 900;              // dust/line field extent (box, +-FIELD/2 per axis)
const FOG_NEAR = 120, FOG_FAR = 1100;
const OVERVIEW_DISTANCE = 320, FOCUS_DISTANCE = 70;
const DUST_N_DESKTOP = 12000, DUST_N_MOBILE = 6000;
const GRID_PAIRS_DESKTOP = 400, GRID_PAIRS_MOBILE = 200;
const MAX_LINK_DIST = 260;      // Manhattan connectors only join reasonably-nearby dust, not the whole field diagonally
const SMOOTH_TIME = 0.5;        // seconds, camera orbit/fly-to/D-pad ease
const IDLE_OMEGA = 0.045;       // rad/s, ambient azimuth drift while "playing"
const PARALLAX_AZ = 0.10, PARALLAX_EL = 0.06; // rad, max additive camera offset from mouse position (U42 42-7)
const PARALLAX_SMOOTH = 0.6;    // seconds — deliberately looser than SMOOTH_TIME so parallax reads as a slow drift, not a snap

const BUCKET_ORDER = ['model-vendor', 'core-ai-hardware', 'megacap-tech', 'benchmark', 'supply-chain'];
const BUCKET_LABEL = {
  'model-vendor': ['Model vendors', '模型厂商'],
  'core-ai-hardware': ['AI hardware', 'AI 硬件'],
  'megacap-tech': ['Megacap tech', '超大盘科技'],
  benchmark: ['Benchmarks', '基准指数'],
  'supply-chain': ['Supply chain', '供应链'],
};

/* ── shared point shader (dust + data layers) — solid disc, no glow,
   per-vertex depth fog, uPixelRatio-aware sizing (V1's tiny-on-retina
   bug: gl_PointSize is in device pixels, so a formula tuned without a
   DPR term renders visibly smaller on any 2x display). ─────────────── */
const POINT_VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aPhase; attribute float aMatch;
uniform float uTime, uSizeK, uSizeMax, uPixelRatio, uFogNear, uFogFar;
varying vec3 vColor; varying float vFog; varying float vMatch;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.05 + aPhase) * 2.4;
  p.y += cos(uTime * 0.04 + aPhase * 1.3) * 2.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  gl_PointSize = min(uSizeMax, aSize * uPixelRatio * (uSizeK / max(1.0, dist)));
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vFog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  vMatch = aMatch;
}`;
const POINT_FRAG = `
precision mediump float;
varying vec3 vColor; varying float vFog; varying float vMatch;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.44, d);
  vec3 c = mix(vColor, vColor * 0.25, vFog);
  float a = edge * (1.0 - vFog * 0.85) * mix(0.15, 1.0, vMatch);
  gl_FragColor = vec4(c, a);
}`;

function sphericalOffset(azimuth, elevation, distance) {
  const ce = Math.cos(elevation);
  return {
    x: distance * ce * Math.sin(azimuth),
    y: distance * Math.sin(elevation),
    z: distance * ce * Math.cos(azimuth),
  };
}

// Axis-aligned 3-segment polyline between two points ("Manhattan" routing —
// the reference's grid/maze look, not straight diagonal wires).
function manhattanSegments(a, b, out) {
  out.push(a.x, a.y, a.z, b.x, a.y, a.z);
  out.push(b.x, a.y, a.z, b.x, b.y, a.z);
  out.push(b.x, b.y, a.z, b.x, b.y, b.z);
}

function lang() { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : 'en'; } catch (e) { return 'en'; } }
function T(en, zh) { return lang() === 'zh' ? zh : en; }

const STAGE_HTML = `
<canvas class="sfCanvas"></canvas>
<button class="sfPlay" type="button" aria-pressed="true" aria-label="Pause ambient motion">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path class="ic-pause" d="M8 6h3v12H8zM13 6h3v12h-3z"/><path class="ic-play" d="M8 5l12 7-12 7z"/></svg>
</button>
<div class="sfTools">
  <button class="sfBtn sfFilterBtn" type="button" aria-expanded="false" aria-label="Filter">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4-2v-4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
  </button>
  <button class="sfBtn sfExit" type="button" aria-label="Exit star field">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.5"/></svg>
  </button>
</div>
<div class="sfFilters" hidden></div>
<div class="sfDpad" role="group" aria-label="Pan camera">
  <button data-dir="up" aria-label="Pan up">&uarr;</button>
  <button data-dir="left" aria-label="Pan left">&larr;</button>
  <button data-dir="right" aria-label="Pan right">&rarr;</button>
  <button data-dir="down" aria-label="Pan down">&darr;</button>
</div>
<aside class="sfModal" hidden role="dialog" aria-modal="false">
  <button class="sfModalClose" type="button" aria-label="Close">&times;</button>
  <h2 class="sfModalTitle"></h2>
  <span class="sfModalTag" hidden></span>
  <div class="sfModalBanner" aria-hidden="true"></div>
  <div class="sfModalBody"></div>
</aside>`;

/**
 * @param {{sectorsData?: object, universeData?: object}} data
 * @param {{buildDetail?:(node:object)=>({title:string,tag?:string,tagClass?:string,bodyHtml:string}|null), onExit?:()=>void}} [opts]
 * @returns {{update:(data:object)=>void, destroy:()=>void}|null}
 */
export function initSectorsStarfield(data, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buildDetail = typeof opts.buildDetail === 'function' ? opts.buildDetail : () => null;
  const onExit = typeof opts.onExit === 'function' ? opts.onExit : () => {};

  const stage = document.createElement('div');
  stage.className = 'sfStage';
  stage.innerHTML = STAGE_HTML;
  document.body.appendChild(stage);

  const canvas = stage.querySelector('.sfCanvas');
  const playBtn = stage.querySelector('.sfPlay');
  const filterBtn = stage.querySelector('.sfFilterBtn');
  const exitBtn = stage.querySelector('.sfExit');
  const filtersEl = stage.querySelector('.sfFilters');
  const dpad = stage.querySelector('.sfDpad');
  const modalEl = stage.querySelector('.sfModal');
  const modalCloseBtn = stage.querySelector('.sfModalClose');
  const modalTitle = stage.querySelector('.sfModalTitle');
  const modalTag = stage.querySelector('.sfModalTag');
  const modalBody = stage.querySelector('.sfModalBody');

  function isMobile() { return innerWidth < 640; }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { stage.remove(); return null; }
  renderer.setClearColor(0x000000, 1);
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
  canvas.addEventListener('webglcontextrestored', () => { try { size(); render(performance.now()); } catch (e) {} }, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, FOG_NEAR, FOG_FAR); // line layer only — points do their own fog math (see POINT_FRAG)
  const camera = new THREE.PerspectiveCamera(55, 1, 1, FOG_FAR * 1.4);

  // ── background dust (ambiance only, never pickable) ──
  const dustN = isMobile() ? DUST_N_MOBILE : DUST_N_DESKTOP;
  const dustPos = new Float32Array(dustN * 3), dustSize = new Float32Array(dustN),
        dustPhase = new Float32Array(dustN), dustColor = new Float32Array(dustN * 3), dustMatch = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * FIELD;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * FIELD * 0.6;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * FIELD;
    dustSize[i] = Math.random() < 0.06 ? 3.0 + Math.random() * 4.0 : 1.0 + Math.random() * 1.6; // mostly small, occasional bigger "stars"
    dustPhase[i] = Math.random() * 100;
    const c = DUST_PALETTE[(Math.random() * DUST_PALETTE.length) | 0];
    dustColor[i * 3] = c.r; dustColor[i * 3 + 1] = c.g; dustColor[i * 3 + 2] = c.b;
    dustMatch[i] = 1.0;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));
  dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhase, 1));
  dustGeo.setAttribute('aColor', new THREE.BufferAttribute(dustColor, 3));
  dustGeo.setAttribute('aMatch', new THREE.BufferAttribute(dustMatch, 1));
  const dustUniforms = { uTime: { value: 0 }, uSizeK: { value: 320 }, uSizeMax: { value: 22 }, uPixelRatio: { value: 1 }, uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR } };
  const dustMat = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, uniforms: dustUniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ── Manhattan connector lines between nearby dust points ──
  const gridPairs = isMobile() ? GRID_PAIRS_MOBILE : GRID_PAIRS_DESKTOP;
  const lineVerts = [];
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  for (let i = 0; i < gridPairs; i++) {
    const ia = (Math.random() * dustN) | 0, ib = (Math.random() * dustN) | 0;
    if (ia === ib) continue;
    tmpA.set(dustPos[ia * 3], dustPos[ia * 3 + 1], dustPos[ia * 3 + 2]);
    tmpB.set(dustPos[ib * 3], dustPos[ib * 3 + 1], dustPos[ib * 3 + 2]);
    if (tmpA.distanceTo(tmpB) > MAX_LINK_DIST) continue;
    manhattanSegments(tmpA, tmpB, lineVerts);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, fog: true });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // ── data layer (from dataToSpace.js — real coordinates, real meaning) ──
  const dataGeo = new THREE.BufferGeometry();
  const dataUniforms = { uTime: { value: 0 }, uSizeK: { value: 420 }, uSizeMax: { value: 90 }, uPixelRatio: { value: 1 }, uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR } };
  const dataMat = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, uniforms: dataUniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  const dataPoints = new THREE.Points(dataGeo, dataMat);
  scene.add(dataPoints);

  let nodes = [];
  let focusDefault = { x: 0, y: 0, z: 0 };
  let overviewDistance = OVERVIEW_DISTANCE;
  let activeMarket = 'ALL', activeBucket = 'ALL';

  function nodeMatches(node) {
    return (activeMarket === 'ALL' || node.market === activeMarket) && (activeBucket === 'ALL' || node.bucket === activeBucket);
  }

  function buildDataLayer(raw) {
    const { nodes: n } = buildSpaceData(raw || {});
    nodes = n;
    const count = Math.max(1, nodes.length);
    const pos = new Float32Array(count * 3), siz = new Float32Array(count), phase = new Float32Array(count),
          col = new Float32Array(count * 3), match = new Float32Array(count);
    let cx = 0, cy = 0, cz = 0, maxR = 0.1;
    nodes.forEach((node, i) => {
      const wx = node.x * WORLD_SCALE, wy = (node.y - 0.5) * WORLD_SCALE * 1.4, wz = node.z * WORLD_SCALE;
      pos[i * 3] = wx; pos[i * 3 + 1] = wy; pos[i * 3 + 2] = wz;
      siz[i] = node.kind === 'vendor' ? 14 : node.kind === 'equity' ? 9 : 7;
      phase[i] = Math.random() * 100;
      const c = node.kind === 'universe' ? COLOR_UNSCORED : (node.market === 'CN' ? COLOR_CN : COLOR_US);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      match[i] = nodeMatches(node) ? 1 : 0;
      cx += wx; cy += wy; cz += wz;
      node._wx = wx; node._wy = wy; node._wz = wz;
    });
    cx /= count; cy /= count; cz /= count;
    nodes.forEach((node) => { maxR = Math.max(maxR, Math.hypot(node._wx - cx, node._wy - cy, node._wz - cz)); });
    dataGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dataGeo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    dataGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    dataGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    dataGeo.setAttribute('aMatch', new THREE.BufferAttribute(match, 1));
    focusDefault = { x: cx, y: cy, z: cz };
    overviewDistance = Math.max(110, maxR * 1.9);
  }
  buildDataLayer(data);

  function applyFilters() {
    const attr = dataGeo.getAttribute('aMatch');
    if (!attr) return;
    nodes.forEach((node, i) => { attr.array[i] = nodeMatches(node) ? 1 : 0; });
    attr.needsUpdate = true;
  }

  // ── camera orbit state (azimuth/elevation/distance around a focus point) ──
  let azimuth = 0.5, azimuthTarget = 0.5, azimuthVel = { v: 0 };
  let elevation = 0.32, elevationTarget = 0.32, elevationVel = { v: 0 };
  let distance = overviewDistance, distanceTarget = overviewDistance, distanceVel = { v: 0 };
  let focus = { ...focusDefault }, focusTarget = { ...focusDefault };
  const focusVel = { x: { v: 0 }, y: { v: 0 }, z: { v: 0 } };
  distanceTarget = overviewDistance;

  let playing = !reduce;
  let focused = null;

  // ── mouse parallax: additive camera offset on top of the orbit above,
  // not a second lerp channel — suspended under reduced-motion, pause, or
  // an active drag/pinch (`pointers.size`), same gating as ambient drift. ──
  let parallaxTX = 0, parallaxTY = 0;
  let parallaxAz = 0, parallaxEl = 0;
  const parallaxAzVel = { v: 0 }, parallaxElVel = { v: 0 };
  function onStagePointerMove(e) {
    if (e.pointerType !== 'mouse' || pointers.size) return;
    parallaxTX = (e.clientX / innerWidth) * 2 - 1;
    parallaxTY = -(e.clientY / innerHeight) * 2 + 1;
  }

  function openModal(node) {
    const d = buildDetail(node);
    if (!d) { modalEl.hidden = true; return; }
    modalTitle.textContent = d.title;
    if (d.tag) { modalTag.hidden = false; modalTag.textContent = d.tag; modalTag.className = 'sfModalTag' + (d.tagClass ? ' ' + d.tagClass : ''); }
    else modalTag.hidden = true;
    modalBody.innerHTML = d.bodyHtml || '';
    modalEl.hidden = false;
  }
  function closeModal() { modalEl.hidden = true; }
  function closeFilters() { filtersEl.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); }

  function flyTo(node) {
    focused = node;
    focusTarget = { x: node._wx, y: node._wy, z: node._wz };
    distanceTarget = FOCUS_DISTANCE;
    openModal(node);
  }
  function flyToOverview() {
    focused = null;
    focusTarget = { ...focusDefault };
    distanceTarget = overviewDistance;
    closeModal();
  }
  // Esc / double-click-empty step back one layer at a time rather than
  // exiting outright — matches the reference's "close what's on top first".
  function layeredBack() {
    if (!modalEl.hidden) { flyToOverview(); return; }
    if (!filtersEl.hidden) { closeFilters(); return; }
    destroy();
  }

  // ── filter panel (real fields: market from dataToSpace, bucket layer) ──
  function renderFilters() {
    const chips = [{ type: 'market', value: 'ALL', en: 'ALL', zh: '全部' },
      { type: 'market', value: 'US', en: 'US', zh: '美股' }, { type: 'market', value: 'CN', en: 'CN', zh: '中国' }];
    BUCKET_ORDER.forEach((b) => chips.push({ type: 'bucket', value: b, en: BUCKET_LABEL[b][0], zh: BUCKET_LABEL[b][1] }));
    chips.unshift({ type: 'bucket', value: 'ALL', en: 'ALL', zh: '全部' });
    filtersEl.innerHTML = chips.map((c) => {
      const active = (c.type === 'market' && activeMarket === c.value) || (c.type === 'bucket' && activeBucket === c.value);
      return '<button type="button" data-type="' + c.type + '" data-value="' + c.value + '" class="' + (active ? 'active' : '') + '">' + (lang() === 'zh' ? c.zh : c.en) + '</button>';
    }).join('');
  }
  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.type === 'market') activeMarket = btn.dataset.value; else activeBucket = btn.dataset.value;
    renderFilters(); applyFilters();
  });
  renderFilters();

  // ── D-pad + arrow-key camera pan (focus slides along the camera's own
  // right/up vectors; releasing coasts to a stop via the same smoothDamp
  // used for orbit — no separate inertia system needed). ──
  const held = new Set();
  function setHeld(dir, on) {
    if (on) held.add(dir); else held.delete(dir);
    dpad.querySelectorAll('button').forEach((b) => b.classList.toggle('held', held.has(b.dataset.dir)));
  }
  function applyDpad(dt) {
    if (!held.size) return;
    const m = camera.matrix.elements; // camera has no parent, so local == world; right = m[0..2], up = m[4..6]
    const step = distance * 0.55 * dt;
    let dx = 0, dy = 0;
    if (held.has('left')) dx -= 1; if (held.has('right')) dx += 1;
    if (held.has('down')) dy -= 1; if (held.has('up')) dy += 1;
    focusTarget.x += (dx * m[0] + dy * m[4]) * step;
    focusTarget.y += (dx * m[1] + dy * m[5]) * step;
    focusTarget.z += (dx * m[2] + dy * m[6]) * step;
  }
  dpad.querySelectorAll('button[data-dir]').forEach((b) => {
    const dir = b.dataset.dir;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); setHeld(dir, true); });
    b.addEventListener('pointerup', () => setHeld(dir, false));
    b.addEventListener('pointerleave', () => setHeld(dir, false));
    b.addEventListener('pointercancel', () => setHeld(dir, false));
  });
  const ARROW_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  // ── pointer interaction: orbit-drag, wheel/pinch dolly, click select,
  // hover cursor feedback ──
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 9 };
  const ndc = new THREE.Vector2();
  const pointers = new Map();
  let dragMoved = false, downX = 0, downY = 0;
  let pinchStart = 0, pinchDistanceStart = overviewDistance;

  function relXY(e) { return { x: e.clientX, y: e.clientY }; }
  function pick(px, py) {
    if (!nodes.length) return null;
    ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(dataPoints);
    return hits.length ? (nodes[hits[0].index] || null) : null;
  }

  function onPointerDown(e) {
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
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const p = relXY(e);
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
      const hit = pick(p.x, p.y);
      if (hit) flyTo(hit); else flyToOverview();
    }
  }
  function onWheel(e) {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0012);
    distanceTarget = Math.min(overviewDistance * 1.6, Math.max(FOCUS_DISTANCE * 0.6, distanceTarget * factor));
  }
  function onDblClick(e) { if (!pick(e.clientX, e.clientY)) layeredBack(); }
  function onKeyDown(e) {
    if (e.key === 'Escape') { layeredBack(); return; }
    const dir = ARROW_DIR[e.key];
    if (dir) { e.preventDefault(); setHeld(dir, true); }
  }
  function onKeyUp(e) { const dir = ARROW_DIR[e.key]; if (dir) setHeld(dir, false); }

  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerup', onPointerUp, { passive: true });
  stage.addEventListener('pointermove', onStagePointerMove, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);

  function togglePlay() {
    playing = !playing;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause ambient motion' : 'Resume ambient motion');
  }
  playBtn.addEventListener('click', togglePlay);
  filterBtn.addEventListener('click', () => {
    const open = filtersEl.hidden;
    filtersEl.hidden = !open; filterBtn.setAttribute('aria-expanded', String(open));
  });
  modalCloseBtn.addEventListener('click', flyToOverview);
  exitBtn.addEventListener('click', destroy);

  // ── render loop ──
  function size() {
    const dpr = Math.min(isMobile() ? 1.5 : 2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    dustUniforms.uPixelRatio.value = dpr; dataUniforms.uPixelRatio.value = dpr;
  }

  let lastT = 0, running = false, raf = 0;
  function render(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016; lastT = t;
    if (playing) {
      const tm = t * 0.001;
      dustUniforms.uTime.value = tm; dataUniforms.uTime.value = tm;
      if (!focused) azimuthTarget += IDLE_OMEGA * dt;
    }
    applyDpad(dt);
    const st = reduce ? 0.0001 : SMOOTH_TIME;
    azimuth = smoothDamp(azimuth, azimuthTarget, azimuthVel, st, dt);
    elevation = smoothDamp(elevation, elevationTarget, elevationVel, st, dt);
    distance = smoothDamp(distance, distanceTarget, distanceVel, st, dt);
    focus.x = smoothDamp(focus.x, focusTarget.x, focusVel.x, st, dt);
    focus.y = smoothDamp(focus.y, focusTarget.y, focusVel.y, st, dt);
    focus.z = smoothDamp(focus.z, focusTarget.z, focusVel.z, st, dt);
    const wantParallax = !(reduce || !playing || pointers.size);
    parallaxAz = smoothDamp(parallaxAz, wantParallax ? parallaxTX * PARALLAX_AZ : 0, parallaxAzVel, PARALLAX_SMOOTH, dt);
    parallaxEl = smoothDamp(parallaxEl, wantParallax ? parallaxTY * PARALLAX_EL : 0, parallaxElVel, PARALLAX_SMOOTH, dt);
    const off = sphericalOffset(azimuth + parallaxAz, elevation + parallaxEl, distance);
    camera.position.set(focus.x + off.x, focus.y + off.y, focus.z + off.z);
    camera.lookAt(focus.x, focus.y, focus.z);
    renderer.render(scene, camera);
  }
  function loop(t) { render(t); if (running) raf = requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  const onVisibility = () => { if (document.hidden) stop(); else start(); };

  size();
  render(performance.now());
  start();
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('resize', size, { passive: true });

  let destroyed = false;
  function destroy() {
    if (destroyed) return; destroyed = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('pointerdown', onPointerDown);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('pointermove', onStagePointerMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDblClick);
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('resize', size);
    renderer.dispose();
    stage.remove();
    onExit();
  }

  return {
    update(newData) { buildDataLayer(newData); },
    destroy,
  };
}
