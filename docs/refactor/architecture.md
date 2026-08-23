# AFFLATUS architecture

## System boundaries

`src/config/siteManifest.js` is the route, locale, metadata and build source of truth. Build scripts derive the Vite input set, sitemap, localized documents, structured data, performance-route projection and social-card expectations from that manifest.

The application has four presentation boundaries:

1. `/` — React editorial chapters plus one decorative, capability-gated Three.js canvas.
2. `/command/` and `/experiments/flight/` — React static-first mission surfaces; no continuous Three.js scene.
3. Focused content indexes and case studies — React reading surfaces in `src/content/`; no canvas.
4. Retained specialist routes — independent data, reader, simulation and visualization entry modules whose URLs and source claims remain stable.

## Homepage experience lifecycle

`src/config/experienceMode.js` resolves Cinematic, Static, Reduced or Legacy before the homepage mounts. `ExperienceRoot` then resolves High, Medium, Mobile, Static or Reduced from viewport, device capability, WebGL, Reduced Motion and Save-Data signals before importing `SignatureScene`.

- Static/Reduced/Save-Data never request the deferred Three.js scene chunk.
- High/Medium/Mobile own one decorative `aria-hidden` canvas.
- The scroll timeline and Flight Director own chapter state; content remains semantic DOM.
- Mobile uses exactly three camera beats: bow approach, port-side drift and engine pass/departure.
- Scene failure falls back to the three-frame static journey; static failure can roll back to `/portfolio.html` through the M01 experience policy.

## Navigation and localization

`src/config/primaryNavigation.js` owns the five public concepts and Command entry. `src/lib/nav.js` enhances retained HTML headers. React-owned mission/content headers call the same enhancer in a layout effect so the full navigation exists before first paint and does not create a delayed second row.

`scripts/localize-site.mjs` emits `/en/` and `/zh/` documents from route-localized metadata and content. Serial is intentionally Chinese-only. Legacy aliases are declared in the manifest and `vercel.json` and remain tested.

## Content ownership

`src/config/contentMigration.js` maps published subjects to their focused destination while preserving original records and anchored URLs. Index and case-study templates do not duplicate source claims or turn historical material into live data.

## Quality and observability

- Unit contracts: `tests/`.
- Browser, accessibility, responsive and visual gates: `e2e/`.
- Performance profiles/governor: `src/showcase/experience/qualityProfile.js` and `qualityGovernor.js`.
- Privacy-bounded Web Vitals: `src/entry/performance.js`.
- Release evidence: `docs/refactor/audit/m17/`, `docs/refactor/screenshots/` and `lighthouse-baseline.json`.
