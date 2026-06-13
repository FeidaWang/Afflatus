# Project Afflatus Technical Guide

Version: `v1.3`

This guide is for maintaining, previewing, building, and publishing Project Afflatus. The site is now a Vite application, not a single standalone HTML file. Uploading only one HTML file will break the HUD, routed pages, fonts, sprites, and JavaScript modules.

## Project Shape

Project root: `Project Afflatus`

Core files:

- `index.html`: Vite entry page, SEO tags, favicon, Open Graph image.
- `package.json` and `package-lock.json`: dependency and script lockfiles.
- `vite.config.js`: local dev and preview server settings.
- `src/main.js`: app boot, animation loop, DOM orchestration, high-level combat wiring.
- `src/styles.css`: global design system, HUD layout, responsive rules, mobile tuning.
- `src/data/content.js`: Chinese/English copy, topbar text, holdings, YTD values.
- `src/data/marketSeries.js`: synthetic chart data and period configuration.
- `src/data/spriteAtlasMeta.js`: generated craft sprite atlas metadata.
- `src/config/combatConfig.js`: weapon cooldowns, labels, combat constants.
- `src/combat/combatRuntime.js`: cooldowns, ammo, deck readiness, service state.
- `src/scene/*`: background, star map, craft sprites, camera/capital flyby rendering.
- `src/ui/*`: radar, combat view, market deck, terminal, battle feed, clock, page turns.
- `src/utils/*`: shared DOM and math helpers.
- `public/*`: static pages and assets copied into the production build.
- `docs/*`: maintenance notes and refactor map.
- `tools/sprite-baker/*`: optional asset generation tools for future craft sprite updates.

## What Belongs In GitHub

Upload these because they are required or useful for maintenance:

- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `src/`
- `public/`
- `docs/`
- `README.md`
- `.gitignore`
- `scripts/` if you want to preserve asset-processing utilities
- `tools/sprite-baker/` if you want future craft sprite regeneration inside the repo

Live static assets that must stay:

- `public/favicon.svg`
- `public/robots.txt`
- `public/page-turn.css`
- `public/page-turn.js`
- `public/sectors.html`
- `public/fleet-log.html`
- `public/signal.html`
- `public/afflatus_terminal_dos_style.html`
- `public/assets/fonts/*.woff2`
- `public/assets/og/og-image.jpg`
- `public/assets/sprites/*.atlas.png`

Useful but optional:

- `assets/hud/`: source/reference HUD images. Keep if you still use them for design recovery.
- `assets-archive/`: historical reference archive. Do not include in a clean production repo unless you deliberately want the archive.

Do not upload these:

- `node_modules/`
- `dist/` when using Vercel, Netlify, or GitHub Actions to build from source
- `.DS_Store`
- `.env` or any secret files
- unused screenshots, old downloaded prototypes, raw prompts, or personal notes
- large PSD/AI/Blend/raw exports unless the site actually imports them

Exception: upload `dist/` only when you are publishing a static GitHub Pages branch that does not run `npm run build`.

## Local Preview

From the project root:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

If the port is busy, Vite will choose another port. Use the address shown in the terminal.

## Production Build

```bash
npm run build
```

The production output is:

```text
dist/
```

Preview the production build:

```bash
npm run preview
```

Default preview URL:

```text
http://127.0.0.1:4173/
```

## Replacing The Old Single HTML Version

The old workflow was a single uploaded `.html` file. Project Afflatus v1.3 should be published as a source repo or as a complete `dist/` build.

Best GitHub workflow:

1. Create or open the GitHub repo for Project Afflatus.
2. Put the Vite source files in the repo root.
3. Commit the source tree.
4. Deploy with Vercel, Netlify, or GitHub Pages Actions.

Recommended commit set:

```bash
git status --short
git add index.html package.json package-lock.json vite.config.js src public docs README.md .gitignore
git commit -m "Release Project Afflatus v1.3"
git push
```

If this folder is not already a Git repo:

```bash
git init
git branch -M main
git add index.html package.json package-lock.json vite.config.js src public docs README.md .gitignore
git commit -m "Release Project Afflatus v1.3"
git remote add origin <your-github-repo-url>
git push -u origin main
```

If you deploy by manually uploading build output:

```bash
npm run build
```

Then upload every file inside `dist/`, not just `dist/index.html`.

## Deployment Settings

Vercel or Netlify:

- Framework: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

GitHub Pages with Actions:

- Build command: `npm run build`
- Artifact directory: `dist`

GitHub Pages without Actions:

- Build locally.
- Upload the complete `dist/` contents to the publishing branch or publishing directory.

## GitHub Pages Subpath Warning

If the site lives at:

```text
https://username.github.io/repo-name/
```

set Vite `base` to the repo path:

```js
export default defineConfig({
  base: '/repo-name/',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 }
});
```

If the site lives at a custom domain or user root domain, keep the default root-style paths.

