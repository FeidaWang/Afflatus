/* ============================================================
   ASTRO PLANETS (Mercury..Pluto) — V23 Phase 1 (roadmap §7.10).
   Real geocentric apparent tropical ecliptic longitude of date,
   via the `astronomy-engine` npm package (MIT, pure JS, no WASM,
   arc-minute-class planetary precision, 1900-2100 coverage).

   This closes the V21 leftover decision documented at the top of
   astro.js: hand-typing VSOP87 coefficients from memory was
   rejected as unverifiable data-entry, and a full Swiss Ephemeris
   WASM port (~600KB+) was rejected as precision this site has no
   use for (no asteroids/fixed stars). astronomy-engine is the
   first vendored ephemeris dependency in the project.

   IMPORTANT — dynamic-import discipline (roadmap §7.10 module 4):
   this module (and the astronomy-engine dependency it pulls in)
   must ONLY be loaded via `import()` at the moment the user
   expands the L3 "PRO" chart or casts a synastry chart. L1/L2 keep
   using astro.js's existing hand-verified Sun/Moon/Ascendant so the
   first-paint bundle carries zero ephemeris-library weight. Never
   add a static top-level import of this file from horoscope.js.

   Astronomy-engine gotcha (verified against a full-year 2026 scan
   before shipping): `EclipticLongitude(body, date)` returns the
   body's HELIOCENTRIC longitude, which is useless for a natal
   chart (a geocentric view). The correct call for "where does this
   planet appear from Earth" is `Ecliptic(GeoVector(body, date,
   true)).elon` — geocentric vector with aberration correction,
   rotated into true-ecliptic-of-date. That's what's used below.
   ============================================================ */
import * as Astronomy from 'astronomy-engine';
import { signOf, degInSign } from './astro.js';

export const PLANET_BODIES = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type PlanetBody = (typeof PLANET_BODIES)[number];

export interface PlanetPosition {
  body: PlanetBody;
  lonDeg: number;   // geocentric apparent ecliptic longitude of date, [0, 360)
  sign: number;      // 0 = Aries .. 11 = Pisces (whole-sign)
  deg: number;       // degrees into that sign, [0, 30)
  retro: boolean;    // apparent retrograde motion (longitude decreasing day-over-day)
}

// Julian Day (UT) -> JS Date. Standard conversion; JD 2440587.5 = Unix epoch.
export const jdToDate = (jd: number): Date => new Date((jd - 2440587.5) * 86400000);

// Geocentric apparent tropical ecliptic longitude of `body` at `date`, degrees [0,360).
export function planetLongitude(body: PlanetBody, date: Date): number {
  const vec = Astronomy.GeoVector(body as Astronomy.Body, date, true);
  const lon = Astronomy.Ecliptic(vec).elon;
  return ((lon % 360) + 360) % 360;
}

// Single planet's full sign/degree/retrograde reading at a given Julian Day (UT).
export function planetReading(body: PlanetBody, jd: number): PlanetPosition {
  const date = jdToDate(jd);
  const lonDeg = planetLongitude(body, date);
  const lonPrevDay = planetLongitude(body, jdToDate(jd - 1));
  // signed day-over-day change, wrapped to (-180, 180]; negative = retrograde
  const delta = (((lonDeg - lonPrevDay + 540) % 360) - 180);
  return { body, lonDeg, sign: signOf(lonDeg), deg: degInSign(lonDeg), retro: delta < 0 };
}

// All eight planets (Mercury..Pluto) at a given Julian Day (UT).
export function allPlanets(jd: number): PlanetPosition[] {
  return PLANET_BODIES.map((b) => planetReading(b, jd));
}
