/* ============================================================
   SECTORS GRAPH VIEW — Canvas 2D render + pan/zoom/drag/click for the
   force-directed "US–CN AI watch" graph (U30 R3). All physics lives in
   forceGraph.js (pure, vitest-covered); this file is the DOM-touching half:
   sizing, the render loop, and turning pointer/touch input into either a
   camera pan/zoom, a node drag, or a click that opens a detail card.

   Same defensive patterns as alphardForge.js (this codebase's other
   canvas-driven visual): IntersectionObserver gates the rAF loop so an
   off-screen page doesn't burn CPU, prefers-reduced-motion renders one
   static settled frame with all interaction still live (dragging/clicking
   doesn't require animation, only the idle "breathing" float does).
   ============================================================ */
import { buildForceGraphData, createForceSim, stepForceSim, settleForceSim } from './forceGraph.js';

// Red (CN) vs blue (US) faction colors — matches the sectors.css
// --faction-us/--faction-cn tokens used everywhere else US/CN is tagged on
// this page (story-card badges, rail media, factionBar). Kept as literal
// hex here since this canvas-drawing module has no access to CSS custom
// properties without a getComputedStyle round-trip per frame.
const MARKET_COLOR = { US: '#4268ff', CN: '#ff2d55' };
const KIND_RADIUS = { pole: 0, vendor: 15, equity: 9 };
const MOBILE_MAX_EQUITIES = 8; // per-basket cap so small screens don't drown in nodes (30b mobile rule)

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
  // camera: canvas-px-per-unit scale + pan offset (in canvas px), origin at center
  let camScale = 1, camX = 0, camY = 0;
  let sim = null;

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
    const maxRadius = sim.nodes.reduce((m, n) => Math.max(m, Math.hypot(n.x, n.y)), 0.1);
    camScale = Math.min(W, H) / (maxRadius * 2.4);
  }

  function worldToScreen(x, y) { return [W / 2 + camX + x * camScale, H / 2 + camY + y * camScale]; }
  function screenToWorld(sx, sy) { return [(sx - W / 2 - camX) / camScale, (sy - H / 2 - camY) / camScale]; }

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

  // ── idle breathing (purely cosmetic, layered on top of settled positions —
  // never fed back into the physics state, so it can't destabilize the sim) ──
  let t0 = 0;
  function breathe(node, t) {
    if (reduce) return [node.x, node.y];
    const ph = (node._ph ?? (node._ph = Math.random() * Math.PI * 2));
    const amp = node.kind === 'vendor' ? 0.02 : 0.014;
    return [node.x + Math.sin(t * 0.6 + ph) * amp, node.y + Math.cos(t * 0.5 + ph * 1.3) * amp];
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // links
    for (const l of sim.links) {
      if (l.kind === 'pole') continue;
      const a = sim.nodes[l.a], b = sim.nodes[l.b];
      const [ax, ay] = worldToScreen(...breathe(a, t)), [bx, by] = worldToScreen(...breathe(b, t));
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      if (l.kind === 'pressure') {
        ctx.strokeStyle = 'rgba(255,111,31,.45)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(0,231,255,.28)'; ctx.setLineDash([]); ctx.lineWidth = 1 + (l.weight || 0.5) * 1.4;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // nodes
    for (const n of sim.nodes) {
      if (n.kind === 'pole') continue;
      const [x, y] = worldToScreen(...breathe(n, t));
      const r = (KIND_RADIUS[n.kind] || 6) * (n === dragNode ? 1.2 : 1);
      const color = MARKET_COLOR[n.market] || '#eef7fb';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.kind === 'vendor' ? color : 'rgba(255,255,255,.9)';
      ctx.globalAlpha = n.kind === 'vendor' ? 0.85 : 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
      ctx.font = (n.kind === 'vendor' ? '700 11px' : '700 9px') + ' "PP Fraktion Mono","IBM Plex Mono",monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(labelFor(n), x, y + r + 13);
    }
  }

  // ── interaction: pan (drag empty space), drag (drag a node), click (open detail) ──
  let dragNode = null, dragging = false, panning = false;
  let lastX = 0, lastY = 0, downX = 0, downY = 0, moved = false;
  let pinch0 = 0, pinchScale0 = 1;

  function pointerDown(sx, sy) {
    downX = sx; downY = sy; lastX = sx; lastY = sy; moved = false;
    const n = nodeAt(sx, sy);
    if (n) { dragNode = n; dragNode.fx = dragNode.x; dragNode.fy = dragNode.y; dragging = true; }
    else { panning = true; }
  }
  function pointerMove(sx, sy) {
    if (Math.hypot(sx - downX, sy - downY) > 4) moved = true;
    if (dragging && dragNode) {
      const [wx, wy] = screenToWorld(sx, sy);
      dragNode.fx = wx; dragNode.fy = wy;
    } else if (panning) {
      camX += sx - lastX; camY += sy - lastY;
    }
    lastX = sx; lastY = sy;
  }
  function pointerUp(sx, sy) {
    if (dragNode) { delete dragNode.fx; delete dragNode.fy; dragNode = null; }
    if (!moved) { const n = nodeAt(sx, sy); if (n) onSelect(n); }
    dragging = false; panning = false;
  }

  function relXY(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const onMouseDown = (e) => { const [x, y] = relXY(e); pointerDown(x, y); };
  const onMouseMove = (e) => { const [x, y] = relXY(e); pointerMove(x, y); };
  const onMouseUp = (e) => { const [x, y] = relXY(e); pointerUp(x, y); };
  const onWheel = (e) => { e.preventDefault(); const factor = Math.exp(-e.deltaY * 0.001); camScale = Math.min(Math.max(camScale * factor, 30), 400); };

  function touchXY(t) { const r = canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; }
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchScale0 = camScale; dragging = false; panning = false;
    } else if (e.touches.length === 1) { const [x, y] = touchXY(e.touches[0]); pointerDown(x, y); }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camScale = Math.min(Math.max(pinchScale0 * (d / (pinch0 || 1)), 30), 400);
    } else if (e.touches.length === 1) { const [x, y] = touchXY(e.touches[0]); pointerMove(x, y); }
  };
  const onTouchEnd = (e) => { const t = e.changedTouches[0]; if (t) { const [x, y] = touchXY(t); pointerUp(x, y); } };

  canvas.addEventListener('mousedown', onMouseDown);
  addEventListener('mousemove', onMouseMove, { passive: true });
  addEventListener('mouseup', onMouseUp, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });

  // ── rAF loop, gated by visibility (IntersectionObserver, same as alphardForge.js) ──
  let running = false, raf = 0;
  function loop(t) {
    t0 = t * 0.001;
    if (!dragging) stepForceSim(sim, 1); // keep settling around live drags/data updates
    draw(t0);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0 });
  io.observe(canvas);

  size(); draw(0);
  // rAF loop always runs (gated on-screen by the IntersectionObserver above) even
  // under prefers-reduced-motion: breathe() already freezes the decorative float
  // in that case, but drag/pan/zoom still need a redraw every frame to track the
  // pointer, and that's direct-manipulation feedback, not the ambient motion
  // reduced-motion opts out of.
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
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    },
  };
}
