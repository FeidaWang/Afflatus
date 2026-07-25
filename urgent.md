# Project Afflatus — Website-Wide Structural Optimization Proposal

> Audit baseline: 2026-07-25 · source tree, production build, route branches, data contracts, rendering loops, metadata, and CI inspected.
>
> This is an execution backlog, not a visual redesign brief. `design.md` remains the visual/narrative SSOT and `tech.md` remains the current architecture SSOT. Preserve the Vite MPA, page-specific identities, local-first privacy, and git-backed content pipeline unless a measured gate below explicitly justifies reopening a decision.

## 0. Executive decision

The highest-return work is not a framework migration. It is to turn the current collection of strong page implementations into a governed platform:

1. Establish one route/content/locale manifest that generates Vite entries, navigation, canonical metadata, sitemap, and redirects.
2. Establish one runtime performance coordinator for canvas/WebGL lifecycle, DPR, visibility, reduced motion, and adaptive quality.
3. Move heavy inline controllers and compute loops into testable modules/workers without changing each page's visual identity.
4. Make every interactive visualization expose a semantic DOM/table equivalent and pass keyboard/screen-reader use.
5. Generate crawlable EN and ZH documents at build time instead of relying on a client-only language toggle.

### Measured baseline

| Evidence | Current state | Architectural implication |
| --- | --- | --- |
| Delivery model | Vite 8 multi-page static site; 11 build entries; 8 active navigation routes | Keep MPA; remove retired entries and generate route wiring from one manifest |
| Build weight | `vendor-three` 674.55 kB raw / 171.29 kB gzip; home JS 191.85 kB raw / 70.28 kB gzip; Horoscope JS 211.75 kB raw / 87.25 kB gzip | Three.js must stay off non-3D critical paths; Horoscope needs feature-level splitting |
| HTML weight | Course 181.89 kB raw / 56.33 kB gzip; Sectors 59.93 kB; Signal 52.61 kB | Extract structured content at build time while preserving fully rendered HTML |
| CSS | Home bundle 229.81 kB raw / 41.71 kB gzip; large legacy layer and many historical overrides | Migrate by component family; add CSS budgets and ownership, not a rewrite |
| 3D assets | Procedural `BufferGeometry`, primitives, shaders, canvas textures; no production GLTF/GLB loader or LOD system | Retain procedural assets; introduce a gated GLB pipeline only for authored high-detail assets |
| Rendering | Multiple WebGL/canvas renderers, independent rAF/timers, DPR caps of 1/1.5/1.75/2/3, partial visibility gates | Centralize policy and lifecycle; do not merge every renderer into one monolith |
| State | URL, DOM, closure state, `localStorage`, and `sessionStorage`; homepage locale key differs from sub-pages | Locale/store migration is P0; typed page stores are P1 |
| Quality gates | Unit/type/data/build/bundle/`!important`; Playwright desktop/flagship-mobile smoke, keyboard, console, axe-regression, screenshots, and anonymous CWV transport; Lighthouse runs every active route 3× against route-specific regression budgets | Treat lab baselines as debt floors, and make production p75 the product-health decision source after sufficient traffic |

## 1. Prioritization model

- **P0 — Critical:** broken cross-page consistency, material accessibility/performance/reliability risk, or platform work that unblocks multiple routes.
- **P1 — High:** major task success, discoverability, maintainability, or rendering improvement after P0 foundations.
- **P2 — Polish:** refinement with bounded value; ship only after P0/P1 acceptance gates remain green.
- **Effort:** S = ≤2 engineer-days, M = 3–7 days, L = 1–3 weeks, XL = multi-wave.

### Impact × effort matrix

| ID | Priority | Impact | Effort | Scope | Proposal and implementation pattern |
| --- | --- | --- | --- | --- | --- |
| P0-01 | P0 | Very high | M | All routes | [x] ~~Create `src/config/siteManifest.js` as the SSOT for path, status, locale titles/descriptions, nav group, theme, schema type, OG image, build inclusion, and redirect. Generate Vite inputs, nav data, sitemap, and a metadata audit from it. CI fails on drift.~~ |
| P0-02 | P0 | Very high | S | All bilingual routes | [x] ~~Migrate `afflatus-lang` and `afflatus:lang` to one versioned key (`afflatus:locale:v1`). Read old keys once, resolve conflicts deterministically, write the new key, and delete old keys after successful migration. Replace scene-specific locale reads with `getLocale()`.~~ |
| P0-03 | P0 | Very high | L | Home, Sectors, Boot, all canvas pages | [x] ~~Add a `RenderBudgetCoordinator`: one visibility/page-lifecycle registry, refresh-rate sampling, pixel-budget DPR, quality tier, pause/resume/dispose hooks, and telemetry. Each renderer registers; it does not own global policy.~~ |
| P0-04 | P0 | Very high | M | All routes | [x] ~~Add browser-level quality gates: Playwright smoke tests at desktop + two flagship mobile profiles, axe checks, keyboard route tests, console/page-error assertions, and two deterministic screenshots per active route.~~ |
| P0-05 | P0 | High | M | All routes | [x] ~~Add CWV budgets and field telemetry: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.10 at p75; route/locale/device-tier dimensions only, no personal input. Lighthouse CI enforces lab regression budgets rather than absolute perfection.~~ |
| P0-06 | P0 | High | M | Home/3D branches | [x] ~~Complete WebGL lifecycle ownership: rebuild after `webglcontextrestored`, dispose geometries/materials/textures/listeners, abort pending loads, cap simultaneous contexts, and fall back to a static poster after repeated loss.~~ |
| P0-07 | P0 | High | M | Stats, Sectors graph, Arena charts, Horoscope charts | [x] ~~Every visual gets a named region, keyboard interaction, textual summary, and table/list fallback. Canvas hit targets receive a parallel DOM control list; SVG points/series expose labels.~~ |
| P0-08 | P0 | High | S | Games, League, Boot | Remove retired `games.html` and `league.html` from Vite inputs; use permanent redirects to `stats.html` after confirming no seasonal reuse deadline. Keep source in an archive branch/package. Ensure `boot.html` stays noindex and is excluded from sitemap/nav. |
| P0-09 | P0 | High | M | JSON consumers + APIs | [x] ~~Introduce `fetchJson(key, {signal, freshness})`: request dedupe, AbortController, timeout, schema validation, stale-while-revalidate cache, and typed failure states. Stop applying `no-store` to immutable/versioned assets.~~ |
| P0-10 | P0 | High | M | All routes | [x] ~~Establish responsive primitives: `viewport-fit=cover`, safe-area tokens, `100svh/100dvh` policy, `VisualViewport` keyboard handling, 44×44 CSS px minimum targets, zoom-safe layouts, and no horizontal page overflow at 320–440 CSS px.~~ |
| P1-01 | P1 | Very high | L | EN/ZH content | Generate crawlable locale documents (`/en/...`, `/zh/...`) from one bilingual content source. Emit fixed `lang`, self-canonical, reciprocal `hreflang`, localized metadata, and locale-aware JSON-LD. Language switching changes URL while preserving route/branch state. |
| P1-02 | P1 | High | L | Home | Split `src/main.js` by experience: base shell, markets, terminal, combat, scene loaders. Load DOM/LCP content first; schedule Three.js and combat after visibility/intent/idle. Retain a zero-JS content path and static scene poster. |
| P1-03 | P1 | High | M | Home/Sectors/Boot 3D | Add a three-tier LOD contract and renderer budgets for current procedural models; add authored GLB pipeline only when a model exceeds procedural maintainability. See §5. |
| P1-04 | P1 | High | L | Horoscope | Split birth form, Bazi/ZWDS, synastry, quizzes, share card, and professional ephemeris into dynamic feature chunks. Move expensive synthesis to a worker and cancel superseded calculations. |
| P1-05 | P1 | High | M | Stats | Move inline statistics/rendering into `src/lib/stats/*` and `src/pages/stats.js`; run bootstrap batches in a worker; keep seeded output; share one chart component contract across MSI/WC datasets. |
| P1-06 | P1 | High | M | Sectors | Split data/card/story/graph controllers; choose one active graph renderer at a time; workerize force iterations; virtualize or progressively reveal long card collections. |
| P1-07 | P1 | High | M | Arena | Create an explicit page state machine (`loading`, `ready`, `stale`, `gated`, `partial`, `error`) and an abortable ticker selection pipeline. Cache history by symbol + last market session, not local calendar day. |
| P1-08 | P1 | High | M | Serial | Create stable book/chapter URLs and pre-render chapter content for SEO/sharing. Introduce `createReaderStore(adapter)` with a versioned schema for theme, font, progress, bookmarks, and audio state. |
| P1-09 | P1 | High | M | All routes | Create a bilingual content schema and lint: `{en, zh}` parity, placeholder/token equality, punctuation rules, glossary term choice, link equality, no orphan language, and maximum UI-label lengths. |
| P1-10 | P1 | High | M | All active routes | Generate route-specific Schema.org graphs and OG assets from the site manifest; add breadcrumb semantics and stable page dates/data provenance where truthful. |
| P1-11 | P1 | Medium-high | M | CSS system | Migrate one component family per PR from legacy CSS into `tokens/components/overrides`; eliminate the corresponding `!important`s; standardize container queries and 3 breakpoint bands. |
| P1-12 | P1 | Medium-high | S | Data pipelines | Extend schema validation to every public JSON and add atomic publish: validate → write temp → rename → build smoke → commit. Derived aggregates are computed, never hand-authored. |
| P2-01 | P2 | Medium | M | All routes | Per-route OG artwork and bilingual social copy; preserve visual identity rather than reusing one global image. |
| P2-02 | P2 | Medium | M | Motion-heavy routes | Add motion choreography tokens (`--motion-fast/base/slow`, easing, distance) and route-level motion budgets; use GSAP/Framer only if a measured requirement cannot be met with the existing vanilla scheduler. |
| P2-03 | P2 | Medium | S | Data visualizations | Add export/share affordances (PNG/SVG/CSV where meaningful), remembered metric selection, and touch crosshair/long-press details. |
| P2-04 | P2 | Medium | S | All routes | Refine empty, stale, locked, offline, retry, success, and destructive microcopy in EN/ZH; announce async changes through restrained live regions. |
| P2-05 | P2 | Low-medium | M | Boot prototype | Decide within a dated RFC whether to merge `bootengine` capabilities into production combat or freeze the prototype. Avoid maintaining two diverging simulation stacks indefinitely. |

### P0 delivery status

