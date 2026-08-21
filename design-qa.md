# AFFLATUS Showcase Integration — Design QA

## Evidence

- Source visual: `/var/folders/mf/spqyb9593h75f1n4s5br659w0000gn/T/codex-clipboard-9812a96a-7f0b-4b1b-bcd6-ba137a9a8a06.png`
- Production-integration desktop viewport: `/private/tmp/afflatus-site-home-viewport.png`
- Normalized hero comparison: `/private/tmp/afflatus-site-integration-hero-qa.png`
- Chinese desktop viewport: `/private/tmp/afflatus-site-home-zh.png`
- Mobile viewport: `/private/tmp/afflatus-site-home-mobile.png`
- Desktop Deck: `/private/tmp/afflatus-site-deck-en.png`
- Desktop COMBAT state: `/private/tmp/afflatus-site-deck-combat-en.png`
- Mobile Deck: `/private/tmp/afflatus-site-deck-mobile.png`
- Migrated Chinese Portfolio: `/private/tmp/afflatus-site-portfolio-zh.png`
- Desktop comparison viewport: 1440 × 1024 CSS pixels, normalized to 864 pixels wide for the combined hero input.
- Mobile verification viewport: 390 × 844 CSS pixels.

## Fidelity result

- P0: none.
- P1: none.
- P2: none.
- P3 accepted: the source uses fictional orbital labels; the implementation uses verified Federal Reserve and Treasury-market telemetry.
- P3 accepted: the generated black-hole image is more photographic than the supplied orbital illustration while retaining the same dark massing and left-side negative space.

The integrated page preserves the approved prototype's editorial grid, type hierarchy, black-hole hero, ivory Field Note, long capital-ship banner, and adaptive Three.js Deck. The production build uses the same implementation and image assets as the approved prototype.

## Route, locale, and interaction verification

- `/` renders English by default, independent of a previously stored adaptive locale.
- `/en/` and `/zh/` render fixed English and Chinese showcase editions with self-referential metadata.
- Internal showcase links remain in the active locale and point to `/en/...` or `/zh/...` routes.
- `/portfolio.html`, `/en/portfolio.html`, and `/zh/portfolio.html` contain the former homepage and preserve its full command experience.
- Language switching preserves query and hash state.
- Desktop and mobile pages have no horizontal overflow.
- Open Deck, close, NAV, COMBAT, reticle, radar, ship status, and power-management states work.
- Desktop Deck observed at 59 FPS in the production preview; animation is capped at 60 FPS and scales DPR/particle count on constrained devices.
- Browser console: no warnings or errors in English homepage, Chinese homepage, Chinese Portfolio, desktop Deck, or mobile homepage verification states.

## Build gates

- Production build: passed.
- Site manifest, header, CSS architecture, combat assets, bilingual lint, OG assets, localized emission, and emitted SEO: passed.
- Isolated staged-tree Vitest: 196 files passed; 1,903 tests passed.

final result: passed
