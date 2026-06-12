# Project Afflatus Refactor Map

This document is the quick navigation map for future changes. Keep the orchestration thin in `src/main.js`; move focused behavior into modules when a feature needs repeated tuning.

## Current Module Boundaries

- `src/main.js`
  - App boot, animation loop, DOM orchestration, high-level combat wiring.
  - Keep this file as the conductor. New visual systems should live in modules.

- `src/config/combatConfig.js`
  - Combat constants: weapon cooldowns, attack timing scale, fleet counts, weapon labels, initial HP factory.
  - Edit here for cooldown duration, missile pacing, fighter/bomber inventory, and weapon display names.

- `src/ui/battleFeed.js`
  - Battle log/toast creation, severity color classification, kill meter, seeded combat messages.
  - Edit here for log wording, priority color behavior, and log rotation timing.

- `src/ui/radarDeck.js`
  - Radar canvas setup and radar private state container.
  - Edit here when changing radar sizing/state ownership before touching radar drawing call sites.

- `src/ui/combatView.js`
  - Combat view camera/state transitions.
  - Edit here for combat camera mode naming, timing, and subject state.

- `src/ui/marketDeck.js`
  - K-line chart, period controls, holding allocation animation, counter animation, holdings hover state.
  - Edit here for stock weight UI, chart redraw logic, period switching, and animated holding bars.

- `src/ui/terminalStarMap.js`
  - Commander terminal SHIP VIEW (live capital-ship exterior via capitalFlyby ambient mode) and login mode switch.
  - The old Alphard star map page was replaced by the exterior feed; the login form is unchanged.
  - Edit here for terminal mode behavior; edit `src/scene/capitalFlyby.js` for the exterior visuals.

- `src/ui/pageTurn.js`
  - Left/right page navigation buttons and keyboard page-turn behavior.
  - Edit here for page transition timing or keyboard navigation.

- `src/ui/softClock.js`
  - Topbar clock rendering with per-digit change highlighting.
  - Edit here for time animation behavior.

- `src/utils/dom.js`
  - Device body classes, safe text escaping, small DOM helpers.

- `src/utils/math.js`
  - Shared math helpers such as `clamp`, `lerp`, `rand`, `easeOut`.

- `src/data/content.js`
  - Chinese/English copy, stock picks, HUD labels.

- `src/data/marketSeries.js`
  - Synthetic market candle data and period metadata.

- `src/scene/backgroundScene.js`
  - Canvas starfield, pointer-reactive particles, and warp streak rendering.
  - Edit here for background motion, star density, pointer interaction, and warp feel.

- `src/combat/combatRuntime.js`
  - Weapon cooldowns, service windows, fleet health, ammo/deck readiness, and progress bar helpers.
  - Edit here for cooldown math, readiness recovery, service timing, and weapon availability.

- `src/scene/spriteCraft.js`
  - Runtime renderer for baked multi-angle craft sprite atlases (nose-up frames, azimuth pick + elevation crossfade, vector fallback).
  - Edit here for frame selection, sizing, or fallback behavior. Atlases live in `public/assets/sprites/`.

- `src/scene/cameraDirector.js`
  - External cinematic cameras for the pilot feed: deck catapult launch and arrested landing sequences with continuous visual-angle sweep.
  - Edit here for camera paths, az/el curves, deck rendering, REC banners.

- `src/scene/capitalFlyby.js`
  - Star-destroyer-class layered side-view flyby; hull/greebles/window lights are baked once to offscreen canvases, runtime is a few drawImage calls.
  - Used as the Enforcer main-gun charging cinematic. Edit here for hull silhouette, lights, pacing.

- `src/data/spriteAtlasMeta.js`
  - AUTO-GENERATED atlas metadata. Regenerate with `node tools/sprite-baker/bake-procedural.mjs`.

- `tools/sprite-baker/`
  - `bake-procedural.mjs`: dependency-free Node software rasterizer (procedural F-47/B-2 models → multi-angle atlases in `public/assets/sprites/`).
  - `index.html`: browser tool to bake atlases from real glTF models (three.js via CDN) — future asset upgrades without Blender.

## Remaining Refactor Targets

1. `combatDrawing`
   - Move combat canvas drawing, targeting reticles, missile/nuke/main-gun visuals.

2. `halleyRuntime`
   - Move comet lifecycle, spawn sizing, threat classification, and collision/destruction state.

3. `languageHud`
   - Move HUD label refresh, language switching, and localized status text.

The first four large systems are now split. Future fixes should target the specific module first and leave `src/main.js` thin.

## Verification

Use:

```bash
npm run build
```

For local preview:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```
