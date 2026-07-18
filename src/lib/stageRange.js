/* ============================================================
   STAGE RANGE — U43. Pure functions for games.html's Apple-Sports-
   style range scrubber: an active window over the knockout stage
   list, expressed as an integer pair [start, end] (inclusive,
   0 ≤ start ≤ end < stageCount). Every gesture (drag a handle, pan
   the middle, pinch, wheel, keyboard) reduces to one of these
   transforms — kept DOM-free so it has its own vitest suite, same
   split as pinchZoom.js (math here, event wiring in games.js).
   ============================================================ */

// Universal clamp/normalize: rounds both ends, clamps into [0, n-1],
// and swaps them back into order if a caller passed them reversed.
export function clampRange(s, e, n) {
  s = Math.max(0, Math.min(n - 1, Math.round(s)));
  e = Math.max(0, Math.min(n - 1, Math.round(e)));
  return s <= e ? [s, e] : [e, s];
}

// Middle-drag: shift the whole window by d cells, width unchanged.
export function panRange([s, e], d, n) {
  const w = e - s;
  const s2 = Math.max(0, Math.min(n - 1 - w, s + d));
  return [s2, s2 + w];
}

// Left handle: d > 0 shrinks from the left, d < 0 grows left (can't cross e).
export function resizeLeft([s, e], d, n) {
  return clampRange(Math.min(s + d, e), e, n);
}

// Right handle: d > 0 grows right, d < 0 shrinks from the right (can't cross s).
export function resizeRight([s, e], d, n) {
  return clampRange(s, Math.max(e + d, s), n);
}

// Pinch/wheel: symmetric widen (d > 0) or narrow (d < 0) around both edges;
// narrowing past a single cell snaps to the window's midpoint cell.
export function zoomRange([s, e], d, n) {
  let s2 = s - d, e2 = e + d;
  if (d < 0 && e2 < s2) { const m = Math.round((s + e) / 2); s2 = e2 = m; }
  return clampRange(s2, e2, n);
}

// Window width (in cells, e - s) -> render density tier.
export function densityFor(w) {
  return w <= 0 ? 'detail' : w <= 2 ? 'cards' : 'chips';
}
