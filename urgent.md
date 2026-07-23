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

---
---

# PART 3 — sectors.html Vendor Cards: Asset Refresh + Logo Layout Hardening

> Audit performed live on `feida.au/sectors.html` (2026-07-22, Chrome DOM inspection + per-URL image probes). Targets: the `AfflatusBrand` registry (inline script in `sectors.html`, `PHOTO_URL`/`LOGO_URL`/`artHTML()`) and the `.rArt` card CSS in `public/styles/sectors.css` (lines ~125–150). Registry convention (U37) stays in force: **real photos from official newsroom/press pages only, real logos only, honest brand-color fallback where nothing verifiable exists.**

## 12. Live audit — what's actually wrong (measured, not guessed)

1. **The NVDA photo is dead.** `nvidianews.nvidia.com/file?fid=…` errors on hotlink (probed: `error`; the `file?fid=` redirect pattern rejects external referrers — NVIDIA's newsroom CDN `iprsoftwaremedia.com` is the hotlinkable form). The delegated error-listener correctly degrades the card to `.noPhoto`, so the flagship NVIDIA card renders as a near-black box.
2. **12 of 18 art keys have no photo at all** (only NVDA/AVGO/MU/SKHY/TSM/SSNLF ever had one), so most cards are dark brand-tint fallbacks — this is the "outdated and visually unappealing" impression, compounded by multi-second pop-in of the lazy hotlinked images (several are 2000px+ originals).
3. **The logos are already geometrically centered.** Probed every `.rArt`: logo center vs card center offset = `0.0px / 0.0px` in both axes, every card — `.rArt` is `display:flex;align-items:center;justify-content:center` and the only in-flow child is the logo (photo/scrim/tags are absolute). What *reads* as misalignment is: (a) the intentional `--tilt` rotation (±1–2°, the "card stack" aesthetic), (b) mixed logo aspect ratios (wide wordmarks vs near-square marks at the same `max-height:44%` render at wildly different visual weights), (c) SVGs with baked-in whitespace, and (d) logos/photos that simply hadn't loaded yet. §14 hardens the layout so centering is guaranteed by construction and optically normalized — but does not pretend to "fix" an offset that doesn't exist.

## 13. Task 1 — updated image assets (every URL probed OK from a real browser, 2026-07-22)

Replace/extend `PHOTO_URL` in the `AfflatusBrand` registry:

| Key | New URL (verified) | What it is / source page |
| --- | --- | --- |
| `NVDA` | `https://iprsoftwaremedia.com/219/files/202603/nvidia-vera-rubin-family.jpeg` | **1600×900** Vera Rubin platform product shot, GTC 2026 press kit (`nvidianews.nvidia.com/news/nvidia-vera-rubin-platform`). Replaces the dead `file?fid=` URL with the same asset's hotlinkable CDN form |
| `SKHY` | `https://d36ae2cxtn9mcr.cloudfront.net/wp-content/uploads/2026/01/05223845/SK-hynix-CES-2026-showcase-products-2.jpg` | **1000×657** CES 2026 product showcase (HBM4/SOCAMM2/LPDDR6), SK hynix newsroom. Replaces the 3.6MB Icheon-campus PNG — newer, product-focused, ~10× lighter |
| `SSNLF` | `https://news.samsungsemiconductor.com/global/wp-content/uploads/2026/02/Image-1.-Samsung-Electronics-HBM4-2-1024x731.jpg` | **1024×731** HBM4 commercial-shipment product shot (Feb 2026), Samsung Semiconductor newsroom. Replaces the KakaoTalk event photo |
| `ASML` **(new)** | `https://edge.sitecorecloud.io/asmlnetherlaaea-asmlcom-prd-5369/media/project/asmlcom/asmlcom/asml/images/products/euv-lithography-systems/twinscan-exe5200b.png?h=608&iar=0&w=1080` | **1080×608** TWINSCAN EXE:5200B High-NA EUV system, official asml.com product page. ASML previously had no photo |
| `anthropic` **(new)** | `https://cdn.sanity.io/images/4zrzovbb/website/b7055119423427c40a0e4d84054aed17682b50a2-2880x1620.png?w=1200&auto=format` | **1200×675** Claude Fable 5 launch key art (Jun 2026), anthropic.com news CDN (their own og:image asset) |
| `openai` **(new)** | `https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill` | **1600×900** GPT-5.6 launch key art (Jul 2026), openai.com's own og:image CDN |
| `MU` *(optional)* | `https://assets.micron.com/adobe/assets/urn:aaid:aem:4d518d2d-07b9-4d1b-afde-1fcda9842089/as/hbm4-carousel-Sampling-HBM4-16H.jpg` | HBM4 16H product shot from micron.com/products/memory/hbm/hbm4 — **but source is only 267×267**; fine for the 1:1 news-grid thumbs, soft if upscaled into the 4:3 rail. Recommendation: keep the current Boise photo for the rail (verified working) unless a larger Micron press asset turns up |
| `AVGO` | *keep current* (`news-editor.broadcom.com/...Palo-Alto-Campus...jpg`, probed OK at 2048px) | Broadcom's newsroom is JS-rendered; the only extractable press og:image is a generic logo card (`broadcom.com/media/.../brcm_preview_image@72ppi.jpg`, probed OK, 1200×627) — a real campus photo beats a logo placard. Swap only if a Tomahawk-6 product still becomes linkable |
| `TSM` | *keep current* (`pr.tsmc.com/sites/pr/multimedia-gallery/407A9160_0.jpg`, probed OK) | Still the best hotlinkable official TSMC gallery asset found |

**Honest fallbacks (unchanged, by U37 convention)**: `google`, `xai`, `meta`, `cohere`, `deepseek`, `alibaba`, `zhipu`, `moonshot`, `minimax`, `MRVL`, `PSTG`, `SNDK`, `TER`, `RMBS`, `ALAB` — no verifiable, hotlinkable official press asset found in this pass; they keep the brand-color card. Do NOT fill these with stock photos or search-engine images (breaks the "no fabricated photography" red line).

- [x] 13.1 Update `PHOTO_URL` with the six new/replaced entries above. **(done)**
- [x] 13.2 Delete the dead NVDA `file?fid=` URL; add a registry comment: *never use `nvidianews.nvidia.com/file?fid=` — hotlink-blocked; use the `iprsoftwaremedia.com` CDN form from the press-kit page instead.* **(done)**
- [x] 13.3 All new `<img>` gain `decoding="async"` alongside the existing `loading="lazy" referrerpolicy="no-referrer"` (registry `artHTML()`). **(done — applied to both `.rPhoto` and `.rLogo` `<img>` templates)**

## 14. Task 2 — logo layout: guaranteed central symmetry + optical normalization

Replace the `.rArt` layout block in `public/styles/sectors.css` (~lines 126–131). Grid-stacking: every layer occupies the same cell, the logo is centered by `place-items` — centering holds no matter how many layers exist or load, rather than depending on "the logo happens to be the only in-flow flex child":

```css
/* .rArt v2 — grid-stacked card art: all layers share one cell; logo/fallback
   dead-centered by construction (place-items), photo/scrim stretch to fill. */
.rArt{position:relative;aspect-ratio:4/3;display:grid;place-items:center;padding:14px;overflow:hidden;
  --brand:var(--accent);--tilt:0deg;background:#0d0d10;cursor:pointer;
  transform:rotate(var(--tilt));transform-origin:50% 65%;
  transition:transform .45s cubic-bezier(.34,1.56,.64,1),filter .3s ease,box-shadow .3s ease}
.rArt>*{grid-area:1/1}                              /* stack every layer in the same cell */
.rPhoto{width:100%;height:100%;object-fit:cover;align-self:stretch;justify-self:stretch;
  opacity:0;transition:opacity .4s ease}            /* fade in on load — kills the pop-in */
.rPhoto.loaded{opacity:1}
.rScrim{width:100%;height:100%;align-self:stretch;justify-self:stretch;
  background:linear-gradient(180deg,rgba(0,0,0,.1) 0%,rgba(0,0,0,.35) 60%,rgba(0,0,0,.6) 100%)}
.nTags{place-self:start start;padding:12px;z-index:1;position:static}  /* pills pin top-left via grid, not abs */
.rLogo{z-index:1;max-width:56%;max-height:38%;object-fit:contain;
  filter:brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.5))}
.rArt.is-mark .rLogo{max-width:30%;max-height:34%}  /* near-square symbol marks: cap width so they match wordmark visual weight */
.rLogoFallback{z-index:1;color:#fff;font:800 19px var(--font);letter-spacing:-.01em;text-align:center;
  text-shadow:0 2px 10px rgba(0,0,0,.5)}
```

Notes / deltas from current:
- `position:absolute` on `.rPhoto`/`.rScrim` and `.nTags` goes away — the grid stack replaces it (remove the old `.rPhoto{position:absolute;inset:0}` line 128, `.rScrim` line 129, and `.nTags{position:absolute;top:12px;left:12px}` line 183's positioning; keep its flex/gap).
- Logo cap tightened `60%/44% → 56%/38%` and a `.is-mark` variant added — this is the *optical* symmetry fix: a near-square mark (OpenAI symbol, Anthropic logomark) at 44% height carries ~3× the ink of a wide wordmark at the same cap; capping marks at 30% width equalizes perceived size so the row of cards reads symmetric.
- **`--tilt` decision needed from you**: the ±1–2° card-stack tilt (lines 133–136) is deliberate design.md identity, but it is also the single biggest reason logos "look" off-axis. Options: (a) keep as is; (b) keep tilt on the card but counter-rotate the logo `.rArt .rLogo{transform:rotate(calc(var(--tilt) * -1))}` so logos stay screen-level while cards stay playful; (c) zero the tilt. **Recommended: (b)** — keeps the identity, fixes the perception.

JS deltas (registry script in `sectors.html`):

```js
// in the delegated listener block — mark photos loaded (mirrors the error listener)
document.addEventListener('load', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('rPhoto')) e.target.classList.add('loaded');
}, true);
// tag near-square logos so CSS can normalize their optical weight
document.addEventListener('load', function (e) {
  var el = e.target;
  if (el && el.classList && el.classList.contains('rLogo') && el.naturalWidth / el.naturalHeight < 1.4) {
    el.closest('.rArt').classList.add('is-mark');
  }
}, true);
```

- [x] 14.1 Apply the CSS block (surgical: only the listed selectors; `.rArt.noPhoto`, hover/selected/tilt rules, `.featured .rArt`, `.nCard .rArt{aspect-ratio:1/1}` all untouched and compatible with the grid stack). **(done — `.nTags` line 183 also merged to `place-self:start start;position:static` per the note, keeping its `display:flex;gap:6px;flex-wrap:wrap`)**
- [x] 14.2 Add the two delegated `load` listeners next to the existing `error` listener. **(done)**
- [x] 14.3 Decide the `--tilt` option (a/b/c above); if (b), add the one counter-rotate rule. **(went with recommended (b) — `.rArt .rLogo{transform:rotate(calc(var(--tilt) * -1))}` added)**

## 15. Verification (Part 3 — blocking)

- [x] Every URL in §13 re-probed (`new Image()`, `referrerPolicy:'no-referrer'` matching the real `<img>` config) — all six new/replaced URLs load OK at expected dimensions (NVDA 1600×900, SKHY 1000×657, SSNLF 1024×731, ASML 1080×608, anthropic 1200×675, openai 1600×900). Re-probed 2026-07-22 same session as implementation; the existing error-listener remains the safety net for future rot.
- [x] `npx vitest run` — 753/753 passing (no regressions; no JS modules touched by this pass). **(done)**
- [x] `npm run build` clean (via alt-outDir workaround for the pre-existing sandbox `EPERM`/parse5 issues noted in Part 1 — unrelated to this change); `check-no-new-important.mjs` still at baseline (2960/2). **(done)**
- [x] Grep gates: old `.rPhoto{position:absolute...}` rule gone; dead `file?fid=` URL only remains as a "never use" comment; `.is-mark` CSS present; both new `load` listeners present. **(done)**
- [ ] NVDA card shows the Vera Rubin shot (not a black box); ASML/Anthropic/OpenAI cards show photos for the first time — not yet visually confirmed live (code not deployed yet; same file://+localhost limitation as Parts 1–2). Please check `/sectors.html` after this ships.
- [ ] Logo centering / `is-mark` visual spot-check — not yet visually confirmed live, same reason as above.
- [ ] No layout shift on photo load (grid cell is sized by `aspect-ratio`, photo fades into it); Lighthouse CLS for the rails ≈ 0. **(not measured — needs your DevTools)**
- [x] U37 convention intact: zero non-official, zero fabricated imagery introduced; fallback list unchanged from §13. **(done)**

## Done (Part 3) =

Every card with a verifiable official press asset shows a current keynote/product image (GTC 2026 Vera Rubin, CES 2026 SK hynix, Feb-2026 Samsung HBM4, High-NA EUV, Fable 5 / GPT-5.6 launch art), photos fade in instead of popping, the one dead URL is gone, and logo centering is guaranteed by grid construction with optical size normalization — while every company without a legitimate asset keeps its honest brand-color card.

---
---

# PART 4 — Arena 2.0: Three AI Trading Models · Full-Market Universe · Picks-Gated Data Layer · Run Automation

> Requested 2026-07-23. **Status: Phases 1-5 (Engine §17.5, Data+dry-run §18.1/§19.5, API gating §18.4, UI pivot §18.2-18.3, Automation §19) shipped 2026-07-23 — see checkmarks below. `public/arena-ledger.json` has been flipped to Season 2 (S/P/T, day 0, $10,000 each — see §18.1.3) via `scripts/bootstrap-season2.mjs`; Season 1 archived byte-for-byte at `arena-ledger-s1.json`. The picks board ("Today's Recommended Trades") replaces the old watchlist chip row, the allowlist is picks-only, and a full admin-unlock UI exists client-side. Idempotent settlement + offline reconcile/outbox + a daily-digest toast/drawer + ntfy push are all built and unit-/manually-tested (§19.3/§19.4). Five scheduled tasks (`arena-picks-publish`, `arena-open-window`, `arena-late-window`, `arena-autopilot-b-post`'s rewritten Phase 2, `arena-weekly-review`) exist and reference the now-ACTIVE V5 prompt — but are all `enabled:false` pending one manual "Run now" verification pass per task (see §21's last item) before anyone flips them on. ARENA_ADMIN_KEY still isn't set in Vercel (unlock UI wired but inert). Phase 6 (final §21 pass — quota audit, a real offline drill) remains: those two items need the scheduled tasks actually running for real, which is gated on the manual verification above.**
> Touches: `arena.html`, `src/pages/arenaAutopilot.js`, `src/pages/arenaTech.js`, `src/lib/arenaRules.js`, `src/lib/arenaRun.js`, `api/quote.js`, `api/history.js` (+2 new api files), `public/arena-*.json` (+3 new data files), `prompts/arena-autopilot.md` (→ v5), `scripts/apply-arena-run.mjs`, scheduled-task definitions.
> Constraints carried forward: design.md is SSOT (palette/fonts/narrative shell untouched); arenaRules.js stays the one place hard limits live; "LLM proposes, code settles, git is the database" stays the architecture; CI gates (vitest / typecheck / validate-data / bundle budget) remain blocking.

## 16. Assumptions & reality mapping (read first)

Per CLAUDE.md §1, stating assumptions instead of silently designing around them:

1. **This stays a simulation.** The site's own footer promises "no real money, no real orders" and every disclaimer says "not investment advice". Nothing below places real trades. If you ever want real execution, that is a different project with a broker API, not a refactor of this one.
2. **The five reference strategies are institutional-scale; we build honest daily/windowed analogs.** Millisecond NLP execution, LSTM/Transformer inference on live Limit Order Book feeds, and satellite-imagery pipelines are not reachable from a static Vercel site on free-tier Finnhub (60 req/min, quotes only — no LOB depth) and Twelve Data (~8 req/min, ~800 credits/day). The mapping table in §17.1 says exactly which *mechanic* of each strategy survives and which is explicitly out of scope. The site copy must say "-inspired", not claim HFT.
3. **The LLM-proposes / code-settles split is non-negotiable.** All three new models produce JSON proposals; `arenaRules.js` validates and `arenaRun.js` settles. "RL execution" and "multi-agent" are therefore implemented as (a) a deterministic, tunable execution policy in code and (b) a pipeline of specialized scheduled-task runs — not as trained neural policies. Flagged honestly in §17.5/§17.6.
4. **Season 1 (Models A/B) is frozen, not deleted.** `arena-ledger.json` day 11 / season 1 gets archived to `public/arena-ledger-s1.json`; Season 2 seeds three fresh $10,000 books. Old predlog entries keep their history.
5. **The admin password is a quota gate, not a security boundary.** It protects free-tier API credits from drive-by visitors. It is not auth; treat it accordingly (§18.4).
6. **Model naming**: ledger keys stay single-letter for schema continuity — `S` / `P` / `T`, codenames ORACLE / PULSE / ATLAS (fits the TRAXUS//CVKM shell).

---

## 17. Task 1 — the three trading models

### 17.1 Synthesis matrix — 5 strategies → 3 models

| # | Reference strategy | What survives here | Model | What is explicitly NOT built |
| --- | --- | --- | --- | --- |
| 1 | NLP sentiment & event-driven | LLM digests news/filings/social at run windows; per-symbol sentiment score + event tags drive entries | **S (ORACLE)**, feeds P/T | Millisecond reaction; direct X firehose (no free API) — use WebSearch + RSS + SEC EDGAR full-text |
| 2 | Deep-learning HFT on LOB | Intraday micro-structure *features* computable from free data: open gap, first-30-min range, VWAP drift, volume surge vs 20d avg, pivot breaks | **P (PULSE)** | Actual LOB depth (not in Finnhub free tier), sub-minute inference, any claim of "HFT" |
| 3 | RL execution / slippage minimization | Deterministic execution policy layer in `arenaRules.js`: order slicing across the two windows, participation cap, limit-vs-market decision by spread proxy; parameters tuned offline against the fill simulator | execution layer for **all books** | Online RL training loop; a learned policy network. This is a hand-tuned policy — the *objective* (minimize modeled slippage) is the RL part we keep |
| 4 | Alternative data fusion | Free, legal alt-data proxies: SEC EDGAR filings/insider Form 4s, Finnhub free endpoints (earnings calendar, recommendation trends), Google Trends via WebSearch digest | **T (ATLAS)** | Satellite imagery, credit-card panels, supply-chain feeds (all paid/licensed) |
| 5 | Multi-agent systems | Pipeline of specialized runs with distinct prompts sharing one payload contract: Gatherer → 3 Analysts → Risk (code) → Executioner (code) → Reviewer | **architecture layer** (§17.6) | Free-form agent-to-agent negotiation; agents share state only through committed JSON artifacts |

### 17.2 Model S — ORACLE (sentiment & event book)

- **Sources (per run)**: WebSearch news sweep (macro + top movers), SEC EDGAR latest 8-K/Form-4 full-text hits, earnings-calendar proximity, the existing arena-news briefing pipeline.
- **Signal**: per-symbol `{sentiment: -1..1, eventTag: earnings|guidance|M&A|litigation|macro|product, halfLifeDays}`. Enters on strong-sentiment + fresh-event combos; exits on sentiment decay (half-life) or event resolution. Black-swan behavior: a `riskOff` flag in the gathered digest (VIX spike / index gap > 1.5%) forces HOLD/SELL proposals only — the daily circuit breaker in code remains the hard stop.
- **Cadence**: pre-market picks + both intraday windows (can react to news at 10:05 and 15:30 ET; that is the honest floor of "event-driven speed" here).
- **Risk personality** (`LIMITS.PER_MODEL.S`): stop 8% (inherits A's), max 6 positions, confidence floor 0.70 (sentiment is noisy), weekly trade cap 20.

### 17.3 Model P — PULSE (intraday structure book)

- **Sources**: `/api/quote` snapshots at window time, Twelve Data 5-min candles for its candidate list only (budgeted, §18.5), 20-day daily history for baselines.
- **Signal**: the §17.1-row-2 feature vector, computed *in code* (`src/lib/arenaFeatures.js`, new, pure + tested — the LLM never computes math it can hallucinate). LLM's job: rank the pre-screened breakout/reversion candidates and size them; features and thresholds arrive in the payload.
- **Cadence**: 10:05 ET window (open-range break) + 15:30 ET window (late-day momentum / mean-revert close). Positions held hours→2 days; hard rule: proposals must include `exitBy` (date) — settle sweeps it like a stop.
- **Risk personality**: stop 5% (tightest), max 5 positions, slippage tier A (5 bps), weekly trade cap 30.

### 17.4 Model T — ATLAS (alt-data fusion book)

- **Sources**: EDGAR insider clusters (≥2 insider buys/10d), Finnhub recommendation-trend deltas, earnings-surprise history, Google-Trends-style demand proxies from the Gatherer digest, sector breadth from existing sectors-data.
- **Signal**: multi-factor conviction score fusing ≥2 independent alt-signals ("fusion" is the point — single-signal entries are rejected by prompt AND by a `signals.length >= 2` check in validation). Long-horizon: weeks. Macro-shift re-weighting: the Gatherer digest carries a regime tag (`risk-on | neutral | risk-off`); T's prompt re-weights factor importance per regime — this is the "agents adapt to macro environment" mechanic in deployable form.
- **Cadence**: post-market only (16:45 ET) + Saturday deep review.
- **Risk personality**: stop 15% (inherits B's), max 8 positions, turnover target <25%/mo, only opens Tue/Thu (inherits B's day gate).

### 17.5 Rules-engine changes (`src/lib/arenaRules.js` — surgical)

- [x] 17.5.1 `LIMITS` gains `PER_MODEL: {S:{...}, P:{...}, T:{...}}` for stop/maxPositions/confidenceFloor/caps; shared invariants (long-only, 20% position cap, 5% cash floor, 3% daily breaker, 20% season reset) stay global and untouched. **(done — every lookup checks `PER_MODEL[model]` first and falls back to the legacy `A`/`B` fields/constants, so Season 1 behavior is byte-identical; verified by the full pre-existing test suite passing unchanged)**
- [ ] 17.5.2 Universe check v2 (see §18.1): from fixed-list membership → `SYMBOL_RE` + tradability screen (last close ≥ $3, avgDollarVol ≥ $5M from the payload's screen data; both enforced in code, not prompt). **(schema half done in Phase 2 — `arena-universe.json` v2 now carries real `tradability: {minLastClose, minAvgDollarVol}` floors, see §18.1.2 — but `validateOrder`/`arenaRun.js` don't read them yet; still deferred, now to Phase 3, since it needs real per-symbol `avgDollarVol` flowing through the run payload, which is the API-gating layer's job)**
- [x] 17.5.3 New execution-policy module `src/lib/arenaExec.js` (pure, tested): order slicing (orders > 10% of book equity split across the day's remaining windows), participation cap vs avg volume, slippage model upgraded from flat tier to `f(orderValue, avgDollarVol)` square-root impact curve. `simulateFill` calls it. **Honest note for the page copy: "RL-inspired execution policy (tuned offline), not a trained agent."** **(done — `sliceOrder`/`capByParticipation`/`impactSlippageBps`/`planExecution` all pure + tested; `simulateFill(order, model, execOpts)` calls `impactSlippageBps` only when `execOpts.avgDollarVol` is supplied — no existing caller passes it yet, so A/B fills are unchanged; dormant until the Phase 2 digest pipeline supplies real volume data, per the module's own header comment)**
- [x] 17.5.4 `arenaRun.js`: accept model keys S/P/T; `exitBy` sweep for P; `signals.length>=2` gate for T; season-2 bootstrap path (archive S1, seed 3×$10k). **(done — `BOOKS = ['A','B','S','P','T']`; new `checkExitBySweep()` in arenaRules.js wired into the run loop right after the stop-loss sweep, a no-op for any position without `exitBy`; Model T's `signals.length>=2` gate lives in `validateOrder`; new `bootstrapSeason2()` in arenaRun.js is pure/tested but NOT invoked against `public/arena-ledger.json` — that flip is Phase 4 per §20, after data/pipeline/API work lands and is dry-run)**
- [x] 17.5.5 Tests first (CLAUDE.md §4): extend `tests/arenaRules.test.js` + new `tests/arenaExec.test.js`, `tests/arenaFeatures.test.js` — write failing tests for every new limit before implementing. **(done — 815/815 vitest passing site-wide, up from 753; every new PER_MODEL limit, the T signals gate, the exitBy sweep, and bootstrapSeason2 each have a dedicated rejecting/accepting test; `npm run typecheck` clean; `npm run build` clean (alt-outDir workaround for the pre-existing sandbox EPERM, same as Parts 1-3); `check-no-new-important.mjs` and `check-bundle-budget.mjs` both green, arena chunk 41.3kB/300kB)**

### 17.6 Multi-agent pipeline — roles → concrete artifacts

One agent = one scheduled run with one prompt section; hand-offs are committed JSON (auditable, replayable, diff-able — no hidden shared state):

| Agent | Runs at | Reads | Writes |
| --- | --- | --- | --- |
| Gatherer | 08:00 ET | web, EDGAR, quotes | `arena-digest-input.json` (news digest, regime tag, screen data, riskOff flag) |
| Analyst S/P/T | window times (§19.1) | digest + own ledger slice + features | `run-input.json` proposal per book |
| Risk Assessor | same run, code | proposal | accept/reject via `arenaRules.js` (already exists — the "agent" is deterministic code, deliberately) |
| Executioner | same run, code | accepted orders | ledger mutation via `arenaExec.js` fill sim |
| Reviewer | 16:45 ET + Sat | all books, predlog | review_zh/en, metrics, `arena-picks.json` for tomorrow |

---

## 18. Task 2 — UI & data architecture refactor (`arena.html`)

### 18.1 Data files (all validated in `scripts/validate-data.mjs`, CI-gated)

- [x] 18.1.1 **NEW `public/arena-picks.json`** — the product of the daily pipeline and the page's new spine:
```json
{
  "date": "2026-07-23", "generatedAt": "...", "regime": "risk-on",
  "models": {
    "S": [{ "sym": "NVDA", "side": "long", "confidence": 0.78,
            "entry": 182.4, "stop": 167.8, "target": 199.0,
            "thesis_en": "…", "thesis_zh": "…", "signals": ["8-K", "sentiment+0.6"] }],
    "P": [ … ], "T": [ … ]
  },
  "quoteAllowlist": ["NVDA", "…"]   // derived: picks ∪ open positions ∪ SPY/QQQ/SMH — the ONLY symbols the page auto-fetches
}
```
- [x] 18.1.2 `arena-universe.json` v2: `mode: "market"` + `exclusions` + tradability floors + benchmarks; the fixed symbol list retires to `arena-universe-s1.json`. `validate-data.mjs` updated for both shapes. **(done — real S&P 500 constituent list, 503 symbols across all 11 GICS sectors, fetched from Wikipedia 2026-07-23 + SPY/QQQ/SMH benchmarks = 506 `symbols`; documented in the file itself as an honest "S&P 500 as full-market proxy" choice, not literally every NYSE/NASDAQ ticker — see the file's own `note_en`/`source_note_en`. Season 1's 30-symbol list archived byte-for-byte at `arena-universe-s1.json`. New `src/lib/validateArenaUniverse.js` validates the v2 shape only — v1/S1 stays unvalidated/frozen, matching how arena-ledger.json/arena-predlog.json are already excluded)**
- [x] 18.1.3 `arena-ledger.json`: `models: {S,P,T}`; Season-1 file archived as above; `version` bumped; frontend must not assume exactly two models (§18.2.3). **(done — `scripts/bootstrap-season2.mjs` (new, idempotent CLI) ran once: archived Season 1 (day 11, 10 trades) byte-for-byte to `public/arena-ledger-s1.json`, then wrote a fresh Season 2 ledger to `public/arena-ledger.json` — `season:2, day:0`, `models:{S,P,T}` each `{startEquity:10000, cash:10000, equity:10000, positions:[], trades:[], ...}`. `bootstrapSeason2()` also gained optional `note_en`/`note_zh` overrides. `arenaAutopilot.js` was generalized to N models — see §18.2.3 — before this flip, so the frontend never assumed exactly two)**
- [x] 18.1.4 **NEW `public/arena-runlog.json`** — append-only run archive: `{runs: [{date, window, model, status: done|missed|queued, ordersProposed, ordersFilled, note}]}`. This is both the audit trail and the offline-catch-up source (§19.3). **(done — `src/lib/validateArenaRunlog.js` enforces the `(date, window, model)` uniqueness invariant §19.3.1 depends on; one real dry-run day written, see §20 step 2 below)**
- [x] 18.1.5 **NEW `public/arena-daily-digest.json`** — end-of-day summary for the notification feature (§19.4): what each book did, P&L, misses, tomorrow's picks count. **(done — `src/lib/validateArenaDigest.js`; one real dry-run day written)**

### 18.2 `arena.html` + page modules

- [x] 18.2.1 **Watchlist → "Today's Recommended Trades"**: `#taWatch` chips row is replaced by a picks board (new `src/pages/arenaPicks.js`): grouped by model (S/P/T color-coded to match their equity-curve colors), each card = sym, side, confidence bar, entry/stop/target ladder, thesis (en/zh via existing `data-en/data-zh` i18n), signals tags. Clicking a pick loads the existing TA panel (`arenaTech.js` `select()` — reuse, don't rewrite). **(done — new `#picksDash` section in `arena.html` between `.hero` and `.ta`; `arenaPicks.js` renders 3 columns from `arena-picks.json`, empty-state "no new position today" per book, date/regime chips + a stale-pool amber banner when the picks date isn't today. Card click/Enter dispatches `arena-pick-select` CustomEvent (not a direct import — same decoupled pattern as `afflatus-lang`); `arenaTech.js` listens and calls its existing internal `select()` unchanged. Old `#taWatch`/`renderWatch()`/`arena-universe-s1.json`-as-chip-source machinery fully removed from `arenaTech.js` and its CSS, since the picks board now owns that role)**
- [x] 18.2.2 Search stays but is gated: searching a symbol **not** in `quoteAllowlist` renders the panel shell with a lock state — "outside today's pool — admin unlock to fetch live data" — instead of firing `/api/quote`. Unlock flow in §18.4. **(done — search bar untouched under a relabeled "Search Any S&P 500 Ticker" header; gated symbols render the existing 🔒 lock message plus the new inline unlock form from §18.4.3)**
- [x] 18.2.3 `arenaAutopilot.js`: generalize from hardcoded `#apModelA/#apModelB` to N panels rendered from `ledger.models` keys; chart draws one line per model + SPY/SMH dashes (Part 1's viz tokens/tooltip already generalize); legend from the same loop. Section subtitle and hero `brief` copy rewritten for three books + full-market universe ("-inspired" wording per §16.2). **(done — `#apModels` container populated dynamically per model key, `MODEL_COLOR`/`MODEL_LABEL` maps cover S/P/T (and legacy A/B), chart/legend/tooltip all loop over `Object.keys(models)`; hero `.brief` and header subtitle rewritten for "three simulated LLM ledgers... trade the full S&P 500"; `.ap-models` CSS switched to `auto-fit(minmax(260px,1fr))`)**
- [x] 18.2.4 Footer disclaimer updated: new data sources (EDGAR), three books, unchanged "no real money" promise. **(done — footer now says "three simulated $10,000 ledgers (S/P/T)" and mentions the admin-gated live-data policy; "no real money, no real orders" promise kept verbatim)**
- [x] 18.2.5 Out of scope (design.md red lines, same as Part 1 §3.3): `#bgCanvas`, palette, fonts, page-turn shell, briefing modal. **(respected — none of these touched)**

### 18.3 Frontend fetch budget (the actual optimization)

- [x] 18.3.1 On load: fetch static JSONs (free — same-origin, CDN-cached) → render picks + ledgers with **zero** API calls. **(done — `arenaPicks.js` and `arenaAutopilot.js` boot loaders only fetch `/arena-picks.json` and `/arena-ledger.json`; no `/api/*` call happens until a symbol is selected)**
- [x] 18.3.2 Live quotes: only `quoteAllowlist` symbols, only while market open (existing clock logic), **only for the symbol currently selected in the panel** — a pick card shows plan-time entry/stop/target until clicked (matches Part 1's lazy-render ethos). **(done for the "selected panel only" part — `fetchQuote`/`fetchHistory` fire only from `select()`, never speculatively. NOT done: no periodic 60s poll loop exists for the open panel — this is a pre-existing gap in `arenaTech.js` predating Part 4, not something this phase added or was asked to add; flagging honestly rather than silently narrowing scope)**
- [x] 18.3.3 History (`/api/history`): only on panel open for allowlisted symbols; server cache already 1h (`s-maxage=3600`) — keep. **(untouched — verified by diff, `Cache-Control` header unchanged)**
- [x] 18.3.4 Everything else = gated (renders from static JSON or shows lock state). No speculative prefetch. **(done — the only two live-data call sites, `fetchHistory`/`fetchQuote`, both go through the allowlist gate; no other network calls exist)**

### 18.4 API layer — allowlist + admin unlock

- [x] 18.4.1 `api/quote.js` / `api/history.js` v2: before the upstream fetch, resolve the day's allowlist — module-level cached fetch of `https://feida.au/arena-picks.json` (TTL 5 min; functions can't read `public/` from their bundle, self-fetch is the simple route). Symbol in allowlist → proceed as today. Not in allowlist → require admin header. **(done, and Phase 4 tightened it exactly as flagged: `resolveAllowlist({picks})` is now picks-only — the Phase 3 picks∪universe union was a deliberate temporary safety measure documented in its own header comment, kept only until the picks board (§18.2.1) shipped as the primary no-key browsing surface. Both API files simplified to fetch only `arena-picks.json` (no longer also fetching `arena-universe.json`, since it's no longer consulted). `tests/arenaAccess.test.js` rewritten to assert picks-only behavior. Self-fetch uses `req.headers.host` for same-origin correctness on preview deployments, falling back to `feida.au` only if that header is somehow absent. Fetch failures degrade to an empty allowlist — `resolveAllowlist` never throws.)**
- [x] 18.4.2 Admin check: header `x-arena-key`, constant-time compare (`crypto.timingSafeEqual`) against `ARENA_ADMIN_KEY` env var (Vercel → Settings → Env). Missing/wrong → `403 {error:'gated', hint:'symbol outside today\'s pool'}`. No token/JWT machinery — one shared secret over HTTPS is proportionate for a quota gate (§16.5); revoke = rotate env var. **(done — `checkAdminKey()` fails closed in every edge case: no env var set, no header sent, or a length mismatch all return `false` rather than throwing or granting access. `ARENA_ADMIN_KEY` is NOT yet set in Vercel — the feature is wired but inert until you add it under Project → Settings → Environment Variables. Response body/status match the spec exactly.)**
- [x] 18.4.3 Frontend unlock: lock state (§18.2.2) opens a minimal password prompt; on success key is held in `sessionStorage` (`afflatus:arenaKey`) and sent on subsequent gated requests; a small "ADMIN" chip appears in `.strip`. Wrong key → inline error, no retry lockout client-side (the per-IP rate limit already covers brute-force economics). **(done — the lock message now includes an inline `#taUnlockForm` (password input + Unlock button) instead of just text; submitting stores the key via `sessionStorage['afflatus:arenaKey']` and immediately retries the gated symbol. `arenaKeyHeaders()` attaches `x-arena-key` to every `/api/quote`/`/api/history` call once a key is stored. `#adminChip` (🔓 ADMIN UNLOCKED) appears in the hero `.strip` when a key is held; click → `confirm()` → clears it and re-locks. A rejected key shows "that admin key was not accepted" instead of the generic gated message, without any client-side lockout — the existing per-IP rate limit is the only throttle, exactly as specified)**
- [x] 18.4.4 Existing per-IP rate limits stay on both endpoints (they protect the upstream quota even from an admin session left open). **(untouched — verified by diff, both files' `checkRateLimit`/`RATE_LIMIT`/`hits` blocks are byte-identical to before)**
- [x] 18.4.5 The `SYMBOL_RE` + params validation from D1 stays untouched. **(untouched — verified by diff)**

**Incidental fix bundled into Phase 2** (superseded by Phase 4): expanding `arena-universe.json` to the full S&P 500 would have silently blown up `arena.html`'s watchlist chip row from 30 curated chips to 506 — noticed and fixed before shipping, via a temporary `arena-universe-s1.json`-backed chip row bridge. Phase 4's picks board (§18.2.1) now replaces that chip row entirely, so the bridge itself (`state.watchlist`/`renderWatch()`/`#taWatch`) has been removed from `arenaTech.js`; `arena-universe-s1.json` remains on disk only as a frozen historical record of Season 1's fixed trading domain (paired with `arena-ledger-s1.json`), no longer read by any page.

**Action needed from you**: set `ARENA_ADMIN_KEY` in Vercel → Project → Settings → Environment Variables (any strong random string) to activate admin unlock server-side. Until then the gate still works (allowlisted symbols load fine; non-allowlisted ones correctly 403), it just means nobody — including you — can use `x-arena-key` to bypass it yet, since there's no matching secret to compare against.

### 18.5 Quota budget (why this fits free tiers)

| Consumer | Symbols | Frequency | Worst-case/day |
| --- | --- | --- | --- |
| Page live quotes | ~10–20 allowlisted | 60s poll, market hours, viewport-gated, `s-maxage=12` shared across visitors | ≪ 60/min Finnhub cap |
| Pipeline quote snapshots | allowlist + candidates (~40) | 4 windows | ~160 calls |
| Twelve Data history | P's candidates (~10 × 5-min) + panel opens (1h cached) | daily | ~100–200 of 800 credits |
| Admin exploration | arbitrary | manual | bounded by rate limit + password |

---

## 19. Task 3 — automation, scheduling, offline handling

### 19.1 Run windows (all times ET; runner must evaluate in `America/New_York`, never fixed UTC — DST)

| Window | ET | Agent runs | Writes/commits |
| --- | --- | --- | --- |
| Pre-market gather | 08:00 Mon–Fri | Gatherer; skip on NYSE holidays (`nyse-holidays-2026.json` already in repo) | digest-input |
| Picks publish | 09:00 | Analyst S pre-screen + Reviewer assemble picks | `arena-picks.json`, `arena-news.json` |
| Open window | 10:05 | Analysts S + P propose → settle | ledger, runlog |
| Late window | 15:30 | Analysts S + P propose → settle | ledger, runlog |
| Post-market | 16:45 | Analyst T propose → settle; Reviewer: mark-to-market all, metrics, digest | ledger, runlog, daily-digest, predlog |
| Weekly review | Sat 10:00 | Reviewer deep pass (existing weekly path in `arenaRun.js`) | reviews, prompt-version bumps |

### 19.2 Runner architecture — decision needed from you

Two viable runners for the LLM steps; the deterministic settle step (`apply-arena-run.mjs`) runs wherever the proposal was produced:

- **(a) Cowork scheduled tasks on your Mac** (current pattern, e.g. push-arena-news). Pros: zero new infra, WebSearch built in, no API billing. Cons: machine asleep = missed window (why §19.3 exists).
- **(b) GitHub Actions cron + Anthropic API**. Pros: always-on, ET-correct via `TZ`, commits natively. Cons: API token cost, needs a WebSearch substitute (Claude API web-search tool), secrets in GH.
- **Recommended: hybrid.** (a) for all LLM windows now — catch-up logic makes misses harmless; (b) as a later migration once the pipeline is stable, starting with the Gatherer (most mechanical). Structure every prompt against the same `run-input.json` contract so the runner is swappable without touching the engine.
- [x] 19.2.1 Decide (a)/(b)/hybrid before implementing §19.3's runner-specific parts. **(decided 2026-07-23 — hybrid, all Cowork scheduled tasks for now per the user's explicit choice; Gatherer is the natural first candidate for a later GitHub Actions migration since it's the most mechanical step, but that migration is not part of this phase)**

### 19.3 Idempotency & offline catch-up (design center, not an edge case)

- [x] 19.3.1 **Run identity** = `(etDate, window, model)`. `arenaRun.js` already tracks `lastRunDate`; extend to per-window in the runlog. Re-running a completed window is a no-op (checked before settle) — makes catch-up and manual retries safe. **(done — new `src/lib/arenaReconcile.js`'s `runIdentity()`/`hasCompletedRun()`/`upsertRunlogEntry()`, wired into `scripts/apply-arena-run.mjs`: every run-input now requires a `window` field, the script checks `hasCompletedRun` before settling and no-ops if already done, and writes the runlog entry itself on success. Manually verified end-to-end: same run-input twice, second run cleanly no-ops, ledger/runlog byte-identical after)**
- [x] 19.3.2 **Catch-up on wake**: every run starts with `reconcile()`: walk NYSE calendar from last runlog entry to now; for each missed window append `{status:'missed'}` to runlog. Missed *proposal* windows are **not** retro-traded — no hindsight trades, ever (the honest rule; a backfilled "would have bought at 10:05" is fiction). Missed *mark-to-market* is backfilled from Twelve Data EOD closes so equity curves stay continuous, entries flagged `late:true`. **(done — new `scripts/reconcile-arena-run.mjs` CLI, called as Step 1 of every Arena scheduled task; uses `arenaReconcile.js`'s pure functions for the diff/decision logic, the calling SKILL.md does the actual EOD-price fetch + `apply-arena-run.mjs ... "late":true` call since that needs real network access the reconcile script deliberately doesn't have. Manually verified with a seeded 3-day gap: correctly recorded 24 missed entries and flagged all 3 models needing a late mark)**
- [x] 19.3.3 **Outbox queue for offline commits**: settle writes results normally; if `git push` fails (no network), the run payload+result is copied to `scripts/outbox/<runId>.json` (gitignored). Next successful run flushes the outbox first (replay-safe via 19.3.1). Replaces the current push-arena-news.sh "hope the push works" pattern; that script gets the same treatment. **(done for the Arena Autopilot path — new `scripts/publish-arena-run.sh` (git add/commit/push for ledger+runlog together, flushes any outbox backlog on successful push) + `scripts/queue-arena-outbox.mjs` (writes the audit record on push failure — settlement itself already succeeded and is safe on disk, only the git sync is queued). NOT applied to push-arena-news.sh itself — that script has no settlement step to protect (it's a single static-JSON commit, not a ledger mutation), so the "hope it works" pattern there is lower-stakes; left untouched per surgical-changes discipline since it wasn't what this task's risk was actually about)**
- [x] 19.3.4 Stale-data honesty on the page: if `arena-picks.json` date < today (pipeline down), the picks board renders a dimmed "yesterday's pool — pipeline offline" banner instead of pretending it's current. Ledger chip already shows `updated`. **(done — already shipped in Phase 4! `arenaPicks.js`'s `render()` compares `d.date` against `todayEtDateStr()` and toggles a `.pick-stale` amber banner when they differ; discovered already-complete while doing Phase 5's §19 pass, no new code needed)**

### 19.4 Notification / "while you were away" summary

- [x] 19.4.1 Post-market Reviewer commits `arena-daily-digest.json` (§18.1.5); deploy makes it live. **(done — `arena-autopilot-b-post`'s rewritten Phase 2 Step 4 has the Reviewer write it fresh every post-market run, published via `push-data.sh` in Step 5)**
- [x] 19.4.2 Push channel (pick one, both cheap): (i) [ntfy.sh](https://ntfy.sh) topic — one `curl` in the post-market task, free, iOS/Android apps; (ii) email via the task itself. **Recommended: ntfy.sh** — no credentials in the repo, one line. **(done — user chose ntfy.sh; a private topic string was generated and is wired into `arena-autopilot-b-post`'s Step 6 `curl` call. The actual topic string is deliberately NOT written into this file or any other repo file — this repo pushes to a public-readable GitHub remote, and an ntfy topic is a "know-it-to-read-it" secret, same class of thing as ARENA_ADMIN_KEY; committing it would let anyone who reads git history subscribe to your daily P&L push. It lives only in `/Users/feida/Claude/Scheduled/arena-autopilot-b-post/SKILL.md`, which is outside git — see that file, or the chat where it was generated, to find the actual topic and subscribe via the ntfy app. Rotate it any time by editing that SKILL.md if it ever leaks.)**
- [x] 19.4.3 On-site: arena page compares digest date vs `localStorage` last-seen; unseen digest → quiet toast ("3 trades settled while you were away · P +0.8%") linking to a digest drawer. Toast styling follows Part 1 tooltip tokens; no new palette. **(done — new `src/pages/arenaDigest.js` + `#digestToast`/`#digestDrawer` in arena.html; toast reuses `--viz-tip-*` tokens, no new colors introduced. `localStorage['afflatus:arenaDigestSeen']` tracks the last-read digest date)**
- [x] 19.4.4 If the day had queued/offline runs (outbox flushed late), digest includes them under a "delayed" section — the queue is *visible*, not silent. **(done — `arena-daily-digest.json`'s `delayed[]` array (schema tightened in `validateArenaDigest.js` this phase: each entry needs date/window/model/note) is populated by the post-market task from that day's runlog `missed`/`late:true` entries; `arenaDigest.js`'s drawer renders a dedicated "⏳ Delayed" section when non-empty)**

### 19.5 Prompts — `prompts/arena-autopilot.md` → v5

- [x] 19.5.1 Rewrite for three books (S/P/T personalities per §17.2–4), same byte-fixed System-Prompt discipline, same "you are STATELESS, payload is the world" rule, hard-rules section updated to PER_MODEL limits. Gatherer/Reviewer get their own sections with output JSON schemas. **(done — appended as "PART 2 — V5" in `prompts/arena-autopilot.md`, byte-fixed blocks for Gatherer + Analyst S/P/T + Reviewer (post-market/weekly), a shared run-payload shape, and a Chinese summary; V4 (Model A/B) is left completely untouched and stays the ACTIVE prompt — the file's new header banner says so explicitly so nobody deletes V4 before Season 1 is actually retired)**
- [x] 19.5.2 Keep the V4 rule that prompts restate limits only to reduce wasted proposals — code remains the enforcer. **(done — every V5 hard-rules block says the risk engine is the real enforcer, same phrasing pattern as V4)**

---

## 20. Implementation order (each phase independently shippable, CI-green)

1. **Engine** (§17.5): tests → `arenaFeatures.js`, `arenaExec.js`, PER_MODEL limits, S/P/T in `arenaRun.js`, season-2 bootstrap. No UI change yet.
2. **Data + pipeline dry-run** (§18.1, §19.5): new JSON schemas + validators; run the pipeline manually for 2–3 days writing real `arena-picks.json` while the page still shows A/B — validates the loop before anyone sees it. **(schemas/validators done + ONE real dry-run day written 2026-07-23, grounded in actual news gathered via web search — see §18.1 checkmarks. Not yet 2-3 days; the page still shows A/B, untouched, exactly as planned. Continuing the dry-run for more days, or moving straight to Phase 3, is the natural next step.)**
3. **API gating** (§18.4): ship allowlist + admin key while the page still auto-fetches only universe symbols (strictly less traffic than today; safe to ship early). **(done — see §18.4 checkmarks. Shipped as picks∪universe rather than picks-only, specifically to keep this step non-breaking before Phase 4's UI exists — see the note under 18.4.1.)**
4. **UI pivot** (§18.2–18.3): picks board, N-model autopilot panels, lock states, copy. Flip season 2 live. **(done 2026-07-23 — see §18.1.3/§18.2/§18.4.3 checkmarks)**
5. **Automation hardening** (§19.1–19.4): window schedule, reconcile/outbox, digest + ntfy. **(done 2026-07-23 — see §19 checkmarks. Five scheduled tasks created/rewritten (`arena-picks-publish`, `arena-open-window`, `arena-late-window`, `arena-autopilot-b-post`'s Phase 2, `arena-weekly-review`) but left DISABLED pending a manual "Run now" verification pass — see §21's last item. Season 2's three books remain static at day 0 until that first real run happens.)**
6. **Verification** (§21) after every phase; full pass at the end.

## 21. Verification (Part 4 — blocking)

- [x] `npx vitest run` green including new arenaExec/arenaFeatures/arenaRules-v2 suites; every §17.5 limit has a rejecting test. **(done — 66 files / 869 tests passing as of the Phase 4 verification pass, up from 815 at the end of Phase 1; `tests/arenaAccess.test.js` rewritten for the picks-only tightening)**
- [x] `node scripts/validate-data.mjs` covers picks/runlog/digest/universe-v2 shapes; CI red on malformed pipeline output. **(done since Phase 2, re-verified green this pass — 12 files checked, all OK)**
- [x] Replay test: run `apply-arena-run.mjs` twice with the same run-input → byte-identical ledger (idempotency, 19.3.1). **(done — manually verified this phase: a throwaway run-input (book S, window weekly-review, a future dummy date so it can't collide with real data) run twice via `apply-arena-run.mjs`; run 1 settled normally, run 2 printed the no-op message and left `arena-ledger.json`/`arena-runlog.json` untouched. Real files were backed up before and restored after — no lasting change to the actual ledger)**
- [~] Offline drill: unplug network, run a window → outbox entry created; reconnect, next run → flushed, runlog shows `queued→done`, no duplicate fills. **(partially done — the outbox mechanics themselves are verified: `queue-arena-outbox.mjs` writes a well-formed `{runId,queuedAt,commitMessage,payload,result}` record, and `publish-arena-run.sh` flushes/clears any backlog on the next successful push. What's NOT been verified is the actual "network down mid-push" trigger path, since a sandbox can't safely simulate that against your real GitHub remote — this needs a real drill on your Mac, e.g. temporarily disabling networking during a manual "Run now")**
- [x] Missed-window drill: skip a day, run reconcile → `missed` entries + `late:true` mark-to-market, equity curve continuous, zero retro-trades. **(the missed-entry half is done and manually verified — seeded a runlog with a 3-trading-day gap, ran `reconcile-arena-run.mjs`, got exactly 24 `missed` entries (8 expected windows × 3 days) and all three models correctly flagged in `lateMarkNeeded`; confirmed zero orders are ever proposed for a missed window, by construction (`buildMissedEntry` hardcodes `ordersProposed:0`). The late-mark-to-market HALF (fetching real EOD closes and calling `apply-arena-run.mjs ... late:true`) is written into the scheduled tasks' Step 1 but hasn't fired for real yet — that's part of the pending manual "Run now" verification)**
- [ ] Quota audit: one full simulated day of page + pipeline calls counted against §18.5 table; Finnhub < 60/min at all times, Twelve Data < 800/day. **(not done — needs a live/staged traffic simulation; realistically only measurable once the scheduled tasks are enabled and run for real, deferred to after the manual verification pass)**
- [x] Gate check: non-allowlisted symbol without key → 403 + lock UI; with key → data; key rotation invalidates immediately; `git grep` proves the key exists nowhere client-side. **(logic verified — `resolveAllowlist`/`checkAdminKey`/`isSymbolAllowed` all unit-tested for exactly these cases, and the frontend unlock form + `x-arena-key` header wiring is in place end-to-end. `grep -rn ARENA_ADMIN_KEY src/ public/ arena.html` finds only the env-var *name* in a code comment, never a key value. Can't be verified live in production yet since `ARENA_ADMIN_KEY` isn't set in Vercel — see the top-of-Part-4 status banner)**
- [x] `npm run build` + bundle budget green (picks board is small; no new deps — no charting/NLP libraries snuck in). **(done — `arena` chunk 45.6 kB/300 kB budget; `npm run typecheck` and `node scripts/check-bundle-budget.mjs` both clean; sandbox's `dist/` write-permission quirk worked around via `--outDir` same as every prior phase)**
- [x] Copy audit: every claim on the page says simulated/"-inspired"; disclaimers updated; zh/en parity via existing i18n attributes. **(done — meta description, header subtitle, hero brief, footer disclaimer all rewritten for "three simulated LLM ledgers" over "the full S&P 500"; every new/changed string has a matching `data-zh`; no HFT/real-money claims introduced)**
- [x] design.md compliance: palette/fonts/shell untouched; Part 1 viz tokens reused for all new chart/tooltip/toast surfaces. **(done — no `:root` token edits, no new fonts; picks board and admin-unlock UI reuse existing `.chip`/`.btn`/`--acid`/`--cyan`/`--magenta` tokens rather than inventing new ones; design.md/tech.md updated with the new patterns — picks board, gated-state unlock form — per this session's archival work)**
- [ ] **Manual "Run now" verification (blocking before enabling the Phase 5 scheduled tasks)**: `arena-picks-publish`/`arena-open-window`/`arena-late-window`/`arena-autopilot-b-post`/`arena-weekly-review` all exist but are `enabled:false` as of 2026-07-23 — none of this phase's automation has actually fired yet against the live Season 2 ledger. Before flipping any of them to `enabled:true`, run each once manually via "Run now" (cheapest/lowest-risk first: `arena-picks-publish`, since it never touches the ledger) and confirm: the published JSON passes `validate-data.mjs`, `apply-arena-run.mjs` settles without error, the runlog/ledger diffs look sane, and the git push actually lands on `origin/main`. Only enable a task once its own dry run looks right — do not flip all five at once on faith.

## Done (Part 4) =

Arena runs three distinct AI books — ORACLE (sentiment/event), PULSE (intraday structure), ATLAS (alt-data fusion) — over the full US market through a multi-agent propose→risk→settle pipeline; the page opens on "Today's Recommended Trades" and spends API quota only on that pool unless an admin unlocks more; scheduled windows execute pre-market/intraday/post-market with idempotent runs, offline outbox + catch-up, and a daily digest pushed to you and surfaced on-site — all still simulated, code-enforced, and honest about what it is.

---

# PART 5 — horoscope.html ZWDS Beta Suite: Bazi Schema + Daily Fortune v2 (日运) · 合盘 Cross-Chart Matrix · Bazi×ZWDS Deep Integration

> **Source spec**: `zwds-astrology-specification.md` (Ni Hai-hsia / 天纪-derived ZWDS architecture, uploaded 2026-07-23). Copy it into `rfcs/` as the reference document. It is a *reference*, not SSOT for math — see §22.1.
> **Scope decision (confirmed 2026-07-23)**: Yang Zhai sectors (阳宅方位), `humanActions` (Junzi/Xiaoren) and the Heaven-Earth-Man 33.33-point formula (spec §3.3) are **deferred to Beta 2**. The `ZWDSChartMatrix` output schema keeps the hooks (fields exist, unused) so Beta 2 is additive, not a migration.
> **All new features ship behind a visible "Beta" badge on horoscope.html.** Entertainment-only banners and the wording law (§22.4) apply to every new string.

## 22. Assumptions & reality mapping (read first — most of this suite already exists)

The spec describes a greenfield build. This repo is **not** greenfield: `src/lib/` already contains a verified calendar/astrology stack. PART 5 is a **gap-closure overhaul**, not a rewrite. Anything below marked SHIPPED must not be re-implemented.

| Spec / task item | Repo reality | Status |
| --- | --- | --- |
| Four Pillars from true sexagenary cycle (`birthPillars`) | `src/lib/bazi.js` — real solar-term (节气) boundaries via Meeus solar longitude, 晚子时 convention, day-cycle pinned to two published anchors (`tests/bazi.test.js`) | **SHIPPED** — gap: no spec-§1.1-shaped JSON export |
| Solar→lunar conversion | `src/lib/lunar.js` (1900–2100, tested vs independent impl) | **SHIPPED** |
| Daily fortune from the real day pillar (日柱), no RNG | `src/lib/horoscopeEngine.js` `dailyFortune()` — day's actual ganzhi × day master, deterministic; seeded PRNG picks *phrasing only* | **SHIPPED** — gap: only day-master element vs day element; no stem ten-god, no branch 合冲刑害 vs the full natal chart (§23.3) |
| ZWDS 12-palace chart (命宫/身宫, 五行局, 14 majors) | `src/lib/ziwei.js` — verified **400/400 vs iztro** | **SHIPPED** — gaps: no 四化, no auxiliary/sha stars, no brightness, no 大限 ages, no §1.2 matrix export (§25.1) |
| 三方四正 scoring, sibling-palace rule, 流年倒推 | nothing | **NEW** (§25.2–25.4) |
| Two-person bazi/ziwei/western synastry | `horoscopeEngine.synastry()`, `synastryModes.synastryZiwei()` (life-palace branch relation), `synastryAstro.js` | **SHIPPED** — gaps: no full 4×4 cross-chart branch matrix, no side-by-side dual-chart UI (§24) |
| Branch relation tables (合/冲/刑/害/破) | `ziping.branchRelations()` (single chart), `dayun.pairRelations()` (one branch vs list), 破 table in `dayun.js` | **PARTIAL** — need a chart-vs-chart pairwise form (§24.1) |
| 大运/流年/犯太岁 (bazi side) | `src/lib/dayun.js` | **SHIPPED** — feeds synthesis rule R3/R4 (§25.5) |
| Stateless REST backend (spec §4.1) | Repo discipline is **fetch-free, client-side pure functions** (`horoscope.js` header, `arenaRules.js` pattern) | **DECISION: no backend.** Pure ESM modules + vitest satisfy the spec's actual requirement (stateless, functional, ephemeris-true). Nothing here needs a server |

### 22.1 Spec-vs-repo conflicts — resolved in favor of verified repo code

1. **Branch indexing**: spec anchors 寅=0; repo uses the standard 子=0 with 寅 at index 2. Spec's 命宫 `(month−1−hour)%12` ≡ repo's `mod(2+(m−1)−hb,12)`; spec's 天府 `(10−zw)%12` ≡ repo's `mod(4−zw,12)`. Same math, different origin. **Keep 子=0 everywhere**; write the equivalence into `ziweiDeep.js`'s header so nobody "fixes" it later.
2. **紫微 placement**: spec §2.3 pseudocode and `ziwei.ziweiBranch()` are equivalent formulations; the repo one is pinned by the 400-chart iztro comparison. **Repo wins.** Do not touch `ziwei.js`.
3. **Palace naming**: spec says 交友宫, repo says 仆役 (same palace). Keep 仆役 internally, render 交友 in zh UI copy if desired — display-only.
4. **Spec §1.1 marks `yangZhaiSectors`/`humanActions` as `required`** — our Beta-1 input schema makes them optional-absent (deferred, see banner).
5. **五行局 derivation**: spec §2.2 uses a year-stem × 命宫-branch lookup table; repo derives 局 from the 命宫 stem-branch's nayin element (五虎遁 + 纳音). These are two encodings of the same mapping — the repo path is the one verified vs iztro. **Repo wins**; add one test asserting the spec's table rows reproduce (§27).

### 22.2 Decision needed from you (default chosen, flag if you disagree)

**"Today" for the daily pillar**: `horoscope.js` `todayStr()` uses the *viewer's local civil date* (matches the existing check-in streak). Mainstream almanac practice reads the day pillar for your local date. **Default: keep viewer-local date** (a Perth user and a Sydney user can legitimately see different day pillars near midnight). Alternative — normalize to Beijing/CST like `normalizeBirthToCST()` does for births — is one line if you prefer a single global "today". Either way the pillar comes from `dayPillar()` (pure JDN arithmetic = the true ephemeris day cycle); **`Math.random` remains banned from every fortune-math path** (§27 greps for it).

### 22.3 New-module map (all pure, all vitest-covered, no new deps)

| Module | Contents | Consumed by |
| --- | --- | --- |
| `src/lib/baziSchema.js` | spec-§1.1 `birthPillars` export/validate | share payloads, §25.6 matrix export |
| `src/lib/synastryBazi.js` | 4×4 cross-chart branch matrix + score | 合盘 UI (§24.2) |
| `src/lib/ziweiDeep.js` | 四化, aux/sha stars, brightness, 大限, §1.2 matrix, 三方四正, sibling rule, 流年 layer | palace-grid UI (§25.6), synthesis |
| `src/lib/deepSynthesis.js` | Bazi×ZWDS concordance rules R1–R5 | deep-analysis panel (§25.6) |

`ziwei.js`, `bazi.js`, `lunar.js`, `dayun.js`, `ziping.js` are **frozen** for this part except: export the internal branch pair tables from `ziping.js`/`dayun.js` that §24.1 needs (export-only lines, zero behavior change).

### 22.4 Wording law (blocking for every new string)

The spec's warning copy ("Extreme structural hazard!", "cardiac/respiratory incidents", "DO NOT INVEST OR EXPAND!") **violates the site's established wording law** (`synastryAstro.js`/`synastryModes.js`: *a pattern + a coping action, never a verdict*; no health claims, no financial directives — hard-learned in Part 4's copy audit). We keep the spec's **math** (thresholds, weights, flags) and rewrite its **copy**: e.g. 化忌-broken sibling palace renders as "this chart pattern favors running things solo — shared ownership reads as high-friction" — never "strictly prohibited". Every string bilingual via existing `data-zh` i18n.

---

## 23. Task 1 — Bazi schema alignment + Daily Fortune v2 (日运)

### 23.1 `baziSchema.js` — spec-§1.1 adapter (~40 lines)

- `toBirthPillars(chart)` → `{ year:'甲子', month:'丙寅', day:'…', hour:'…'|null }` from `computeBazi()` output; strings must match the spec regex `^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$`.
- `validateBirthPillars(obj)` → hand-rolled asserts (no ajv — no new deps), used by tests and by the share-link codec when ingesting.
- `todayPillars(dateStr)` → `{ day: '…' }` + stem/branch indices for today via `dayPillar()` — the single sanctioned entry point for "today's ganzhi" (both §23.3 and §25.4 import it; nothing else recomputes it).

### 23.2 `dailyFortune()` v2 — full 五行生克 upgrade (`horoscopeEngine.js`, surgical)

Current read = day-master element vs today's element (`elementRelation()`, line 30). v2 layers on, keeping the signature, the 8..96 clamp, the seeded phrasing banks, and every existing test:

1. **Stem channel**: today's stem vs natal day master → 十神 via `ziping.tenGodOfStem()`; map ten-god → domain emphasis (官杀→career, 财→wealth, 印→learning/backing, 食伤→expression, 比劫→peers/competition).
2. **Branch channel**: today's branch vs **all four** natal branches via the exported pair tables (§22.3) — 六合/三合/六冲/相刑/相害/相破 — weighted by pillar: day 0.4, year 0.25, month 0.25, hour 0.1 (hour term dropped when hour unknown, weights renormalized).
3. **Score composition**: element relation (existing) 50% + stem channel 25% + branch channel 25%; a 冲 on the natal day branch caps `overall` at 60 (a clash day never reads "excellent" — spec's restriction principle), a 六合 on the day branch floors it at 40.
4. Phrasing banks gain fragments keyed by ten-god and by strongest branch event, zh/en. Deterministic as before: same (birth, date) → identical output.

**Backward-compat**: existing `tests/horoscopeEngine.test.js` invariants (determinism, cross-day variation, cross-person variation, clamp) must pass unchanged; add new cases pinning one hand-computed 冲 day and one 合 day.

### 23.3 Daily Fortune module UI (`horoscope.js` + `horoscope.html`)

- The existing daily panel gains: today's full day pillar rendered as a pillar card (reuse `pillarCardsHTML()`, line ~296), the ten-god label, and a "why" strip listing the branch events (e.g. 午—子冲 on your day pillar) — the receipts, not just a score. Beta badge on the panel header.

## 24. Task 2 — 合盘 v2: cross-chart Earthly-Branch matrix + side-by-side UI

### 24.1 `synastryBazi.js` — the exact 地支相合相冲 algorithm (~120 lines)

```
crossBranchMatrix(pillarsA, pillarsB) →
  { cells: 4×4 [{ pa, pb, relations: ['六合'|'三合'|'六冲'|'相刑'|'相害'|'相破'...], w }],
    score: 0..100, combos: [...], clashes: [...] }
```

- **Tables** (import from `ziping.js`/`dayun.js` after the export-only change — do not duplicate): 六合 (子丑 寅亥 卯戌 辰酉 巳申 午未), 三合 pairs counted as半合 (申子辰/亥卯未/寅午戌/巳酉丑), 六冲 (i vs i+6), 相刑 (both directions, incl. 自刑), 相害, 相破 (`dayun.js`'s table).
- **Weights**: pillar-pair significance matrix — day×day 1.0 (the spouse axis), day×year .6, year×year .5, month×month .5, day×month .5, hour pairs .3, others .4. Relation values: 六合 +10, 半合 +6, 六冲 −10, 刑 −7, 害 −5, 破 −4, multiplied by pair weight, summed, sigmoid-squashed to 0..100 centred at 50.
- **Invariant (tested)**: `crossBranchMatrix(A,B).score === crossBranchMatrix(B,A).score` and cell (i,j) mirrors (j,i).
- Missing hour on either side → 3×4 / 3×3 matrix, weights renormalized (same discipline as `synastry()`).

### 24.2 Side-by-side dual-chart UI (`horoscope.html` + `horoscope.js`)

- New 合盘 layout: two full pillar-card columns (A = 关系册 "me", B = other — reuse `pillarCardsHTML()` verbatim per column), desktop side-by-side / mobile stacked, with the **4×4 matrix rendered as a grid between/below them** — cells color-coded (existing tokens only: harmony = `--cyan`-tinted, clash = `--magenta`-tinted, neutral = dim) with the relation glyph (合/冲/刑/害/破).
- Clicking a non-neutral cell draws an SVG connector line between the two physical pillar cards involved (same overlay technique as §10's star-map lines; no new lib).
- Below the matrix: the existing `synastry()` + `synastryZiwei()` + western `crossAspects()` panels remain untouched — this section *adds* the branch-matrix layer above them; nothing is removed.
- 关系册 (BOOK_KEY) flow unchanged: pick a saved person → dual chart renders.

## 25. Task 3 — ZWDS deep layer + Bazi×ZWDS synthesis

### 25.1 `ziweiDeep.js` part A — completing the spec-§1.2 matrix (input: `computeZiwei()` output; `ziwei.js` untouched)

1. **四化 (birth-year transformations)**: year stem → (化禄, 化权, 化科, 化忌) star table. ⚠ Known school variance on 庚/壬/戊 rows — **pin to iztro's table** (consistent with the harness that already validates `ziwei.js`) and document the choice in the header, same convention-footnote discipline as `ziping.js`.
2. **Auxiliary + sha stars** (spec star `level`s): 禄存/擎羊/陀罗 (year stem), 天马 (year branch trine), 左辅/右弼 (lunar month), 文昌/文曲 (hour branch), 火星/铃星 (year branch group + hour), 地空/地劫 (hour). Levels: `Lucky` (禄存 天马 左辅 右弼 文昌 文曲), `Sha` (擎羊 陀罗 火星 铃星 地空 地劫), majors = `Major`.
3. **大限 (Da Xian) ages**: first decade starts at 局数 (Water 2 → age 2, … Fire 6 → age 6); direction = 阳年男/阴年女 forward, else backward (mirrors `dayun.dayunDirection()` — assert agreement in tests); walk the 12 palaces from 命宫 assigning `startAge/endAge` (10y each).
4. **Brightness (庙旺得利平陷)**: 14-major lookup table, `brightness` field per spec. School variance is real here too — mark the field optional in our validator, pin one published table, footnote it.
5. **`toChartMatrix(z, deep, clientId)`** → the spec-§1.2 `ZWDSChartMatrix` JSON verbatim (incl. `isSelfPalace` from 身宫, `wuXing`/`polarization` per star, `transformation`). This is the export/interop surface; internal code keeps using the richer live objects.

### 25.2 三方四正 scoring engine (spec §3.1, exact weights)

`sanFangSiZheng(palaces, i)` → target + opposite `(i+6)%12` + trines `(i+4)%12`,`(i+8)%12`; scoring per spec: Sha star +3.0 clash, 化忌 +5.0 clash (**+5.0 again and `huaJiActive=true` when it sits in the opposing palace** — the spec's 2× rule), 化禄/权/科 +4.0 favorable. Returns the spec's `scoring_matrix` shape plus a 0..100 normalized score for UI/synthesis use.

### 25.3 Sibling-palace partnership rule (spec §3.2)

`partnershipRead(palaces)` — FALSE iff 兄弟宫 holds 化忌, or holds 七杀 together with any Sha star (exact spec condition). Copy per §22.4: solo-structure *pattern* language, never "prohibited". Renders as one card in the deep panel with the receipts (which star, which condition).

### 25.4 流年 layer + back-propagation (spec §3.4, capped)

- 流年命宫 = the palace whose branch equals the year's branch (`dayun.liunianPillar()` supplies the ganzhi); 流年四化 from the year stem re-using §25.1's table; year score = §25.2 over the 流年命宫 **with the annual transformations overlaid**.
- `flowingYearScan(deep, currentAge)`: exactly the spec's shape — look ahead ages +1/+2, `deceptiveBait` triggers when current ≥ 75 and any look-ahead < 20; returns defensive/aggressive stance scores (25/90 per spec). **Horizon hard-capped at 10 years** (spec §4.1.3) — enforced by a test, and it's cheap anyway (pure array math, no server).
- Copy per §22.4: "unusually bright year followed by a sharp dip — the pattern favors consolidating over expanding" — no ALL-CAPS financial commands.

### 25.5 `deepSynthesis.js` — the Bazi×ZWDS rules (the actual "deep integrated analysis")

Both systems are computed from the same birth instant; synthesis = structured agreement/disagreement, never averaging into mush. Rules (each emits `{verdict: 'reinforced'|'crosscurrent', receipts: [...]}`):

| # | Bazi input (exists) | ZWDS input (new) | Synthesis rule |
| --- | --- | --- | --- |
| R1 | 身强/身弱 from `ziPingAnalysis()` | 命宫 §25.2 score | Both strong → "reinforced self-direction"; strong bazi + broken 命宫 (or inverse) → crosscurrent copy naming both receipts |
| R2 | 用神 element (`ziPingAnalysis`) | 命宫 major stars' `wuXing` | 用神 element generated/matched by 命宫 stars → amplifier flag on R1; restricted → damper |
| R3 | current 大运 pillar (`computeDayun()`) | current 大限 palace + its §25.2 score | The two decade systems cover the same years: agreement tiers (both favorable / mixed / both adverse) drive the decade card's tone |
| R4 | 流年 犯太岁 (`taisuiRelation()`) | 流年宫 score + 流年四化 (§25.4) | Year card: 犯太岁 AND 化忌-hit 流年宫 → strongest caution tier; either alone → moderate; neither → 流年宫 score speaks |
| R5 | daily v2 relation + branch events (§23.2) | today's branch palace §25.2 score | Daily deep line: bazi day read × the palace today's branch lights up — the one place Task 1 and Task 3 meet |

Concordance principle (header-documented): **agreement sharpens copy, disagreement hedges it** — a crosscurrent never renders as a verdict, it renders as both receipts + a coping line (§22.4).

### 25.6 UI — 12-palace grid + deep panel (`horoscope.html` + `horoscope.js`)

- **Palace grid component** (spec §4.2): classic 4×4 ring (12 palaces around a 2×2 center box), 子-branch palace bottom-center, 午 top-center (spec's stated orientation, standard layout). Center box = 五行局, 命主 info, Beta badge. Each cell: palace name, branch+stem, stars with 四化 superscripts (禄权科忌), 大限 age range.
- **Click a palace → SVG 三方四正 overlay** arrows to its three linked palaces (spec §4.2.2) + that palace's §25.2 score breakdown in a side strip.
- **Warning states** (spec §4.2.3): 化忌-holding palaces get the existing amber/`--magenta` border treatment — reuse Part-1 viz tokens, invent nothing.
- **Deep-analysis panel** below the grid: R1–R5 cards. Renders only when hour is known (`computeZiwei()` returns null otherwise — surface the "hour needed" empty state, existing pattern).

## 26. Implementation order (each phase independently shippable, CI-green)

1. **Engine T1** (§23.1–23.2): `baziSchema.js` + `dailyFortune` v2, tests first (old invariants must stay green). Ship — daily panel upgrade (§23.3) can ride along or follow.
2. **Engine T2** (§24.1): `ziping.js`/`dayun.js` export-only edits + `synastryBazi.js` + symmetry/weight tests. No UI yet.
3. **Engine T3a** (§25.1): `ziweiDeep.js` stars/四化/大限/brightness/matrix + iztro spot-check harness.
4. **Engine T3b** (§25.2–25.5): scoring, sibling rule, 流年, `deepSynthesis.js`. Pure math, fully testable headless.
5. **UI** (§23.3, §24.2, §25.6): dual-chart 合盘, palace grid, deep panel, Beta badges, zh/en strings.
6. **Verification** (§27) after every phase; full pass at the end.

## 27. Verification (Part 5 — blocking)

- [ ] `npx vitest run` green; new suites: `baziSchema`, `dailyFortune`-v2 (old invariants unchanged + pinned 冲/合 days), `synastryBazi` (A↔B symmetry, missing-hour renormalization, hand-checked 子午冲 day×day case), `ziweiDeep` (大限 direction agrees with `dayunDirection()` for 20 random births; 大限 ranges tile all 12 palaces gaplessly), `deepSynthesis` (each R-rule's agreement and crosscurrent branch exercised).
- [ ] iztro spot-check harness extended: 四化 + 禄存/擎羊/陀罗/文昌/文曲 placements match on ≥100 random births (same methodology that pinned `ziwei.js`); any deliberate school-convention divergence documented in the module header, not silently different.
- [ ] Spec-table reproduction: §2.2's 五行局 lookup rows reproduce from the repo's nayin path (all 10 stems × 6 branch-pairs); `toChartMatrix()` output validates against spec §1.2 (hand-rolled asserts; every star has `name/level/wuXing/transformation`).
- [ ] Determinism audit: `grep -rn "Math.random" src/lib/` shows zero hits in any fortune-math module (seeded PRNG for phrasing only, as today); same (birth, date) → byte-identical `dailyFortune`/`flowingYearScan` output across two runs.
- [ ] `npm run build` + `node scripts/check-bundle-budget.mjs` green — horoscope chunk stays inside budget (all new code is table math; no new deps allowed).
- [ ] Copy audit (§22.4): no health claims, no financial directives, no verdict language in any new string; every new string has `data-zh`; entertainment-only banner present on every new panel; Beta badges present.
- [ ] design.md compliance: no `:root` edits, no new fonts; grid/matrix/warning states reuse Part-1 viz tokens and existing `.chip`/`.btn` patterns.
- [ ] Frozen-file audit: `git diff` on `ziwei.js`/`bazi.js`/`lunar.js` shows zero changes; `ziping.js`/`dayun.js` diffs are export-keyword-only.

## Done (Part 5) =

horoscope.html carries a Beta suite where the daily reading is driven by the full 五行生克 of today's true day pillar against all four natal pillars with visible receipts; 合盘 shows two complete charts side-by-side with an exact 4×4 Earthly-Branch combination/clash matrix; and a full ZWDS deep layer — 四化, sha stars, 大限 ages, 三方四正 scoring, the sibling-palace partnership rule, and a capped 流年 back-propagation scan — synthesizes with the existing Bazi engine through five explicit concordance rules, all pure, deterministic, ephemeris-true, test-pinned against iztro, and worded within the site's no-verdict copy law.
