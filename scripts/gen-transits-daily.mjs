#!/usr/bin/env node
/* ============================================================
   gen-transits-daily.mjs (V23 Phase 3, roadmap §7.10 module 4) —
   precompute today's planet longitudes into public/transits-daily.json
   (<2KB) so the browser can render "双人今日天象" (daily couple weather)
   and the daily draw / fate-calendar features WITHOUT loading
   astronomy-engine at all — the client just fetches this tiny JSON and
   runs the existing light aspect math (src/lib/astro.js aspectBetween)
   against each visitor's own natal longitudes.

   Run by a daily scheduled task (see roadmap §7.10 module 4: "复用
   push-data.sh 管线"), same pattern as the site's other scheduled data
   generators (sectors-data.json, signal-events.json, etc.):
     node scripts/gen-transits-daily.mjs
     bash scripts/push-data.sh public/transits-daily.json "chore: refresh daily transits"

   Duplicates the small geocentric-longitude call from src/lib/
   astroPlanets.ts instead of importing that file directly: this script
   runs as a plain Node ESM script (no tsc/vite build step involved),
   and astroPlanets.ts's own header comment is explicit that it must
   only ever be reached via dynamic import() from the browser bundle —
   importing it here would be a second, unrelated entry point into the
   same file for a different runtime. The geocentric-longitude formula
   itself (Ecliptic(GeoVector(body, date, true)).elon) is copied
   verbatim, including the heliocentric-vs-geocentric gotcha documented
   there.
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Astronomy from 'astronomy-engine';

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

function geoLongitude(body, date) {
  if (body === 'Sun') {
    // Astronomy.GeoVector(Sun, ...) is valid too, but SunPosition() is the
    // library's own dedicated (and cheaper) apparent-geocentric Sun call.
    return Astronomy.SunPosition(date).elon;
  }
  const vec = Astronomy.GeoVector(body, date, true);
  const lon = Astronomy.Ecliptic(vec).elon;
  return ((lon % 360) + 360) % 360;
}

const now = new Date();
const planets = {};
for (const body of BODIES) planets[body] = Number(geoLongitude(body, now).toFixed(4));

const p = (x) => String(x).padStart(2, '0');
const out = {
  generatedAt: now.toISOString(),
  date: `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`,
  planets,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'transits-daily.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(out, null, 2));
