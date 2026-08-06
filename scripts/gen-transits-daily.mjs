#!/usr/bin/env node
/* ============================================================
   gen-transits-daily.mjs (V23 Phase 3, roadmap §7.10 module 4) —
   precompute today's planet longitudes into public/transits-daily.json
   (<2KB) so the browser can render "双人今日天象" (daily couple weather)
   and the daily draw / fate-calendar features WITHOUT loading
   astronomy-engine at all — the client just fetches this tiny JSON and
   runs the existing light aspect math (src/lib/astro.js aspectBetween)
   against each visitor's own natal longitudes.

   Run by the unified data orchestrator. The scheduled path writes to its
   temporary candidate directory and hands that file to data:publish; a plain
   invocation still refreshes public/transits-daily.json for local use:
     node scripts/gen-transits-daily.mjs --output=<candidate>/transits-daily.json
     npm run data:publish -- horoscope-transits <candidate>

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
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import * as Astronomy from 'astronomy-engine';
import { zonedDate } from '../src/lib/dataFreshness.js';

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

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

const now = new Date(option('now', new Date().toISOString()));
if (Number.isNaN(now.getTime())) throw new Error('invalid --now timestamp');
const planets = {};
for (const body of BODIES) planets[body] = Number(geoLongitude(body, now).toFixed(4));

const out = {
  generatedAt: now.toISOString(),
  date: zonedDate(now, 'Australia/Melbourne'),
  planets,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(option('output', join(__dirname, '..', 'public', 'transits-daily.json')));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(out, null, 2));
