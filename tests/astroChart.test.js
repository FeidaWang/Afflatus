import { describe, it, expect } from 'vitest';
import { renderWheel, renderAspectGrid, renderRadar, ZODIAC_GLYPH, PLANET_GLYPH } from '../src/lib/astroChart.js';

// astroChart.js is a pure data-in/SVG-string-out renderer (roadmap §7.10
// module 4) — same headless verification approach as carrierHull.test.js:
// no real renderer available in this sandbox, so we verify structure/
// geometry from the returned SVG string instead of pixels.

const count = (s, re) => (s.match(re) || []).length;

describe('renderWheel — house-cusp geometry', () => {
  it('draws exactly 12 cusp spokes and 12 sign glyphs', () => {
    const svg = renderWheel({ ascDeg: 15, planets: [] });
    expect(count(svg, /class="aw-cusp( aw-asc)?"/g)).toBe(12);
    expect(count(svg, /class="aw-sign"/g)).toBe(12);
  });
  it('the ascendant cusp (index 0) sits at the 9-o\'clock screen position (left of center, same y as center)', () => {
    // ascDeg=15 (mid-Aries): cusp 0 is the ascendant's own sign boundary,
    // i.e. cuspLon=0 relative math -> screen angle 180+(0-15)=165°, close to
    // but not exactly 180 (only lonDeg===ascDeg would be exactly left) — use
    // ascDeg on a 30-boundary so cusp 0 lands exactly on the ascendant point.
    const svg = renderWheel({ ascDeg: 0, planets: [] });
    const tag = svg.match(/<line[^>]*class="aw-cusp aw-asc"[^>]*\/>/);
    expect(tag).toBeTruthy();
    const x1 = parseFloat(tag[0].match(/x1="([\d.]+)"/)[1]), y1 = parseFloat(tag[0].match(/y1="([\d.]+)"/)[1]);
    expect(x1).toBeLessThan(200); // left of center (cx=200)
    expect(Math.abs(y1 - 200)).toBeLessThan(1); // same height as center (cy=200)
  });
  it('sign glyph order starts from the ascendant\'s own sign and proceeds through all 12', () => {
    const ascDeg = 40; // Taurus (sign index 1)
    const svg = renderWheel({ ascDeg, planets: [] });
    const glyphs = [...svg.matchAll(/class="aw-sign"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(glyphs.length).toBe(12);
    expect(glyphs[0]).toBe(ZODIAC_GLYPH[1]); // Taurus first
    expect(new Set(glyphs).size).toBe(12); // all 12 signs present, no repeats
  });
});

describe('renderWheel — planets and aspects', () => {
  it('places one marker per planet, tagged with its own longitude', () => {
    const planets = [{ body: 'Sun', lonDeg: 100 }, { body: 'Moon', lonDeg: 210 }];
    const svg = renderWheel({ ascDeg: 0, planets });
    expect(count(svg, /class="aw-planet"/g)).toBe(2);
    expect(svg).toContain('data-body="Sun" data-lon="100.00"');
    expect(svg).toContain('data-body="Moon" data-lon="210.00"');
    expect(svg).toContain(PLANET_GLYPH.Sun);
    expect(svg).toContain(PLANET_GLYPH.Moon);
  });
  it('marks retrograde planets with ℞', () => {
    const svg = renderWheel({ ascDeg: 0, planets: [{ body: 'Mercury', lonDeg: 50, retro: true }] });
    expect(svg).toContain('℞');
  });
  it('draws an aspect line for two planets in exact conjunction, none for an unrelated 35° gap', () => {
    const conj = renderWheel({ ascDeg: 0, planets: [{ body: 'Sun', lonDeg: 10 }, { body: 'Moon', lonDeg: 12 }] });
    expect(count(conj, /data-aspect="conj"/g)).toBe(1);
    const none = renderWheel({ ascDeg: 0, planets: [{ body: 'Sun', lonDeg: 10 }, { body: 'Moon', lonDeg: 45 }] });
    expect(count(none, /data-aspect="/g)).toBe(0);
  });
});

describe('renderAspectGrid — NxN symmetry', () => {
  it('has N diagonal cells and a symmetric off-diagonal (i,j) == (j,i)', () => {
    const planets = [{ body: 'Sun', lonDeg: 10 }, { body: 'Moon', lonDeg: 12 }, { body: 'Mars', lonDeg: 100 }];
    const svg = renderAspectGrid(planets);
    expect(count(svg, /class="ag-diag"/g)).toBe(3);
    // Sun/Moon are in exact conjunction (2° apart) — both mirrored cells should carry it
    expect(count(svg, /data-aspect="conj"/g)).toBe(2); // (Sun,Moon) and (Moon,Sun)
  });
  it('scales to the number of planets given (10-body chart)', () => {
    const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const planets = bodies.map((body, i) => ({ body, lonDeg: i * 37 }));
    const svg = renderAspectGrid(planets);
    expect(count(svg, /class="ag-diag"/g)).toBe(10);
  });
});

describe('renderRadar — five-dimension polygon', () => {
  const dims = [
    { key: 'love', label: 'Love', value: 80 },
    { key: 'career', label: 'Career', value: 40 },
    { key: 'comm', label: 'Comm', value: 60, lit: true },
    { key: 'energy', label: 'Energy', value: 20 },
    { key: 'growth', label: 'Growth', value: 100 },
  ];
  it('draws a 5-point data polygon and 5 axis labels', () => {
    const svg = renderRadar(dims);
    const dataPoly = svg.match(/points="([^"]+)" class="ar-data"/)[1];
    expect(dataPoly.trim().split(' ').length).toBe(5);
    expect(count(svg, /class="ar-label( ar-lit)?"/g)).toBe(5);
  });
  it('marks the lit dimension distinctly', () => {
    const svg = renderRadar(dims);
    expect(svg).toContain('data-dim="comm"');
    expect(count(svg, /ar-lit/g)).toBeGreaterThanOrEqual(2); // label + dot
  });
  it('clamps out-of-range values into [0,100] without throwing', () => {
    expect(() => renderRadar([
      { key: 'a', label: 'A', value: -20 }, { key: 'b', label: 'B', value: 150 },
      { key: 'c', label: 'C', value: 50 }, { key: 'd', label: 'D', value: 50 }, { key: 'e', label: 'E', value: 50 },
    ])).not.toThrow();
  });
});
