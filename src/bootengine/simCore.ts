/* ============================================================
   SIM CORE — U29 P1: the single-fighter per-frame step function that
   wires the whole pipeline together — 意图选择(hbt.ts) → 机动库
   (maneuvers.ts) → 样条轨迹生成(catmullRom.ts) → PID(pid.ts) →
   6DOF 刚体(rigidBody6dof.ts). No THREE.js, no DOM.

   `stepSimFrame(state, opts)` is a pure function: same state + same opts
   (including the SAME rng call sequence) always produces the same next
   state. That's the golden-set contract this module's test file checks —
   run two independent simulations from identical starting conditions and
   identical seeds, they must match frame-for-frame.

   Serializability is a hard constraint, not a nicety: FighterSimState will
   cross a Worker postMessage boundary in P1's "Worker 壳" (structured
   clone can't carry functions/closures). That's WHY state stores
   `maneuverWaypoints: Vec3[]` (plain data) instead of a built
   CatmullRomPath (which closes over functions) — the path is rebuilt from
   the waypoints each frame instead of cached. Cheap (a handful of points),
   and correctness > micro-optimization for P1.

   Control law (deliberately simple, P1 scope — refined once P2/P3 need
   more nuance):
   - Heading: cross(currentForward, desiredDir) is a standard small-angle
     proxy for "rotation axis * sin(error angle)" — each component is fed
     through its own PID (target 0) to produce a torque command per axis.
   - Thrust: a single PID closes the gap between |desiredVel| and the
     fighter's current speed; the resulting scalar is applied as force
     along desiredDir (vectored-thrust simplification — no separate
     "afterburner vs. maneuvering thruster" split yet).
   - Energy (fuel/heat/whatever backs `energyPct`) is NOT modelled here —
     that's a gameplay-balance decision for a later phase, not a physics
     concern; stepSimFrame only READS energyPct (for the HBT threshold)
     and passes it through unchanged.
   ============================================================ */

import type { Vec3, Body6dof } from './rigidBody6dof';
import { integrateRigidBody, rotateVectorByQuat, createBody6dof } from './rigidBody6dof';
import type { PidState, PidGains } from './pid';
import { createPidState, stepPid } from './pid';
import type { Intent, Blackboard } from './hbt';
import { createBlackboard, createTacticalTree, selectIntent, type BTNode } from './hbt';
import { planManeuver } from './maneuvers';
import { createCatmullRomPath } from './catmullRom';

const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const cross = (a: Vec3, b: Vec3): Vec3 => v3(
  a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x,
);
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : v3(0, 0, 1);
};
function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const na = normalize(a), nb = normalize(b);
  const d = Math.max(-1, Math.min(1, na.x * nb.x + na.y * nb.y + na.z * nb.z));
  return (Math.acos(d) * 180) / Math.PI;
}

const LOCAL_FORWARD: Vec3 = v3(0, 0, 1); // this engine's body-local forward axis convention

const TORQUE_GAINS: PidGains = { kp: 6, ki: 0, kd: 1.5 };
const TORQUE_LIMIT = 40;
const THRUST_GAINS: PidGains = { kp: 8, ki: 1, kd: 0.5 };
const THRUST_LIMIT = 60;

// nominal time-to-fly-the-whole-spline, per intent — a fixed pacing model
// (see catmullRom.ts header: the curve itself is duration-agnostic, the
// CALLER supplies pacing). Short/urgent maneuvers get less time.
const MANEUVER_DURATION_S: Record<Intent, number> = {
  disengage: 4,
  scissors: 5,
  breakTurn: 3,
  tailChase: 4,
  formationRejoin: 6,
  holdFormation: 6,
};

export interface FighterSimState {
  body: Body6dof;
  mass: number;
  inertia: Vec3;
  energyPct: number;
  intent: Intent;
  maneuverWaypoints: Vec3[];
  maneuverU: number; // 0..1 progress along the current maneuver spline
  headingPid: { x: PidState; y: PidState; z: PidState };
  speedPid: PidState;
}

