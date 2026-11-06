# M8 evidence

Everything with `SYNTH` in its name uses invented data, served on 127.0.0.1 only. None of it is a real result or VEC trial data.

| Path | What |
|---|---|
| `matrix/` | 74 viewport captures: 7 states × 5 viewports × 2 languages, plus the race details below the map at 1024 and 768 |
| `probes/party-letters-*` | Party letters, normal and with simulated deuteranopia. Shot before the seat chart was top-aligned |
| `data/matrix.json` | Layout readings per capture: page width, text outside the viewport, console errors, stage codes |
| `data/probe.json` | DOM readings: source-failure panel, evidence link, runoff label, NSW Council and AU Senate counts |
| `data/lighthouse-runs.json` | Every Lighthouse run behind the recorded row |
| `scripts/` | The scripts that made all of the above. `make-stores.mjs` is the M7 reviewer's generator, unchanged |

Reproduce: `npm run build`, then `npx vite preview --host 127.0.0.1 --port 4290 --strictPort`, then `node scripts/make-stores.mjs <repo> <scratch>`, then `node scripts/add-runoff.mjs <scratch>`, then `node scripts/elections/serve-local.mjs --store <scratch>/stores/vic-live --port 4180` (and `vic-error` on 4181), then `node scripts/matrix.mjs <repo> matrix data/matrix.json`.
