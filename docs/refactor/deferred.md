# AFFLATUS deferred issues from M00

These are observations only. They are not fixed in M00 because M00 permits documentation, tests, and non-invasive diagnostics only.

## Existing verification failures

- `e2e/quality-gates.spec.js`: home does not expose the selectors expected by the current route gate (`[data-afflatus-nav]`, `.nav-menu-btn`, `.nav-labs__trigger`) after the showcase entry renders.
- `e2e/quality-gates.spec.js`: `signal.html` produces a 404 resource request and therefore fails the no-console-error fixture.
- `e2e/quality-gates.spec.js`: existing serious color-contrast findings are reported for home and portfolio.
- `e2e/quality-gates.spec.js`: portfolio mobile keyboard behavior does not reach the expected `aria-expanded="true"` state in one project.

## Architecture/performance risks

- 23 canvas references, 34 files with `requestAnimationFrame`, and 84 global event-listener references indicate multiple independent animation/event owners.
- The route map declares multiple canvas/WebGL experiences; M06/M07 should establish the eventual single-canvas and single-RAF ownership boundary before adding more cinematic effects.
- Vite reports post-minification chunks over 500 kB; Three.js vendor and home bundles are the main candidates for later M13 governance.
- `portfolio.html` and `index.html` represent two materially different homepage/deck shells; M01/M03 must establish the rollback and route compatibility strategy before visual consolidation.
- Current route semantics do not yet have dedicated `/command` or `/experiments/flight` paths; defer route creation to M03/M14.

## Scope boundary

- Do not rewrite existing content, market data, translations, analytics, or accessibility behavior during M00.
- Do not remove legacy portfolio/deck code until the M17 cleanup gate.

## M01 follow-up

- M01 establishes a feature-flag and redirect boundary only. The current showcase remains the default cinematic mode; M04/M06 must replace its presentation/scene architecture behind this boundary rather than alter the legacy shell in place.

## M17 closeout

The M00 observations above are retained as historical baseline evidence. Their release dispositions are:

- shared navigation selectors, Signal resource delivery and serious/critical axe baselines now pass the active-route browser gate;
- Portfolio mobile navigation and fixed command-bar behavior pass their scoped projects;
- the homepage owns one decorative canvas and one scene RAF; specialist routes remain intentionally isolated;
- Command and Flight Experiment now have dedicated static-first routes;
- Three.js remains a deferred chunk with explicit High/Medium/Mobile/Static/Reduced governance;
- `/portfolio.html` remains a compatibility and rollback surface rather than being deleted without dependency evidence.

The remaining operational limits are field INP, physical-device sustained-FPS profiling and physical VoiceOver/TalkBack review; see `m17-release-candidate.md`.
