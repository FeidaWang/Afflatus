# AFFLATUS M00 file map

This map records actual implementation paths found in the repository. It supersedes illustrative paths in the design specification for future modules.

## Build and runtime

| Concern | Actual files |
|---|---|
| Package/scripts | `package.json`, `package-lock.json` |
| Vite/MPA | `vite.config.js` |
| Deployment/redirect headers | `vercel.json` |
| Route source of truth | `src/config/siteManifest.js` |
| Main home entry | `index.html`, `src/showcase-main.jsx` |
| Main home React UI | `src/showcase/App.jsx`, `src/showcase/showcase.css` |
| Legacy portfolio/deck entry | `portfolio.html`, `src/main.js`, `src/homeExperience.js` |
| Shared runtime entries | `src/entry/performance.js`, `src/entry/viewport.js`, `src/entry/dataBridge.js` |

## UI and information architecture

| Concern | Actual files |
|---|---|
| Header/brand | `src/lib/afflatusBrand.js`, `src/lib/nav.js`, `public/styles/afflatus-brand.css` |
| Responsive primitives | `public/styles/responsive-primitives.css` |
| Global styles | `src/styles.css` |
| Home visual styles | `src/showcase/showcase.css`, `src/portfolio-convoy.css`, `src/home-combat-showcase.css`, `src/home-visual-upgrade.css` |
| Signature/market deck | `src/ui/marketDeck.js`, `src/ui/radarDeck.js`, `src/ui/terminalStarMap.js`, `src/ui/voyageLogConsole.js` |
| Locale/i18n | `src/lib/i18n.js`, `src/lib/i18nData.js`, `src/lib/localeStore.js`, `src/lib/bilingualContent.js`, `src/data/content.js` |
| Content/data | `src/data/`, `public/*.json`, `data/` |

## Scene, canvas, motion, and fallback paths

| Concern | Actual files |
|---|---|
| Main home scene orchestration | `src/homeExperience.js` |
| Home flagship | `src/scene/homeFlagshipNarrative.js`, `src/scene/homeFlagshipWebGPU.js`, `src/scene/capitalShip3D.js`, `src/scene/capitalFlyby.js` |
| Combat scene | `src/scene/topdownCombat.js`, `src/combat/combatRuntime.js`, `src/combat/combatState.js`, `src/combat/flightPath.js` |
| Scene utilities | `src/scene/backgroundScene.js`, `src/scene/alphardForge.js`, `src/scene/starMapScene.js`, `src/scene/sectorsStarfield.js` |
| Renderer selection/lifecycle | `src/lib/renderBackendSelector.js`, `src/lib/webglLifecycle.js`, `src/lib/renderBudgetCoordinator.js` |
| Existing 2D/fallback behavior | `src/homeExperience.js` (`?combatview=2d`), `src/main.js` poster insertion, `public/assets/combat/models/venator-hero-poster.webp` |
| Motion/reduced motion | `src/homeExperience.js`, `src/lib/scrollReveal.js`, `src/lib/scrollRevealView.js`, `public/styles/responsive-primitives.css` |
| Radar/HUD | `src/ui/radarDeck.js`, `src/cic-radar-vscan.css`, `src/cic-hud.css`, `src/home-combat-showcase.css`, `portfolio.html` |

## Assets and large files

| Type | Actual paths |
|---|---|
| GLB models | `public/assets/combat/afflatus-command.glb`, `public/assets/combat/models/*.glb`, `public/assets/showcase/afflatus-command.glb` |
| Hero/poster imagery | `public/assets/combat/models/venator-hero-poster.webp`, `public/assets/showcase/blackhole-hero.jpg`, `public/assets/showcase/signature-vanguard.jpg` |
| Combat textures | `public/assets/combat/materials/*.ktx2`, `public/assets/combat/textures/` |
| HUD imagery | `assets/hud/`, `public/hud/` |
| Fonts | `public/fonts/`, plus Google Fonts links in HTML entries |
| Other >1 MB assets | `assets/hud/f47-helmet.png`, `assets/hud/f47-side.png`, `assets/hud/pp1518.png`, `assets/hud/starship-back.png`, `assets/hud/starship-side.png`, `assets/material-source/vanguard-graphite-wear-v1.png`, `public/audio/*.mp3`, `public/novels/yuxi-gongci.json`, `public/vendor/black-hole/{deflection.dat,doppler.dat}` |

## Test and verification map

- Unit tests: `tests/**/*.test.{js,ts}` via Vitest configuration in `vite.config.js`.
- Route/keyboard/accessibility smoke: `e2e/quality-gates.spec.js`.
- Visual captures: `e2e/visual-captures.spec.js`, `e2e/combat-hud.visual.spec.js`.
- WebGL lifecycle/fallback: `e2e/webgl-lifecycle.spec.js`, `e2e/cityview.spec.js`.
- Playwright setup and viewport projects: `playwright.config.js`.
- M00 screenshot evidence: `docs/refactor/screenshots/m00/`.
