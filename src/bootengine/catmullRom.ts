/* ============================================================
   CATMULL-ROM — U29 P1/P3: the "样条轨迹生成" stage of the HBT pipeline
   (意图选择 → 机动库 → 样条轨迹生成) AND the P3 "Catmull-Rom 镜头轨"
   camera path — one spline module serves both, since both problems are
   "smoothly pass through a list of waypoints". No THREE.js, no DOM.

   Deliberately duration-agnostic: sample(u) takes u in [0,1] across the
   WHOLE multi-segment path and returns a position plus a tangent (the
   spatial derivative d(pos)/du — NOT a velocity in units/second). A
   maneuver has its own pacing (fast break-turn, slow rejoin) and a camera
   cut has its own pacing (a snap-cut vs. a lazy pan) — baking a single
   time model into the curve itself would force one pacing on both
   consumers. Callers multiply tangent(u) by their own du/dt (1 / duration,
   or an eased ramp) to get a real velocity — same "pure math, caller owns
   time" split as pid.ts/rigidBody6dof.ts.

   Standard uniform Catmull-Rom (not centripetal): fine here because
   maneuver/camera waypoints are hand-placed by the maneuver library, not
   arbitrary/unevenly-spaced captured data — the "cusp" failure mode
   centripetal parametrization fixes doesn't come up. Endpoints are handled
   by duplicating the first/last point as phantom neighbours (standard
   clamped-spline trick) so the path actually starts/ends AT the given
   points instead of needing extra padding points from the caller.
   ============================================================ */

export interface Vec3 { x: number; y: number; z: number; }

const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const scaleV = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);

// one Catmull-Rom basis eval, per-axis (p0..p3 are scalars: the x, y, or z
// component of four consecutive control points; t is the LOCAL segment
// parameter in [0,1]).
function basis(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}
function basisDeriv(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2)
    + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t
    + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

export interface CatmullRomPath {
  segments: number; // number of segments (control points - 1)
  sample(u: number): { pos: Vec3; tangent: Vec3 };
  pos(u: number): Vec3;
  tangent(u: number): Vec3;
}

export function createCatmullRomPath(points: Vec3[]): CatmullRomPath {
  if (points.length < 2) throw new Error('createCatmullRomPath: need at least 2 points');
  // phantom-pad: duplicate first/last point so every real segment has 4
  // usable neighbours (pts[0] and pts[last] are the phantom points).
  const pts = [points[0], ...points, points[points.length - 1]];
  const segCount = points.length - 1;

  function locate(u: number) {
    const uc = Math.max(0, Math.min(1, u));
    const scaled = uc * segCount;
    const seg = Math.min(segCount - 1, Math.floor(scaled));
    return { seg, local: scaled - seg };
  }

  function sample(u: number) {
    const { seg, local: t } = locate(u);
    const p0 = pts[seg], p1 = pts[seg + 1], p2 = pts[seg + 2], p3 = pts[seg + 3];
    const pos = v3(
      basis(p0.x, p1.x, p2.x, p3.x, t),
      basis(p0.y, p1.y, p2.y, p3.y, t),
      basis(p0.z, p1.z, p2.z, p3.z, t),
    );
    // chain rule: local t = u*segCount - seg, so d(local)/du = segCount.
    const dLocal = v3(
      basisDeriv(p0.x, p1.x, p2.x, p3.x, t),
      basisDeriv(p0.y, p1.y, p2.y, p3.y, t),
      basisDeriv(p0.z, p1.z, p2.z, p3.z, t),
    );
    return { pos, tangent: scaleV(dLocal, segCount) };
  }

  return {
    segments: segCount,
    sample,
    pos: (u: number) => sample(u).pos,
    tangent: (u: number) => sample(u).tangent,
  };
}
