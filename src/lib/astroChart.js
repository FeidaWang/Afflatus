/* ============================================================
   ASTRO CHART — V23 Phase 1 (roadmap §7.10 module 4). Pure SVG
   string renderers: data in, SVG-markup string out. No DOM, no
   astronomy-engine import — planet math lives in astroPlanets.ts
   (dynamically imported) / astro.js; this file only draws what
   it's given, so it's directly vitest-able and safe to statically
   import (never pulls the ephemeris dependency into the bundle).

   Three renderers:
   - renderWheel(): L3 natal wheel — whole-sign houses from the
     ascendant, planet glyphs on a ring, an inner aspect-line web.
   - renderAspectGrid(): L3 NxN aspect heatmap.
   - renderRadar(): L2 five-dimension (love/career/comm/energy/
     growth) spider chart.

   Wheel angle convention (verified by hand against the standard
   astrological layout, see tests/astroChart.test.js): ascendant
   sits at 9 o'clock; increasing ecliptic longitude sweeps
   COUNTERCLOCKWISE from there (9 -> 6 -> 3 -> 12 o'clock), which
   puts the descendant opposite at 3 o'clock and the MC-ish region
   at 12 — the conventional quadrant layout. Formula: screen angle
   θ = 180° + (lonDeg - ascDeg); x = cx + r·cos(θ), y = cy − r·sin(θ)
   (SVG y grows downward, hence the minus).
   ============================================================ */
import { aspectBetween, ASPECT_T } from './astro.js';

const DEG = Math.PI / 180;
const mod360 = (n) => ((n % 360) + 360) % 360;

export const ZODIAC_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const PLANET_GLYPH = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };
const ASPECT_STYLE = {
  strong: { stroke: '#e0b45a', width: 1.6, dash: '' },
  soft: { stroke: '#9cc79c', width: 1.1, dash: '' },
  hard: { stroke: '#d9765a', width: 1.1, dash: '3,3' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function wheelPoint(lonDeg, ascDeg, r, cx, cy) {
  const th = (180 + (lonDeg - ascDeg)) * DEG;
  return [cx + r * Math.cos(th), cy - r * Math.sin(th)];
}

/**
 * Natal wheel — data in, SVG string out.
 * @param {{ascDeg:number, planets:Array<{body:string, lonDeg:number, retro?:boolean}>}} data
 * @returns {string} SVG markup (no outer <svg> viewBox sizing decisions made
 *   for the caller beyond a fixed 400x400 box — callers wrap/scale via CSS).
 */
export function renderWheel({ ascDeg, planets }) {
  const cx = 200, cy = 200, rOuter = 190, rZodiacIn = 156, rPlanet = 116, rAspect = 64;
  let svg = `<svg class="astro-wheel" viewBox="0 0 400 400" role="img" aria-label="natal wheel">`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rOuter}" class="aw-bg"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rZodiacIn}" class="aw-ring"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rAspect}" class="aw-inner"/>`;
  // 12 house-cusp spokes + sign glyphs (whole sign: cusp N starts at ascendant's sign)
  const ascSign = Math.floor(mod360(ascDeg) / 30);
  for (let i = 0; i < 12; i++) {
    const cuspLon = i * 30;
    const [x0, y0] = wheelPoint(cuspLon, ascDeg, rZodiacIn, cx, cy);
    const [x1, y1] = wheelPoint(cuspLon, ascDeg, rOuter, cx, cy);
    const isAsc = i === 0;
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${isAsc ? 'aw-cusp aw-asc' : 'aw-cusp'}"/>`;
    const signIdx = (ascSign + i) % 12;
    const [lx, ly] = wheelPoint(cuspLon + 15, ascDeg, (rZodiacIn + rOuter) / 2, cx, cy);
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="aw-sign" text-anchor="middle" dominant-baseline="central">${ZODIAC_GLYPH[signIdx]}</text>`;
  }
  // aspect web (inner circle), reusing astro.js's aspectBetween
  const aspectPairs = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = aspectBetween(planets[i].lonDeg, planets[j].lonDeg);
      if (a) aspectPairs.push({ a: planets[i], b: planets[j], aspect: a });
    }
  }
  for (const { a, b, aspect } of aspectPairs) {
    const [x0, y0] = wheelPoint(a.lonDeg, ascDeg, rAspect, cx, cy);
    const [x1, y1] = wheelPoint(b.lonDeg, ascDeg, rAspect, cx, cy);
    const style = ASPECT_STYLE[ASPECT_T[aspect.key].tone] || ASPECT_STYLE.soft;
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${style.stroke}" stroke-width="${style.width}" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} data-aspect="${esc(aspect.key)}" data-a="${esc(a.body)}" data-b="${esc(b.body)}"/>`;
  }
  // planet markers
  for (const p of planets) {
    const [x, y] = wheelPoint(p.lonDeg, ascDeg, rPlanet, cx, cy);
    const glyph = PLANET_GLYPH[p.body] || p.body[0];
    svg += `<g class="aw-planet" data-body="${esc(p.body)}" data-lon="${p.lonDeg.toFixed(2)}">`
      + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" class="aw-planet-bg"/>`
      + `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="aw-planet-glyph" text-anchor="middle" dominant-baseline="central">${glyph}${p.retro ? '℞' : ''}</text>`
      + `</g>`;
  }
  svg += `</svg>`;
  return svg;
}

