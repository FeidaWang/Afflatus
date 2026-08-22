# AFFLATUS M00 baseline

Captured: 2026-08-23 (Australia/Melbourne)
Reference: `Monumental_deep_space_design_spec_2026_codex_ready.md` is treated as the design reference; `CODEX_REFACTOR_MODULES_AFFLATUS_2026.md` is treated as the execution instruction. M00 is documentation/diagnostics only.

## Repository state

- Branch: `codex/signal-yield-monitor`
- Worktree: dirty before M00. Existing tracked changes and untracked files were preserved and not interpreted as M00 changes.
- Package manager: npm, lockfile `package-lock.json`.
- Framework/build: Vite 8 multi-page application, React 19 entry points, Three.js 0.160.1, Vitest 4, Playwright 1.61.
- Deployment: Vercel configuration in `vercel.json`.
- Runtime: Node `v24.14.0`, npm `11.18.0`.
- Install baseline: `npm install --ignore-scripts --no-audit --no-fund` — passed (`up to date`). `node_modules` was already present.

## Commands and results

| Purpose | Command | Result |
|---|---|---|
| Install | `npm install --ignore-scripts --no-audit --no-fund` | PASS |
| Dev server | `npm run dev -- --port 5173` | PASS; Vite served `http://127.0.0.1:5173/` |
| Build | `npm run build` | PASS; 19 fixed-locale documents + 136 novel documents emitted |
| Typecheck | `npm run typecheck` | PASS |
| Unit | `npm test` | PASS; 197 files, 1915 tests |
| Lint/quality gates | `npm run build` prebuild chain | PASS: data, site manifest, header, CSS, combat assets, bilingual, OG checks |
| E2E smoke | `npm run test:e2e:smoke` | 53 passed, 17 failed, 20 skipped; failures recorded below |

The first E2E attempt was environment-blocked because the sandbox could not bind `127.0.0.1:4173` (`EPERM`). The same command was then rerun with local-listener permission and reached the test suite.

Build warning: Vite reports chunks larger than 500 kB, including `vendor-three` and `main`; this is an existing performance risk, not changed by M00.

## Current observable architecture

- Home `/` is the current showcase/command-atlas page, authored through `src/showcase/App.jsx`, `src/showcase/DeckScene.jsx`, `src/showcase/showcase.css`, and `src/showcase-main.jsx`.
- Legacy/expanded portfolio and deck experience remains in `portfolio.html`, `src/main.js`, `src/homeExperience.js`, and `src/portfolio-convoy.css`.
- Shared brand/navigation and responsive foundations are in `src/lib/afflatusBrand.js`, `src/lib/nav.js`, `public/styles/afflatus-brand.css`, and `public/styles/responsive-primitives.css`.
- Scene/rendering code is spread across `src/scene/`, `src/combat/`, `src/bootengine/`, and `src/ui/`; data and locale logic is under `src/data/` and `src/lib/`.
- The current homepage uses WebGL/Three.js capability declarations and retains a 2D/fallback path. `?combatview=2d` is an observable legacy 2D path.

## Instrumentation counts

Counts below are repository text-reference counts, not runtime instances:

- `<canvas>` references across HTML/JS/JSX/TS: 23
- files containing `requestAnimationFrame`: 34
- `(window|document).addEventListener(` references under `src/` and `public/`: 84
- GLTF/GLB or `GLTFLoader` references under home/scene code: 23
- public/assets files over 1 MB: see `file-map.md`

## Screenshot evidence

All captures are viewport screenshots in `docs/refactor/screenshots/m00/`:

- `home-1440x900.jpg`
- `home-1280x800.jpg`
- `home-390x844.jpg`
- `home-deck-open-1440x900.jpg`
- `home-reduced-motion-390x844.jpg` (captured through the existing 2D/reduced-motion-compatible path)
- `home-fallback-1440x900.jpg` (captured through the existing `?combatview=2d` fallback path)

The browser-control surface used for this capture did not expose a WebGL context-failure injector. Therefore the exact forced WebGL-loss state is covered by existing `e2e/webgl-lifecycle.spec.js` and the fallback screenshot is explicitly labeled as the existing 2D fallback, not a fabricated failure state.

## Known baseline risks

- Main route E2E expects `[data-afflatus-nav]` and `.nav-menu-btn`/`.nav-labs__trigger` elements that are absent or behave differently on the current showcase home.
- `signal.html` emits a 404 resource during browser smoke.
- Existing axe serious `color-contrast` findings appear on home/portfolio; no new M00 styles were added.
- Portfolio mobile keyboard smoke has an existing `aria-expanded`/navigation behavior mismatch.
- Vite emits large-chunk warnings, especially the Three.js vendor chunk.
- The repository is already dirty with unrelated work; M00 does not claim or clean those changes.

## M00 conclusion

Baseline and repository mapping are complete. No product code, visual style, or business behavior was modified by M00. M01 may begin after review of the existing dirty-worktree boundary and the E2E risks above.
