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

// 12:00 Melbourne on the given YYYY-MM-DD day. DST switches at 02:00/03:00
// local, so the offset read at that day's 23:00 local also holds at noon.
function melbourneNoon(day) {
  const [y, m, d] = day.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Melbourne', timeZoneName: 'longOffset' })
    .formatToParts(probe).find((part) => part.type === 'timeZoneName').value; // e.g. "GMT+11:00"
  const [, sign, hh, mm] = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  return new Date(Date.UTC(y, m - 1, d, 12) - minutes * 60_000);
}

const now = new Date(option('now', new Date().toISOString()));
if (Number.isNaN(now.getTime())) throw new Error('invalid --now timestamp');
// The sky is sampled at a fixed instant of the Melbourne day, so every run on
// the same day writes identical bytes and the scheduled job commits once a day.
const date = zonedDate(now, 'Australia/Melbourne');
const instant = melbourneNoon(date);
const planets = {};
for (const body of BODIES) planets[body] = Number(geoLongitude(body, instant).toFixed(4));

// ±30 Melbourne days around today, one row per day at Melbourne noon:
// [date, ...longitudes in BODIES order], 2 decimals (~4 KB). The almanac
// page reads retrograde marks off adjacent rows and never loads an ephemeris.
const WINDOW_DAYS = 30;
const [cy, cm, cd] = date.split('-').map(Number);
const rows = [];
for (let offset = -WINDOW_DAYS; offset <= WINDOW_DAYS; offset++) {
  const day = new Date(Date.UTC(cy, cm - 1, cd + offset)).toISOString().slice(0, 10);
  const noon = melbourneNoon(day);
  rows.push([day, ...BODIES.map((body) => Number(geoLongitude(body, noon).toFixed(2)))]);
}

const out = {
  generatedAt: instant.toISOString(),
  date,
  planets,
  window: { center: date, bodies: BODIES, sampledAt: 'Melbourne noon', days: rows },
};

// Pretty-print, but keep each window row on one line.
const json = JSON.stringify(out, null, 2).replace(/\[\s*("\d{4}-\d{2}-\d{2}"[^\]]*?)\s*\]/g, (_, row) => `[${row.replace(/\s+/g, ' ')}]`);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(option('output', join(__dirname, '..', 'public', 'transits-daily.json')));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json + '\n');
console.log(`Wrote ${outPath}`);
console.log(json);
