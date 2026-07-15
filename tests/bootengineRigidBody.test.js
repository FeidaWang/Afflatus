import { describe, it, expect } from 'vitest';
import { integrateRigidBody, createBody6dof, v3, identityQuat, rotateVectorByQuat } from '../src/bootengine/rigidBody6dof';

const finiteV = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const finiteQ = (q) => Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w);
const qNorm = (q) => Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
const qDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

describe('integrateRigidBody — linear motion', () => {
  it('matches the discrete-exact velocity/position for constant force (symplectic Euler)', () => {
    const mass = 2, force = v3(4, 0, 0), dt = 0.02, steps = 100;
    let body = createBody6dof();
    for (let i = 0; i < steps; i++) {
      body = integrateRigidBody(body, force, v3(), mass, v3(1, 1, 1), dt);
    }
    const accel = force.x / mass; // = 2
    const expectedVel = accel * dt * steps; // exact for constant force
    // discrete Riemann sum: pos = dt * sum_{k=1}^{N} accel*dt*k
    const expectedPos = accel * dt * dt * (steps * (steps + 1)) / 2;
    expect(body.vel.x).toBeCloseTo(expectedVel, 9);
    expect(body.pos.x).toBeCloseTo(expectedPos, 6);
  });

  it('zero force/torque on a body at rest stays exactly at rest', () => {
    const body0 = createBody6dof();
    const body1 = integrateRigidBody(body0, v3(), v3(), 1, v3(1, 1, 1), 0.02);
    expect(body1.pos).toEqual(v3());
    expect(body1.vel).toEqual(v3());
    expect(body1.quat).toEqual(identityQuat());
  });

  it('never produces NaN/Infinity across a dense stepping sweep', () => {
    let body = createBody6dof();
    for (let i = 0; i < 500; i++) {
      body = integrateRigidBody(
        body, v3(Math.sin(i), Math.cos(i * 0.5), 1), v3(0.1, -0.2, 0.05), 3, v3(2, 2, 2), 0.016,
      );
      expect(finiteV(body.pos) && finiteV(body.vel) && finiteQ(body.quat) && finiteV(body.angVel)).toBe(true);
    }
  });
});

describe('integrateRigidBody — angular motion', () => {
  it('keeps the quaternion normalized across many steps', () => {
    let body = createBody6dof();
    for (let i = 0; i < 300; i++) {
      body = integrateRigidBody(body, v3(), v3(0.3, 0.1, -0.2), 1, v3(1, 1.5, 0.8), 0.02);
    }
    expect(qNorm(body.quat)).toBeCloseTo(1, 9);
  });

  it('a full rotation period at constant angular velocity returns to the starting orientation', () => {
    const w = 2; // rad/s about x-axis
    const dt = 0.001;
    const period = (2 * Math.PI) / w;
    const steps = Math.round(period / dt);
    let body = createBody6dof({ angVel: v3(w, 0, 0) });
    // torque = 0 with initial angVel already set keeps angVel constant
    // (angAccel = 0/inertia = 0), isolating pure orientation integration.
    for (let i = 0; i < steps; i++) {
      body = integrateRigidBody(body, v3(), v3(), 1, v3(1, 1, 1), dt);
    }
    // q and -q represent the same rotation, so compare |dot| to 1.
    expect(Math.abs(qDot(body.quat, identityQuat()))).toBeCloseTo(1, 2);
  });

  it('is deterministic given the same inputs (golden-set requirement)', () => {
    const run = () => {
      let body = createBody6dof();
      const trace = [];
      for (let i = 0; i < 50; i++) {
        body = integrateRigidBody(body, v3(1, 0.5, 0), v3(0.1, 0, 0.2), 2, v3(1, 1, 1), 0.02);
        trace.push({ ...body.pos, qw: body.quat.w });
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });
});

describe('rotateVectorByQuat', () => {
  it('identity quaternion leaves the vector unchanged', () => {
    const v = v3(1, 2, 3);
    const r = rotateVectorByQuat(identityQuat(), v);
    expect(r.x).toBeCloseTo(v.x, 9);
    expect(r.y).toBeCloseTo(v.y, 9);
    expect(r.z).toBeCloseTo(v.z, 9);
  });

  it('180° about Y flips local forward (0,0,1) to (0,0,-1)', () => {
    const r = rotateVectorByQuat({ x: 0, y: 1, z: 0, w: 0 }, v3(0, 0, 1));
    expect(r.x).toBeCloseTo(0, 9);
    expect(r.y).toBeCloseTo(0, 9);
    expect(r.z).toBeCloseTo(-1, 9);
  });

  it('90° about Y rotates (1,0,0) to (0,0,-1)', () => {
    const h = Math.SQRT1_2;
    const r = rotateVectorByQuat({ x: 0, y: h, z: 0, w: h }, v3(1, 0, 0));
    expect(r.x).toBeCloseTo(0, 9);
    expect(r.y).toBeCloseTo(0, 9);
    expect(r.z).toBeCloseTo(-1, 9);
  });

  it('preserves vector length for an arbitrary unit quaternion', () => {
    const raw = { x: 0.2, y: -0.4, z: 0.1, w: 0.8 };
    const len = Math.sqrt(raw.x ** 2 + raw.y ** 2 + raw.z ** 2 + raw.w ** 2);
    const q = { x: raw.x / len, y: raw.y / len, z: raw.z / len, w: raw.w / len };
    const v = v3(3, -1, 2);
    const r = rotateVectorByQuat(q, v);
    const inLen = Math.hypot(v.x, v.y, v.z);
    const outLen = Math.hypot(r.x, r.y, r.z);
    expect(outLen).toBeCloseTo(inLen, 9);
  });
});
