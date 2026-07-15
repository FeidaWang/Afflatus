/* ============================================================
   RIGID BODY 6DOF — U29 P1: "PID 6DOF 电传飞控" half of the fly-by-wire
   loop. No THREE.js, no DOM, plain {x,y,z}/{x,y,z,w} objects — same
   scene-agnostic discipline as flightPath.js, so a fighter's physical
   state can be advanced and tested without a renderer.

   Division of labour with pid.ts: HBT/maneuvers decide *where the nose
   should point and how fast to go* (setpoints); pid.ts turns "how far off
   is the current heading/speed" into force/torque; THIS module turns
   force/torque into the next pos/vel/quat/angVel. Three separate pure
   layers, three separate test files — matches the existing
   weaponClock.js / cameraMath.js split (one authoritative clock, one pure
   math layer, each independently golden-tested).

   Integration scheme: semi-implicit (symplectic) Euler — velocity is
   updated from force first, then position is updated from the NEW
   velocity (not the old one). Chosen over full RK4 deliberately:
   simplicity-first (this is a game-feel dogfight sim, not a physics
   research tool), and symplectic Euler is exact for constant
   acceleration/torque within a step and stays numerically stable at fixed
   dt — the two properties the golden-set test actually needs. Inertia is
   modelled as a diagonal tensor (roll/pitch/yaw treated independently,
   ignoring cross-coupling products of inertia) — correct enough for a
   fighter-shaped craft and one tensor multiply cheaper per frame; a full
   3x3 tensor is not on the U29 P1 checklist and would be unverifiable
   without real craft mass data.
   ============================================================ */

export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }

export interface Body6dof {
  pos: Vec3;
  vel: Vec3;
  quat: Quat;
  angVel: Vec3; // rad/s, body-frame
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const identityQuat = (): Quat => ({ x: 0, y: 0, z: 0, w: 1 });

const addV = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scaleV = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const divV = (a: Vec3, s: Vec3): Vec3 => v3(a.x / s.x, a.y / s.y, a.z / s.z);
const crossV = (a: Vec3, b: Vec3): Vec3 => v3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);

// Rotates a vector by a unit quaternion (Fabian Giesen's fast form: avoids
// building a full 3x3 rotation matrix for a single vector). Needed by
// simCore.ts to turn a body's orientation into its world-space forward
// axis (local +Z, by this engine's convention) for heading-error control.
export function rotateVectorByQuat(q: Quat, v: Vec3): Vec3 {
  const qv = v3(q.x, q.y, q.z);
  const t = scaleV(crossV(qv, v), 2);
  return addV(addV(v, scaleV(t, q.w)), crossV(qv, t));
}

function normalizeQuat(q: Quat): Quat {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (!(len > 1e-9)) return identityQuat();
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

// Quaternion derivative for a body spinning at body-frame angular velocity
// w: dq/dt = 0.5 * (w as a pure quaternion) * q. Standard formula used to
// advance orientation from angular velocity every step.
function quatDerivative(q: Quat, w: Vec3): Quat {
  return {
    x: 0.5 * (w.x * q.w + w.y * q.z - w.z * q.y),
    y: 0.5 * (w.y * q.w + w.z * q.x - w.x * q.z),
    z: 0.5 * (w.z * q.w + w.x * q.y - w.y * q.x),
    w: 0.5 * (-w.x * q.x - w.y * q.y - w.z * q.z),
  };
}

// mass: scalar; inertia: diagonal moment-of-inertia per body axis (x=roll,
// y=yaw-ish, z=pitch-ish — caller's convention, this module doesn't care
// which is which). force/torque are in the SAME frame as vel/angVel
// (world-frame linear, body-frame angular — the usual flight-sim split).
export function integrateRigidBody(
  body: Body6dof,
  force: Vec3,
  torque: Vec3,
  mass: number,
  inertia: Vec3,
  dt: number,
): Body6dof {
  const accel = scaleV(force, 1 / Math.max(1e-6, mass));
  const vel = addV(body.vel, scaleV(accel, dt));
  const pos = addV(body.pos, scaleV(vel, dt));

  const angAccel = divV(torque, v3(
    Math.max(1e-6, inertia.x), Math.max(1e-6, inertia.y), Math.max(1e-6, inertia.z),
  ));
  const angVel = addV(body.angVel, scaleV(angAccel, dt));
  const dq = quatDerivative(body.quat, angVel);
  const quat = normalizeQuat({
    x: body.quat.x + dq.x * dt,
    y: body.quat.y + dq.y * dt,
    z: body.quat.z + dq.z * dt,
    w: body.quat.w + dq.w * dt,
  });

  return { pos, vel, quat, angVel };
}

export function createBody6dof(overrides: Partial<Body6dof> = {}): Body6dof {
  return {
    pos: overrides.pos ?? v3(),
    vel: overrides.vel ?? v3(),
    quat: overrides.quat ?? identityQuat(),
    angVel: overrides.angVel ?? v3(),
  };
}