| ID | Status | Completed evidence / next gate |
| --- | --- | --- |
| P0-01 | [x] ~~**Completed 2026-07-25**~~ | `src/config/siteManifest.js` now owns route status, build inclusion, nav order/group, sitemap membership, EN/ZH metadata, schema intent, theme, capabilities, and redirects. Vite derives all 11 entries from `BUILD_ROUTES`; browser navigation consumes the generated lightweight projection `navRoutes.generated.js`; `site-manifest.mjs` generates sitemap and audits source HTML + Vercel redirects; CI runs `site:check`; 8 manifest invariant tests pass. Full gate: 73 files / 1,090 tests, typecheck, 12 data schemas, `!important` baseline, production build, and bundle budgets all pass. |
| P0-02 | [x] ~~**Completed 2026-07-25**~~ | `localeStore.js` now owns `afflatus:locale:v1`; resolution order is new key → old sub-page key → old home key; legacy keys are deleted only after a verified current-key write. Home, shared i18n, Arena, Games, League, and scene copy no longer read/write legacy keys directly. Ten language-capable HTML entries run one byte-identical synchronous pre-paint/migration script, enforced by `site:check`. Eight migration/failure-mode tests pass. Full gate: 74 files / 1,098 tests, typecheck, data validation, style baseline, production build, and bundle budgets all pass. |
| P0-03 | [x] ~~**Completed 2026-07-25**~~ | `renderBudget.js` owns tier selection, mobile/desktop pixel budgets, budget-derived DPR, refresh-rate estimation, p95 evaluation, and hysteresis. `renderBudgetCoordinator.js` owns one visibility/page-lifecycle registry, coalesced resize, refresh sampling, adaptive quality, anonymous surface telemetry, and pause/resume/dispose hooks. Registered owners now include Home master/background Worker/black-hole + HUD canvas family/Alphard/combat/radar/market chart/terminal map/hologram/lazy 3D assets; both Sectors renderers; all three Boot WebGL branches + telemetry; and Arena, Signal, and Serial ambient canvases. The Worker is resumable with a generation guard; Home fully stops while hidden/frozen and resumes with a 32 ms `dt` clamp. Twelve policy/coordinator tests pass. Explicit non-loop exceptions are on-demand share/export/transition canvases and the pointer-driven scratch cards on already-redirected Games/League routes. Full gate: 76 files / 1,110 tests, typecheck, 12 data schemas, style baseline, production build, and bundle budgets all pass. |
| P0-04 | [x] ~~**Completed 2026-07-25**~~ | `playwright.config.js` defines desktop Chromium (1440×1000), iPhone 16 Pro Max-like WebKit (440×956 @3x), and Galaxy S26 Ultra-like Chromium (412×892 @3.5x). The active-route manifest drives 96 collected browser checks: all 8 routes × 3 devices for render/metadata/overflow, keyboard/menu/route navigation, and two deterministic viewport captures; axe runs once per DOM contract against an exact-target debt baseline that permits only audited contrast nodes and fails on every new serious/critical target. The deterministic fixture fixes time/random/locale, isolates external analytics/fonts, disables animation variance, and asserts zero console/page errors. CI installs Chromium/WebKit, runs the matrix after the unit/build job, and retains reports/captures for 7 days. Browser work exposed and fixed Home nested interactive cards, Arena listbox naming, Sectors hidden-clone focusability, Stats range/SVG naming plus negative SVG animation geometry, page-transition negative radii after time-origin hand-off, Signal scroll-animation overflow, and Horoscope mobile grid overflow. Final gate: 80 passed + 16 intentional non-desktop axe skips; 48 PNG captures emitted; 76 Vitest files / 1,110 tests, typecheck, 12 schemas, style baseline, production build, and bundle budgets pass. Physical iPhone/Samsung runs remain the release sign-off, not emulation claims. |
| P0-05 | [x] ~~**Completed 2026-07-25**~~ | Every active route loads one shared `web-vitals` entry for CLS/INP/LCP. `webVitals.js` sends only an exact GA4 allowlist (`schema_version`, metric name/value/delta/rating/id, manifest route, `en/zh`, coarse device tier); it never spreads PerformanceEntry/attribution, URL query, viewport, UA, user input, or raw hardware values. Events use the existing delayed `gtag` transport, queue in memory for at most 10 s, then drop. Field targets are LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.10 at p75, segmented only by route/locale/device tier. `site-manifest.mjs` generates the performance/Lighthouse route projections and fails if an active HTML entry is missing or duplicated. Lighthouse 12.6.1 runs all 8 routes 3× under mobile simulation: route LCP/TBT/Speed Index/CLS/script bytes are hard 5%-regression gates, total bytes and category score are warning trends, and reports persist in CI. Sectors additionally reduced its decorative ticker from 1,012 to ≤120 buttons, delays ticker motion until the first LCP candidate/fallback, removed nonessential bar-growth motion, fixed ticker contrast, and avoids no-op bilingual DOM rewrites. Lighthouse intermittently returns `NO_LCP` for this dynamic route, so Sectors hard-gates FCP/Speed Index/CLS/script bytes while production field p75 remains the LCP decision source. Final gate: 78 Vitest files / 1,119 tests; Playwright 81 passed + 18 intentional skips; typecheck, 12 schemas, style baseline, production build, bundle budgets, and Lighthouse assertions pass. Post-deploy: register GA4 custom dimensions/metrics for the allowlisted fields and do not judge p75 until the sample is sufficient. |
| P0-06 | [x] ~~**Completed 2026-07-25**~~ | `webglLifecycle.js` now owns a hard eight-context lease cap, session-scoped loss counts, listener/AbortSignal lifetime, first-loss restoration, second-loss static-poster fallback, and an accessible bilingual re-enable control. Home raw Saturn GL rebuilds shaders/program/buffer/uniform locations after restoration; Three.js surfaces reset renderer state; Boot armor/fleet additionally rebuild their PMREM environment maps. Home Saturn, Alphard, hologram, fighter, capital ship and top-down combat; opt-in Sectors starfield; and all three Boot branches use the contract. `disposeThreeScene()` identity-deduplicates and releases geometries, materials, nested texture/uniform resources, render lists, renderer, and context; composer/render-surface disposal and Sectors data-buffer replacement are explicit. Current scenes have no asynchronous GLTF/texture fetch, while the lifecycle AbortSignal is the required cancellation token for future loaders. Four unit tests cover restore/fallback, cap, abort/listener cleanup and de-duplicated disposal; Chromium additionally invokes the real `WEBGL_lose_context` extension and verifies restore → repeated-loss poster → accessible recovery control. Final gate: 79 Vitest files / 1,123 tests; Playwright 82 passed + 20 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, and bundle budgets pass. |
| P0-07 | [x] ~~**Completed 2026-07-25**~~ | Stats confidence bars are SVG buttons with names, focus treatment and Enter/Space activation; the MSI/World Cup log tables expose the same records as keyboard-operable rows, bootstrap/threshold changes use polite status regions, and every generated histogram/curve/calibration SVG has a meaningful text name. Sectors’ 2D force graph now exposes a live node-count/current-selection summary, a visible parallel DOM button list, Canvas arrow-key/Enter/Home control and focus state; the opt-in 3D starfield has the same summary/button fallback in addition to its filter/D-pad controls, while the existing full matrix remains the complete non-visual dataset. Arena marks its ambient Canvas decorative and gives the equity SVG a text equivalent containing every model/benchmark’s final value; TA levels remain duplicated in semantic cards and positions in tables. Horoscope radar/wheel/aspect SVG names now contain their actual scores/planet positions/relationships; Ziwei and Bazi-matrix connector overlays are hidden as decorative while the real buttons expose complete names and pressed state. Shared page-turn handlers now ignore focused interactive/`tabindex` targets, preventing chart arrow keys from navigating routes. Three new browser contracts verify Stats keyboard marks/rows, Sectors Canvas + node-list equivalence, and Arena chart summaries; three pure SVG tests verify Horoscope data names. Final gate: 79 Vitest files / 1,126 tests; Playwright 85 passed + 26 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, and bundle budgets pass. |
| P0-08 | [ ] **Owner hold 2026-07-25** | Games and League are explicitly **not permanently retired for now**. Their HTML/source and Vite build entries remain intact; no archive/delete operation and no permanent redirect were applied. The existing temporary redirect state remains unchanged until the owner chooses seasonal reuse or retirement. Boot is independently verified as `noindex,nofollow`, absent from nav and sitemap, and still included only as a prototype build. |
| P0-09 | [x] ~~**Completed 2026-07-25**~~ | `fetchJson(key, {signal, freshness, timeoutMs, headers, forceRefresh})` now resolves a closed resource registry, validates every payload before delivery, de-duplicates concurrent requests, gives each consumer independent AbortSignal cancellation, applies an 8 s bounded network timeout, and returns typed `JsonDataError` states with status/retry/schema detail. Fresh data is served from memory/Cache Storage; stale data is returned immediately while one background revalidation refreshes it. Static fixed-URL JSON uses normal HTTP caching instead of blanket `no-store`; Arena quote/history retain endpoint-appropriate freshness. Arena, Boot, Games, League, Horoscope, Sectors, Signal, Stats, and Serial index/book consumers are migrated; the paused Serial playlist is deliberately untouched. Validators are split per resource and loaded concurrently with their JSON request, retaining route-level lazy delivery without a serial validation RTT. A 0.2 kB bridge exposes the module contract to legacy inline IIFEs and is inlined only in production HTML to avoid a render-blocking request. Quote/history proxies now bound allowlist/upstream calls, validate upstream shapes, emit normalized non-cacheable errors plus `X-Request-Id`, preserve 403 gating, and retain 12 s/1 h edge caching on success. Eight unit contracts cover de-duplication, schema failure, independent abort, SWR, HTTP status, correlation/error shape and timeout; Chromium proves Signal’s two renderers make one request. Final gate: 81 Vitest files / 1,134 tests; Playwright 114 collected = 86 passed + 28 intentional skips; typecheck, 12 schemas, route manifest, style baseline, production build, bundle budgets and diff hygiene pass. |
| P0-10 | [x] ~~**Completed 2026-07-25**~~ | All 12 route documents now declare `viewport-fit=cover` and load one shared responsive primitive sheet; all 11 Vite-built routes also mount `viewportRuntime.js`, with `site:check` enforcing both contracts. Global tokens expose four safe-area insets, `100svh`/`100dvh` fallbacks, measured visual-viewport height/offset/center, keyboard occlusion, and a 44 px touch target. VisualViewport resize/scroll plus layout resize/orientation events are coalesced to one rAF; the runtime sets `data-keyboard-open`, updates scroll padding, and tears down every listener. Home/Boot full-screen surfaces, Arena briefing/toast, Sectors starfield/node list/fallback, Course toast, and Serial FAB/toast consume the dynamic viewport or keyboard/safe-area offsets. Coarse-pointer/≤440 px HTML controls and navigation targets receive the 44×44 floor; the legacy Home Command button and Serial toolbar controls were brought into compliance without increasing the `!important` baseline. Production builds inline only the small responsive primitives, avoiding an extra stylesheet request while retaining a maintainable source file; shared page-turn CSS remains external because inlining it delayed route-specific CSS discovery on Horoscope. Sectors reserves the measured final header height at each mobile wrapping breakpoint, reducing its repeatable Lighthouse CLS from 0.221 to 0.019. A browser gate loads every active, redirect, prototype and 404 route at 320×720, verifies viewport/safe-area/runtime variables, asserts ≤1 px page overflow, and audits every visible non-SVG HTML control. Two unit tests cover keyboard-inset math and listener/rAF disposal. Deterministic final gates pass: 82 Vitest files / 1,138 tests, typecheck, 12 schemas, route manifest, style baseline, production build, bundle budgets and diff hygiene. The latest complete Playwright matrix remains 150 collected = 98 passed + 52 intentional project-scope skips; post-change single-worker verification passed 35 functional assertions and hit two macOS/Chromium context-teardown stalls. Completed Lighthouse 24-report and affected-route samples established the new budgets, but the final independent rerun is pending because the current host subsequently returned persistent cross-route `NO_FCP` runtime errors before assertions. Physical iPhone/Samsung safe-area, keyboard and 120 Hz behavior remains release sign-off. |

