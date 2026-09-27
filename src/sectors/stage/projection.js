// Orthographic globe projection shared by the scroll stage and the company globe.
// Sphere frame from globeMath: +Y north, +Z at (0°, 0°), +X east.
import { spherePoint } from '../../showcase/globeMath.js';

const RAD = Math.PI / 180;

/**
 * Project a unit-sphere point for a view centred on (lat0, lon0).
 * `view = { lat0, lon0, radius, cx, cy }`; screen y grows downward.
 * `depth` is the component toward the viewer (1 at the centre, 0 on the limb);
 * `visible` is false on the far hemisphere.
 */
export function projectXyz([x, y, z], { lat0, lon0, radius, cx, cy }) {
  const cl = Math.cos(lon0 * RAD), sl = Math.sin(lon0 * RAD);
  const x1 = x * cl - z * sl;          // rotate about Y so lon0 faces the camera
  const z1 = x * sl + z * cl;
  const cp = Math.cos(lat0 * RAD), sp = Math.sin(lat0 * RAD);
  const y2 = y * cp - z1 * sp;         // tilt about X so lat0 sits at the centre
  const z2 = y * sp + z1 * cp;
  return { x: cx + radius * x1, y: cy - radius * y2, depth: z2, visible: z2 >= 0 };
}

/** Same as projectXyz, from latitude / longitude in degrees. */
export const projectLatLon = (lat, lon, view) => projectXyz(spherePoint(lat, lon, 1), view);
