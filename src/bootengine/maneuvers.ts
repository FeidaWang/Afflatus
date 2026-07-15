/* ============================================================
   MANEUVERS — U29 P1: stage 2 of the HBT pipeline (意图选择 → 机动库 →
   样条轨迹生成). Turns an `Intent` (from hbt.ts) plus the current
   geometry (self/target position+velocity) into a waypoint list ready
   for createCatmullRomPath() (catmullRom.ts). No THREE.js, no DOM.

   Each planner is a pure function of its inputs (plus an OPTIONAL seeded
   `rng` for the one place randomness matters — which side to break turn
   toward). Pass `rng` from seed.ts's createRng(seed)/rngFromString() to
   keep a run reproducible; omit it and the planner falls back to a fixed
   choice, which is itself deterministic (just not varied run-to-run).

   Waypoints always start at exactly `selfPos` — createCatmullRomPath()
   guarantees the resulting curve passes through every waypoint exactly,
   so "the flown path starts exactly where the fighter currently is" is a
   structural guarantee, not a hope.

   `targetPos`/`targetVel` mean different things per intent: for
   tailChase/scissors/breakTurn/disengage it's the ENEMY being fought;
   for formationRejoin/holdFormation it's the fighter's OWN formation
   anchor point. Same field names, context-dependent meaning — documented
   here rather than split into two parallel APIs (that would duplicate
   every planner signature for no behavioural difference).
   ============================================================ */

import type { Vec3 } from './rigidBody6dof';
import type { Intent } from './hbt';

const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : v3(0, 0, 1); // arbitrary but stable fallback axis
};
const cross = (a: Vec3, b: Vec3): Vec3 => v3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
// a horizontal-ish axis perpendicular to `dir`, for "break left/right" style offsets.
function perpAxis(dir: Vec3): Vec3 {
  let perp = cross(dir, v3(0, 1, 0));
  if (length(perp) < 1e-6) perp = cross(dir, v3(1, 0, 0));
  return normalize(perp);
}

export interface ManeuverInput {
  intent: Intent;
  selfPos: Vec3;
  selfVel: Vec3;
  targetPos: Vec3;
  targetVel: Vec3;
  rng?: () => number; // [0,1), seed.ts's createRng — omit for a fixed choice
}

export interface Maneuver {
  intent: Intent;
  waypoints: Vec3[];
}

function planTailChase(input: ManeuverInput): Vec3[] {
  const toTarget = sub(input.targetPos, input.selfPos);
  const dir = normalize(toTarget);
  const standoff = 15; // aim BEHIND the target, not at its current position
  const behindTarget = sub(input.targetPos, scale(normalize(input.targetVel), standoff));
  const lead = add(input.selfPos, scale(dir, length(toTarget) * 0.5));
  return [input.selfPos, lead, behindTarget];
}

function planBreakTurn(input: ManeuverInput): Vec3[] {
  const away = normalize(sub(input.selfPos, input.targetPos));
  const perp = perpAxis(away);
  const side = (input.rng ? input.rng() : 0.5) < 0.5 ? -1 : 1;
  const p1 = add(input.selfPos, scale(perp, side * 20));
  const p2 = add(p1, scale(away, 15));
  return [input.selfPos, p1, p2];
}

function planScissors(input: ManeuverInput): Vec3[] {
  const toTarget = normalize(sub(input.targetPos, input.selfPos));
  const perp = perpAxis(toTarget);
  const step = length(sub(input.targetPos, input.selfPos)) / 3 || 5;
  const p1 = add(input.selfPos, add(scale(toTarget, step), scale(perp, 10)));
  const p2 = add(input.selfPos, add(scale(toTarget, step * 2), scale(perp, -10)));
  const p3 = add(input.selfPos, scale(toTarget, step * 3));
  return [input.selfPos, p1, p2, p3];
}

function planDisengage(input: ManeuverInput): Vec3[] {
  const away = normalize(sub(input.selfPos, input.targetPos));
  const p1 = add(input.selfPos, scale(away, 30));
  const p2 = add(input.selfPos, scale(away, 60));
  return [input.selfPos, p1, p2];
}

// formationRejoin AND holdFormation both just mean "get to the anchor" —
// the only difference is how urgent it is, which is a maneuverClock (P3)
// concern, not a geometry one.
function planRejoin(input: ManeuverInput): Vec3[] {
  return [input.selfPos, input.targetPos];
}

export function planManeuver(input: ManeuverInput): Maneuver {
  let waypoints: Vec3[];
  switch (input.intent) {
    case 'tailChase': waypoints = planTailChase(input); break;
    case 'breakTurn': waypoints = planBreakTurn(input); break;
    case 'scissors': waypoints = planScissors(input); break;
    case 'disengage': waypoints = planDisengage(input); break;
    case 'formationRejoin':
    case 'holdFormation':
    default: waypoints = planRejoin(input); break;
  }
  return { intent: input.intent, waypoints };
}
