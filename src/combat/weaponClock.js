/* ============================================================
   WEAPON CLOCK — single authoritative timeline per weapon event (V16,
   ROADMAP §4). Pure functions + one shared `now()` — no DOM, no per-consumer
   setTimeout/setInterval.

   The problem this replaces: CIWS/nuke/main-gun/missile effects each used to
   compute "how far are we into this event" from their own locally-scoped
   deadline (some `Date.now()`-based, one `performance.now()`-based), updated
   by their own independent `setInterval` polling loop. Two consumers of the
   "same" event (a DOM countdown label and a canvas cinematic) could each be
   sampling a different clock at a different cadence — never guaranteed to
   agree frame-to-frame, and a maintenance trap (tune one timer, forget the
   other). The fix is not to align the two timers; it's to have exactly one:
   every weapon event publishes a single `{ weapon, t0, phases }` timeline at
   the moment it starts, and every consumer (DOM text, canvas cinematic,
   future V14 camera cuts) derives its render state from `now() - t0` against
   that SAME object. Call `startTimeline()` once per weapon event and thread
   the returned object to every consumer that needs to render it that frame.
   ============================================================ */

// Single clock function. Everything in this module — and every call site
// that migrates to it — should read time through this one function instead
// of mixing Date.now()/performance.now() across weapon systems.
export function now() {
  return Date.now();
}

// phases: [{ name, at }], `at` = ms offset from t0. Order doesn't matter on
// input (sorted here); `at: 0` is required on the first phase implicitly —
// if the caller omits a phase at 0, one named '_start' is added so
// activePhase() always resolves to *something* before the first named beat.
export function startTimeline(weapon, phases, t0 = now()) {
  const sorted = [...phases].sort((a, b) => a.at - b.at);
  if (!sorted.length || sorted[0].at > 0) sorted.unshift({ name: '_start', at: 0 });
  const totalMs = sorted[sorted.length - 1].at;
  return { weapon, t0, phases: sorted, totalMs };
}

// 0..1, clamped. This is the one formula every consumer (DOM or canvas)
// should call — never re-derive it locally from t0/totalMs by hand.
export function phaseFraction(timeline, t = now()) {
  if (!timeline || !(timeline.totalMs > 0)) return 0;
  const elapsed = t - timeline.t0;
  return Math.max(0, Math.min(1, elapsed / timeline.totalMs));
}

export function elapsedMs(timeline, t = now()) {
  if (!timeline) return 0;
  return Math.max(0, t - timeline.t0);
}

export function isFinished(timeline, t = now()) {
  if (!timeline) return true;
  return t - timeline.t0 >= timeline.totalMs;
}

// The named phase whose `at` boundary has most recently been crossed —
// e.g. CIWS: 'laserLock' -> 'barrage' -> 'ceaseFire' -> 'cameraEnd'.
export function activePhase(timeline, t = now()) {
  if (!timeline) return null;
  const el = elapsedMs(timeline, t);
  let current = timeline.phases[0];
  for (const p of timeline.phases) {
    if (p.at <= el) current = p; else break;
  }
  return current.name;
}

// ms remaining until a specific named phase boundary is reached — the exact
// shape a "T-3.00" style countdown needs, sourced from the same t0 as every
// other consumer of this timeline (no separate deadline variable).
export function msUntilPhase(timeline, phaseName, t = now()) {
  if (!timeline) return 0;
  const p = timeline.phases.find((x) => x.name === phaseName);
  if (!p) return 0;
  return Math.max(0, timeline.t0 + p.at - t);
}

// ms remaining until the timeline ends entirely.
export function msRemaining(timeline, t = now()) {
  if (!timeline) return 0;
  return Math.max(0, timeline.t0 + timeline.totalMs - t);
}

// Force-advance a timeline so it reads as already at/near its end — used
// when the real kill (halley.destroyed) lands before the scripted timeline
// would have reached its final phase. Returns a NEW timeline object (pure)
// whose t0 is shifted so `phaseFraction` immediately reads as `atFraction`
// (default 1 = fully finished) at the given `t`. Consumers that compare
// "was this already past this fraction" against the previous frame can
// detect the jump and fire a one-shot cut-flash (see combatCine.js's
// existing rising-edge `killed` handling, which this is designed to slot
// into rather than replace).
export function forceAdvance(timeline, atFraction = 1, t = now()) {
  if (!timeline || !(timeline.totalMs > 0)) return timeline;
  const targetElapsed = atFraction * timeline.totalMs;
  return { ...timeline, t0: t - targetElapsed };
}
