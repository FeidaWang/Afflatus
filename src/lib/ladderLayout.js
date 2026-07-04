/* ============================================================
   LADDER LAYOUT — generic 1D label declutter for stacked price-scale UIs
   (Arena TA dashboard's Level Ladder, V13 hotfix).

   Pure math, no DOM: given each label's TRUE target position, returns an
   adjusted position for every label such that no two are closer than
   `minGap`, using a bidirectional monotonic-pass declutter (push down, push
   up, repeat) — the same technique chart libraries use for axis labels.
   Relative order is always preserved. Output may fall outside [0, extent];
   callers add the returned overflow to the container size / offset instead
   of compressing labels illegibly.
   ============================================================ */

/**
 * @param {number[]} targets - true target positions (any unit, e.g. px), any order.
 * @param {{minGap:number, passes?:number}} opts
 * @returns {number[]} adjusted positions, same order/length as `targets`.
 */
export function declutter1D(targets, { minGap, passes = 4 } = {}) {
  const n = targets.length;
  if (n < 2) return targets.slice();
  const order = targets.map((_, i) => i).sort((a, b) => targets[a] - targets[b]);
  const ys = order.map((i) => targets[i]);
  for (let p = 0; p < passes; p++) {
    for (let i = 1; i < n; i++) if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
    for (let i = n - 2; i >= 0; i--) if (ys[i + 1] - ys[i] < minGap) ys[i] = ys[i + 1] - minGap;
  }
  const out = new Array(n);
  order.forEach((origIdx, k) => { out[origIdx] = ys[k]; });
  return out;
}

/**
 * Fits a set of (already-decluttered) positions inside [0, extent], returning
 * a uniform offset to add to every position plus the total size needed.
 * Never compresses — only tells the caller how much bigger the container
 * must be and how far down to shift everything to avoid clipping the top.
 * `extent` itself shifts down by `offset` too (it's the coordinate frame's
 * nominal bottom, not a hard cap), so size is whichever is bigger: the
 * shifted nominal extent, or the shifted lowest position (+ padBottom).
 */
export function fitExtent(positions, extent, { padTop = 0, padBottom = 0 } = {}) {
  if (!positions.length) return { offset: 0, size: extent };
  const offset = Math.max(0, padTop - Math.min(...positions));
  const size = Math.max(extent + offset, Math.max(...positions) + offset + padBottom);
  return { offset, size };
}
