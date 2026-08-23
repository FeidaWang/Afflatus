# AFFLATUS M07 — FlightDirector, ScrollTimeline and SceneState

Date: 2026-08-23
Scope: M07 scroll-to-scene infrastructure only. M08 camera route and carrier behaviour have not started.

## Outcome

The home experience now has one directional data flow from native document scroll to renderer state:

```text
native scroll / resize / history restoration
  -> ScrollTimeline (measured chapter bounds + target progress)
  -> one SignatureScene RAF (smoothed 0–1 progress)
  -> FlightDirector (camera contract + chapter cue)
  -> renderer objects + minimal readonly SceneState
  -> DOM data-current-chapter / data-active-system / data-loading-state
```

`src/showcase/experience/scrollTimeline.js` is the only owner of chapter DOM measurement and document scroll reads. `SignatureScene` does not query chapters or read `scrollY`; it consumes Timeline frames and FlightDirector output.

No wheel, touch or keyboard event is intercepted. Anchor navigation, PageDown and browser history stay native, and the semantic six-Chapter DOM remains readable without WebGL or a continuous RAF.

## ScrollTimeline contract

- Maps the document scrollable distance to a finite, clamped `0–1` target.
- Smooths only the renderer progress with exponential damping; DOM Chapter state follows the native target immediately.
- Measures all six existing `[data-chapter]` elements and derives contiguous normalized ranges from their document positions.
- Uses a viewport-relative 45% reading anchor, not hard-coded section heights or scene pixels.
- Treats sub-pixel/one-pixel browser bottom rounding as `1`, preventing an almost-complete final state.
- Resolves exact boundaries toward the incoming Chapter and provides both target Chapter and smoothed journey Chapter data.
- Responds to `scroll`, `resize`, `hashchange`, `popstate` and `pageshow`; it never calls `scrollTo`, prevents default scrolling or creates its own RAF.
- Static and Reduced Motion modes keep this event-driven Timeline, so readonly DOM scene state remains current with zero Canvas and zero continuous RAF.

## FlightDirector contract

`src/showcase/experience/FlightDirector.js` owns the renderer-facing fields required by the design:

- Camera Position;
- Look-at target;
- FOV;
- Exposure;
- Roll;
- Chapter Cue and Active System.

M07 deliberately supplies one neutral baseline for every Chapter: position `[0, 0, 1]`, look-at `[0, 0, 0]`, FOV `38`, exposure `1`, roll `0`. The renderer now uses a `PerspectiveCamera` and applies all of these fields, but there is no Chapter-specific camera motion, spline, carrier pass or authored route. Those values belong exclusively to M08.

Chapter Cue is mapped to the six existing semantic systems:

| Chapter | Active System |
|---|---|
| `01-cold-void` | `orientation` |
| `02-the-approach` | `operating-posture` |
| `03-parallel-drift` | `capital-software-intelligence` |
| `04-bridge-aperture` | `current-intelligence` |
| `05-the-wake` | `field-record` |
| `06-departure` | `manifesto` |

## SceneState and React boundary

`src/showcase/experience/sceneState.js` exposes frozen snapshots containing only:

- `chapterId`;
- `activeSystem`;
- `loadingState`.

The store notifies subscribers only when one of these values changes. `ExperienceRoot` publishes snapshots to readonly root data attributes imperatively; the main RAF never calls a React state setter. Low-frequency React state remains limited to capability, quality Profile, deferred component and lifecycle status transitions.

E2E-only diagnostics expose snapshot getters when `window.__AFFLATUS_E2E__` is present. They are absent in normal production sessions and prove that scene frames/render calls advance while `reactRenders` remains unchanged.

## Single RAF and lifecycle ownership

- `SignatureScene` remains the only continuous RAF owner. Timeline has no RAF.
- M06's two startup paint opportunities are transient scheduling frames, not a second animation loop.
- Quality-profile resize reconciliation now uses a short timer instead of a transient resize RAF.
- Visibility loss cancels the main RAF and resumes from a fresh timestamp.
- Context loss stops the RAF and moves through the M01 static fallback.
- Scene unmount removes `visibilitychange` and `webglcontextlost`, disconnects ResizeObserver, disposes geometry/material/texture/renderer and releases the context.
- Experience unmount destroys Timeline, removes its five browser listeners, clears restoration timers and removes the E2E diagnostics surface.
- The existing M05 scene-signal listener and profile resize listener retain symmetric cleanup.

Browser evidence captures the old experience API before context loss; after the route remount, that old instance reports `activeRafOwners: 0`, `mainRafRunning: false`, `destroyed: true` and `listenerCount: 0`.

## React review

Applied the Vercel React best-practices checklist:

- Three.js remains a conditional dynamic import after the Poster-first paint boundary;
- scroll listeners are passive and centralized;
- high-frequency progress, timestamps, counters and renderer state live outside React state;
- parent lifecycle callbacks are stable or held through callback refs;
- effects have symmetric listener, timer, observer, RAF and resource cleanup;
- no component-local scroll subscription, eager Three.js import or per-frame state update was introduced.

## Automated and visual evidence

- Timeline/Director/SceneState unit contract: `tests/m07FlightDirector.test.js`
- Browser scroll/history/RAF/cleanup contract: `e2e/m07-flight-director.spec.js`
- M06 Canvas/fallback compatibility: `e2e/m06-experience.spec.js`
- Earlier interaction and semantic compatibility: M01, M03, M04 and M05 Playwright specs

Final checks:

- `npm test`: 204 files, 1954 tests passed;
- `npm run typecheck`: passed;
- `npm run build`: passed;
- M01–M07 cross-device Playwright regression: 51 passed, 42 project-specific skips;
- M07 dedicated matrix: 7 passed, 14 project-specific skips;
- home quality gates: 3 passed;
- LCP telemetry: 1 passed;
- `git diff --check`: passed.

An additional combined all-route quality-gate and telemetry run produced 27 passes and four out-of-scope worktree failures: three Signal checks saw the same missing-resource 404, and Portfolio reported existing contrast failures at `#f1`, `#f2`, `#f3`. M07 changes do not touch those routes or selectors; the home gates are clean.

Screenshots, all visually inspected:

- `docs/refactor/screenshots/m07-flight-desktop-1440x1000.png`
- `docs/refactor/screenshots/m07-flight-mobile-412x892.png`
- `docs/refactor/screenshots/m07-flight-reduced-440x956.png`

## Build impact

Compared with the M06 handoff build:

- eager home JS: 219.43kB -> 224.85kB minified; Timeline, Director and static-path SceneState are intentionally eager;
- home CSS: unchanged at 17.81kB minified;
- deferred scene glue: 3.49kB / 1.68kB gzip -> 4.42kB / 2.10kB gzip;
- Three.js remains deferred at 728.58kB / 188.02kB gzip and is still not requested by static/reduced profiles;
- no GLTF or authored camera-route asset is requested in M07.

The existing shared Three.js chunk warning remains M13 scope.

## M08 boundary

M08 may replace the neutral baseline with the authored camera route and Chapter-specific interpolation. It must consume the existing normalized Timeline and publish through FlightDirector; scene objects must not begin reading DOM or scroll directly. M08 must also preserve native scrolling, the one-main-RAF rule, readonly SceneState, Poster/static/reduced paths, Canvas cardinality and every lifecycle cleanup proven here.

No commit was created for M07.
