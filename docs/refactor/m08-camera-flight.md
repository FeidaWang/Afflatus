# AFFLATUS M08 — Guided Camera Flight

Date: 2026-08-23
Scope: M08 camera composition and carrier behaviour only. M09 scale-reference layers and M10 final lighting/materials are not implemented.

## Outcome

The production home no longer presents a centred rotating object. One fixed, procedural carrier now remains at the world origin while the existing M07 FlightDirector moves a PerspectiveCamera through seven authored shots:

```text
Distant observation
  -> Bow approach
  -> Port-side parallel drift
  -> Bridge aperture
  -> Mid-hull shadow
  -> Engine pass
  -> Departure vector
```

The single decorative Canvas is fixed to the viewport and persists behind the existing six semantic Chapters. The Chapter DOM and native document scrolling remain unchanged. Semi-transparent section surfaces preserve copy contrast while allowing the carrier composition to continue across section boundaries.

## Authored route

`src/showcase/experience/FlightDirector.js` owns the route and interpolates Position and Look-at with a local Catmull-Rom implementation. FOV, exposure and Roll use eased scalar interpolation.

| Progress | Path node | FOV | Roll |
|---:|---|---:|---:|
| 0.00 | Distant observation | 38° | -0.12° |
| 0.12 | Bow approach | 33° | -0.34° |
| 0.28 | Port-side parallel drift | 31° | 0.42° |
| 0.50 | Bridge aperture | 29° | 0.58° |
| 0.68 | Mid-hull shadow | 32° | 0.26° |
| 0.84 | Engine pass | 31° | -0.46° |
| 1.00 | Departure vector | 38° | 0.00° |

Every dense route sample is finite, FOV is clamped to 28°–40°, and absolute Roll is clamped to 0.8°. Boundary sampling is continuous and pure: the same progress produces the same camera state regardless of forward or reverse traversal. Native `hashchange` continues to snap the M07 Timeline for direct Chapter navigation.

Projection tests use the actual carrier bounds. No sample from 0% through 70% fully frames the carrier at the desktop evidence aspect ratio; the departure keyframe is the first authored full silhouette.

## Carrier and renderer behaviour

`src/showcase/experience/createCarrierProxy.js` reuses the repository's procedural AFFLATUS Vanguard geometry rather than loading either committed Venator GLB:

- 4,312 triangles;
- seven merged material-family draw surfaces plus non-rendering anchors;
- fixed position `[0, 0, 0]`, rotation `[0, 0, 0]`, and scale `1.18`;
- no per-frame carrier transform;
- no OrbitControls;
- no high-poly model, texture pack, Bloom, dust field or nebula added.

The small ambient/key/reflection light setup exists only to make composition reviewable. It is not the M10 final lighting or material pass.

`SignatureScene` remains the only continuous RAF owner. On each eligible frame it samples the M07 Timeline, updates the FlightDirector, applies the camera transform/FOV/Roll/exposure, and renders. It does not read document scroll or update React state per frame. Visibility, context-loss, resize, pointer, geometry, material, texture and renderer cleanup remain symmetric.

## Supplemental input and debug surface

Fine mouse input changes only the camera view offset, never route Position or Look-at. It is clamped to ±5 CSS pixels and exponentially damped; touch has no pointer-dependent camera path.

The flight overlay reports normalized progress, FOV and nearest Path Node only when both conditions are true:

- `import.meta.env.DEV`;
- query parameter `flight-debug=1`.

A production build ignores the query and emits no overlay. E2E-only readonly diagnostics retain the M07 alias and add `window.__AFFLATUS_M08__` solely when the deterministic test fixture opts in.

## Static and Reduced Motion

Static, Reduced Motion, Save Data and unsupported-WebGL profiles still do not import the scene, create a Canvas or start a continuous RAF. They retain the poster-first semantic page and the existing motion toggle contract. The fixed background placement did not change the one-Canvas or fallback lifecycle.

## React review

Applied the Vercel React best-practices checklist after the scene changes:

- Three.js and carrier code remain behind the M06 deferred dynamic import;
- high-frequency camera, pointer and diagnostic values stay in the renderer effect, not React state;
- lifecycle callbacks are stable or held through refs;
- no component-level scroll subscription, second RAF or per-frame React render was introduced;
- all new browser listeners and renderer resources have paired cleanup.

## Automated and visual evidence

- Camera route, bounds, continuity, reverse determinism, crop, pointer, static-transform and debug-gate unit contract: `tests/m08CameraFlight.test.js`
- Browser flight, direct jump, reverse travel, pointer bounds, one RAF, production debug gate and cross-device evidence: `e2e/m08-camera-flight.spec.js`
- Updated M06 fixed-viewport Canvas geometry contract: `e2e/m06-experience.spec.js`
- Preserved M07 Timeline/Director contract: `tests/m07FlightDirector.test.js`

Final checks:

- `npm test`: 205 files, 1,962 tests passed;
- `npm run typecheck`: passed;
- `npm run build`: passed;
- M01–M08 cross-device Playwright regression: 57 passed, 54 project-specific skips;
- M08 dedicated device matrix: 6 passed, 12 project-specific skips;
- home metadata/keyboard/axe gates: 3 passed;
- LCP telemetry: 1 passed;
- `git diff --check`: passed.

The browser-verification skill's preferred `agent-browser` CLI was not installed in this workspace. The repository's deterministic Playwright suite supplied the real Chromium/WebKit navigation, input, lifecycle and screenshot verification instead.

Screenshots, all visually inspected:

- `docs/refactor/screenshots/m08-bow-approach-desktop-1440x1000.png`
- `docs/refactor/screenshots/m08-parallel-drift-desktop-1440x1000.png`
- `docs/refactor/screenshots/m08-departure-desktop-1440x1000.png`
- `docs/refactor/screenshots/m08-flight-mobile-412x892.png`
- `docs/refactor/screenshots/m08-flight-reduced-440x956.png`

## Build impact

Compared with the M07 handoff build:

- eager home JS: 224.85 kB -> 221.05 kB minified;
- home CSS: 17.81 kB -> 18.51 kB minified;
- deferred `SignatureScene`: 4.42 kB / 2.10 kB gzip -> 6.15 kB / 2.84 kB gzip;
- reused procedural dependencies are split as `odinHull` 6.44 kB / 2.58 kB gzip and `afflatusVanguard` 7.16 kB / 2.96 kB gzip;
- Three.js remains deferred and unchanged at 728.58 kB / 188.02 kB gzip;
- static/reduced profiles still request none of the deferred scene or carrier chunks.

The existing shared Three.js chunk warning remains M13 scope.

## M09 boundary

M09 may add the five independently degradable space layers and at least three visible scale-reference classes. It must preserve this camera route, the fixed-carrier invariant, the single RAF, the first-70% crop and all fallback paths. M09 should not replace scale evidence with a simple carrier `scale` animation, and M10 remains the owner of final materials, engine treatment and Selective Bloom.

No commit was created for M08.
