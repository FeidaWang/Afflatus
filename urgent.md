# urgent.md — Data-Viz Refresh: OpenAI (gpt-5-6) Chart Language → feida.au

> **Scope**: charts/stat widgets on `arena.html` and `stats.html` only. Strict to-do list; every item traces to a real selector/file. Source of visual truth: charts on `openai.com/index/gpt-5-6` (inspected 2026-07-21, dark mode).
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

## Done =

Charts on both pages read like the OpenAI benchmark plots — bare hairline axes, thin marker-terminated lines, one gradient (Wilson band), quiet uniform tooltips — while every page keeps its own Afflatus palette, fonts, and narrative shell.
