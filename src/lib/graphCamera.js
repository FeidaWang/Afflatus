/* ============================================================
   GRAPH CAMERA — pure camera/bloom math for the sectors.html Interactive
   Star Map (交互星图), replicating the path-to-hope graph module's camera
   language (urgent.md Part 2 §10): critically-damped pan/zoom (never a
   linear tween, never a teleport — design.md 宪章③), cursor-anchored zoom,
   inertial pan with soft rubber-band bounds, focus-fly on node select, and
   a preBloom->bloom entrance (pathLength-normalized line draw-on + node
   fade/scale, same visual language as the measured dashoffset:1->0 SVG
   lines and opacity:0->1 node cards on anthropic.com/path-to-hope).

   No DOM here (same pure/view split as forceGraph.js + sectorsGraphView.js
   and scrollReveal.js + scrollRevealView.js): everything below is plain
   numbers in, plain numbers out. sectorsGraphView.js is the DOM-touching
   half — it owns the canvas, pointer events, and the render loop; this file
   only tells it *where things are* on a given frame.
   ============================================================ */

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/**
 * Critically-damped 1D follow (the classic "SmoothDamp" algorithm — Game
 * Programming Gems 4 / Unity's Mathf.SmoothDamp). Unlike a plain exponential
 * chase (scrollReveal.js's chase()) this also carries velocity, so a camera
 * that's still moving when its target changes blends smoothly instead of
 * snapping onto a new decay curve — needed here because pan/zoom targets
 * change every pointermove, not just once per scroll-trigger.
 *
 * @returns {{value:number, velocity:number}}
 */
export function smoothDamp(current, target, velocity, smoothTime, dt) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;
  const temp = (velocity + omega * change) * dt;
  const newVelocity = (velocity - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  // Prevent overshoot: if we've crossed the target, snap and zero velocity
  // rather than let the curve ring past it and back.
  if ((originalTo - current > 0) === (output > originalTo)) {
    output = originalTo;
    return { value: output, velocity: (output - originalTo) / Math.max(dt, 1e-6) };
  }
  return { value: output, velocity: newVelocity };
}

/**
 * Cursor-anchored zoom: given the current camera and a screen-space cursor
 * position, returns the new {tscale, tx, ty} such that the world point that
 * was under the cursor before the zoom is still under it after — the
 * invariant path-to-hope-style graphs rely on (zoom toward what you're
 * pointing at, not toward the canvas center).
 */
export function zoomAnchor(cam, sx, sy, factor, W, H, minScale, maxScale) {
  const wx = (sx - W / 2 - cam.tx) / cam.tscale;
  const wy = (sy - H / 2 - cam.ty) / cam.tscale;
  const tscale = clamp(cam.tscale * factor, minScale, maxScale);
  return { tscale, tx: sx - W / 2 - wx * tscale, ty: sy - H / 2 - wy * tscale };
}

/** Exponential inertia decay for post-drag pan velocity; returns 0 once
 *  below `minSpeed` so callers can stop animating instead of chasing zero. */
export function decayVelocity(v, dt, tau = 0.35, minSpeed = 2) {
  const nv = v * Math.exp(-dt / tau);
  return Math.abs(nv) < minSpeed ? 0 : nv;
}

/**
 * Soft rubber-band bound on a proposed pan target: keeps the graph's
 * settled extent (radius in world units) from leaving the viewport
 * entirely. Callers still smoothDamp toward the clamped value (never snap
 * directly to it), which is what produces the spring-back feel instead of
 * a hard wall.
 */
export function clampPanTarget(tx, ty, scale, maxRadius, W, H) {
  const rPx = Math.max(1, maxRadius) * scale;
  const marginX = W / 2 + rPx * 0.85;
  const marginY = H / 2 + rPx * 0.85;
  return { tx: clamp(tx, -marginX, marginX), ty: clamp(ty, -marginY, marginY) };
}

/** Camera target that centers world point (nodeX, nodeY) at `zoomBoost`x
 *  the current scale — path-to-hope's "fly to focus" on node select. */
export function focusTarget(nodeX, nodeY, currentScale, zoomBoost = 1.15) {
  const tscale = currentScale * zoomBoost;
  return { tx: -nodeX * tscale, ty: -nodeY * tscale, tscale };
}

/** `power2.out`-family ease used for the label fade-in and general timing. */
export function easeOutQuad(t) {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

/** Overshoot-then-settle ease for the node "pop in" (radius growth). */
export function easeOutBack(t, overshoot = 1.70158) {
  const c = clamp(t, 0, 1);
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + overshoot * Math.pow(c - 1, 2);
}

export const BLOOM_DURATION = 0.9; // seconds, matches the measured/spec'd entrance length

/** Per-link draw-on progress (0..1): staggered by how far the link's vendor
 *  endpoint sits from its market pole, so the bloom sweeps outward from the
 *  poles rather than every link snapping in at once — the canvas equivalent
 *  of path-to-hope's per-line `stroke-dashoffset: 1 -> 0`. */
export function bloomLinkT(elapsedSec, distFromPoleRatio) {
  const stagger = 0.3 * clamp(distFromPoleRatio, 0, 1);
  return clamp((elapsedSec - stagger) / 0.5, 0, 1);
}

/** Per-node fade/scale progress (0..1), starting 150ms after that node's
 *  own link begins drawing. */
export function bloomNodeT(elapsedSec, distFromPoleRatio) {
  const stagger = 0.3 * clamp(distFromPoleRatio, 0, 1) + 0.15;
  return clamp((elapsedSec - stagger) / 0.4, 0, 1);
}

/** Label alpha (0..1), fading in only during the last 300ms of the bloom. */
export function bloomLabelAlpha(elapsedSec) {
  return clamp((elapsedSec - (BLOOM_DURATION - 0.3)) / 0.3, 0, 1);
}
