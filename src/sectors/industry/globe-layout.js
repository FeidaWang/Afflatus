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
