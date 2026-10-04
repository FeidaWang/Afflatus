# Prototype Instructions

## Selected design and user decisions

On 4 October 2026, the user selected the third generated design with these changes: selected-stock detail and chart on the left; watchlist rows on the right; exactly one main-page Add Stock button above the watchlist; three-index typography from the first design within the third design's compact index-strip footprint. `design/selected-design.png` is the revised visual target. Use warm paper, subtle graph grid, Newsreader/Songti display typography, and real watercolor texture assets. All quotes remain clearly labeled fictional design data. Keep this prototype self-contained.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Follow-up scope — 4 October 2026

The user explicitly requires direct reuse of the previous conversation's final modified third design. Preserve its left stock / right watchlist composition, paper, fonts, textures, index height, typography and exactly one Add Stock button. Only update the shared course header/footer, green-up/red-down crayon candles and line modes, D/M/3M/YTD/Y/MAX periods, draggable time and workspace sliders, and the real NYSE/Melbourne opening clock. Keep fictional quote provenance visible. Do not introduce an alternate dashboard design.

## Publication scope — 4 October 2026

The user authorized publishing this exact dashboard at the bilingual /en/arena.html and /zh/arena.html routes, together with the course cover changes. Remove the main-page stock search, the NYSE calendar link, and the short “Design sample · Not live” labels. Preserve the remaining small data provenance text; quotes have not been connected to a live market feed. The root MPA imports this prototype directly, without duplicating the visual implementation. Fixed-language pages follow their URL and use normal links to their language peer.

## Typography update — 4 October 2026

The user requires all English typography on Afflatus, including this published dashboard and Canvas chart labels, to use Anthropic Sans. This supersedes the earlier English font choices. Preserve the selected layout and the existing Chinese fallback families. The production font files and shared declarations live in the root `public/assets/fonts/` and `public/styles/typography.css`.

The user subsequently requested a smaller, lighter sitewide type hierarchy against Anthropic's site. Journal titles and company headings now use regular 400 weight, with smaller responsive sizes; watchlist headings use 500. Shared navigation stays at 15px/400, footer links at 12px/400, and the masthead wordmark at 22px/600. Preserve the dashboard composition and Chinese fallback families while applying this scale.