## Maintenance Map

Common edits:

- Text, language copy, holdings, weights: `src/data/content.js`
- Candlestick/period data: `src/data/marketSeries.js`
- Topbar, HUD layout, responsive behavior: `src/styles.css`
- Combat timing and weapon constants: `src/config/combatConfig.js`
- Cooldowns, readiness, ammo, deck logic: `src/combat/combatRuntime.js`
- Radar: `src/ui/radarDeck.js`
- Combat view: `src/ui/combatView.js`
- Battle feed/logs/toasts: `src/ui/battleFeed.js`
- Market deck and allocation animation: `src/ui/marketDeck.js`
- Terminal/star map: `src/ui/terminalStarMap.js`
- Background scene: `src/scene/backgroundScene.js`
- Sprite craft rendering: `src/scene/spriteCraft.js`
- Baked sprite metadata: `src/data/spriteAtlasMeta.js`
- Static route pages: `public/sectors.html`, `public/fleet-log.html`, `public/signal.html`

When changing visuals, use this order:

1. Update the smallest focused module first.
2. Update `src/styles.css` only for layout/skin changes.
3. Run `npm run build`.
4. Preview on desktop and mobile width.
5. Commit only meaningful source and asset files.

## Version Checklist

Before publishing a new version:

- Update visible version text in the site.
- Update `package.json` version if the release number changes.
- Run `npm run build`.
- Check `index.html` meta title/description.
- Check `public/favicon.svg` and `public/assets/og/og-image.jpg`.
- Verify topbar links: Home, Sectors, Fleet Log, Signal, Assets.
- Verify keyboard page turns and left/right page buttons.
- Verify mobile HUD does not block the title or market deck.
- Verify language switching works repeatedly.

## Troubleshooting

Blank page:

- Run `npm run build` and fix any build error.
- Check browser console for missing module or asset paths.
- Confirm the complete `dist/assets/` folder was uploaded.

Fonts or sprites missing:

- Confirm `public/assets/fonts/` and `public/assets/sprites/` were uploaded.
- If deployed under a GitHub Pages subpath, configure `base`.

Old version still appears:

- Hard refresh the browser.
- Wait for the hosting provider cache.
- Confirm the correct branch and output directory are deployed.

Fullscreen blur (the whole page, text included, goes soft only when maximized):

- Root cause: the landing page stacks three full-viewport canvases — `#starfield`
  (2D), `#blackhole-gl` (WebGL), `#event-layer` (2D) — that all share one `dpr`.
  When the window is small (half-screen, mobile) their backing stores are small
  and everything stays crisp. When maximized on a large/Retina display the three
  backing stores grow large enough to exhaust the GPU tile-memory budget, and
  Chrome silently re-rasterizes the *entire document* — DOM text included — at a
  reduced scale. It looks like a CSS blur but no `filter` is involved.
- Why earlier fixes didn't hold: the old cap stepped `dpr` down by viewport area
  (1.25 / 1.5 / 2) but never put an absolute ceiling on each canvas, so at
  fullscreen each canvas was still ~5.8MP (~17MP / ~70MB across the three) and
  could still cross the GPU budget on big screens.
- Current fix (`src/scene/backgroundScene.js` → `resize()`): a hard per-canvas
  pixel budget. `dpr = sqrt(BUDGET_PX / viewportArea)`, clamped to
  `[0.6, devicePixelRatio]`, with `BUDGET_PX = 3_600_000`. Each canvas is pinned
  to <= 3.6MP, so the three together stay ~41MB flat from half-screen through 4K
  (dpr auto-drops to ~0.66 at 4K, invisible on soft glow / black-hole content).
  The freed memory lets the root/text layer keep its native scale and stay sharp.
  Half-screen windows still resolve near 2x, which is why half-screen and mobile
  always looked fine.
- Verify root cause in ~60s: maximize the window, then DevTools -> three-dot menu
  -> More tools -> Rendering -> enable **Frame Rendering Stats** and watch
  **GPU memory**; or use the **Layers** panel and read each canvas layer's memory
  estimate. The number should drop noticeably after the fix. Also confirm
  hardware acceleration at `chrome://gpu`.
- If text is still blurry after the fix *and* GPU memory is not maxed out, the
  cause is almost certainly fractional display scaling (a non-integer
  `devicePixelRatio` from a scaled monitor or OS zoom), not this code path.
- Hard rule already encoded in `src/styles.css`: never put a `filter` on a
  main/fullscreen canvas — Chrome rasterizes filtered layers at reduced
  resolution on large Retina windows. Dimming is done via overlay vignettes.

Git says this is not a repository:

- Run `git init`, or copy the project files into the existing GitHub repo folder before committing.

Physical folder rename:

- The repo and documentation should be labeled `Project Afflatus`.
- Rename the local filesystem folder only when no dev server is running and no editor terminal is inside the old folder.