export function createFighterSimState(overrides: Partial<FighterSimState> = {}): FighterSimState {
  return {
    body: overrides.body ?? createBody6dof(),
    mass: overrides.mass ?? 1,
    inertia: overrides.inertia ?? v3(1, 1, 1),
    energyPct: overrides.energyPct ?? 1,
    intent: overrides.intent ?? 'holdFormation',
    maneuverWaypoints: overrides.maneuverWaypoints ?? [],
    maneuverU: overrides.maneuverU ?? 1, // start "finished" so frame 1 always plans
    headingPid: overrides.headingPid ?? {
      x: createPidState(), y: createPidState(), z: createPidState(),
    },
    speedPid: overrides.speedPid ?? createPidState(),
  };
}

export interface StepSimFrameOptions {
  targetPos: Vec3;
  targetVel: Vec3;
  dt: number;
  rng?: () => number;
  tree?: BTNode<Blackboard>;
}

function buildBlackboard(state: FighterSimState, targetPos: Vec3, targetVel: Vec3): Blackboard {
  const range = length(sub(targetPos, state.body.pos));
  // 0deg = self sits directly behind the target's direction of travel
  const aspectDeg = angleBetweenDeg(sub(state.body.pos, targetPos), scale(targetVel, -1));
  // is the TARGET behind US, roughly pointed our way, and close? → we're being chased
  const behindUsDeg = angleBetweenDeg(sub(targetPos, state.body.pos), scale(state.body.vel, -1));
  const targetOnTail = behindUsDeg < 45 && range < 80;
  return createBlackboard({ range, aspectDeg, energyPct: state.energyPct, targetOnTail });
}

export function stepSimFrame(state: FighterSimState, opts: StepSimFrameOptions): FighterSimState {
  const { targetPos, targetVel, dt, rng, tree } = opts;

  const blackboard = buildBlackboard(state, targetPos, targetVel);
  const intent = selectIntent(blackboard, tree ?? createTacticalTree());

  let waypoints = state.maneuverWaypoints;
  let maneuverU = state.maneuverU;
  const needsReplan = intent !== state.intent || maneuverU >= 1 || waypoints.length < 2;
  if (needsReplan) {
    const maneuver = planManeuver({
      intent, selfPos: state.body.pos, selfVel: state.body.vel, targetPos, targetVel, rng,
    });
    waypoints = maneuver.waypoints;
    maneuverU = 0;
  }

  const duration = MANEUVER_DURATION_S[intent];
  const nextU = Math.min(1, maneuverU + dt / duration);

  const path = createCatmullRomPath(waypoints);
  const sampled = path.sample(nextU);
  const desiredVel = scale(sampled.tangent, 1 / duration);
  const desiredDir = length(desiredVel) > 1e-6 ? normalize(desiredVel) : normalize(sub(targetPos, state.body.pos));

  // heading control: drive cross(forward, desiredDir) → 0 on each axis
  const forward = rotateVectorByQuat(state.body.quat, LOCAL_FORWARD);
  const rotAxis = cross(forward, desiredDir);
  const headingPid = {
    x: { ...state.headingPid.x }, y: { ...state.headingPid.y }, z: { ...state.headingPid.z },
  };
  const torque = v3(
    stepPid(headingPid.x, TORQUE_GAINS, rotAxis.x, dt, { outputLimit: TORQUE_LIMIT }),
    stepPid(headingPid.y, TORQUE_GAINS, rotAxis.y, dt, { outputLimit: TORQUE_LIMIT }),
    stepPid(headingPid.z, TORQUE_GAINS, rotAxis.z, dt, { outputLimit: TORQUE_LIMIT }),
  );

  // thrust control: close the speed gap along desiredDir
  const speedPid = { ...state.speedPid };
  const desiredSpeed = length(desiredVel);
  const currentSpeed = length(state.body.vel);
  const thrustMag = stepPid(speedPid, THRUST_GAINS, desiredSpeed - currentSpeed, dt, { outputLimit: THRUST_LIMIT });
  const force = scale(desiredDir, thrustMag);

  const body = integrateRigidBody(state.body, force, torque, state.mass, state.inertia, dt);

  return {
    ...state,
    body,
    intent,
    maneuverWaypoints: waypoints,
    maneuverU: nextU,
    headingPid,
    speedPid,
  };
}
