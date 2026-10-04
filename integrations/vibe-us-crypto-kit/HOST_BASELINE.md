# Host baseline — 5 October 2026 (Australia/Melbourne)

- Checkout: `/Users/feida/.codex/worktrees/5615/afflatus`; starting commit `c7901191`.
- Branch: `codex/vibe-us-crypto-integration`; initial `git status --short` and `git diff` were empty. External kit was copied without modifying its original directory.
- Read `/Users/feida/.codex/AGENTS.md` (empty), root `CLAUDE.md`, and the applicable prototype `AGENTS.md` before editing the imported dashboard.
- Host is Vite MPA / React 19, not Next.js. Locked install currently resolves Vite 8.2.0. Inputs/navigation/SEO are owned by `src/config/siteManifest.js`.
- Current Arena HTML imports `src/pages/arenaJournal.jsx`, which imports `prototypes/us-equities-dashboard/src/App.jsx`. The older `arenaEntry.js` is not the page entry.
- The existing dashboard deliberately labels its inherited chart/quotes fictional. This integration adds separately sourced daily research; it does not relabel the prototype values as live data.
- Existing APIs `api/quote.js`, `api/history.js`, `api/treasury-yields.js`, navigation, manifest, published data and publication pipeline are preserved.

Before integration: `npm ci` succeeded; `npm run typecheck` passed; `npm run build` and its data/site/header/css/combat/i18n/OG/SEO gates passed. `npm test` failed: 19 files, 96 tests failed; 152 files / 1841 tests passed. Logs: `validation/host/baseline-*.log`. These failures precede the integration; tests were not deleted or disabled.

The P0 source/bootstrap gate and P1 new-code acceptance can be assessed independently of these recorded inherited failures. The full site must not be described as having all unit gates green.
