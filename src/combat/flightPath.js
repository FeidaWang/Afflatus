/* ============================================================
   FLIGHT PATH — U24 (24a): pure launch/landing lifecycle for a single
   fighter. No THREE.js, no DOM — plain-number parametric curves so the
   whole lifecycle is unit-testable (tests/flightPath.test.js), matching
   the cameraMath.js / weaponClock.js discipline.

   Design (Urgent.md U24 解决架构):
   - Time-driven parametric segments, NOT per-frame physics.
   - Segments are cubic Hermite curves chained head-to-tail: each segment
     starts from the previous segment's exact end position AND velocity, so
     the whole path is C1-continuous by construction.
   - Velocities are analytic (Hermite derivative), zero frame-differencing —
     same trick as the chaseCam preset (V18 Phase 1).
   - The moving world is injected as closures: `deck(tMs)` (carrier deck
     point; the capital patrols) and `formation(tMs)` (the fighter's slot in
     the analytic strafe ring). Both must return { pos:{x,y,z}, vel:{x,y,z} }
     with vel in units/second. This keeps the module scene-agnostic.
   - Phase tables reuse the weaponClock timeline shape so camera cues can be
     driven with the same activePhase()/msUntilPhase() helpers (V16).
   ============================================================ */

import { startTimeline } from './weaponClock.js';

// ── vector helpers (plain objects, pure) ─────────────────────────────────
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);

// ── cubic Hermite segment ────────────────────────────────────────────────
// p0/p1: endpoint positions; v0/v1: endpoint velocities in units/SECOND;
// durMs: segment duration. Returns { pos(sMs), vel(sMs) } with sMs clamped
// to [0, durMs]; vel is the analytic derivative (units/second).
export function hermiteSegment(p0, v0, p1, v1, durMs) {
  const T = Math.max(1, durMs) / 1000; // seconds — velocity scaling
  const at = (sMs) => {
    const u = Math.max(0, Math.min(1, sMs / Math.max(1, durMs)));
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const pos = v3(
      h00 * p0.x + h10 * T * v0.x + h01 * p1.x + h11 * T * v1.x,
      h00 * p0.y + h10 * T * v0.y + h01 * p1.y + h11 * T * v1.y,
      h00 * p0.z + h10 * T * v0.z + h01 * p1.z + h11 * T * v1.z,
    );
    const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1;
    const d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
    const vel = v3(
      (d00 * p0.x + d10 * T * v0.x + d01 * p1.x + d11 * T * v1.x) / T,
      (d00 * p0.y + d10 * T * v0.y + d01 * p1.y + d11 * T * v1.y) / T,
      (d00 * p0.z + d10 * T * v0.z + d01 * p1.z + d11 * T * v1.z) / T,
    );
    return { pos, vel };
  };
  return { pos: (sMs) => at(sMs).pos, vel: (sMs) => at(sMs).vel, at };
}

// ── phase tables (ms offsets; weaponClock timeline shape) ────────────────
export const LAUNCH_PHASES = [
  { name: 'catapult', at: 0 },     // deck run, attached to the moving deck
  { name: 'rotate', at: 1200 },    // nose up, still deck-relative
  { name: 'climb', at: 2600 },     // detach → Hermite toward formation slot
  { name: 'join', at: 5200 },      // exactly on the analytic formation
];
export const LANDING_PHASES = [
  { name: 'break', at: 0 },        // peel off the formation
  { name: 'approach', at: 1600 },  // glide-slope line at the deck
  { name: 'flare', at: 4200 },     // deck-relative decel
  { name: 'touchdown', at: 5200 }, // at rest on the deck (deck velocity)
];

const at = (phases, name) => phases.find((p) => p.name === name).at;

/* ── LAUNCH ────────────────────────────────────────────────────────────────
   createLaunchPath({ deck, deckDir, formation, t0 })
   - deck(tMs)      → {pos,vel}  moving deck reference point (units/s vel)
   - deckDir        → {x,y,z}    unit-ish launch direction (level)
   - formation(tMs) → {pos,vel}  the fighter's analytic formation slot
   - t0             → absolute ms this event starts (scene clock)
   sample(tMs) → { pos, vel, phase, done }
   Guarantees: C1 at every phase boundary; sample(t ≥ join) === formation(t).
*/
export function createLaunchPath({ deck, deckDir, formation, t0 = 0, phases = LAUNCH_PHASES }) {
  const rotateAt = at(phases, 'rotate'), climbAt = at(phases, 'climb'), joinAt = at(phases, 'join');
  const timeline = startTimeline('flight-launch', phases, t0);

  // deck-relative run: offset q(s) along deckDir with q(0)=0, q'(0)=0 (the
  // catapult winds up), plus a smooth pitch-up lift after `rotate`.
  const RUN_LEN = 9;          // units traveled along the deck by detach
  const LIFT = 2.2;           // vertical gain by detach
  const relRun = (sMs) => {   // s in [0, climbAt]
    const u = Math.max(0, Math.min(1, sMs / climbAt));
    const q = RUN_LEN * u * u;                        // q' = 2*RUN_LEN*u / T
    const uw = Math.max(0, (sMs - rotateAt) / (climbAt - rotateAt));
    const lift = LIFT * uw * uw;                      // zero slope at rotate
    return { q, lift, u, uw };
  };
  const deckPhase = (tMs) => {
    const s = tMs - t0;
    const d = deck(tMs);
    const { q, lift, u, uw } = relRun(s);
    const Tc = climbAt / 1000, Tr = (climbAt - rotateAt) / 1000;
    const qDot = (2 * RUN_LEN * u) / Tc;
    const liftDot = (2 * LIFT * uw) / Tr * (uw > 0 ? 1 : 0);
    return {
      pos: add(add(d.pos, scale(deckDir, q)), v3(0, lift, 0)),
      vel: add(add(d.vel, scale(deckDir, qDot)), v3(0, liftDot, 0)),
    };
  };

  // climb: Hermite from the exact detach state to the exact formation state
  // at `join` — C1 at both ends by construction. Built lazily so the deck /
  // formation closures are only sampled when the path is actually flown.
  let climbSeg = null;
  const climbSegment = () => {
    if (!climbSeg) {
      const d = deckPhase(t0 + climbAt);
      const f = formation(t0 + joinAt);
      climbSeg = hermiteSegment(d.pos, d.vel, f.pos, f.vel, joinAt - climbAt);
    }
    return climbSeg;
  };

  return {
    kind: 'launch',
    timeline,
    joinAtMs: t0 + joinAt,
    sample(tMs) {
      const s = tMs - t0;
      if (s >= joinAt) { const f = formation(tMs); return { ...f, phase: 'join', done: true }; }
      if (s >= climbAt) {
        const seg = climbSegment().at(s - climbAt);
        return { pos: seg.pos, vel: seg.vel, phase: 'climb', done: false };
      }
      const d = deckPhase(Math.max(t0, tMs));
      return { ...d, phase: s >= rotateAt ? 'rotate' : 'catapult', done: false };
    },
  };
}

