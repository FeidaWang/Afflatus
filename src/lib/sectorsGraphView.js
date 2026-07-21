/* ============================================================
   SECTORS GRAPH VIEW — Canvas 2D render + pan/zoom/drag/click for the
   force-directed "US–CN AI watch" graph (U30 R3). All physics lives in
   forceGraph.js (pure, vitest-covered); this file is the DOM-touching half:
   sizing, the render loop, and turning pointer/touch input into either a
   camera pan/zoom, a node drag, or a click that opens a detail card.

   Camera language (urgent.md Part 2 §10, replicating the path-to-hope graph
   module): cursor-anchored zoom, inertial pan with a soft rubber-band edge,
   focus-fly on node select, and a preBloom->bloom entrance. All of that
   math is pure and lives in graphCamera.js (vitest-covered) — this file
   only feeds it screen coordinates and paints the result. Every camera
   motion is a critically-damped smoothDamp follow (design.md 宪章③: never a
   linear tween, never a teleport).

   Same defensive patterns as alphardForge.js (this codebase's other
   canvas-driven visual): IntersectionObserver gates the rAF loop so an
   off-screen page doesn't burn CPU, prefers-reduced-motion renders one
   static settled frame with all interaction still live (dragging/clicking
   doesn't require animation, only the idle "breathing" float and the bloom/
   inertia/focus-fly motion do).
   ============================================================ */
import { buildForceGraphData, createForceSim, stepForceSim, settleForceSim } from './forceGraph.js';
import {
  smoothDamp, zoomAnchor, decayVelocity, clampPanTarget, focusTarget,
  easeOutBack, bloomLinkT, bloomNodeT, bloomLabelAlpha, BLOOM_DURATION,
} from './graphCamera.js';

// Red (CN) vs blue (US) faction colors — matches the sectors.css
// --faction-us/--faction-cn tokens used everywhere else US/CN is tagged on
// this page (story-card badges, rail media, factionBar). Kept as literal
// hex here since this canvas-drawing module has no access to CSS custom
// properties without a getComputedStyle round-trip per frame.
const MARKET_COLOR = { US: '#4268ff', CN: '#ff2d55' };
const KIND_RADIUS = { pole: 0, vendor: 15, equity: 9 };
const MOBILE_MAX_EQUITIES = 8; // per-basket cap so small screens don't drown in nodes (30b mobile rule)

const PAN_TAU = 0.10, ZOOM_TAU = 0.12, FOCUS_TAU = 0.35; // urgent.md §10.1
const MIN_SCALE = 30, MAX_SCALE = 400;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} sectorsData parsed sectors-data.json
 * @param {{onSelect?:(node:object)=>void, lang?:()=>string}} [opts]
 * @returns {{update:(data:object)=>void, destroy:()=>void}}
 */