/**
 * Aspect grid heatmap — NxN, diagonal shows the planet glyph, off-diagonal
 * cells (upper triangle only, mirrored visually via symmetric coloring)
 * show the matched aspect's color, empty if no aspect.
 * @param {Array<{body:string, lonDeg:number}>} planets
 */
export function renderAspectGrid(planets) {
  const n = planets.length;
  const cell = 30, pad = 4;
  const size = n * cell + pad * 2;
  let svg = `<svg class="astro-aspect-grid" viewBox="0 0 ${size} ${size}" role="img" aria-label="aspect grid">`;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = pad + j * cell, y = pad + i * cell;
      if (i === j) {
        svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="ag-diag"/>`;
        svg += `<text x="${x + cell / 2}" y="${y + cell / 2}" class="ag-glyph" text-anchor="middle" dominant-baseline="central">${PLANET_GLYPH[planets[i].body] || planets[i].body[0]}</text>`;
        continue;
      }
      if (j < i) continue; // upper triangle only; lower mirrors via a second pass below
      const a = aspectBetween(planets[i].lonDeg, planets[j].lonDeg);
      const style = a ? (ASPECT_STYLE[ASPECT_T[a.key].tone] || ASPECT_STYLE.soft) : null;
      svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="ag-cell" fill="${style ? style.stroke : 'transparent'}" fill-opacity="${style ? 0.5 : 0}" data-a="${esc(planets[i].body)}" data-b="${esc(planets[j].body)}" data-aspect="${a ? esc(a.key) : ''}"/>`;
      // mirror the same cell into the lower triangle so the grid reads
      // symmetrically at a glance (roadmap calls this a "heatmap", not a
      // one-sided table)
      const mx = pad + i * cell, my = pad + j * cell;
      svg += `<rect x="${mx}" y="${my}" width="${cell}" height="${cell}" class="ag-cell" fill="${style ? style.stroke : 'transparent'}" fill-opacity="${style ? 0.5 : 0}" data-a="${esc(planets[j].body)}" data-b="${esc(planets[i].body)}" data-aspect="${a ? esc(a.key) : ''}"/>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

/**
 * Five-dimension radar (L2) — 爱情/事业/沟通/能量/成长.
 * @param {Array<{key:string, label:string, value:number, lit?:boolean}>} dims exactly 5 entries, value in [0,100]
 */
export function renderRadar(dims) {
  const n = dims.length;
  const cx = 130, cy = 130, rMax = 96;
  const angleFor = (i) => (-90 + (360 / n) * i) * DEG; // start at top, clockwise
  const pt = (i, r) => [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
  let svg = `<svg class="astro-radar" viewBox="0 0 260 260" role="img" aria-label="five-dimension radar">`;
  // grid rings at 33/66/100%
  for (const frac of [0.33, 0.66, 1]) {
    const poly = dims.map((_, i) => pt(i, rMax * frac).map((v) => v.toFixed(1)).join(',')).join(' ');
    svg += `<polygon points="${poly}" class="ar-grid"/>`;
  }
  // spokes + labels
  dims.forEach((d, i) => {
    const [ex, ey] = pt(i, rMax);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="ar-spoke"/>`;
    const [lx, ly] = pt(i, rMax + 22);
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="ar-label${d.lit ? ' ar-lit' : ''}" text-anchor="middle" dominant-baseline="central" data-dim="${esc(d.key)}">${esc(d.label)}</text>`;
  });
  // data polygon
  const dataPoly = dims.map((d, i) => pt(i, rMax * Math.max(0, Math.min(100, d.value)) / 100).map((v) => v.toFixed(1)).join(',')).join(' ');
  svg += `<polygon points="${dataPoly}" class="ar-data"/>`;
  dims.forEach((d, i) => {
    const [px, py] = pt(i, rMax * Math.max(0, Math.min(100, d.value)) / 100);
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.4" class="ar-dot${d.lit ? ' ar-lit' : ''}" data-dim="${esc(d.key)}"/>`;
  });
  svg += `</svg>`;
  return svg;
}
