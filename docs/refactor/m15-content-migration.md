# M15 — Content migration and quiet reading surfaces

## Result

Published work now has small, addressable homes outside the homepage flight surface:

| Subject | Destination | Retained source |
| --- | --- | --- |
| FY25/26 capital record | `/capital/fy25-26/` | `/portfolio.html#fy2026Performance` |
| Federal Reserve / long end | `/signal.html` | `/signal.html` |
| AI Industry Solar Atlas | `/intelligence/solar-atlas/` | `/portfolio.html#solarAtlas` |
| QF-01 | `/arena.html` | `/arena.html` |
| Cityview / astrology | `/cityview.html`, `/horoscope.html` | unchanged |
| Course / fiction | `/course.html`, `/serial.html` | unchanged |

The new collection indexes are `/capital/`, `/intelligence/`, `/field-notes/` and `/experiments/`. They use a Feature + Complete Index pattern. Capital and Solar Atlas use a wide hero, 740px reading body and a visual breakout; no new route owns a continuous Three.js surface.

## Compatibility and publication contract

- Primary navigation now enters the four focused collection routes.
- `/markets`, `/lab`, `/labs` and `/writing` (including slash/path variants) permanently redirect to their corresponding collection indexes.
- Legacy documents retain their original titles, dates, source claims, anchors and direct URLs.
- Each new active route has canonical metadata, localized SEO, Schema.org graph, sitemap entry, social cards and a route performance baseline.

## Verification

- `npm run build` — passed: 22 manifest routes, 17 discoverable; emitted 53 route documents and 456 novel documents.
- `npm test -- tests/m15ContentMigration.test.js tests/afflatusBrand.test.js tests/lighthouseConfig.test.js` — 130 passed.
- `npx playwright test e2e/m15-content-migration.spec.js` — 3 passed, 6 expected cross-device skips.
- `npm run og:check` — 35 social cards.
- Lighthouse, 3 local runs per new route — median performance score 0.96, LCP 2.109–2.110s, TBT 0ms, CLS 0.078, Speed Index 1.881–1.883s.

Screenshots:

- `docs/refactor/screenshots/m15-capital-index-desktop-1440x1000.png`
- `docs/refactor/screenshots/m15-solar-atlas-case-desktop-1440x1000.png`
- `docs/refactor/screenshots/m15-field-notes-mobile-440x956.png`
