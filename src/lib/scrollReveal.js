/* ============================================================
   SCROLL REVEAL — pure progress/easing math for the anthropic.com-style
   damped-scrub card reveal (urgent.md Part 2 §9). Extracted from a live
   ScrollTrigger read on anthropic.com (2026-07-21): trigger window
   "center 70%" -> "center 40%", scrub 0.8, ease power2.out, animating a
   rounded inset card open to full-bleed.

   No DOM here (same pure/view split as forceGraph.js + sectorsGraphView.js):
   revealProgress() maps a rect + viewport height to a 0..1 target, chase()
   is a frame-rate-independent exponential follow (≡ GSAP scrub:0.8).
   scrollRevealView.js is the DOM-touching half.
   ============================================================ */

/**
 * Reveal progress for a section: 0 while its vertical center is still below
 * 70% of viewport height, 1 once it has risen above 40% of viewport height —
 * mirrors the measured ScrollTrigger window (start:"center 70%", end:"center 40%").
 * @param {number} rectTop element's getBoundingClientRect().top
 * @param {number} rectHeight element's getBoundingClientRect().height
 * @param {number} vh viewport height (innerHeight)
 */
export function revealProgress(rectTop, rectHeight, vh) {
  const center = rectTop + rectHeight / 2;
  const p = (vh * 0.70 - center) / (vh * 0.30);
  return Math.min(1, Math.max(0, p));
}

/** Frame-rate-independent exponential chase (≡ GSAP `scrub: 0.8`): `current`
 *  moves a fixed fraction of the remaining distance to `target` per second,
 *  so the same tau produces the same visual catch-up speed at 30fps or 120fps. */
export function chase(current, target, dtSec, tau = 0.8) {
  if (!(dtSec > 0)) return current;
  return current + (target - current) * (1 - Math.exp(-dtSec / tau));
}

/** GSAP `power2.out` equivalent: 1-(1-t)^2. */
export function easeOutQuad(t) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c);
}

export function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * clip-path inset() string for a rounded-card reveal (heroCard/graphWrap):
 * eased progress `e` interpolates from a 24px-radius card inset 7.7% on each
 * side (≡ the measured 84.6%-max-width Anthropic tween) to full-bleed.
 */
export function revealClipPath(e, w) {
  const ee = Math.min(1, Math.max(0, e));
  const xInset = lerp(0.077 * w, 0, ee);
  const yInset = lerp(24, 0, ee);
  const radius = lerp(24, 0, ee);
  return `inset(${yInset.toFixed(2)}px ${xInset.toFixed(2)}px round ${radius.toFixed(2)}px)`;
}

/** Horizontal-only variant for plain text rows (.band) — no radius/vertical
 *  inset since there's no card background to round. */
export function revealClipPathX(e, w) {
  const ee = Math.min(1, Math.max(0, e));
  const xInset = lerp(0.077 * w, 0, ee);
  return `inset(0px ${xInset.toFixed(2)}px round 0px)`;
}
