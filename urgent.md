# urgent.md — Design-Language Upgrades → feida.au

> **Part 1 (SHIPPED 2026-07-21, commit `2750ff7`)**: OpenAI gpt-5-6 chart language → `arena.html` / `stats.html`.
> **Part 2 (NEW)**: Anthropic motion design (scroll-linked container scaling + path-to-hope star-graph mechanics) → `sectors.html`. See §6 onward.

> **Part 1 scope**: charts/stat widgets on `arena.html` and `stats.html` only. Strict to-do list; every item traces to a real selector/file. Source of visual truth: charts on `openai.com/index/gpt-5-6` (inspected 2026-07-21, dark mode).
> **Constraint (read first)**: `design.md` is SSOT — per-page palette/font identity and narrative shells are non-removable (U46-甲-1/2). We adopt OpenAI's chart *geometry and behavior* (minimal grid, hairline axes, thin lines + point markers, quiet tooltips, restrained color count), NOT their neutrals/fonts. Do not swap page palettes to grayscale.

---

## 0. Extracted OpenAI design system (reference spec)

Observed on the live benchmark charts (score-vs-cost frontier lines, tooltips, controls):

| Element | OpenAI treatment |
| --- | --- |
| Plot chrome | No card border, no plot background — chart sits directly on page bg (#000) |
| Grid | Effectively none: one hairline Y-axis + one hairline X-axis (`rgba(255,255,255,.25)`, 1px, solid). No horizontal gridlines, no dashed lines |
| Ticks | Small monospace, dim gray (~`#9a9a9a`), 10–11px, outside the plot; `50%` / `$1,000` formatting |
| Series | 1.5px solid lines + filled point markers (r≈3.5). Hero series = white; own family = periwinkle/indigo tints; competitors = salmon/pink; marker *shape* encodes vendor (circle/square/diamond) |
| Fills | Extremely sparing; no area glow. Emphasis via line weight + marker, not fill |
| Tooltip | Near-black panel `~#161616`, 1px `rgba(255,255,255,.12)` border, 8px radius, 12×14px padding, plain `Label: value` rows, 13px, no arrow, fast fade, offset from point |
| Legend | Dot/square swatch + plain text, multi-column, above plot, borderless, 12px |
| Controls | Metric tabs (quiet pills) + a bordered rounded-lg `<select>` (dark bg, 1px gray border) |
| Motion | Charts lazy-render on scroll into view; no bar-grow theatrics, no glow pulses. Hover = tooltip only |
| Extras | Download icon appears top-right on hover; caption below chart: bold italic chart name + plain description |

Key takeaway to replicate: **delete grid, thin the lines, quiet the glow, normalize tooltips.**

---

## 1. Phase 0 — shared viz tokens (do this first)

### 1.1 `stats.html` `:root` (line 39) — ADD, don't rename existing vars

```css
/* data-viz layer (OpenAI-derived geometry, Afflatus palette) */
--viz-axis: rgba(220,232,242,.28);   /* solid hairline axes */
--viz-grid: rgba(220,232,242,.07);   /* the ONE optional midline */
--viz-tick: var(--dim);
--viz-line-w: 1.5px;
--viz-marker-r: 3;
--viz-tip-bg: rgba(7,10,18,.96);
--viz-tip-line: rgba(220,232,242,.14);
--viz-tip-radius: 8px;
```

### 1.2 `public/styles/arena.css` `:root` (line 1) — ADD the same block, arena-flavored

```css
--viz-axis: rgba(234,241,255,.26);
--viz-grid: rgba(234,241,255,.07);
--viz-tick: var(--muted);
--viz-line-w: 1.5px;
--viz-marker-r: 3;
--viz-tip-bg: rgba(5,7,14,.96);
--viz-tip-line: rgba(234,241,255,.14);
--viz-tip-radius: 8px;
```

- [x] Add both token blocks. No other `:root` edits. **(done)**

---

## 2. Phase 1 — `stats.html` (inline styles + inline chart JS, both MSI and World Cup sections share the same code paths)

### 2.1 Chart frame & grid — charts 1/2/3 + bootstrap (both sections)

Current: 3 dashed gridlines per chart (`stroke-dasharray="3 4"`, stroke `C.line`) at 50/75/100% — heavier than the target.

- [x] Chart 1 (per-series bars, JS ~line 417): keep only the **baseline** (0%) and **100%** lines; render solid 1px, stroke `var(--viz-axis)` for baseline, `var(--viz-grid)` for the top line. Drop `stroke-dasharray` entirely. **(done)**
- [x] Chart 2 (Wilson curve, ~line 488): same — baseline solid `--viz-axis`; 50% coin-flip line stays (it's information) but restyle from gold dashed `6 4` → gold solid, `stroke-opacity:.3`, 1px. **(done)**
- [x] Chart 3 (reliability, ~line 514): axes solid hairline; keep the diagonal (information) as gold `stroke-opacity:.3` solid. **(done)**
- [x] Bootstrap histogram (~line 569): drop per-bar 2px gaps to 1px; percentile markers (gold, `5 4` dash) stay — dashed is meaningful there (threshold, not grid). **(done)**
- [x] All tick `<text>`: normalize to `font-size="10"`, fill `var(--viz-tick)` (currently mixed 8.5/9/9.5/10). **(done for axis ticks; the `n=` bin annotations and bootstrap counter text were left alone — those aren't axis ticks)**
- [x] Duplicate every change in the World Cup twins (~lines 692, 768, 794, 842). **(done — confirmed WC uses distinct ids `wcBars`/`wcCurve`/`wcCurvePath`/`wcDrawer`, no collision with MSI)**

### 2.2 Lines, markers, band fill

- [x] Chart 2 polyline: `stroke-width` 2 → `1.5`; point circles r `2.6` → `3` (matches OpenAI line-thin/marker-clear ratio). **(done)**
- [x] Wilson band polygon: replace flat `rgba(79,214,196,.12)` with a `<linearGradient>` (teal `.16` at curve → `0` at band edge) defined once in `<defs>` — this is the "gradient fill" slot; nothing else gets a gradient. **(done — `#wilsonGradMsi` / `#wilsonGradWc`, separate ids per section)**
- [x] Chart 1 bars: keep `rx 1.5`; drop `fill-opacity .85` → `.9`; **remove** the hover `filter:brightness(1.35) drop-shadow(...)` on `.bar-hit` (CSS line 72–73) → replace with `opacity` dimming: hovered bar `1`, add `svg:hover .bar-hit:not(:hover){opacity:.45;transition:opacity .15s}`. Tooltip carries the detail; no glow. **(done)**

### 2.3 Tooltip `.tooltip` (CSS line 74)

- [x] Restyle to spec: `background:var(--viz-tip-bg); border:1px solid var(--viz-tip-line); border-radius:var(--viz-tip-radius); padding:10px 12px; box-shadow:0 4px 16px rgba(0,0,0,.4)`. **(done)**
- [x] Add 4px translateY on show: base `transform:translateY(4px)`, `.show{transform:none}`, transition `.15s`. Keep `position:fixed` + pointer-events logic as-is. **(done)**
- [x] Keep `Label: value` row format already used in `tipHtml` — it already matches OpenAI's tooltip copy structure. **(unchanged, already compliant)**

### 2.4 Cards, entrance, misc

- [x] `.chart-card` (CSS line 63): keep border (site identity) but drop `translateY(14px)` entrance → `translateY(8px)`, duration `.55s → .4s`. OpenAI renders in-place; we keep a whisper of the reveal per design.md §3. **(done)**
- [x] `.stat:hover` (line 59): remove `box-shadow` glow; keep border-color shift only. **(done)**
- [x] Bar-grow animation (JS ~line 447) and curve draw-on (~line 498): **keep** — they encode data order (design.md 宪章③) — but cut stagger `60ms → 40ms` and curve draw `1.4s → 1s`. **(done, both MSI + WC)**
- [x] `.pick-row .bar i` fill: keep; width transition `.9s → .6s`. **(done)**

---

## 3. Phase 2 — `arena.html` / `src/pages/arenaAutopilot.js` / `src/pages/arenaTech.js` / `public/styles/arena.css`

### 3.1 Autopilot equity chart `#apChart` (arena.html line 130, JS `renderChart()` in arenaAutopilot.js ~line 60)

- [x] `.ap-grid` (arena.css line 315): 4 gridlines → keep only top+bottom hairlines, stroke `var(--viz-grid)`; move the two intermediate `$` labels to the axis without their gridlines (labels + `.ap-axis-bg` plates stay — they solve a real dash-crossing artifact, see JS comment). **(done)**
- [x] `.ap-line` (line 318): `stroke-width:2` → `var(--viz-line-w)`. **(done)**
- [x] Add end-of-series markers: in `buildPath()`, append `<circle r="3">` in `currentColor` at the last point of each series (OpenAI marker-terminated lines). Single-point fallback already draws a dot — reuse it. **(done, new `.ap-end-dot` class)**
- [x] Benchmark lines (`.ap-line-spy`/`.ap-line-smh`): dashes stay (meaningful: simulated benchmark); reduce `stroke-width 1.4 → 1.2` and opacity to `.8` so the two model lines read as heroes. **(done)**
- [x] NEW (only new component in this pass): nearest-point hover tooltip on `#apChart`. **(done — `.viz-tip` div, `pointermove`/`pointerleave` bound once via `bindChartTooltip()`, reads nearest-by-day points from `chartCtx`, interpolates SPY/SMH from their 2-point lines)**
- [x] `.ap-legend` swatches: keep; ensure 12px text, no border (already compliant). **(unchanged, already compliant)**

### 3.2 TA panel (`arenaTech.js`, `#taPanel`)

- [x] `.ta-ladder` (arena.css line 241): background gradient → flat `var(--panel-2)`; border → `1px solid var(--viz-grid)`. Level rows keep their sup/res/pp colors (information). **(done)**
- [x] Any dashed separator inside ladder/cards: solid hairline `var(--viz-grid)` unless the dash encodes something (pre/post market split stays dashed). **(checked — remaining dashes are all information-bearing: leader connector, gap marker, session line, `.k-round` psychological levels, benchmark legend swatch. None touched.)**
- [x] Tick/label typography inside ladder: 10px `var(--font-mono)`, color `var(--viz-tick)` — align with 2.1's normalization. **(done — `.lad-lab em`)**

### 3.3 Explicitly out of scope (do NOT touch — design.md red lines)

- `#bgCanvas`, `.bg-grid/.bg-weave/.bg-marks/.bg-glitch` — decorative shell, not data-viz.
- Watchlist chips `#taWatch`, countdown, news ticker, Today's Signal panel — text widgets, no chart geometry.
- Page fonts (Orbitron/Rajdhani/JetBrains), acid/cyan palette, narrative copy.

---

## 4. Phase 3 — verification (blocking; run before commit)

- [x] `npm run build` clean; `scripts/check-no-new-important.mjs` passes (no new `!important`). **(done — `check-no-new-important` passes at baseline; `npm run build` hit a pre-existing, unrelated sandbox `EPERM` unlinking a stale `dist/.DS_Store` plus pre-existing `course.html` parse5 warnings — neither touches files from this pass. Re-ran with `vite build --outDir /tmp/...` to route around it: build succeeded, `arena-*.js` and `stats-*.js` bundled clean.)**
- [ ] Visual diff both pages vs `dist_check_baseline/` at 1280w and 390w: only chart internals changed. **(not done — this sandbox's browser tooling can't load `file://` paths on your machine (extension blocked it) and has no network path to a local dev server on your Mac. Recommend: run `npm run dev` and eyeball `/stats.html` + `/arena.html` yourself, or tell me to try another route.)**
- [x] `stats.html`: hover a bar → tooltip matches spec (8px radius, no glow); click still opens reasoning drawer; threshold slider + bootstrap RUN still recompute; both MSI and World Cup sections identical treatment. **(code-verified: drawer/slider/bootstrap logic untouched, only styling changed; MSI and WC edits kept in lockstep)**
- [x] `arena.html`: `#apChart` tooltip tracks nearest point; ledger-unavailable path (`renderError()`) unaffected. **(code-verified: `renderError()` never calls `renderChart`/touches `chartCtx`; `arenaLedgerView.test.js` — the pure functions the new tooltip calls — still passes, 13/13)**
- [x] `prefers-reduced-motion`: entrance/draw animations still fully disabled (existing `RM` guards must keep covering the retuned durations). **(verified — only touched durations inside existing `if (!RM)` branches; the `RM` checks themselves are untouched)**
- [ ] Contrast: `--viz-tick` on `--bg` ≥ 4.5:1 on both pages (measure; bump alpha if short). **(not measured — no browser color-picker access in this environment; `--viz-tick` resolves to the pre-existing `--dim`/`--muted` tokens already used site-wide for label text, so risk is low, but worth a quick check)**
- [x] Grep gate: no remaining `stroke-dasharray="3 4"` in stats.html; no `drop-shadow` in `.bar-hit` hover. **(done — both greps return zero matches)**

**Automated checks run:** `npm run build` (via alt outDir), `node scripts/check-no-new-important.mjs`, `npx vitest run` (57 files / 718 tests, all passing, including `arenaLedgerView.test.js`), `node --check` on `arenaAutopilot.js`, plus the two grep gates above.

---

## Done (Part 1) =

Charts on both pages read like the OpenAI benchmark plots — bare hairline axes, thin marker-terminated lines, one gradient (Wilson band), quiet uniform tooltips — while every page keeps its own Afflatus palette, fonts, and narrative shell.

---
---

# PART 2 — sectors.html Motion Overhaul (Anthropic reference mechanics)

> Reference sources inspected live 2026-07-21: `anthropic.com` (homepage big-CTA scroll-bg, GSAP internals read via `ScrollTrigger.getAll()`) and `anthropic.com/path-to-hope` (graph module DOM archaeology). Target: `sectors.html` general layout motion + the Interactive Star Map (交互星图, `#mwGraph` / `src/lib/sectorsGraphView.js` / `src/lib/forceGraph.js`).

## 6. Extracted reference spec A — scroll-linked container scaling (anthropic.com)

Read directly off the live page (GSAP 3.15.0 + ScrollTrigger; configs pulled from `ScrollTrigger.getAll()`):

| Parameter | Measured value |
| --- | --- |
| Driver | GSAP ScrollTrigger, `scrub: 0.8` (damped scrub — rendered progress chases scroll progress with ~0.8s catch-up, NOT instant) |
| Trigger | the section itself; `start: "center 70%"`, `end: "center 40%"` — the whole animation runs in the ~30vh of scroll where the section's center travels from 70% to 40% of viewport height |
| Tween target 1 | `.big-cta_scroll-bg` — FROM inset card `{max-width: 1279px (=84.6% of its 1512px container), border-radius: 24px, margin-top/bottom: 62px}` TO full-bleed `{maxWidth: '100%', borderRadius: '0px', margins: 0}`, `ease: power2.out`, duration 0.5 of a 0.55-unit timeline |
| Tween target 2 | inner `.big-cta_container` — margins compensate to `4rem`, same ease, so content doesn't jump while the shell expands |
| Write mode | inline styles per rAF frame (the intermediate frame in the DOM snippet — `max-width: 98.6545%; border-radius: 3px; margin: 6px` — is simply one scrubbed frame near the end of this tween) |

**Mechanic in one sentence**: as the section scrolls into its trigger window, a damped scrub expands a rounded inset "card" background into a full-bleed rectangle by interpolating `max-width` / `border-radius` / `margins` with `power2.out`.

## 7. Extracted reference spec B — star-graph canvas (path-to-hope)

DOM archaeology of `graph-module-scss-module__4HFQbW__*` (69 nodes, 87 links, 15 labels observed):

- **Structure**: `.page` → `.scrollHost` (viewport-sized) → sticky `.stage` → **one `.canvas` DIV of fixed logical size 1440×1024** containing everything. Not `<canvas>`, not WebGL — plain DOM + one SVG.
- **Camera**: pan/zoom is a single CSS transform on that container: `transform: translate(Xpx, Ypx) scale(S)`. Focusing a node = animating translate so the node's logical coords land at viewport center. One writer, one property, GPU-composited.
- **Links**: one `<svg viewBox="0 0 1440 1024">` with 87 `<line>` elements, `stroke: #141413`, and critically `stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0` — dash normalized via `pathLength` so the bloom is a uniform `dashoffset 1→0` draw-on regardless of line length.
- **Nodes**: absolutely-positioned DIVs (`left/top/width/height` in the same 1440×1024 logical space, CDN `background-image` cards), `opacity: 0` pre-bloom; a `nodeBordered` variant. DOM nodes ⇒ free native hover/click/focus UX.
- **preBloom state machine**: `.canvas.preBloom` gates everything. Intro: viewport-centered `.word` elements ("Keep" → "thinking.") fade in sequentially as (hijacked, wheel-driven) scroll progresses; on bloom the `preBloom` class drops and lines draw on (dashoffset), nodes/labels fade in, words scale away. (Honest note: the bloom transition itself refused to fire under synthetic CDP scroll — its virtual-scroll runtime filters untrusted input — so bloom *timing/stagger* below is a spec'd recommendation, not a measurement. Everything structural above is measured.)
- **Labels/blurbs**: same logical space, `opacity: 0` staged with the same state machine.

**Mechanic in one sentence**: a fixed-logical-size DOM "world" panned/zoomed by one `translate()+scale()` transform, with a `preBloom→bloom` entrance where pathLength-normalized SVG lines draw on and DOM nodes fade in.

## 8. Mapping to sectors.html — architecture decisions (read before coding)

1. **No GSAP.** `package.json` ships zero animation deps and design.md U30-30a explicitly ruled "no D3/Pixi/Three for this graph" — adding GSAP for one scroll effect fails that bar. §9 specs a ~40-line dependency-free equivalent whose damping is mathematically identical to `scrub: 0.8` (exponential chase, τ=0.8s).
2. **Charter conflict, resolved**: design.md 宪章③ says animate `transform/opacity` only, but Anthropic literally animates `max-width/margins` (layout). Primary spec uses **`clip-path: inset(V H round R)`** — paint-only, visually identical (card reveals to full-bleed), charter-compliant. The literal Anthropic property set is documented as fallback only if the clip-path route shows visual artifacts around `.graphWrap`'s border/shadow.
3. **Star map stays Canvas 2D** (`sectorsGraphView.js`). Path-to-hope proves the *mechanics* need no WebGL; we replicate camera/bloom/UX semantics inside the existing canvas renderer rather than rebuilding as DOM (69 DOM nodes is fine for a static editorial graph; our sim re-renders every frame — canvas is the right call and already built/tested).
4. **Physics live in pure modules** (`forceGraph.js` pattern): new camera math (smoothDamp, anchor-zoom, inertia) goes in a pure, vitest-testable module; `sectorsGraphView.js` only wires pointers to it.

## 9. Developer checklist — scroll-linked section reveal (`sectors.html` layout)

New file `src/lib/scrollReveal.js` (pure progress math) + wiring in `src/pages/sectors.js`:

- [x] **9.1 Progress mapping** (replicates `start:"center 70%" end:"center 40%"`) — **(done, `src/lib/scrollReveal.js` `revealProgress()`, matches literally)**
- [x] **9.2 Scrub damping** (replicates GSAP `scrub: 0.8` — exponential chase, frame-rate independent) — **(done, `chase()`, matches literally)**
- [x] **9.3 Eased interpolation** (`power2.out` ≡ `e = 1-(1-p)^2`), applied to the reveal — **(done, `easeOutQuad()` + `revealClipPath()`/`revealClipPathX()`, same anchor values: 7.7%/24px/24px)**
- [x] **9.4 Apply to**: `.graphWrap` (star map shell — the marquee use), `.heroCard`, and the four `.band` section headers (band: horizontal-inset-only variant). Nothing else — three mechanics max per design.md restraint. **(done, `scrollRevealView.js` queries exactly these three selectors)**
- [x] **9.5 Loop discipline**: one shared rAF driven by an IntersectionObserver; loop sleeps when no tracked section is in its trigger window AND `|target-rendered| < 0.001`. **(done — IO gates `tracking`, loop self-stops when every tracked target has converged; a lightweight `scroll` listener restarts it since IO's `isIntersecting` alone is too coarse to drive a continuous scrub, see code comment)**
- [x] **9.6 `prefers-reduced-motion`**: skip chase, set final state directly. **(done — targets init straight to `rendered=1` and no rAF loop starts at all under reduce; also gated on `CSS.supports('clip-path', ...)` so unsupported browsers get no clip applied, i.e. full-bleed/unclipped by default)**
- [x] **9.7 Tests** (`tests/scrollReveal.test.js`) — **(done, 15/15 passing: progress clamps + exact boundary values, chase monotonic + frame-rate-independent + never-overshoots + zero-dt no-op, easing endpoints, clip-path string output at e=0/1 and at varying width)**

## 10. Developer checklist — star map camera + bloom (`sectorsGraphView.js`)

New pure module `src/lib/graphCamera.js` + surgical edits in `sectorsGraphView.js`:

- [x] **10.1 Camera state object** replaces bare `camScale/camX/camY` — **(done: `cam = {x,y,scale,tx,ty,tscale,vx,vy,vscale}`; τ constants match exactly: `PAN_TAU=0.10, ZOOM_TAU=0.12, FOCUS_TAU=0.35`, switched per-mode via a `camTau` variable)**
- [x] **10.2 Cursor-anchored zoom** — **(done, `graphCamera.js` `zoomAnchor()`, invariant-tested in `graphCamera.test.js`. One refinement over the literal spec: anchors off the *rendered* camera, not the target — if it anchored off a lagging target during a fast wheel gesture the point under the cursor would drift until the glide finished; anchoring off what's actually drawn keeps it correct throughout. Same treatment for the pinch midpoint.)**
- [x] **10.3 Pan inertia** — **(done: `decayVelocity()` + `clampPanTarget()`, wired into the rAF loop; skipped entirely under `prefers-reduced-motion` — see 11's note below, that refinement wasn't in the original checklist text but follows directly from the reduced-motion rule this doc states elsewhere)**
- [x] **10.4 Focus-fly on node select** — **(done: click centers the node at `cam.tscale*1.15` via `focusTarget()`; blank-space click and `Esc` both fly home via a `goHome()` helper built on `size()`'s existing scale-fit math)**
- [x] **10.5 preBloom → bloom entrance** — **(done: `BLOOM_DURATION=0.9`, `bloomLinkT`/`bloomNodeT`/`bloomLabelAlpha` in `graphCamera.js`, all constants match — 0.5s link draw, 150ms node stagger, last-300ms label fade; triggers once on first `IntersectionObserver` intersect; `easeOutBack` used for the node "pop")**
- [x] **10.6 Hover UX** — **(done: mousemove hit-test each frame via existing `nodeAt()`, `cursor:pointer`, hovered ring +1px stroke/1.15x radius, non-hovered links dimmed to 0.35 / other nodes to 0.6 alpha)**
- [x] **10.7 Wire-up** — **(done — `draw()` reads `cam.x/y/scale`, all input handlers write only `cam.tx/ty/tscale`, `stepForceSim` untouched)**
- [x] **10.8 Tests** (`tests/graphCamera.test.js`) — **(done, 20/20 passing — see honest note on the "<1.5s"/"~0.5s" numeric claims below)**

  **Two numbers in this checklist needed correcting once actually measured against the algorithm** (both are physics facts, not implementation shortcuts — flagged rather than quietly adjusting the test to fake a pass):
  - *Focus-fly "reaches target within 0.5s"*: a critically-damped smoothDamp with τ=0.35s is ~78% of the way there at 500ms and >99% by ~1.5s — τ is a decay time-constant, not a hard deadline. The test now checks both checkpoints instead of asserting full convergence at exactly 500ms.
  - *Inertia "<1.5s"*: true for a typical drag-release speed (tested at 120px/s), but an extreme flick (2000px/s) with τ=0.35 takes ~2.6s to decay below the 2px/s threshold. The test now covers a moderate flick (<1.5s, matches the original intent) and separately confirms even a hard flick always terminates in bounded time — no infinite coast.

## 11. Verification (Part 2 — blocking)

- [x] `npx vitest run` — **(done: 753/753 passing — 718 pre-existing + 15 `scrollReveal` + 20 `graphCamera`)**
- [x] `npm run build` clean; no new deps in `package.json` — **(done: build succeeds, `git diff package.json` is empty; `sectors` bundle grew 8.4kB→13.4kB for the new code, still 3% of its 300kB budget per `check-bundle-budget.mjs`; `check-no-new-important.mjs` unaffected)**
- [ ] Manual: wheel-zoom on a node keeps it under the cursor; drag-fling glides and rubber-bands; toggling 星图 plays the bloom once (and only once per reveal); node click flies camera + opens `#mwDetail`; `Esc` flies home. **(NOT independently verified — this sandbox has no path to a live browser against your local dev server or `file://`, same limitation noted in Part 1. Please run `npm run dev` and check `/sectors.html` yourself: click "View as interactive map →", scroll-hover/click nodes, wheel-zoom, flick-drag, press Esc.)**
- [ ] `prefers-reduced-motion`: no bloom animation, no inertia glide, no reveal motion — but final states all correct and interaction fully functional. **(code-verified via review — every ambient-motion path checks `reduce` and either skips animating or snaps to final state — but not visually confirmed in a real browser; please spot-check with your OS's reduce-motion setting on.)**
- [ ] Perf: DevTools trace while scrolling sectors.html — no layout thrash from the reveal (clip-path only), star map steady 60fps with hover dimming active. **(not measured — needs your DevTools.)**
- [x] design.md compliance pass: 宪章③ (transform/opacity/paint-only, smoothDamp, no teleport ✓), U30-30a (no new deps ✓), narrative shell untouched (星图 copy/persona unchanged ✓). **(done — reveal writes only `clip-path`, camera writes only a canvas transform-equivalent via re-draw, both charter-compliant; zero new dependencies; no copy/persona text touched)**

## Done (Part 2) =

sectors.html sections reveal with Anthropic's damped-scrub card-expand feel (charter-compliant clip-path implementation), and the 交互星图 gains path-to-hope's camera language — bloom entrance, cursor-anchored zoom, inertial pan, focus-fly on select, hover dimming — all inside the existing dependency-free Canvas 2D renderer with the physics in pure, tested modules.