/* ── LANDING ───────────────────────────────────────────────────────────────
   createLandingPath({ deck, deckDir, formation, t0 })
   deckDir here = the APPROACH direction (fighter flies along it to the
   deck; typically the same forward vector as launch). After `touchdown`
   the fighter sits at deck + restOffset moving with the deck.
*/
export function createLandingPath({ deck, deckDir, formation, t0 = 0, phases = LANDING_PHASES }) {
  const approachAt = at(phases, 'approach'), flareAt = at(phases, 'flare'), downAt = at(phases, 'touchdown');
  const timeline = startTimeline('flight-landing', phases, t0);

  const APPROACH_BACK = 16;   // approach fix sits this far behind the deck
  const APPROACH_UP = 3.4;    // glide-slope entry height above deck
  const V_APPROACH = 7;       // approach speed along deckDir (units/s)
  // parking offset = exactly the deck reference point, so an auto-relaunch
  // (createLaunchPath starts at deck(t)) hands over with zero position jump.
  const REST = v3(0, 0, 0);

  // segment builders (lazy, chained so C1 holds across all boundaries)
  let segBreak = null, segApproach = null, segFlare = null;
  const backDir = scale(deckDir, -1);
  const approachFix = () => { // where the glide slope starts, at `approach`
    const d = deck(t0 + approachAt);
    return {
      pos: add(add(d.pos, scale(backDir, APPROACH_BACK)), v3(0, APPROACH_UP, 0)),
      vel: add(d.vel, scale(deckDir, V_APPROACH)),
    };
  };
  const flareFix = () => {    // just off the deck at `flare`
    const d = deck(t0 + flareAt);
    return {
      pos: add(add(d.pos, scale(backDir, 2.5)), v3(0, 0.9, 0)),
      vel: add(d.vel, scale(deckDir, V_APPROACH * 0.55)),
    };
  };
  const build = () => {
    if (segBreak) return;
    const f0 = formation(t0);
    const a = approachFix(), fl = flareFix();
    segBreak = hermiteSegment(f0.pos, f0.vel, a.pos, a.vel, approachAt);
    segApproach = hermiteSegment(a.pos, a.vel, fl.pos, fl.vel, flareAt - approachAt);
    // flare/touchdown is DECK-RELATIVE (the deck keeps moving under the
    // fighter): Hermite in deck space from the flare offset+speed to REST+0.
    const dFl = deck(t0 + flareAt);
    const rel0 = v3(fl.pos.x - dFl.pos.x, fl.pos.y - dFl.pos.y, fl.pos.z - dFl.pos.z);
    const relV0 = v3(fl.vel.x - dFl.vel.x, fl.vel.y - dFl.vel.y, fl.vel.z - dFl.vel.z);
    segFlare = hermiteSegment(rel0, relV0, REST, v3(0, 0, 0), downAt - flareAt);
  };

  return {
    kind: 'landing',
    timeline,
    downAtMs: t0 + downAt,
    sample(tMs) {
      build();
      const s = tMs - t0;
      if (s >= flareAt) {
        const d = deck(tMs);
        const rel = segFlare.at(Math.min(s, downAt) - flareAt);
        return {
          pos: add(d.pos, rel.pos),
          vel: add(d.vel, s >= downAt ? v3(0, 0, 0) : rel.vel),
          phase: s >= downAt ? 'touchdown' : 'flare',
          done: s >= downAt,
        };
      }
      if (s >= approachAt) {
        const seg = segApproach.at(s - approachAt);
        return { pos: seg.pos, vel: seg.vel, phase: 'approach', done: false };
      }
      const seg = segBreak.at(Math.max(0, s));
      return { pos: seg.pos, vel: seg.vel, phase: 'break', done: false };
    },
  };
}
