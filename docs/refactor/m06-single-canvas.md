# AFFLATUS M06 — Single Canvas, Poster and capability gating

Date: 2026-08-23
Scope: M06 infrastructure and aligned first frame only. M07 flight/timeline work has not started.

## Outcome

The six-chapter DOM remains the complete source of meaning. Chapter 01 now owns the only home WebGL surface through `src/showcase/experience/ExperienceRoot.jsx`; no chapter, Command dialog or retained Radar creates another home Canvas.

The visible sequence is intentionally one-way:

```text
semantic DOM + Poster
  -> two browser paint opportunities
  -> idle capability probe
  -> dynamic SignatureScene / Three.js import
  -> aligned WebGL first frame
```

The Poster is never removed. The WebGL texture uses the same `blackhole-hero.jpg` source and cover-position contract, so loading, ready and fallback states preserve the composition and box geometry.

## Unified quality profile

`src/showcase/experience/qualityProfile.js` resolves one of:

- `high` — capable wide viewport; 60fps target, DPR capped at 1.5;
- `medium` — narrower or ≤6-core/≤6GB class device; 30fps, DPR 1.25;
- `mobile` — capable viewport at or below 820px; 24fps, DPR 1;
- `static` — explicit static mode, missing WebGL, single-core/≤2GB class device or unusably small viewport;
- `reduced` — explicit reduced mode, Motion off, system Reduced Motion or Save Data.

Missing optional `deviceMemory` / `hardwareConcurrency` values use conservative neutral defaults rather than being interpreted as failure. Software WebGL is allowed and receives the existing hardware/viewport profile; stronger runtime performance governance remains M13 scope.

Only `high`, `medium` and `mobile` load the dynamic scene. `static` and `reduced` request neither `SignatureScene` nor the Three.js vendor chunk and create no Canvas or continuous RAF.

## Lifecycle and fallback contract

- Canvas is decorative: `aria-hidden="true"`, `tabindex="-1"`, pointer-events disabled through its absolute host.
- Texture load or renderer initialization failure calls the M01 fallback boundary and retains the Poster.
- `webglcontextlost` is prevented, the RAF is stopped, resources are disposed and the experience moves to static Poster mode.
- `visibilitychange` pauses the RAF; resume resets the time origin before requesting the next frame, avoiding a large delta.
- ResizeObserver owns render-size reconciliation; the capability root also re-resolves viewport Profile and unmounts/restarts the same single Canvas at profile boundaries.
- Unmount removes visibility/context/resize listeners, cancels RAF, disposes geometries, materials and texture, disposes the renderer and releases its context.
- M05 `afflatus:scene-signal` is consumed at the experience boundary through `data-scene-intent`; interaction primitives still import no renderer code.

Local-only diagnostics:

- `?scene=unavailable` — capability/init unavailable;
- `?scene=resource-error` — invalid Poster texture resource.

Both remain restricted to localhost by the same review policy as M01 diagnostics.

## React review

Applied the Vercel React best-practices checklist:

- Three.js is a conditional dynamic import after first paint;
- RAF timestamps, running state and renderer objects live in refs/effect scope, not React state;
- React state changes only for low-frequency profile/status transitions;
- callback refs prevent renderer effects from restarting when parent callbacks change;
- capability, resize, visibility, context and signal effects all have symmetric cleanup;
- no barrel import or eager Three.js import was added to the home application bundle.

## Automated and visual evidence

- Profile/lifecycle unit contract: `tests/m06ExperienceRoot.test.js`
- Browser/fallback/performance contract: `e2e/m06-experience.spec.js`
- M04 single-canvas compatibility: `e2e/m04-home.spec.js`
- M01 fallback compatibility: `e2e/experience-mode.spec.js`

Browser coverage includes delayed scene-chunk delivery while H1/Poster remain visible, one-Canvas cardinality, Canvas accessibility, exact host geometry within the existing 1px section border, CLS ≤0.01, scene intent, visibility pause/resume, WebGL-disabled mode, resource failure, context loss, viewport profile reconciliation and static/reduced network exclusion.

Screenshots:

- `docs/refactor/screenshots/m06-cinematic-desktop-1440x1000.png`
- `docs/refactor/screenshots/m06-mobile-412x892.png`
- `docs/refactor/screenshots/m06-reduced-poster-440x956.png`

## Build impact

Compared with the M05 handoff build:

- eager home JS: 224.74kB -> 219.43kB minified;
- home CSS: 17.03kB -> 17.81kB minified;
- deferred scene glue: 3.49kB minified / 1.68kB gzip;
- Three.js remains a deferred shared vendor chunk and is not requested by static/reduced profiles;
- no GLTF is requested in M06.

The existing Vite warning for the shared Three.js vendor chunk remains. M13 owns compression, LOD and adaptive runtime budgets; M06 does not disguise that deferred cost as eager home work.

## M07 boundary

M06 has one minimal scene RAF and no scroll reads. M07 may replace that loop with the shared FlightDirector/ScrollTimeline owner, but must preserve this Poster-first import boundary, quality Profile, Canvas cardinality, cleanup behavior and renderer-neutral scene-signal contract.