## 2. Route and branch map

### `/` — Home / deep-space captain log

**Branches:** default 3D combat; `?combatview=2d`; legacy/SC panel modes; tactical/director cameras; optional `?combat=topdown`, `?ship=odin|wedge`, nebula/tactical-line feature flags; terminal, market, holdings, and stardrive subsections.

**P0**

- Register background worker, black-hole GL, Alphard Forge, combat, radar, and hologram renderers with the shared lifecycle coordinator. A renderer must implement `mount()`, `setQuality(tier)`, `pause(reason)`, `resume()`, `resize(viewport)`, and `destroy()`.
- Replace scattered DPR caps with a pixel budget: `dpr = clamp(sqrt(pixelBudget / (cssW*cssH)), minDpr, deviceDpr)`. Suggested starting budgets, to be tuned by trace: 2.2 M pixels mobile and 3.6 M desktop per active full-screen renderer, with only one high-cost renderer at a time.
- Stop the master frame loop on `document.hidden`; clamp resumed `dt` to 32 ms so physics/camera state cannot jump after tab restoration.
- Recreate raw WebGL resources on context restoration. After two losses in a session, set `data-renderer="poster"` and show an accessible “Enable interactive scene” control.
- Fix locale persistence through P0-02. The initial `<html lang>`, home copy, nav, and 3D captions must read the same locale source.

**P1**

- Split the 3,552-line controller into feature entry points. Static hero/holdings is the critical path; `vendor-three` is fetched only when a 3D stage approaches the viewport or the user enters combat.
- Add procedural LODs for capital ships/fighters and reuse geometry/material instances. Convert transient lasers, missiles, explosions, and trail segments to bounded pools; no `new Material()` inside sustained fire.
- Replace the 78 ms barrage interval with the existing clock/main-frame scheduler.
- Keep real DOM headings, holdings, disclaimers, and links above every canvas for crawlability and no-WebGL use.

**P2**

- Use shader quality defines (`LOW/MED/HIGH`) for particle count, bloom taps, shadow resolution, volumetric steps, and chromatic aberration. Do not compile new variants during combat.
- Preserve 120 Hz camera/input responsiveness while allowing expensive visual simulation to update at 60 Hz with interpolation.

### `/arena.html` — TA, recommendations, Autopilot, digest

**Branches:** briefing acknowledged/unacknowledged; `?embed`; recommendation available/stale/error; TA pre/post tabs; ticker search; unlocked/locked/rejected admin session; quote available with daily-history fallback; three model ledgers; digest toast/drawer.

**P0**

- Model branches as a reducer/state chart rather than mutually mutating IIFEs. Render from state; effects own abort tokens. Selecting a new symbol cancels old history/quote calls and ignores late responses.
- Use `aria-activedescendant` for ticker suggestions, arrow-key navigation, Enter selection, Escape dismissal, and a visible result count. Restore focus after closing briefing/digest dialogs and trap focus while modal.
- Keep secrets in `sessionStorage`, never copy them into URLs/logging/analytics, and clear them after a 403 rejection.
- Make equity charts keyboard-readable: series toggle buttons, left/right point navigation, textual latest value and delta, and a table fallback.

**P1**

- Cache EOD candles by `{symbol,lastCompletedNYSESession,dataVersion}` and live quotes with a short TTL. Reuse in-flight requests across recommendation cards and TA selection.
- Virtualize only the 506-symbol suggestion result, not the recommendation cards. Search against normalized symbol/name tokens using a prebuilt index.
- Separate “model simulation”, “market data”, and “editorial digest” provenance. Every timestamp states timezone and freshness; stale data remains visible with an explicit badge.
- For SEO, render a static explanation of methodology and risk discipline; do not expose personalized “buy/sell” claims or make dynamic ticker states canonical.

### `/sectors.html` — AI sectors, vendor matrix, star graph

**Branches:** card/story view; interactive Canvas 2D graph; optional `?fx=starfield3d`; model/vendor detail; data available/empty/error; post-memory track.

**P0**

- Do not run Canvas 2D graph and Three.js starfield simultaneously. A route-level renderer lease grants the GPU budget to one view and pauses/disposes the other after a short back-navigation cache.
- Replace full-window mouse listeners with pointer events scoped to the active stage; pointer capture handles pan; `touch-action` is declared per surface.
- Provide a DOM node list synchronized with graph selection so keyboard/screen-reader users can inspect vendors, relationships, confidence, and source notes.
- Remove hotlinked presentation-critical imagery from the runtime dependency chain. Store optimized licensed/official assets locally with source/license metadata; show dimensioned placeholders to prevent CLS.

**P1**

- Move force simulation steps to a worker using compact typed arrays. The main thread sends graph revisions and receives positions at ≤30 Hz; rendering interpolates at display rate.
- Preserve Canvas for the dense graph and DOM for detail/cards. Use SVG only for exported/static relationship diagrams; do not rebuild the full animated graph in DOM.
- Normalize entity IDs in datasets. Relations reference IDs rather than vendor/ticker strings; validation rejects dangling IDs.
- Generate `CollectionPage` + `ItemList` structured data from the static vendor/article summary, not from decorative graph coordinates.

**Delivered 2026-07-25 — scoped slice; P1-06 stays open until workerization and controller splitting are complete**

- [x] ~~Replace the crooked horizontal story-card rail with a stable two-column editorial grid, one column on mobile, consistent media ratios, local product/launch imagery, and explicit local brand marks.~~
- [x] ~~Move the current ecosystem storyboard into `public/sectors-ecosystem.json` v3 with stable entity IDs, 19 nodes, 19 typed edges, source URLs, products, country codes, reveal thresholds, and five scroll chapters.~~
- [x] ~~Start from an empty dark field and progressively reveal frontier labs → capital/open weights → cloud/compute → memory/foundry as scroll advances; hold the complete map for inspection after the story.~~
- [x] ~~Replace abstract dots with logo plates and flag badges; provide text/brand-mark fallbacks, bilingual product detail, directional relationship lines, a parallel DOM node list, and Canvas keyboard selection.~~
- [x] ~~Remove graph zoom buttons plus wheel/pinch zoom listeners. Preserve page pinch zoom, touch vertical scrolling, tap selection, and desktop-only pan/node repositioning.~~
- [x] ~~Run physics at a fixed 60 Hz and render through the shared 120 fps target budget with adaptive DPR, hidden/offscreen pause, reduced-motion final-state rendering, deterministic mobile topology, and complete teardown.~~
- [x] ~~Correct unverified launch claims instead of publishing them: the dataset records Claude Opus 4.8 as the latest verified Opus release and explicitly states that no official Opus 5 launch was verified on the audit date.~~

### `/signal.html` — Fed signal dossier

**Branches:** four chapter anchors; hawk/dove compass; pillar filters; expandable incidents; asset watch; data/offline state; ambient audio on/off.

**P0**

- Fetch `signal-events.json` once through the shared data client and fan out validated state. The current page has multiple consumers that independently fetch the same document.
- Convert incident headers to real buttons inside articles; maintain `aria-expanded`, keyboard operation, focus visibility, and deep links such as `#incident-<id>`.
- Pause canvas/audio timers when offscreen, hidden, or reduced-motion/data preferences apply. Audio always requires user activation and exposes a persistent mute state.

**P1**

- Split the 52.61 kB generated HTML into a static editorial shell plus data-driven chapters at build time. Keep the key conclusion and source methodology in rendered HTML.
- Add `CollectionPage`/`ItemList` schema and `dateModified` from validated data. Use neutral “scenario/desk view” language consistently in EN/ZH.
- Animate only state transitions: needle moves to a changed signal, new incident highlight, expanded body. Remove ambient motion that does not convey state on constrained tiers.

### `/stats.html` — prediction archive and dashboards

**Branches:** MSI and World Cup datasets; bars, Wilson curve, reliability plot, bootstrap histogram; reasoning drawers; recompute/error states.

**P0**

- Extract duplicated MSI/WC chart code into `renderCompetitionDashboard({data,labels,ids})`. Keep statistical functions pure and add golden fixtures for both competitions.
- Add `<figure><figcaption>` structure, visible chart conclusions, an underlying sortable table, and keyboard-selectable series/points. Never encode vendor/result solely by color.
- Move the 2,000-sample bootstrap into a worker. Stream progress every 5–10%, accept a seed, and terminate/cancel on rerun or page hide.

**P1**

- Use SVG for low-mark charts and axes; switch to Canvas only above a documented point threshold (starting rule: >2,000 visible marks or continuous pan/zoom). Export uses the same scale functions.
- Centralize scales, tick formatting, tooltip positioning, and chart palette tokens. Tooltip placement clamps to `visualViewport`, not `window.innerWidth`.
- Add `Dataset` structured data describing competitions, metric definitions, temporal coverage, license/provenance, and download URL if a stable data export exists.

### `/horoscope.html` — Bazi, astrology, synastry, quizzes

**Branches:** birth input/manual location; personal chart/day reading; L1/L2/L3 astrology; ZWDS deep detail; synastry and saved relationship book; Davison/detail accordions; share `?p=`; persona/logic/EQ quizzes; reset.

**P0**

- Define a versioned `HoroscopeState` and feature selectors. Persist only explicitly approved profile/result fields; keep professional ephemeris and intermediate matrices in memory.
- Treat the share query as untrusted input: length cap, schema/version check, invalid-link recovery, and no automatic persistence until the user confirms.
- Every generated result section receives a heading, status announcement, focus target, and “Back to inputs” control. Accordions use buttons and stable IDs.
- Split/cancel compute so a second submit cannot race the first; use a worker for deep synthesis when measured main-thread work exceeds 50 ms.

**P1**

- Dynamic-import synastry, quizzes, share-card, and `astronomy-engine` only when each branch opens. Base birth form and first result remain the initial bundle.
- Replace broad template-string DOM replacement with small render functions and event delegation. Sanitize any field originating in URL or JSON before HTML insertion.
- Make chart matrices usable at 200% zoom and 320 CSS px: permit internal scrolling, sticky row/column labels, and a linear accessible reading order.
- Use `WebApplication` structured data; avoid presenting entertainment output as medical, financial, or factual personalized advice.