export function initSectorsGraph(canvas, sectorsData, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, destroy() {} };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : () => {};
  const labelFor = typeof opts.labelFor === 'function' ? opts.labelFor : (n) => n.label;

  let W = 1, H = 1, dpr = 1;
  let sim = null;
  let sized = false;
  let maxRadius = 0.1; // settled sim extent (world units), recomputed in size()
  let homeScale = 1;   // the fitted "camera home" scale computed in size()

  // camera: rendered (x/y/scale, what's drawn) chases target (tx/ty/tscale,
  // what input/logic wants) via smoothDamp; vx/vy/vscale are smoothDamp's
  // own internal follow-velocities (not the same thing as pan inertia below).
  const cam = { x: 0, y: 0, scale: 1, tx: 0, ty: 0, tscale: 1, vx: 0, vy: 0, vscale: 0 };
  let camTau = PAN_TAU; // switches to FOCUS_TAU during a focus-fly, back once settled
  let focusing = false;

  function isMobile() { return (canvas.getBoundingClientRect().width || innerWidth) < 640; }

  function capForMobile(data) {
    if (!isMobile()) return data;
    const capped = JSON.parse(JSON.stringify(data));
    if (Array.isArray(capped.baskets)) {
      capped.baskets = capped.baskets.map((b) => ({
        ...b,
        equities: (b.equities || []).slice().sort((a, c) => (c.confidence || 0) - (a.confidence || 0)).slice(0, MOBILE_MAX_EQUITIES),
      }));
    }
    return capped;
  }

  function buildSim(data) {
    const graph = buildForceGraphData(capForMobile(data));
    const s = createForceSim(graph);
    settleForceSim(s, 220); // pre-settle so the first paint isn't a chaotic jump
    return s;
  }

  sim = buildSim(sectorsData || {});

  function size() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    // Fit the actual settled extent of the current sim, not a fixed guess:
    // real modelWatch/basket data (more nodes than the small dev fixtures)
    // settles to a noticeably larger radius, and a hardcoded assumption left
    // the graph rendering as a tiny cluster in the middle of the canvas.
    maxRadius = sim.nodes.reduce((m, n) => Math.max(m, Math.hypot(n.x, n.y)), 0.1);
    homeScale = Math.min(W, H) / (maxRadius * 2.4);
    // First layout: snap straight to home, no flying-in from nowhere. A
    // resize while already interacting just re-clamps the target — smoothDamp
    // glides there like any other move.
    if (!sized) { cam.scale = cam.tscale = homeScale; sized = true; }
    else { cam.tscale = Math.min(Math.max(cam.tscale, MIN_SCALE), MAX_SCALE); }
  }

  function worldToScreen(x, y) { return [W / 2 + cam.x + x * cam.scale, H / 2 + cam.y + y * cam.scale]; }
  function screenToWorld(sx, sy) { return [(sx - W / 2 - cam.x) / cam.scale, (sy - H / 2 - cam.y) / cam.scale]; }

  function nodeAt(sx, sy) {
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      if (n.kind === 'pole') continue;
      const [px, py] = worldToScreen(n.x, n.y);
      const rr = (KIND_RADIUS[n.kind] || 6) + 4;
      if ((sx - px) ** 2 + (sy - py) ** 2 <= rr * rr) return n;
    }
    return null;
  }

  // Self-driven camera moves (focus-fly, home) vs. continuous pointer
  // manipulation: reduced-motion exempts direct drag/pan/zoom (feedback tied
  // 1:1 to the pointer, imperceptibly smoothed) but this ambient "camera
  // flies there on its own" motion is exactly what reduced-motion opts out
  // of, so it snaps straight to the final pose instead of gliding (urgent.md §11).
  function flyTo(tx, ty, tscale) {
    cam.tx = tx; cam.ty = ty; cam.tscale = tscale;
    if (reduce) {
      cam.x = tx; cam.y = ty; cam.scale = tscale; cam.vx = cam.vy = cam.vscale = 0;
      focusing = false; camTau = PAN_TAU;
    } else {
      focusing = true; camTau = FOCUS_TAU;
    }
  }

  function goHome() { flyTo(0, 0, homeScale); }

  // ── idle breathing (purely cosmetic, layered on top of settled positions —
  // never fed back into the physics state, so it can't destabilize the sim) ──
  let t0 = 0;
  function breathe(node, t) {
    if (reduce) return [node.x, node.y];
    const ph = (node._ph ?? (node._ph = Math.random() * Math.PI * 2));
    const amp = node.kind === 'vendor' ? 0.02 : 0.014;
    return [node.x + Math.sin(t * 0.6 + ph) * amp, node.y + Math.cos(t * 0.5 + ph * 1.3) * amp];
  }

  // ── preBloom -> bloom entrance (urgent.md §10.5): fires once, the first
  // time the canvas is actually visible. Canvas equivalent of path-to-hope's
  // per-line stroke-dashoffset draw-on + per-node opacity fade. ──
  let bloomStart = null; // performance.now() ms, set on first intersect
  function bloomElapsedSec() {
    if (reduce) return BLOOM_DURATION; // §10.5: full state immediately, no animation
    if (bloomStart == null) return 0;  // not yet triggered (still hidden/off-screen)
    return Math.min(BLOOM_DURATION, (performance.now() - bloomStart) / 1000);
  }

  // ── hover (urgent.md §10.6) ──
  let hoverNode = null, hoverSX = -1, hoverSY = -1;

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bloomT = bloomElapsedSec();
    const hoverActive = !!hoverNode && !dragging;

    // links
    for (const l of sim.links) {
      if (l.kind === 'pole') continue;
      const a = sim.nodes[l.a], b = sim.nodes[l.b];
      const distRatio = Math.min(1, Math.max(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y)) / Math.max(maxRadius, 0.1));
      const lt = bloomLinkT(bloomT, distRatio);
      if (lt <= 0) continue;
      const [ax, ay] = worldToScreen(...breathe(a, t)), [bx, by] = worldToScreen(...breathe(b, t));
      const ex = ax + (bx - ax) * lt, ey = ay + (by - ay) * lt;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey);
      let dim = 1;
      if (hoverActive) dim = (a === hoverNode || b === hoverNode) ? 1 : 0.35;
      if (l.kind === 'pressure') {
        ctx.strokeStyle = 'rgba(255,111,31,.45)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(0,231,255,.28)'; ctx.setLineDash([]); ctx.lineWidth = 1 + (l.weight || 0.5) * 1.4;
      }
      ctx.globalAlpha = lt * dim;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // nodes
    for (const n of sim.nodes) {
      if (n.kind === 'pole') continue;
      const distRatio = Math.min(1, Math.hypot(n.x, n.y) / Math.max(maxRadius, 0.1));
      const nt = bloomNodeT(bloomT, distRatio);
      if (nt <= 0) continue;
      const [x, y] = worldToScreen(...breathe(n, t));
      const isHover = hoverActive && n === hoverNode;
      const baseR = (KIND_RADIUS[n.kind] || 6) * (n === dragNode ? 1.2 : 1) * (isHover ? 1.15 : 1);
      const r = baseR * easeOutBack(nt);
      const color = MARKET_COLOR[n.market] || '#eef7fb';
      const dim = hoverActive && !isHover ? 0.6 : 1;
      ctx.globalAlpha = nt * dim;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.kind === 'vendor' ? color : 'rgba(255,255,255,.9)';
      ctx.globalAlpha = (n.kind === 'vendor' ? 0.85 : 0.9) * nt * dim;
      ctx.fill();
      ctx.globalAlpha = nt * dim;
      ctx.lineWidth = isHover ? 2.5 : 1.5; ctx.strokeStyle = color; ctx.stroke();
      const labelA = bloomLabelAlpha(bloomT) * dim;
      if (labelA > 0) {
        ctx.globalAlpha = labelA;
        ctx.font = (n.kind === 'vendor' ? '700 11px' : '700 9px') + ' "PP Fraktion Mono","IBM Plex Mono",monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(labelFor(n), x, y + r + 13);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── interaction: pan (drag empty space), drag (drag a node), click (open detail) ──
  let dragNode = null, dragging = false, panning = false;
  let lastX = 0, lastY = 0, downX = 0, downY = 0, moved = false;
  let lastMoveT = 0, panVelX = 0, panVelY = 0;
  let inertiaActive = false;
  let pinch0 = 0, pinchScale0 = 1, pinchMidX = 0, pinchMidY = 0;

  function pointerDown(sx, sy) {
    downX = sx; downY = sy; lastX = sx; lastY = sy; moved = false;
    lastMoveT = performance.now(); panVelX = 0; panVelY = 0; inertiaActive = false;
    const n = nodeAt(sx, sy);
    if (n) { dragNode = n; dragNode.fx = dragNode.x; dragNode.fy = dragNode.y; dragging = true; }
    else { panning = true; focusing = false; camTau = PAN_TAU; }
  }
  function pointerMove(sx, sy) {
    if (Math.hypot(sx - downX, sy - downY) > 4) moved = true;
    hoverSX = sx; hoverSY = sy;
    if (dragging && dragNode) {
      const [wx, wy] = screenToWorld(sx, sy);
      dragNode.fx = wx; dragNode.fy = wy;
    } else if (panning) {
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT) / 1000;
      const dx = sx - lastX, dy = sy - lastY;
      cam.tx += dx; cam.ty += dy;
      panVelX = dx / dt; panVelY = dy / dt;
      lastMoveT = now;
    } else {
      hoverNode = nodeAt(sx, sy);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    }
    lastX = sx; lastY = sy;
  }
  function pointerUp(sx, sy) {
    if (dragNode) { delete dragNode.fx; delete dragNode.fy; dragNode = null; }
    if (!moved) {
      const n = nodeAt(sx, sy);
      if (n) {
        onSelect(n);
        const f = focusTarget(n.x, n.y, cam.scale, 1.15);
        flyTo(f.tx, f.ty, f.tscale);
      } else if (panning) {
        goHome(); // blank click while over the graph flies back to the fitted view
      }
    } else if (panning && !reduce && (Math.abs(panVelX) > 2 || Math.abs(panVelY) > 2)) {
      inertiaActive = true; // real pan release with residual speed -> coast + rubber-band (skipped under reduced-motion, §11)
    }
    dragging = false; panning = false;
  }

  function relXY(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const onMouseDown = (e) => { const [x, y] = relXY(e); pointerDown(x, y); };
  const onMouseMove = (e) => { const [x, y] = relXY(e); pointerMove(x, y); };
  const onMouseUp = (e) => { const [x, y] = relXY(e); pointerUp(x, y); };
  const onMouseLeave = () => { hoverNode = null; };
  const onWheel = (e) => {
    e.preventDefault();
    inertiaActive = false; focusing = false; camTau = ZOOM_TAU;
    const [sx, sy] = relXY(e);
    const factor = Math.exp(-e.deltaY * 0.001);
    // anchor off the RENDERED camera (what's actually on screen right now),
    // not the target — keeps the point under the cursor correct even mid-glide.
    const next = zoomAnchor({ tx: cam.x, ty: cam.y, tscale: cam.scale }, sx, sy, factor, W, H, MIN_SCALE, MAX_SCALE);
    cam.tx = next.tx; cam.ty = next.ty; cam.tscale = next.tscale;
  };

  const onKeyDown = (e) => { if (e.key === 'Escape' && running) goHome(); };

  function touchXY(t) { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; }
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchScale0 = cam.scale; dragging = false; panning = false; inertiaActive = false; focusing = false; camTau = ZOOM_TAU;
      const r = canvas.getBoundingClientRect();
      pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    } else if (e.touches.length === 1) { const [x, y] = touchXY(e.touches[0]); pointerDown(x, y); }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      // zoomAnchor wants a multiplicative factor against the CURRENT rendered
      // scale; the pinch gesture itself defines an absolute target scale
      // (pinchScale0 * d/pinch0) relative to where the pinch started, so
      // convert: factor = absoluteTarget / cam.scale.
      const factor = (d / (pinch0 || 1)) / (cam.scale / pinchScale0 || 1);
      const next = zoomAnchor({ tx: cam.x, ty: cam.y, tscale: cam.scale }, pinchMidX, pinchMidY, factor, W, H, MIN_SCALE, MAX_SCALE);
      cam.tx = next.tx; cam.ty = next.ty; cam.tscale = next.tscale;
    } else if (e.touches.length === 1) { const [x, y] = touchXY(e.touches[0]); pointerMove(x, y); }
  };
  const onTouchEnd = (e) => { const t = e.changedTouches[0]; if (t) { const [x, y] = touchXY(t); pointerUp(x, y); } };

  canvas.addEventListener('mousedown', onMouseDown);
  addEventListener('mousemove', onMouseMove, { passive: true });
  addEventListener('mouseup', onMouseUp, { passive: true });
  canvas.addEventListener('mouseleave', onMouseLeave, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKeyDown, { passive: true });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });

  // ── rAF loop, gated by visibility (IntersectionObserver, same as alphardForge.js) ──
  let running = false, raf = 0, lastFrameT = 0;
  function loop(t) {
    t0 = t * 0.001;
    const dt = lastFrameT ? Math.min(0.05, (t - lastFrameT) / 1000) : 1 / 60;
    lastFrameT = t;

    if (!dragging) stepForceSim(sim, 1); // keep settling around live drags/data updates

    if (inertiaActive) {
      cam.tx += panVelX * dt; cam.ty += panVelY * dt;
      panVelX = decayVelocity(panVelX, dt); panVelY = decayVelocity(panVelY, dt);
      const clamped = clampPanTarget(cam.tx, cam.ty, cam.scale, maxRadius, W, H);
      cam.tx = clamped.tx; cam.ty = clamped.ty;
      if (panVelX === 0 && panVelY === 0) inertiaActive = false;
    }

    const rx = smoothDamp(cam.x, cam.tx, cam.vx, camTau, dt); cam.x = rx.value; cam.vx = rx.velocity;
    const ry = smoothDamp(cam.y, cam.ty, cam.vy, camTau, dt); cam.y = ry.value; cam.vy = ry.velocity;
    const rs = smoothDamp(cam.scale, cam.tscale, cam.vscale, camTau, dt); cam.scale = rs.value; cam.vscale = rs.velocity;
    if (focusing && Math.abs(cam.tx - cam.x) < 0.5 && Math.abs(cam.ty - cam.y) < 0.5 && Math.abs(cam.tscale - cam.scale) < 0.5) {
      focusing = false; camTau = PAN_TAU;
    }

    if (!dragging && !panning) { hoverNode = nodeAt(hoverSX, hoverSY); }

    draw(t0);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { if (bloomStart == null) bloomStart = performance.now(); start(); }
    else stop();
  }), { threshold: 0 });
  io.observe(canvas);

  size(); draw(0);
  // rAF loop always runs (gated on-screen by the IntersectionObserver above) even
  // under prefers-reduced-motion: breathe() already freezes the decorative float
  // in that case, but drag/pan/zoom/inertia/focus-fly still need a redraw every
  // frame to track the pointer, and that's direct-manipulation feedback, not the
  // ambient motion reduced-motion opts out of (bloom is the one exception —
  // bloomElapsedSec() short-circuits to "fully bloomed" under reduce).
  addEventListener('resize', () => { size(); draw(t0); }, { passive: true });

  return {
    update(data) {
      sim = buildSim(data || {});
      draw(t0);
    },
    destroy() {
      stop(); io.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      removeEventListener('mousemove', onMouseMove);
      removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    },
  };
}
