// tests/sectorsGlobeLayout.test.js
import { describe, expect, it } from 'vitest';
import { TIER_RADIUS, clusterMarkers, companyMarkers } from '../src/sectors/industry/globe-layout.js';

const c = (id, lat, lon, tier = 2, layer = 'compute', country = 'US') => ({ id, hq: { lat, lon }, tier, layer, country });
const view = { lat0: 35, lon0: -110, radius: 300, cx: 400, cy: 400 };

describe('companyMarkers', () => {
  it('sizes by tier and filters by layer', () => {
    const m = companyMarkers([c('a', 37.4, -122, 1), c('b', 37.4, -122, 3, 'power')], view, { layer: 'compute' });
    expect(m).toHaveLength(1);
    expect(m[0].r).toBe(TIER_RADIUS[1]);
  });
  it('drops far-side companies', () => {
    expect(companyMarkers([c('tw', 24.8, 121)], view)).toHaveLength(0);
  });
});

describe('clusterMarkers', () => {
  it('groups Bay Area companies and keeps distant ones apart', () => {
    const m = companyMarkers([c('nvda', 37.37, -121.96, 1), c('amd', 37.38, -121.96), c('alab', 37.34, -121.89, 3), c('ceg', 39.29, -76.61)], view);
    const cl = clusterMarkers(m);
    const bay = cl.find((k) => k.ids.includes('nvda'));
    expect(bay.ids.sort()).toEqual(['alab', 'amd', 'nvda']);
    expect(cl.find((k) => k.ids.includes('ceg')).ids).toEqual(['ceg']);
  });
  it('never loses a company', () => {
    const m = companyMarkers(Array.from({ length: 30 }, (_, i) => c(`x${i}`, 30 + (i % 5), -120 + i)), view);
    expect(clusterMarkers(m).flatMap((k) => k.ids)).toHaveLength(m.length);
  });
});