### `/serial.html` — bookshelf and reader

**Branches:** three books; chapter selection; normal/waterfall layouts; green/night themes; font size; bookmark/progress; auto page; optional playlist; mobile keyboard/toolbar states.

**P0**

- Introduce `readerStore` with `{version,bookId,chapterId,offset,theme,fontSize,layout,bookmarks,audioTrack}` and a storage adapter. Migrate current scattered keys once and preserve existing readers' progress.
- Use `history.pushState` or real chapter URLs on chapter changes; back/forward restores chapter and reading offset without losing toolbar state.
- Replace continuous scroll writes with an rAF-throttled sampler and idle/debounced persistence. Flush on `pagehide`, not only before unload.
- Respect safe-area bottom insets and the on-screen keyboard; the toolbar must never cover the active paragraph or audio controls.

**P1**

- Pre-render `/zh/novels/<book>/<chapter>/` pages with `Book`, `CreativeWorkSeries`, and chapter-level `Article/Chapter` metadata, next/previous links, and canonical URLs. Hydrate reader enhancements on top.
- Fetch the index first, then the selected book; prefetch only adjacent chapters on idle and low-cost network conditions. Do not preload the 438.99 kB book.
- Virtualize waterfall mode by chapter block/window, preserving find-in-page and screen-reader continuity with sentinel-based mounting.
- Retain Chinese-only creative content if intentional, but bilingualize reader chrome, errors, metadata, and navigation so the global locale promise is honest.

### `/course.html` — AI collaboration playbook

**Branches:** chapter anchors 00–06, weekly section, appendix, glossary popover, reading progress.

**P0**

- Keep all meaningful content in HTML, but generate it from structured chapter data so the 181.89 kB source is maintainable and locale parity is testable.
- Add a skip link, landmark/heading audit, keyboard-operable chapter nav, focus-visible glossary terms, and `aria-current` for the active chapter.

**P1**

- Split chapter source into `content/course/<chapter>.json|md`; a build plugin emits one complete document for SEO and optional per-chapter pages. Client JS only handles progress and glossary.
- Use `content-visibility:auto` plus accurate `contain-intrinsic-size` for offscreen chapters after verifying find-in-page and accessibility behavior.
- Generate `Course`, `CourseInstance` only if a real instance exists, `ItemList`, and breadcrumb schema. Do not claim certification, provider affiliation, or outcomes not supported by the content.

### Retired and experimental routes

#### `/games.html` and `/league.html`

- Treat as archived products, not live hidden branches. Make redirects permanent, remove build/nav/sitemap/metadata duplication, and preserve final data in Stats.
- If seasonal reuse is likely, extract a `prediction-experience` package with sport/esport adapters; do not keep two entire public pages deployed as templates.

#### `/boot.html`

- Maintain `noindex,nofollow`, no analytics requirement, and explicit “prototype” labeling.
- Put `?combatcam=tactical|director` and `?p2demo=armor|fleet` behind an on-page developer switcher so test branches are discoverable without memorized URLs.
- Give every renderer the same lifecycle/quality contract before any merge into Home. Freeze the prototype if no production decision is made by the RFC date.

#### `/api/quote` and `/api/history`

- Preserve symbol allowlists and server-side keys. Add bounded upstream timeouts, normalized error codes, `Cache-Control` appropriate to quote/history freshness, and request correlation IDs without user/session secrets.
- Rate limiting must be enforceable across instances; an in-memory limiter is only a best-effort burst guard. If abuse becomes material, adopt a managed edge/KV limiter through a separate security RFC.

#### `/404.html` and the shared navigation shell

- Generate the 404 page from the same route/locale manifest, return the actual HTTP 404 status, exclude it from sitemap/canonical indexing, and offer Home plus the three primary task routes rather than a dead-end visual.
- Keep native anchor `href`s in navigation and page-turn controls so browsing works before JS. JS may enhance transitions but must not own reachability.
- Deduplicate the two page-turn implementations (`src/lib/page-turn.js` and `src/ui/pageTurn.js`) behind one tested keyboard/pointer contract. Serial's deliberate opt-out remains a manifest capability.
- The portaled Labs menu needs a real button trigger, roving/familiar arrow-key behavior, `aria-controls`, focus return, viewport collision handling, and teardown-safe global listeners.

## 3. Algorithm, logic, and state architecture

### 3.1 Site manifest

```js
{
  id: 'arena',
  path: '/arena.html',
  status: 'active',                 // active | redirect | prototype
  build: true,
  nav: { group: null, order: 20 },
  locales: {
    en: { title, description, ogTitle, ogDescription },
    zh: { title, description, ogTitle, ogDescription }
  },
  schema: ['WebPage', 'Dataset'],
  themeColor: '#05070e',
  capabilities: ['live-data', 'svg-viz'],
  redirectTo: null
}
```

Build checks:

1. Every active route has both locale metadata records and one H1.
2. Every nav route is built and in the sitemap.
3. Redirect/prototype routes are absent from sitemap and locale generation.
4. Canonical, OG URL, JSON-LD URL, and emitted path agree.
5. Route branch query parameters are documented and excluded from canonical indexing unless explicitly promoted.

### 3.2 Page state pattern

Use a small reducer per complex page, not a global SPA store:

```js
const state = {
  status: 'idle',
  locale: 'en',
  data: null,
  selection: null,
  requestId: 0,
  error: null
};
```

- Pure reducer: `(state, event) => nextState`.
- Effect layer: fetch/worker/storage; owns `AbortController`.
- Renderer: idempotent projection from state to existing DOM.
- URL adapter: parses/serializes only stable shareable state.
- Store adapter: versioned schema, migration, quota/error handling.
- Late async result is accepted only when `requestId` matches.

### 3.3 Data pipeline

- Assign stable IDs to all entities and relationships.
- Store raw events/records; derive win rate, aggregates, and chart series in code.
- Validate at authoring, CI, and runtime boundary. Runtime failure renders last-known-good data with a stale badge.
- Publish atomically and attach `{schemaVersion,dataVersion,generatedAt,sourceUpdatedAt}`.
- Replace blanket `no-store` with:
  - immutable versioned assets: `public, max-age=31536000, immutable`;
  - daily/weekly JSON: short `max-age`, longer `stale-while-revalidate`;
  - live quote API: seconds-level edge caching where provider terms permit;
  - private/admin responses: `private, no-store`.

## 4. Data visualization architecture

### Rendering decision table

| Case | Renderer | Rule |
| --- | --- | --- |
| ≤2,000 visible marks; semantic relationships matter | SVG + DOM | Stats curves, Arena equity, small ladders |
| Dense graph/continuous pan/zoom | Canvas 2D + DOM mirror | Sectors interactive graph |
| Spatial scene/depth/shaders | WebGL/Three.js + DOM content layer | Home combat, Sectors starfield, Boot |
| Static editorial relationship | Pre-rendered SVG | Social/SEO/export fallback |

### Shared chart contract

- `model`: immutable normalized series, labels, units, provenance.
- `scales`: pure data↔pixel functions shared by render/hit-test/export.
- `view`: SVG/canvas implementation.
- `interaction`: pointer, keyboard, touch crosshair; no business logic.
- `semantic`: heading, conclusion, table, live value announcement.
- `lifecycle`: resize observer, visibility pause, destroy/abort.

Performance rules:

- Cache paths/geometry until data or size changes.
- Do not read layout after writing it in the same frame.
- Coalesce pointer events and render at most once per rAF.
- Use `ResizeObserver`; avoid full-window resize work per component.
- For Canvas, render in CSS-pixel coordinates after one DPR transform.
- For large data, downsample by viewport buckets while retaining extrema; never downsample the underlying accessible table/export.

## 5. 3D modeling, assets, shaders, and effects

### 5.1 Asset decision

- Keep procedural geometry for stylized ships, HUD meshes, repeated primitives, and assets whose dimensions are algorithmically tested.
- Use GLB only for authored hero models whose topology/UV/material complexity is no longer maintainable in code.
- One asset must not exist in both procedural and GLB form without an explicit migration owner.

### 5.2 Authored GLB pipeline

`source .blend` → naming/scale/origin validation → glTF Transform dedupe/prune/weld → Meshopt geometry compression → KTX2/BasisU textures → LOD packaging → manifest + visual regression thumbnails.

Starting budgets, adjusted only by trace:

| Budget | Desktop high | Mobile high | Low tier |
| --- | --- | --- | --- |
| Active scene triangles | ≤350k | ≤120k | ≤60k |
| Hero LOD0 | ≤120k | ≤60k | not loaded |
| LOD ratios | 100% / 40% / 10% / impostor | 50% / 20% / impostor | impostor |
| Draw calls | ≤120 | ≤70 | ≤40 |
| Hero texture edge | 4096 only when visibly justified | 2048 | 1024 |
| Initial compressed 3D payload | ≤3 MB | ≤1.5 MB | poster only |
| Estimated active GPU assets | ≤220 MB | ≤140 MB | ≤80 MB |

- Pack ORM channels; prefer 8-bit textures; use normal maps instead of micro-geometry.
- Use KTX2 capability negotiation; retain a tested PNG/JPEG fallback only for unsupported cases.
- Choose LOD by projected screen size with hysteresis, not raw camera distance.
- Precompile/warm required shader variants before interaction; never compile on first weapon hit.

### 5.3 Shaders and VFX

- Central uniforms: time, resolution, DPR, quality, reduced motion, exposure.
- Shader tier controls loop counts and samples with compile-time defines.
- Pool transient geometry and materials. Track `renderer.info.memory` and draw calls in development.
- Bloom is selective and desktop/high-tier by default; mobile uses emissive materials/cheap sprites unless the frame trace passes.
- Reduce transparent overdraw: depth-sorted bounded effects, tight quads, no full-screen blending layers without a measured need.
- A reduced-motion path freezes ambient particles/camera drift but preserves necessary state feedback.

### 5.4 Frame-rate policy

- Measure nominal refresh using median rAF intervals; never assume 60 Hz.
- At 120 Hz the total frame budget is 8.33 ms; target app main-thread work ≤4.5 ms and leave compositor/browser headroom.
- At 60 Hz the budget is 16.67 ms; target app work ≤9 ms.
- Quality drops after sustained p95 overruns, and rises only after a longer stable window to prevent oscillation.
- Simulation may run fixed 60 Hz while rendering/input interpolate at 120 Hz. Physics uses accumulated fixed steps with a maximum of two catch-up steps.
- Long-task, dropped-frame, WebGL-loss, and quality-tier changes are development telemetry and optional privacy-safe production aggregates.

## 6. UI, UX, accessibility, and bilingual copy

### 6.1 Interaction system

