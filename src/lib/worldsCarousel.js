/* Card carousel physics for /worlds.html (spec 2026-10-26 §5). Pure and
   DOM-free: the page feeds pointer/wheel deltas in card units and calls
   step() from requestAnimationFrame, then maps `pos` to one CSS variable.
   Four or more cards form a closed ring; fewer sit on an arc whose ends
   rubber-band. Release coasts with friction, then an under-damped spring
   snaps to the nearest card with a small overshoot. */

const FRICTION = 0.92;   // velocity kept per 16 ms while coasting
const SNAP_SPEED = 0.02; // cards/frame below which coasting hands over to the spring
const STIFFNESS = 0.12;
const DAMPING = 0.78;
const EDGE = 0.35;       // share of an arc drag that still moves past either end
const REST = 0.001;

const lo = () => 0;
const hi = (s) => Math.max(0, s.n - 1);
const outside = (s, pos) => !s.loop && (pos < lo(s) || pos > hi(s));
const wrap = (pos, n) => ((pos % n) + n) % n;

function snapTarget(s, pos) {
  const t = Math.round(pos);
  return s.loop ? t : Math.min(hi(s), Math.max(lo(s), t));
}

export function createCarousel(n, pos = 0) {
  return { pos, vel: 0, n, loop: n >= 4, phase: 'idle', target: pos };
}

export function drag(state, dCards) {
  let pos = state.pos + dCards;
  if (!state.loop) {
    // Split the move into the part inside [0, n-1] and the part past an end.
    const min = lo(state);
    const max = hi(state);
    const from = state.pos;
    if (pos < min) pos = Math.min(from, min) + (pos - Math.min(from, min)) * EDGE;
    else if (pos > max) pos = Math.max(from, max) + (pos - Math.max(from, max)) * EDGE;
  }
  return { ...state, pos, vel: dCards, phase: 'drag' };
}

export function release(state, velCardsPerFrame, { reduced = false } = {}) {
  if (reduced) {
    const target = snapTarget(state, state.pos);
    return { ...state, pos: state.loop ? wrap(target, state.n) : target, vel: 0, phase: 'idle', target };
  }
  if (outside(state, state.pos) || Math.abs(velCardsPerFrame) < SNAP_SPEED) {
    return { ...state, vel: velCardsPerFrame, phase: 'spring', target: snapTarget(state, state.pos) };
  }
  return { ...state, vel: velCardsPerFrame, phase: 'coast' };
}

export function step(state, dtMs) {
  const k = dtMs / 16;
  if (state.phase === 'coast') {
    const pos = state.pos + state.vel * k;
    const vel = state.vel * FRICTION ** k;
    if (outside(state, pos) || Math.abs(vel) < SNAP_SPEED) {
      return { ...state, pos, vel, phase: 'spring', target: snapTarget(state, pos) };
    }
    return { ...state, pos, vel };
  }
  if (state.phase === 'spring') {
    const vel = (state.vel + STIFFNESS * (state.target - state.pos) * k) * DAMPING ** k;
    const pos = state.pos + vel * k;
    if (Math.abs(state.target - pos) < REST && Math.abs(vel) < REST) {
      return { ...state, pos: state.loop ? wrap(state.target, state.n) : state.target, vel: 0, phase: 'idle' };
    }
    return { ...state, pos, vel };
  }
  return state;
}

export function indexAt(pos, n, loop) {
  const i = Math.round(pos);
  return loop ? wrap(i, n) : Math.min(Math.max(0, n - 1), Math.max(0, i));
}

/** Spring to card `index`; on a ring it takes the shorter way round. */
export function goTo(state, index) {
  let target = index;
  if (state.loop) {
    const d = wrap(index - state.pos + state.n / 2, state.n) - state.n / 2;
    target = state.pos + d;
  }
  return { ...state, phase: 'spring', target: state.loop ? Math.round(target) : snapTarget(state, target) };
}
