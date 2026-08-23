# AFFLATUS M14 — Mission Room and Flight Experiment Split

Date: 2026-08-23
Scope: truthful public Command, isolated flight experiment and route integration.

## Outcome

The sole public Command entry now points to `/command/`. It is a semantic, WebGL-free Mission Room containing:

- Current Objective: “Preserve capital while maintaining optionality.”
- Current Trajectory: Capital / Stable, Software / Building, Intelligence / Observing;
- Next Action: “Review long-end signal” with a dossier link;
- keyboard-operable Observe / Model / Commit tabs;
- an explicit unavailable state for account, deployment, sensor and combat data that is not connected.

The page never presents invented values as telemetry. Its background uses only a slow, low-opacity CSS drift and stops under Reduced Motion.

`/experiments/flight/` is a separate noindex experiment entry. It clearly labels NAV / COMBAT, Radar, Weapons, Shields and G-force as simulated systems and preserves `/portfolio.html?mode=flight` as the legacy launch path. FPS is compiled behind the development/debug gate.

## Bundle and route isolation

Production chunks, minified / gzip:

| Route chunk | Size |
|---|---:|
| Command | 6.98 kB / 3.10 kB |
| Flight Experiment | 3.94 kB / 1.94 kB |
| shared Mission Header | 1.72 kB / 0.78 kB |
| deferred shared navigation | 3.72 kB / 1.58 kB |

Neither route requests `SignatureScene`, Three.js or `topdownCombat`. Both have fixed-locale emitted documents, WebPage schema, canonical metadata and dedicated 1200×630 bilingual social cards. Command is discoverable; Flight Experiment remains noindex and is excluded from the sitemap.

## Performance baseline

Three local Lighthouse runs per route:

| Route | Median score | Median LCP | TBT | Median CLS | Script | Total |
|---|---:|---:|---:|---:|---:|---:|
| Command | 0.98 | 1,961 ms | 0 ms | 0 | 74,083 B | 140,194 B |
| Flight Experiment | 0.98 | 1,959 ms | 0 ms | 0 | 72,906 B | 138,908 B |

One shared-header run on each route produced CLS 0.078; that observed branch is retained as `clsBudgetBase`, below the 0.1 field guardrail.

## Verification

- route, truthfulness, bundle-boundary and SEO contracts: `tests/m14MissionRoom.test.js` plus manifest/brand/Lighthouse tests;
- desktop, mobile Reduced Motion, navigation geometry and asset isolation: `e2e/m14-mission-room.spec.js`;
- visually inspected evidence:
  - `docs/refactor/screenshots/m14-command-desktop-1440x1000.png`;
  - `docs/refactor/screenshots/m14-command-mobile-reduced-440x956.png`;
  - `docs/refactor/screenshots/m14-flight-experiment-desktop-1440x1000.png`.

No commit was created for M14.