- Minimum target: 44×44 CSS px; 8 px separation for adjacent destructive/primary actions.
- Every custom control has hover, active, focus-visible, disabled, loading, success, and error states where applicable.
- Dialogs trap focus, label themselves, close on Escape, and restore the trigger.
- Pointer gestures always have keyboard/button alternatives. Never make swipe/drag the only route to content.
- At 200% zoom, text reflows without two-dimensional page scrolling. Complex matrices may scroll internally with labeled regions.
- Contrast gates: 4.5:1 normal text, 3:1 large text and meaningful UI graphics; test both page themes and overlays.
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, and `prefers-reduced-data` receive explicit fallbacks.

### 6.2 Copy model

```json
{
  "key": "arena.data.stale",
  "en": "Showing the last verified session · Updated {time} ET",
  "zh": "正在显示最近一次已验证交易日 · 更新于美东时间 {time}",
  "tone": "neutral",
  "maxChars": { "en": 72, "zh": 34 },
  "tokens": ["time"]
}
```

Rules:

- Translate intent and information hierarchy, not word order.
- EN uses sentence case for functional UI; all-caps is reserved for in-world labels.
- ZH uses full-width punctuation in prose, concise action labels, and explicit timezone/unit placement.
- One glossary controls technical terms: drawdown/回撤, confidence/置信度, stale/数据已过时, desk view/个人案头观点, entertainment only/仅供娱乐.
- Legal/risk meaning must be equivalent, not merely present in one locale.
- Data-generated text follows nested `{en,zh}`; legacy suffix fields are migrated at validation boundaries.
- Automated checks compare placeholder tokens, markup slots, URLs, and missing keys. Human review signs off headline rhythm, sensitive claims, and literary text.

## 7. SEO and technical discoverability

### 7.1 Static locale architecture

- Generate locale paths at build time while keeping the Vite MPA.
- Each locale document has fixed `lang`, localized title/description/H1, self-canonical, `hreflang="en"`, `hreflang="zh-CN"`, and `x-default`.
- The language switch is a normal link to the equivalent locale URL; JS may enhance it but is not required.
- Query experiments (`combatview`, `fx`, `embed`, `p2demo`) canonicalize to the base route and are not added to sitemap.
- Horoscope share links and future chapter URLs get their own policy: share payload pages remain `noindex` unless a safe server/build-rendered public document exists.

### 7.2 Route schema map

| Route | Schema.org graph |
| --- | --- |
| Home | `WebSite`, `ProfilePage`/`Person` only with verified public fields |
| Arena | `WebApplication` + methodology `Article`; `Dataset` for stable simulation records |
| Sectors | `CollectionPage`, `ItemList`, provenance-bearing `Dataset` where downloadable |
| Signal | `CollectionPage`, `ItemList`, `dateModified`; avoid false `NewsArticle` authorship/date claims |
| Stats | `Dataset`, `DataCatalog` only if multiple stable datasets are published |
| Horoscope | `WebApplication`, entertainment description |
| Serial | `Book`, `CreativeWorkSeries`, chapter pages, author identity as published |
| Course | `Course`, `ItemList`, `BreadcrumbList`; `CourseInstance` only for a real offering |

### 7.3 Discoverability gates

- CI parses emitted HTML, not source templates.
- Assert unique title/description, one canonical, valid JSON-LD, one H1, lang/hreflang parity, crawlable nav links, no broken internal links, and sitemap/manifest equality.
- Generate route-specific OG images at 1200×630 and localized alt text.
- Add `lastmod` only from a trustworthy content/data timestamp.
- Retired pages return permanent redirects; prototypes return noindex and are absent from internal nav.

## 8. Flagship mobile optimization

Official hardware anchors used for the test plan:

- iPhone 16 Pro Max: 6.9-inch OLED, 2868×1320 physical pixels, Dynamic Island, adaptive ProMotion up to 120 Hz. Apple: <https://support.apple.com/en-gb/121032>
- Galaxy S26 Ultra: 6.9-inch QHD+ 3120×1440 Dynamic AMOLED 2X, adaptive 1–120 Hz. Samsung: <https://news.samsung.com/uk/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet>
- Apple safe-area guidance: <https://developer.apple.com/design/human-interface-guidelines/layout>

Do not UA-sniff either device. Tune from capabilities and verify on real hardware/browser combinations.

### iPhone 16 Pro Max / Safari

- Standard portrait test target: approximately 440×956 CSS px at DPR 3, plus landscape and Display Zoom. Read actual `visualViewport`; do not hardcode these dimensions.
- Add `viewport-fit=cover` to every full-bleed route. Define `--safe-top/right/bottom/left: env(safe-area-inset-*)` and apply them to nav, modals, combat controls, reader toolbar, and edge gestures.
- Use `min-height:100svh` for stable initial shells and `100dvh` for active overlays. Avoid `100vh` for keyboard-sensitive forms.
- Listen to `visualViewport.resize/scroll` only while an input/dialog is active; rAF-coalesce updates. Horoscope fields, Arena unlock, and Serial controls remain visible above the keyboard.
- Keep essential tap controls below/away from the Dynamic Island safe region; full-bleed canvas may paint behind it, content may not.
- Test Safari back/forward cache: restore paused renderers, timers, and scroll state on `pageshow` with `event.persisted`.

### Samsung Galaxy S26 Ultra / Chrome and Samsung Internet

- Test FHD+/QHD+ modes, font scaling, display scaling, portrait/landscape, Chrome, and Samsung Internet. CSS viewport/DPR can differ by settings; use `visualViewport` and pixel-budget DPR.
- Respect camera cutout/rounded-corner safe insets and bottom browser/gesture UI with the same safe-area tokens.
- Support both coarse touch and S Pen hover: hover may enrich graph/tooltips, but tap/keyboard always performs selection. Use Pointer Events and pressure only as optional enhancement.
- Avoid edge-only drag handles that conflict with Android back gestures; inset graph/reader drag affordances at least 16 CSS px from side edges.
- Recalculate canvas backing stores after resolution/display-mode changes without destroying logical state.

### 120 Hz acceptance

On both devices, test three tiers:

1. **Content scroll:** p95 frame interval ≤10 ms in 120 Hz mode, no long task >100 ms during steady scroll.
2. **Interactive visualization:** stable 60 fps minimum; 120 fps input/camera response when quality permits.
3. **Heavy 3D:** 60 fps target, 45 fps degradation threshold, automatic quality drop below threshold, no thermal runaway during a 5-minute session.

Also verify touch-to-feedback starts in the next frame, no accidental page zoom on custom surfaces, browser pinch zoom remains available for page content, and battery/thermal tests do not force repeated WebGL context loss.

## 9. Execution plan and acceptance gates

### Wave 0 — Baseline and safety net (2–4 days)

- Record mobile/desktop Lighthouse, bundle map, 30-second performance traces, WebGL renderer counts, draw calls, active triangles, and memory proxies per route/branch.
- Add Playwright desktop + iPhone 16 Pro Max-like + Galaxy S26 Ultra-like profiles; use real-device runs for final sign-off.
- Add axe, keyboard smoke, console error, and emitted-metadata checks.
- **Exit:** baselines stored; tests cover every active route and critical branch; no proposal item relies on an unmeasured “faster”.

### Wave 1 — Cross-cutting P0 foundation (1–2 weeks)

- Ship site manifest, locale-key migration, fetch client, responsive safe-area tokens, renderer coordinator, context recovery, and retired-route cleanup.
- **Exit:** one route source drives build/nav/sitemap/metadata; locale survives a full nav cycle; background tabs reach zero active animation loops; all dialogs/graphs pass basic keyboard and axe gates.

### Wave 2 — Heavy-route restructuring (2–4 weeks)

- Home split/lifecycle; Arena state pipeline; Sectors worker/renderer lease; Stats module/worker; Horoscope feature chunks; Serial reader store/history.
- **Exit:** no route regresses CWV budgets by >5%; no stale async render races in forced-network tests; workers terminate; route teardown returns renderer/listener counts to baseline.

### Wave 3 — Locale SEO and content pipeline (2–3 weeks)

- Move content into bilingual schemas; generate EN/ZH documents, localized metadata/Schema.org, chapter URLs, and route-specific OG assets.
- **Exit:** emitted HTML passes canonical/hreflang/schema/link checks; JS-disabled pages expose core content and navigation; locale parity lint is green.

### Wave 4 — 3D asset/LOD and 120 Hz refinement (1–3 weeks)

- Add procedural LODs, pooling, shader tiers, optional GLB toolchain, and real-device quality tuning.
- **Exit:** triangle/draw-call/payload/GPU-memory budgets pass; 5-minute iPhone/Samsung sessions meet the 60 fps heavy-scene target or visibly select a documented lower tier without crashes.

### Wave 5 — P2 polish (ongoing, budgeted)

- Refine copy, exports, social assets, motion tokens, and prototype decision.
- **Exit:** P0/P1 gates remain green; each polish item has a user task or measurable communication benefit.

## 10. Definition of done

An optimization item is complete only when:

1. It names the affected route and branch.
2. Pure logic has unit coverage; browser behavior has an integration check.
3. EN and ZH states are both reviewed, including error/empty/stale copy.
4. Keyboard, screen reader semantics, 200% zoom, reduced motion, and touch are verified in proportion to the feature.
5. Bundle/CWV/frame/memory budgets are measured before and after.
6. Async work aborts and renderers/workers/listeners/timers dispose on navigation or hide.
7. Emitted HTML metadata and structured data validate.
8. iPhone 16 Pro Max Safari and Galaxy S26 Ultra Chrome/Samsung Internet receive real-device sign-off for mobile/3D changes.
9. `design.md` narrative identity and `tech.md` architecture decisions are updated only when the implementation creates a new durable rule.

## 11. Explicit non-goals

- No React/Next/Astro/Tailwind migration solely for fashion or component syntax.
- No simultaneous GSAP + Framer + bespoke animation runtimes. The existing scheduler remains default; add a dependency only against a measured, cross-route need.
- No converting SEO-relevant text into canvas/WebGL.
- No WebGPU production switch before WebGL baselines, fallbacks, and real-device evidence exist.
- No high-detail GLB asset merely to replace a cheaper, testable procedural model.
- No “120 fps” claim based on a desktop simulator; flagship acceptance is on real devices.

---

# Part 3 — Fable 5 Recommended P0 · Sectors → “Red vs Blue” US-China AI Competition Storyboard

> Authored 2026-07-25 by Claude Fable 5 at the operator's request. This part is additive: Parts 1–2 delivery records stand, and every rule already ratified there (renderer lease, RenderBudgetCoordinator registration, `fetchJson` resource registry, no graph zoom, bilingual copy schema, provenance discipline, P0-07 accessibility contract) is **binding** on this work. Recommended priority: **P0** for RB-P0-\*, P1/P2 as labeled.
>
> Theme: sectors.html's center of gravity moves from "AI-infrastructure watchlist with a US-China aside" to a full **US-China AI Competition storyboard** — rivalry, co-existence, supply-chain dependency, and capital-market flow — told in the modular scroll-story language of anthropic.com, restyled for this site's ambient dark identity.

