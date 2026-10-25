/* ============================================================
   PINCH ZOOM — U39. Pure functions for a 3-level semantic zoom
   (tree ↔ stage ↔ match) on games.html's knockout bracket:
   pinch OUT (fingers spread) zooms IN to a single match's detail,
   pinch IN (fingers pinch together) zooms OUT to a compact
   all-rounds tree showing more matches at once. Ctrl+wheel (trackpad
   pinch on desktop) maps to the same levels. Kept framework/DOM-free
   so the transition logic has its own golden-set test suite — the
   games.js gesture wiring (pointer tracking, re-render) is the only
   part that touches the DOM.
   ============================================================ */

export const ZOOM_TREE = 0;   // zoomed out — all rounds, compact
export const ZOOM_STAGE = 1;  // default — one round's match cards (U38 slider)
export const ZOOM_MATCH = 2;  // zoomed in — one match, full detail

export function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* scaleDelta > 0 = fingers spreading (zoom in) · < 0 = pinching (zoom out).
   Below `threshold` the gesture is treated as noise/drift and the level
   holds steady — prevents a jittery finger from flipping levels. */
export function nextZoomLevel(level, scaleDelta, threshold = 36) {
  if (!Number.isFinite(scaleDelta) || Math.abs(scaleDelta) < threshold) return level;
  const dir = scaleDelta > 0 ? 1 : -1;
  return Math.max(ZOOM_TREE, Math.min(ZOOM_MATCH, level + dir));
}

// Normalizes a ctrl+wheel event's deltaY (trackpad pinch signal in
// Chrome/Firefox/Safari) into the same sign convention as touch
// scaleDelta: pinch-out/zoom-in reports negative deltaY.
export function wheelScaleDelta(deltaY) {
  return -deltaY;
}
