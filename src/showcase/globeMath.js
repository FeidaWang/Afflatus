// +Y north, +Z at (0°, 0°), +X east. Orthographic camera faces -Z.
export const clamp = value => Math.max(0, Math.min(1, value));
export function spherePoint(latitude, longitude, radius = 1) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}
export function localProgress(top, height, viewport, header) {
  const travel = height - (viewport - header);
  return travel > 0 ? clamp((header - top) / travel) : 0;
}
// AFFLATUS design keys; not measured source camera values. Angles are unwrapped.
export const HERO_KEYS = [
  { at: 0, x: .50, y: .53, scale: 1, yaw: -.25, pitch: .16, orbit: .35 },
  { at: .18, x: .50, y: .53, scale: 1, yaw: -.40, pitch: .16, orbit: .40 },
  { at: .42, x: .50, y: .53, scale: .91, yaw: -1.05, pitch: .10, orbit: .56 },
  { at: .68, x: .50, y: .53, scale: .88, yaw: -1.95, pitch: .06, orbit: .73 },
  { at: .88, x: .50, y: .53, scale: .86, yaw: -2.48, pitch: .12, orbit: .88 },
  { at: 1, x: .50, y: .53, scale: .86, yaw: -2.48, pitch: .12, orbit: .88 },
];
export function heroFrame(progress) {
  const p = clamp(progress), b = HERO_KEYS.find(k => k.at >= p) || HERO_KEYS.at(-1);
  const a = HERO_KEYS[Math.max(0, HERO_KEYS.indexOf(b) - 1)];
  const t = b.at === a.at ? 0 : (p - a.at) / (b.at - a.at), s = t * t * (3 - 2 * t);
  return Object.fromEntries(Object.keys(a).map(key => [key, a[key] + (b[key] - a[key]) * s]));
}
export function shipOrbit(theta) {
  // Tilt the orbit 1 radian around X. Radius 1.55 exceeds Earth + .20 ship + .15 clearance.
  const r = 1.55, tilt = 1;
  return {
    position: [r * Math.cos(theta), r * Math.sin(theta) * Math.sin(tilt), r * Math.sin(theta) * Math.cos(tilt)],
    angle: Math.atan2(Math.cos(theta) * Math.sin(tilt), -Math.sin(theta)),
  };
}
// Original long-axis habitation ship: bow, layered cabins, twin drives, antenna.
export const SHIP_LINES = [
  [[-.19, -.025], [.07, -.035], [.20, 0], [.07, .035], [-.19, .025], [-.19, -.025]],
  [[-.13, -.025], [-.13, -.065], [-.02, -.065], [.03, -.03]],
  [[-.13, .025], [-.13, .065], [-.02, .065], [.03, .03]],
  [[-.19, -.04], [-.23, -.04], [-.23, -.015], [-.19, -.015]],
  [[-.19, .04], [-.23, .04], [-.23, .015], [-.19, .015]],
  [[-.12, 0], [.18, 0]], [[-.07, -.025], [-.07, .025]],
  [[.01, -.03], [.01, .03]], [[-.04, .065], [-.04, .10], [.015, .10]],
];

// A reversible editorial timeline, not the reference site's unmeasured timings.
export function storyFrame(progress) {
  const p=clamp(progress);
  const smooth=(a,b)=>{const t=clamp((p-a)/(b-a));return t*t*(3-2*t);};
  const first=smooth(.24,.36), second=smooth(.59,.71);
  return { weights:[1-first,first-second,second], phase:p<.30?0:p<.65?1:2, green:first, blue:second };
}