## RB-0. Scope, fit, and what already exists

sectors.html (977 lines) already ships the load-bearing pieces: a scroll-driven Canvas ecosystem storyboard (`initSectorsGraph`, `sectors-ecosystem.json` v3 — 19 nodes / 19 typed edges / 5 chapters), a two-column US/CN vendor news grid, the `AfflatusBrand` local asset registry, the `buildDetail()` content/shell separation, the `mwMatrix` data fallback, and post-memory thesis cards. This part **extends** those systems; it does not rebuild them.

| ID | Priority | Effort | Scope | Item |
| --- | --- | --- | --- | --- |
| RB-P0-01 | P0 ✅ | S | Design system | Ship the Red-vs-Blue token layer (§RB-1) into `styles/sectors.css` behind `.sectors-page` — no global token pollution. |
| RB-P0-02 | P0 ✅ | M | Data | Author `public/sectors-competition.json` v1 (§RB-3 schema): models, radar axes, benchmark table, efficiency, pricing, geo scores, equity nodes — every numeric field carries `{value, src, tier}` provenance. Add schema validator + `fetchJson` registry key `sectors-competition`. |
| RB-P0-03 | P0 ✅ | M | Storyboard | Re-chapter the existing scroll story to the five-act competition arc (§RB-2.2) and add bloc polarity (US left/blue field, CN right/red field) to node layout + dual-polar edge rendering. |
| RB-P0-04 | P0 ✅ | M | Radar | Build the multidimensional evaluation radar + sortable benchmark table (§RB-4) as SVG+DOM per the Part 1 §4 rendering decision table (≤2,000 marks ⇒ SVG). Full keyboard/table parity per P0-07. |
| RB-P0-05 | P0 ✅ | M | Equities | Ship the dual Top-10 equity boards (US / CN A-share+HKEX, §RB-5) reusing `newsCard()`; every pick maps to model-vendor nodes via stable IDs. |
| RB-P0-06 | P0 ✅ | S | Macro | Ship the geopolitical scoreboard (§RB-6): four 1–100 axes, methodology note, dated sources, EN/ZH. |
| RB-P1-01 | P1 | M | Interaction | Pricing/efficiency scatter (cost vs intelligence, TTFT vs TPOT) with crosshair + table fallback. |
| RB-P1-02 | P1 | S | Storyboard | Supply-chain dependency ribbons (HBM→GPU→cloud→model; EUV/foundry chokepoints) as typed edges in the existing graph, not a second renderer. |
| RB-P0-07 | P0 ✅ | S | Data correction | **Opus 5 verified 2026-07-24** ([primary source](https://www.anthropic.com/news/claude-opus-5)): update `sectors-ecosystem.json` anthropic node (products += "Claude Opus 5"; rewrite `summary_en/zh` — drop the "no official Opus 5 launch verified" line, it is now false), update `sectors-data.json` modelWatch anthropic `current_line`, and rewrite the storyboard `frontier` chapter copy in sectors.html that repeats the old correction ("Anthropic's latest verified Opus remains 4.8"). Part 2's correction discipline worked exactly as designed: the claim stayed out until a primary source existed, and the same discipline now requires publishing the launch. |
| RB-P2-01 | P2 | S | Polish | Glow-node pulse on chapter reveal, meridian shimmer, OG image refresh for the new narrative. |

**Non-goals (inherited + new):** no second simultaneous WebGL surface (renderer lease stands); no zoom reinstatement; no CDN chart library — the site is a Vite MPA with self-hosted modules; no claim of model capability, launch, or score that lacks a citable primary/secondary source — unverified items ship as `tier:"estimate"` or `tier:"pending"` and render with the existing provenance badge, never as fact.

## RB-1. Design system — Anthropic-inspired, ambient dark, Red vs Blue

### RB-1.1 Aesthetic translation

Anthropic.com's grammar → this site's dark identity:

| anthropic.com trait | Sectors translation |
| --- | --- |
| Warm ivory field, high whitespace | Near-black field `#07080C` with warm-tinted panels; whitespace ratios kept (≥96px section gaps desktop, ≥56px mobile) |
| Serif display + humanist grotesque body | Display serif stack for chapter heads; existing grotesque for body/UI (no webfont purchase — stack below) |
| Modular full-width story sections | Retain `graphStorySteps` sticky-canvas pattern; each act is one full-viewport module |
| Restrained accent color | Two accents only: bloc-blue and bloc-red; everything else neutral |
| Fluid, physics-light canvas moments | Existing 60 Hz force model + scroll reveal; add polarity field, nothing heavier |

### RB-1.2 Token layer (production CSS — scope: `.sectors-page`)

```css
.sectors-page {
  /* field */
  --rb-bg: #07080C;
  --rb-panel: #0D0F15;
  --rb-panel-edge: #1A1D26;
  --rb-ink: #EDEAE3;          /* warm ivory ink on dark — the Anthropic nod */
  --rb-ink-dim: #9A97A0;
  /* blocs */
  --rb-blue: #2F6BFF;         /* US ecosystem */
  --rb-blue-soft: #62A8FF;
  --rb-blue-glow: 0 0 18px rgba(47,107,255,.45);
  --rb-red: #E5484D;          /* CN ecosystem */
  --rb-red-soft: #FF7A80;
  --rb-red-glow: 0 0 18px rgba(229,72,77,.45);
  --rb-meridian: linear-gradient(180deg, var(--rb-blue) 0%, transparent 45%,
                 transparent 55%, var(--rb-red) 100%);
  /* neutral edge/link classes reuse Part 2 legend colors where types overlap */
  --rb-neutral-edge: #7EF0DC;
  /* type */
  --rb-font-display: "Iowan Old Style", "Palatino Linotype", Palatino,
                     "Songti SC", "Noto Serif SC", serif;
  --rb-font-body: inherit;    /* keep the page's existing grotesque */
  --rb-h-display: clamp(2rem, 5.5vw, 3.6rem);
  --rb-lh-display: 1.08;
  /* rhythm */
  --rb-gap-section: clamp(56px, 8vw, 112px);
  --rb-radius: 14px;
}
```

Rules: bloc color encodes **country of ecosystem only** — never sentiment or recommendation. Every bloc-colored element also carries a text/flag label (P0-07: no color-only meaning). Contrast: `--rb-ink` on `--rb-bg` = 15.4:1; bloc colors used on dark pass 3:1 for large text/graphics; body text never sits directly on a glow. Glows are `box-shadow`/`filter` on composited layers only, disabled under `prefers-reduced-motion` and on the low quality tier from the RenderBudgetCoordinator.

### RB-1.3 Dual-polar vector lines

Cross-bloc edges (e.g. NVIDIA→Chinese cloud constraint, TSMC→both blocs) render as a two-stop gradient stroke blue→red along the edge direction; same-bloc edges use the bloc soft color at 55% alpha. Canvas implementation: per-edge `createLinearGradient(x1,y1,x2,y2)` cached per layout revision (Part 1 §4 performance rules — no per-frame gradient allocation).

## RB-2. Layout and storyboard architecture

### RB-2.1 Page section order (replaces current section order for the mid-page; hero/ticker/macro/stock rails above stay)

```html
<!-- S3 · replaces the "US–China AI watch" band -->
<section id="rbStory" class="graphStory rbStory" aria-label="US-China AI competition storyboard">
  <div class="graphSticky"><div class="graphWrap">
    <canvas id="mwGraph" role="group" tabindex="0"
            aria-describedby="mwGraphHint mwGraphSummary"></canvas>
    <div class="rbMeridian" aria-hidden="true"></div>   <!-- vertical dual-polar divide -->
    <div class="graphLegend"><!-- + bloc legend: ■ US · ■ CN --></div>
  </div></div>
  <div class="graphStorySteps"><!-- five acts, §RB-2.2 --></div>
  <div class="graphAfter"><!-- summary, DOM node list, take — unchanged contract --></div>
</section>

<!-- S4 · NEW: evaluation radar + benchmark table -->
<section id="rbRadar" class="rbRadar" aria-label="Frontier model evaluation radar">
  <header class="rbSectionHead">…</header>
  <div class="rbRadarLayout">
    <figure class="rbRadarFig">
      <svg id="rbRadarSvg" viewBox="0 0 640 640" role="img"></svg>
      <figcaption id="rbRadarCaption" aria-live="polite"></figcaption>
    </figure>
    <div class="rbRadarPicker" role="group" aria-label="Compare models"><!-- model toggle buttons --></div>
  </div>
  <details class="mwMatrix" open><summary>…full benchmark table…</summary>
    <div id="rbBenchTable"></div>   <!-- sortable semantic <table>, the SSOT view -->
  </details>
</section>

<!-- S5 · NEW: efficiency & price scatter (RB-P1-01) -->
<section id="rbEcon" class="rbEcon" aria-label="Cost and speed economics">…</section>

<!-- S6 · replaces newsGrid columns header: dual Top-10 equity boards -->
<section id="rbEquities" class="rbEquities" aria-label="US and China AI equity boards">
  <div class="mwColWrap">
    <section class="mwCol rbColUS"><h3>US Top 10 · 蓝方</h3><div class="newsGrid"></div></section>
    <section class="mwCol rbColCN"><h3>China Top 10 · 红方</h3><div class="newsGrid"></div></section>
  </div>
</section>

<!-- S7 · NEW: geopolitical scoreboard -->
<section id="rbScore" class="rbScore" aria-label="US-China AI ecosystem scoreboard">…</section>
```

### RB-2.2 Five-act scroll arc (rewrites `data-graph-step` chapters; canvas reveal thresholds move to the competition dataset)

1. **`divide`** — empty dark field; the meridian draws in; US nodes settle left/blue, CN right/red. Copy: two ecosystems, one supply chain.
2. **`frontier`** — flagship model nodes ignite (§RB-3 roster). The 2.7-point Arena gap is the chapter stat.
3. **`chokepoints`** — supply edges draw across the meridian: EUV→foundry→HBM→accelerator→cloud. Export-control edges render as interrupted (dashed) dual-polar lines.
4. **`capital`** — equity nodes attach to their vendors; market badges (NASDAQ/NYSE · SSE/SZSE STAR · HKEX) appear.
5. **`system`** — full map holds for inspection; scoreboard totals fade in; DOM node list + full matrix below remain the complete non-visual dataset.

Scroll mechanics, keyboard Canvas control, DOM mirror, reveal thresholds, reduced-motion final-state rendering: all inherited unchanged from the delivered Part 2 slice.

### RB-2.3 JS module plan

| Module | Role |
| --- | --- |
| `src/lib/sectorsCompetition.js` | Pure: parse/validate competition data, derive radar geometry, scoreboard math, sort orders. Vitest-covered. |
| `src/lib/sectorsGraphView.js` | Extended: bloc polarity forces (x-bias by `bloc`), meridian, dual-polar edge paint. Same lease/coordinator registration. |
| `src/lib/rbRadarView.js` | SVG radar render + picker + caption announcements. No canvas. |
| `src/pages/sectors*` inline IIFEs | Wire-up only, same window-bridge conventions as today. |

Polarity force (pure, testable): `fx += (bloc === 'US' ? -1 : bloc === 'CN' ? 1 : 0) * k * (targetX - x)` where `targetX = center ± fieldWidth*0.28`; neutral (supply-chain multinationals: TSMC, ASML, SK hynix, Samsung) settle on the meridian — that placement **is** the co-existence argument.

## RB-3. Data contract — `public/sectors-competition.json` v1

One document, atomic publish, validated at authoring/CI/runtime (Part 1 §3.3). Every numeric leaf is `{ "value", "src", "asOf", "tier" }` with `tier ∈ verified | reported | estimate | pending`. The provenance badge and matrix render the tier; the radar renders `pending` axes as gaps, never zeros.

### RB-3.1 Model record schema + verified July 2026 roster

```json
{
  "schemaVersion": "competition/v1",
  "updated": "2026-07-25",
  "models": [
    {
      "id": "claude-fable-5", "vendor": "anthropic", "bloc": "US",
      "name": "Claude Fable 5", "route": "closed",
      "released": "2026-07-01", "params_b": null, "context_k": null,
      "radar": {
        "intelligence": { "value": 60,  "unit": "AA Intelligence Index v4.1", "tier": "verified" },
        "coding_agentic": { "value": 80.3, "unit": "SWE-Bench Pro %", "tier": "verified" },
        "reliability": { "value": null, "unit": "hallucination-control composite", "tier": "pending" },
        "speed": { "value": null, "unit": "TTFT/TPOT composite", "tier": "pending" },
        "cost_efficiency": { "value": null, "unit": "II per $ blended", "tier": "derived" },
        "openness": { "value": 0, "unit": "open-weight = 100", "tier": "verified" }
      },
      "pricing": { "in_per_m": 10.00, "out_per_m": 50.00, "currency": "USD", "tier": "verified" },
      "notes_en": "Suspended June 2026; back online since July 1. Highest SWE-Bench Pro of any usable model.",
      "notes_zh": "2026年6月曾暂停服务，7月1日恢复。可用模型中 SWE-Bench Pro 最高。"
    }
  ]
}
```

Roster to author (all fields per the record above; the figures below are the research-verified seeds, sources in §RB-8):

| id | bloc | Route | Key verified seeds (2026-07) |
| --- | --- | --- | --- |
| `claude-fable-5` | US | closed | II v4.1 **60**; SWE-Bench Pro **80.3%**; $10/$50 per 1M in/out; resumed Jul 1. No longer index rank 1 since Opus 5's Jul 24 launch |
| `claude-opus-5` | US | closed | **Launched 2026-07-24** (primary source: [anthropic.com/news/claude-opus-5](https://www.anthropic.com/news/claude-opus-5)). $5/$25 (same as 4.8); Fast mode 2.5× speed at 2× price; adaptive effort settings. AA Intelligence Index **61** at max effort (**new rank 1**, above Fable 5 60 / GPT-5.6 Sol 59; 60 xhigh / 59 high / 56 medium); AA Agentic Index **55.3** (rank 1). Vendor-claimed SOTA: Frontier-Bench v0.1, GDPval-AA, ARC-AGI 3 (≈3× next best), OSWorld 2.0, Zapier AutomationBench — `tier:"reported"` until third-party runs land; CursorBench within 0.5% of Fable 5 peak at half cost/task. Behind Mythos 5 on cyber; most-aligned on Anthropic's behavioral audit (2.3 misaligned score) |
| `claude-opus-4-8` | US | closed | II **56**; $5/$25. Superseded as latest Opus on 2026-07-24; retained in dataset as the safety-classifier fallback model for Opus 5/Fable 5 |
| `gpt-5-6-sol` | US | closed | II **59**; $5/$30; STEM flagship (FrontierMath Tier 4 39.6% verified on 5.5 Pro); classic MMLU/GPQA not published at launch ⇒ those cells `pending` |
| `gemini-3-5-flash` | US | closed | Launched May 20; $1.50/$9; consumer default. `gemini-3-5-pro`: partner testing only ⇒ whole record `tier:"reported"`, no radar |
| `gemini-3-6-flash` | US | closed | Launched Jul 21; $1.50/$7.50; II **50**; DeepSWE 49%, MLE-Bench 63.9%, OSWorld-V 83.0%; −17% output tokens vs 3.5 |
| `grok-4-5` | US | closed | II **54**; agentic/coding evals only at launch ⇒ academic cells `pending` |
| `muse-spark-1-1` | US | closed | Meta planning/action agent (already in ecosystem v3 with source); benchmarks `pending` |
| `qwen-3-7-max` | CN | open | HMMT Feb-2026 **97.1** (table-leading); Apex reasoning **44.5**; leads SWE-Pro/Terminal-Bench among CN models |
| `deepseek-v4-pro` | CN | open | Apex **38.3**; $0.43/$0.87 (base V4: $0.14/$0.28 — cheapest capable model); dual thinking modes |
| `kimi-k3` | CN | open | II **57** (top CN on the index); 2.8T params / 1M context (per ecosystem v3 sources); $3/$15 |
| `minimax-m3` | CN | open | SWE-Bench Pro **59.0%**, Terminal-Bench 2.1 **66.0%** (published at launch); HKEX-listed parent |

### RB-3.2 Benchmark table columns (the `bench` block, all provenance-wrapped)

- **Universal/academic:** MMLU-Pro; **SuperCLUE** (Chinese-native composite — populate from superclueai.com's latest monthly report at authoring time; ships `pending` until transcribed with report date); GPQA Diamond; ARC-AGI-2.
- **Professional:** SWE-Bench Pro / HumanEval-class coding; hallucination-control rate (use a named public eval, e.g. vendor-neutral factuality suites; `pending` where unpublished); precise instruction following (IFEval-class); agentic planning (Terminal-Bench / OSWorld-Verified).
- **Linguistic baseline (perplexity, accuracy, ROUGE, BLEU):** honest handling — frontier closed labs stopped publishing these; the table keeps the columns for open-weight models where third-party evals exist and renders `n/a — not published` otherwise. The plan explicitly forbids inventing values to fill the grid.
- **Operational:** TTFT (s, p50) and TPOT (tok/s) **measured per provider, not per model** — record `{provider, value}` pairs (first-party API vs Groq/Cerebras-class hosts, where 100–300+ tok/s and 0.16–0.18 s TTFT are verified for open models). Param scale/VRAM only for open weights.
- **Economic:** `$ / 1M in`, `$ / 1M out`, output:input price ratio (a real spread signal: Fable 5 ratio 5.0 vs DeepSeek V4 2.0).

### RB-3.3 Equity node schema

```json
{
  "equities": [
    {
      "id": "eq-nvda", "ticker": "NVDA", "exchange": "NASDAQ", "market": "US",
      "bloc": "US", "layer": "compute",
      "links": [ { "to": "openai", "type": "supply" }, { "to": "anthropic", "type": "supply" } ],
      "conviction": { "value": 24, "tier": "estimate" },
      "thesis_en": "…", "thesis_zh": "…",
      "kpis": [ { "label_en": "Q1 FY27 revenue", "value": "$81.6B (+85% YoY)", "src": "…", "tier": "verified" } ],
      "risk_en": "…", "risk_zh": "…", "asOf": "2026-07-25"
    }
  ]
}
```

`market ∈ US | A | HK`; `layer ∈ compute | silicon | foundry | memory | equipment | cloud | model | application`; `links[].to` must resolve to a model-vendor or ecosystem node ID — CI rejects dangling IDs (Part 1 §3.3). Conviction stays `estimate` by definition: it is the operator's desk weight, not data.

## RB-4. Evaluation radar — spec

Six axes (order fixed clockwise): Intelligence · Coding/Agentic · Reliability · Speed · Cost-efficiency · Openness. Normalization: each axis maps its native unit to 0–100 against the *current roster's* min/max, recomputed at data build — the JSON stores native values, never pre-normalized ones. Radar renders ≤4 models simultaneously (legibility rule); picker enforces it and announces changes through `#rbRadarCaption`.

Accessibility parity (P0-07): the SVG carries a name listing every plotted model+axis value; the sortable `<table>` under it is the complete dataset including tier badges and per-provider speed rows; axis sort + bloc filter are DOM buttons; color never encodes alone (US solid stroke / CN dashed stroke in addition to hue for color-blind users).

## RB-5. Capital markets — dual Top-10 boards

Curated picks (verify prices/KPIs at authoring; theses below are the research-backed starting set):

**US board (blue):** NVDA (compute; Q1 FY27 rev $81.6B +85%), AVGO (custom XPU + networking; OpenAI/Anthropic/Google/Meta design wins), MU (HBM; top 1-yr AI performer ≈ +657%), TSM* (foundry/CoWoS), ASML* (EUV monopoly), SKHY* (HBM leader, Jul 10 Nasdaq ADR), MSFT (cloud+OpenAI), GOOGL (Gemini+TPU full stack), META (Muse Spark + open-weight distribution), AMZN (AWS + Anthropic infra). *Meridian names — US-listed but supply both blocs' constraints narrative; the board badges them as such.

**China board (red):** Cambricon 688256.SS (AI accelerators; Q1 rev +160%, 500k-unit 2026 target), SMIC 0981.HK/688981.SS (foundry self-sufficiency; top Korean-flow HK asset H1), Alibaba 9988.HK (Qwen + cloud, Moonshot stake), Tencent 0700.HK (compute buyer; reported CXMT supply agreement), Baidu 9888.HK (Ernie + robotaxi), iFlytek 002230.SZ (speech/education on Ascend), MiniMax HKEX (Jan 2026 listing; M3), Moonshot-exposure vehicle (private — exposure via Alibaba stake; board carries an explicit "no direct listing" note), CXMT (STAR Market — verify listing status vs the milestone already recorded in ecosystem v3 before publishing a ticker), Hygon/Huawei-chain proxy 688041.SS (domestic x86/DCU — mark `reported`).

Board card = existing `newsCard()` with a `kpis` row and bloc tag; every ticker joins the graph as an equity node (§RB-3.3). Disclaimer band inherits "desk view only · no tips" and adds an A-share/HKEX access note (QDII/Connect eligibility differs — factual note, no advice).

## RB-6. Macro geopolitical scoreboard

Four axes, 1–100, each with published methodology line and dated sources; composite is a stated weighted mean (Compute .35 / Algorithms .30 / Capital .20 / Data .15) — weights are editorial and labeled as such.

| Axis | US | CN | Data backing (2026 sources, §RB-8) |
| --- | --- | --- | --- |
| Compute | 92 | 48 | US+partner advanced-die capacity ≈ 35–38× China's (quality-adj.); Blackwell Ultra 15 PF FP4 vs Ascend 950PR 1.56 PF |
| Algorithmic innovation | 88 | 84 | Arena gap top-US vs top-CN ≈ 2.7 pts (Mar 2026, Stanford AI Index) vs >30 pts in 2023; Kimi K3 II 57 within 3 of Fable 5 |
| Capital | 90 | 60 | Private AI investment $285.9B vs $12.4B (≈23×); offset: ≈$184B cumulative Chinese state-guided funds |
| Data ecosystem | 76 | 82 | CN leads research volume/patent output + industrial deployment scale; US leads high-quality English corpus/eval infrastructure — axis marked `estimate` (no single composite source exists) |

Rendering: two mirrored horizontal bar pairs per axis on the meridian, numbers always printed, EN/ZH methodology footnote, `tier` badge per axis. Outlook paragraph (EN/ZH) states the report's own framing: capability converging, compute structurally divergent — and must carry both blocs' counter-arguments per the site's even-handed voice.

## RB-7. Execution and acceptance gates

**Wave RB-1 (data + tokens, 2–3 days):** RB-P0-01/02. *Exit:* schema validates in CI; every leaf has tier+src; `pending` count reported by the validator; no visual change shipped yet.
**Wave RB-2 (storyboard re-chapter, 3–5 days):** RB-P0-03. *Exit:* five acts pass the existing Playwright canvas/keyboard/DOM-mirror contracts; renderer lease + coordinator registration unchanged; reduced-motion final state renders all five acts' end-state.
**Wave RB-3 (radar + boards + scoreboard, 4–6 days):** RB-P0-04/05/06. *Exit:* axe clean; table↔radar↔graph selection stays in sync; sort/filter keyboard-complete; Sectors route stays within its Lighthouse regression budgets (FCP/SI/CLS/script-bytes hard gates per P0-05) and CLS ≤0.02 held.
**Wave RB-4 (P1/P2):** scatter, dependency ribbons, polish — only after RB-P0 gates stay green one full weekly data cycle.

**Definition of done additions:** every rendered number traceable to a JSON leaf with source+date; EN/ZH parity lint passes on all new copy; no bloc color without text label; weekly data refresh runbook updated to include SuperCLUE/leaderboard transcription steps with report-date capture.

## RB-7b. Delivered 2026-07-25 — RB-P0-01 … RB-P0-07, with the deviations named

Shipped files: `public/sectors-competition.json` (new, 51.0 kB raw / 14.7 kB gzip, lazy-fetched below the fold), `src/lib/validateSectorsCompetition.js` (new), `src/lib/sectorsCompetition.js` (new, pure), `src/lib/sectorsCompetitionView.js` (new, DOM/SVG only), `src/lib/forceGraph.js`, `src/lib/sectorsGraphView.js`, `src/lib/fetchJson.js`, `scripts/validate-data.mjs`, `public/sectors-ecosystem.json`, `public/sectors-data.json`, `public/styles/sectors.css`, `sectors.html`, plus `tests/sectorsCompetition.test.js`, `tests/sectorsCompetitionView.test.js` and six new cases in `tests/forceGraph.test.js`.

Gates green: **84 Vitest files / 1,193 tests** (up from 82 / 1,138), `tsc --noEmit`, **13** data schemas (`sectors-competition.json` now among them), `site:check` (12 routes / 8 discoverable), production build, bundle budgets (all entries inside budget; `sectors` chunk 39.78 kB raw / 16.41 kB gzip), and the `!important` baseline unchanged at 2,960 + 2. `sectors.html` grows 59.93 → 72.8 kB raw (22.84 kB gzip), all of it below-the-fold bilingual copy.

**Deviations from the plan as written above — each one is a decision, not an omission:**

1. **The radar ships 4 axes, not 6.** Intelligence, Coding/agentic, Cost-efficiency and Openness have real values for part of the roster. "Reliability" and "Speed" do not: no vendor-neutral hallucination-control eval covers this roster, and TTFT/throughput is a property of the serving provider rather than the model. Shipping them as radar spokes that are empty for every model would have been worse than honest omission, so they are table columns carrying `status: "not_published"` / `"provider_dependent"` with a printed reason. §RB-4's six-axis list is superseded by this.
2. **Act order kept as `divide → frontier → capital → chokepoints → system`**, not the plan's `divide → frontier → chokepoints → capital → system`. The existing dataset already ordered capital before compute and every node's reveal threshold is tuned to it; reordering would have rewritten 19 thresholds to no narrative gain.
3. **Position encodes bloc on desktop only.** Mobile keeps the hand-placed row grid, because bloc columns plus 56 px plates do not fit a phone stage. On mobile the bloc is carried by the plate ring colour and the existing flag badge. Colour is never the sole channel on either breakpoint — every node keeps its country badge, table rows keep a US/CN text pill, and China-bloc radar series are dashed as well as red.
4. **The meridian is drawn on canvas, not as a CSS overlay.** A fixed CSS line desyncs from the node columns the instant a desktop user pans. The `.rbMeridian` element in §RB-2.1's markup sketch was therefore not built.
5. **Cross-bloc gradients are allocated per frame, not cached per layout revision.** The shipped dataset has 3 cross-bloc edges out of 19, so this is at most 3 `createLinearGradient` calls per frame; a cached gradient would point the wrong way as soon as a node breathes or the camera moves. §RB-1.3's caching instruction was wrong and is retracted.
6. **Tokens live in the existing `:root` block of `public/styles/sectors.css`**, not a new `.sectors-page` block. That stylesheet is loaded by exactly one document, so `:root` is already page-scoped, and the file's existing convention wins over the plan's.
7. **One view module, not two.** `sectorsCompetitionView.js` renders radar, table, boards and scoreboard; a separate `rbRadarView.js` would have duplicated the same tier-badge and bilingual helpers three times.
8. **Force settings retuned and measured, not guessed.** Bloc anchors with the old constants blew the composition out to a 10.3-unit span (canvas fit `scale` 48). The shipped `{repulsion 0.05, springLength 0.42, poleStrength 0.1, minDist 0.12}` settles at 7.96 × 6.21 (`scale` 63) and puts the closest pair of plates **73 CSS px** apart versus the pre-change baseline of 68 px. A unit test asserts the ≥68 px floor against the real dataset so a future retune cannot silently regress it.

**Not done, and deliberately so:** RB-P1-01 (cost/speed scatter), RB-P1-02 (dependency ribbons) and RB-P2-01 (glow polish) remain open per the wave plan. `newsCard()` was **not** reused for the equity boards as §RB-P0-05 proposed — a ranked board needs rank, exchange, layer, desk weight, KPI chips and a risk line, which is a different component from a media card; the boards are their own `.rbRow` markup instead.

**Still owed before this can be called complete:** no browser ran this code. The Playwright matrix, axe pass, Lighthouse route budgets and real-device iPhone/Samsung sign-off required by Part 1 §10 have not executed — this sandbox has no browsers installed. Treat the current state as unit-verified and visually unverified until `npm run test:e2e` and `npm run test:lighthouse` pass locally or in CI.

## RB-8. Source register (verified 2026-07-25)

Opus 5 launch (added 2026-07-25): [Anthropic — Introducing Claude Opus 5](https://www.anthropic.com/news/claude-opus-5) (primary; Jul 24 launch, $5/$25, Fast mode, safeguards/fallback routing) · [Artificial Analysis — Claude Opus 5 (max)](https://artificialanalysis.ai/models/claude-opus-5) (independent II 61 / Agentic 55.3, per-effort scores) · [System Card](https://www.anthropic.com/claude-opus-5-system-card). Model rankings/benchmarks: [buildfastwithai July 2026 rankings](https://www.buildfastwithai.com/blogs/best-ai-models-july-2026-ranked) · [divkix model comparison](https://divkix.me/blog/ai-models-compared-2026/) · [LM Council benchmarks](https://lmcouncil.ai/benchmarks) · [apidog M3 vs V4-Pro vs Qwen3.7](https://apidog.com/blog/minimax-m3-vs-deepseek-v4-vs-qwen-3-7/) · [DataCamp Qwen3.7-Max](https://www.datacamp.com/blog/qwen3-7-max) · [orcarouter Kimi K3 vs DeepSeek V4](https://www.orcarouter.ai/blog/kimi-k3-vs-deepseek-v4) · [aimadetools Qwen 3.7 vs MiniMax M3](https://www.aimadetools.com/blog/qwen-3-7-vs-minimax-m3/). Pricing: [CloudZero](https://www.cloudzero.com/blog/llm-api-pricing-comparison/) · [TLDL pricing table](https://www.tldl.io/resources/llm-api-pricing) · [BenchLM pricing](https://benchlm.ai/llm-pricing). Gemini: [kie.ai Gemini 3.6 Flash](https://kie.ai/blog/what-is-gemini-3-6-flash) · [TechTimes 3.6 Flash](https://www.techtimes.com/articles/321268/20260722/gemini-36-flash-cuts-token-costs-scores-higher-every-benchmark.htm) · [codersera Gemini 3.5 guide](https://codersera.com/blog/gemini-3-5-complete-guide-2026/). Speed: [inworld TTFT/throughput](https://inworld.ai/resources/fastest-llm-inference-api) · [digitalapplied latency benchmarks](https://www.digitalapplied.com/blog/ai-model-latency-benchmarks-2026-ttft-throughput). Macro: [Stanford AI Index via digitimes](https://www.digitimes.com/news/a20260415PD226/2026-competition-performance-development-data.html) · [chinabizinsider AI Index 2026](https://chinabizinsider.com/stanfords-2026-ai-index-says-chinas-top-models-are-closing-the-gap-with-the-us/) · [SolidAITech US-China 2026](https://www.solidaitech.com/2026/07/us-china-ai-race-capability-gap.html). Equities: [Blockonomi top AI stocks Jul 2026](https://blockonomi.com/top-5-ai-stocks-for-july-2026-nvidia-nvda-microsoft-msft-and-broadcom-avgo-lead-the-way/) · [NerdWallet best-performing AI stocks](https://www.nerdwallet.com/investing/learn/ai-stocks-invest-in-artificial-intelligence) · [NAI500 top 10 China AI stocks](https://nai500.com/blog/2026/05/top-10-china-stocks-powering-asia-s-ai-breakout/) · [Investing.com Chinese AI landscape](https://www.investing.com/news/stock-market-news/chinese-ai-stocks-the-full-landscape-from-chips-to-cloud-93CH-4810339) · [KuCoin Korean flows H1 2026](https://www.kucoin.com/news/flash/korean-retail-investors-buy-2-8b-in-chinese-ai-assets-in-h1-2026).

Aggregator figures above are seeds: before each leaf ships `tier:"verified"`, the weekly data run must confirm against the primary (vendor model card, exchange filing, or the named leaderboard itself) and record the capture date.
