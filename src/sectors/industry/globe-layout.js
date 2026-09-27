// src/sectors/industry/globe-layout.js
import { projectLatLon } from '../stage/projection.js';

export const TIER_RADIUS = { 1: 18, 2: 13, 3: 9 };

export function companyMarkers(companies, view, { layer = null } = {}) {
  return companies
    .filter((c) => !layer || c.layer === layer)
    .map((c) => ({ c, p: projectLatLon(c.hq.lat, c.hq.lon, view) }))
    .filter(({ p }) => p.visible)
    .sort((a, b) => a.p.depth - b.p.depth)
    .map(({ c, p }) => ({ id: c.id, x: p.x, y: p.y, r: TIER_RADIUS[c.tier], visible: true, country: c.country, tier: c.tier }));
}

export function clusterMarkers(markers, { gap = 3 } = {}) {
  const order = [...markers].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  const clusters = [];
  for (const m of order) {
    const hit = clusters.find((k) => Math.hypot(k.x - m.x, k.y - m.y) < k.r + m.r + gap);
    if (hit) { hit.ids.push(m.id); hit.r = Math.min(28, hit.r + 1.5); } else clusters.push({ x: m.x, y: m.y, r: m.r, ids: [m.id] });
  }
  return clusters;
}

// Coarse territory outlines, [lon, lat], for tinting the globe's land dots (spec §8.3 chapter 4).
// Deliberately rough — enough to colour a dot grid, not a map of borders.
const TERRITORIES = {
  US: [
    [[-124.7, 48.4], [-123, 49], [-95, 49], [-89, 48], [-83, 46], [-82.5, 42], [-79, 43.3], [-75, 45], [-71, 45], [-67, 47.4],
      [-67, 44.5], [-70, 41.5], [-74, 40.5], [-76, 35], [-81, 31], [-80, 25], [-82, 25], [-83, 29], [-85, 29.7], [-89, 30],
      [-94, 29.5], [-97, 26], [-99.5, 27.5], [-104.5, 29.5], [-106.5, 31.8], [-111, 31.3], [-117.1, 32.6], [-120.5, 34.5], [-124.4, 40.4]],
    [[-168, 65], [-166, 68.9], [-156, 71.4], [-141, 69.6], [-141, 60], [-137, 58.5], [-131, 55], [-133, 56], [-150, 59.5],
      [-158, 56], [-165, 54.5], [-162, 58.5], [-166, 60.5]],
  ],
  CN: [
    [[73.5, 39.5], [75, 37], [78.5, 35.5], [79, 32.5], [81, 30], [85, 28], [88.7, 27.8], [92, 27.8], [97.5, 28.2], [98.5, 24.5],
      [101.5, 21.2], [106.5, 22.8], [108, 21.5], [111, 21.3], [113.5, 22.2], [117, 23.5], [119.5, 25.5], [122.2, 29.5], [122.2, 31.6], [121, 32.5],
      [120.5, 34.5], [119, 35], [122.5, 37], [121, 39], [122.5, 40.5], [124.4, 40], [128, 42], [130.5, 42.5], [131, 44.8],
      [134.7, 48.3], [127.5, 49.8], [125.5, 53], [121, 53.3], [119.5, 50], [116, 49.5], [111, 43.5], [106, 42], [97, 42.7],
      [91, 45.5], [87.5, 49], [85, 47], [82.5, 45], [80, 42.5], [76, 40.5]],
  ],
};

const inside = (poly, lon, lat) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/** 'US', 'CN' or null for a latitude / longitude in degrees. */
export function landRegion(lat, lon) {
  for (const [id, polys] of Object.entries(TERRITORIES)) if (polys.some((p) => inside(p, lon, lat))) return id;
  return null;
}

/** Same, for a unit-sphere point in the globe frame (+Y north, +Z at 0°/0°, +X east). */
export const xyzRegion = ([x, y, z]) => landRegion(Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI, Math.atan2(x, z) * 180 / Math.PI);
