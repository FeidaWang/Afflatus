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

// Spec §8.3 chapter 4: US and China land dots are tinted. Coarse territory test on (lat, lon).
import { landRegion, xyzRegion } from '../src/sectors/industry/globe-layout.js';
import { spherePoint } from '../src/showcase/globeMath.js';
describe('landRegion', () => {
  const cases = [
    ['San Francisco', 37.77, -122.42, 'US'], ['New York', 40.71, -74.0, 'US'], ['Austin', 30.27, -97.74, 'US'], ['Seattle', 47.61, -122.33, 'US'],
    ['Miami', 25.76, -80.19, 'US'], ['Anchorage', 61.22, -149.9, 'US'],
    ['Beijing', 39.9, 116.4, 'CN'], ['Shanghai', 31.23, 121.47, 'CN'], ['Shenzhen', 22.54, 114.06, 'CN'], ['Hangzhou', 30.27, 120.16, 'CN'], ['Chengdu', 30.57, 104.07, 'CN'], ['Urumqi', 43.83, 87.62, 'CN'],
    ['Toronto', 43.65, -79.38, null], ['Vancouver', 49.28, -123.12, null], ['Tijuana', 32.51, -117.04, null], ['Mexico City', 19.43, -99.13, null],
    ['Seoul', 37.57, 126.98, null], ['Tokyo', 35.68, 139.69, null], ['Taipei', 25.03, 121.57, null], ['Ulaanbaatar', 47.89, 106.91, null], ['London', 51.5, -0.13, null],
  ];
  it.each(cases)('%s', (_, lat, lon, want) => expect(landRegion(lat, lon)).toBe(want));
  it('reads unit-sphere points in the globe frame', () => {
    expect(xyzRegion(spherePoint(37.77, -122.42, 1))).toBe('US');
    expect(xyzRegion(spherePoint(39.9, 116.4, 1))).toBe('CN');
    expect(xyzRegion(spherePoint(51.5, -0.13, 1))).toBe(null);
  });
});
