/* ============================================================
   PID — U29 P1: single-axis PID controller for the fly-by-wire layer
   ("PID 6DOF 电传飞控" in the U29 framework). No THREE.js, no DOM — the
   caller owns the state object and passes it in every call, same idiom as
   cameraMath.js's smoothDamp(current, target, velocityRef, ...): this
   module stays a pure function, the fighter/camera owns its own PidState
   per axis.

   Six of these (or three, paired into Vec3) drive rigidBody6dof.ts: e.g.
   one per angular axis to turn "desired heading" into torque, one for
   throttle to turn "desired speed" into thrust. HBT/maneuvers decide the
   *setpoint*; PID decides how hard to push to get there without the
   attitude ping-ponging (divergence) — that's the golden-set contract this
   module's test file enforces.

   Anti-windup: the integral accumulator is clamped to `integralLimit`
   (defaults to `outputLimit`) every step, not just the final output. Plain
   output-clamping alone lets the integral term keep growing while the
   output is already saturated ("integral windup"), which then overshoots
   hard once the error reverses sign — exactly the kind of divergence the
   golden-set step-response test checks for.
   ============================================================ */

export interface PidGains {
  kp: number;
  ki: number;
  kd: number;
}

export interface PidState {
  integral: number;
  prevError: number;
}

export interface PidOptions {
  outputLimit?: number;   // clamp the final control output
  integralLimit?: number; // clamp the accumulator (defaults to outputLimit)
}

export function createPidState(): PidState {
  return { integral: 0, prevError: 0 };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function stepPid(
  state: PidState,
  gains: PidGains,
  error: number,
  dt: number,
  opts: PidOptions = {},
): number {
  const outputLimit = opts.outputLimit ?? Infinity;
  const integralLimit = opts.integralLimit ?? outputLimit;

  state.integral = clamp(state.integral + error * dt, -integralLimit, integralLimit);
  const derivative = dt > 0 ? (error - state.prevError) / dt : 0;
  state.prevError = error;

  const raw = gains.kp * error + gains.ki * state.integral + gains.kd * derivative;
  return clamp(raw, -outputLimit, outputLimit);
}
