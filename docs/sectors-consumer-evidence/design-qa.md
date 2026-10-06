# Sectors consumer research — design QA

final result: passed

Scope: adapt the 81k article's established design and interaction patterns into the existing Afflatus Observatory, with bilingual summaries of the two requested articles. This is an adaptation with original Afflatus content, fonts and navigation; it does not assert that every Anthropic corporate page element has been copied.

Source visual truth: `docs/sectors-consumer-evidence/source-wall-1280.png` and `source-wall-390.png`, captured from https://www.anthropic.com/features/81k-interviews.
Implementation: `docs/sectors-consumer-evidence/implementation-wall-en-1280.png`, `implementation-wall-zh-390.png`, `implementation-consumer-en-390.png`, `implementation-consumer-zh-390.png`, `preview-zh.png`.

Desktop comparison: source and final implementation 1280 × 720 CSS/pixels, density 1. Mobile comparison: both 390 × 844 CSS/pixels, density 1. No scaling was used. Both wall captures were emitted together in the same comparison call. Earlier mismatched-height desktop captures were superseded by the final matched pair.

## Findings and repairs

- Initial P1: missing expand control caused initialization to throw. Added the rendered control, verified its pressed state changes and regression coverage for all required modal controls. Fresh built-route console logs contain no errors.
- Initial P2: equal white cards and absent topic sidebar lost the source wall's hierarchy. Added a desktop topic sidebar, featured spanning card, paper-colored surfaces and compact sans-serif header. Re-captured the desktop and mobile wall and compared against the source.
- Initial P2: absolute percentage widths left mobile labels outside short bars. Normalized lengths within each group, retained absolute percentage labels and explicitly disclosed the scaling. Verified Chinese and English at 390px.

No remaining actionable P0/P1/P2 findings in the implemented scope.

## Required fidelity surfaces

- Typography: existing local Newsreader/Hanken Grotesk and Chinese serif fallbacks retained. Sans-serif controls, serif evidence copy and compact labels follow the source hierarchy. Chinese titles wrap naturally; no clipped labels observed.
- Layout: matched desktop dialog inset, sidebar, featured card and mobile single-column wall. Search and topic controls wrap on phones with usable targets. Source's horizontal group selector becomes wrapped source filters for bilingual readability. No document horizontal overflow at the checked widths.
- Colors: cream paper, shaded lead card, subdued rules, green/blue bars and dark selected controls reproduce the reference palette within the existing tokens.
- Assets: new material is data visualization and native controls, with no new decorative raster assets. The existing geographic globe and local font assets remain in use. No remote media was downloaded or hotlinked.
- Copy: all new labels, explanations, empty states, statistics and controls have English/Chinese pairs. Source links, authors, publication dates and population/measurement caveats are visible. Original model measurements remain dated October 6; the research snapshot is October 7.

Focused comparisons: the wall screenshots resolve small labels, card text, controls, sidebar and surface colors. The consumer mobile screenshots resolve the title, statistics and bars. Source bars were visually inspected in-browser; no pixel-exact chart recreation is claimed.

## Interaction evidence

Passed in the in-app browser against the built `/en/sectors.html` and `/zh/sectors.html` routes:

- Bar disclosure and keyboard-accessible native summaries.
- Three subscription comparison scenarios, including the Fable 50% sub-cap and compute lower-bound note.
- Evidence source filter (2 SemiAnalysis cards), topic filter, Chinese search, explicit empty results.
- Expand control, close control and Escape dismissal.
- Existing company directory: Chinese search for 寒武纪 returns one organization.
- Chapter navigation and localized routes.
- Fresh final preview console error logs: empty.

Build, localization, SEO/data/style/header/i18n gates passed. TypeScript check passed. Focused Vitest: 15/15 passed. Entire repository test suite and a new Lighthouse run were not executed.

## Pattern mapping

| Reference surface | Afflatus surface |
| --- | --- |
| Geographic globe and scroll perspectives | Existing hero and map; perspective rotation now eases and respects reduced motion |
| Editorial reading rhythm | Existing prose columns and eight-chapter navigation |
| Ranked bars and disclosures | Consumer spending and monetization charts |
| Paired comparison | Subscription test-case selector and relative bars |
| Map, scatter and regional slopes | Existing industry globe, model scatter and ecosystem region comparison |
| Quote Wall / groups / search / expansion | Source-backed evidence wall, topic sidebar/select, source filters, bilingual search and expansion |
| Citation / appendix / sources | Existing citation copy, October 7 downloadable snapshot and source ledger |

## Checklist

- Completed bilingual implementation, static fallbacks, evidence attribution, schema registration and SEO snapshot update.
- Completed matched desktop/mobile wall comparisons and browser verification.
- Local preview retained. No deployment, commit, push or PR was requested after the user selected local review.

P3 follow-up: proprietary Anthropic fonts and exact survey-specific chart behavior are not duplicated; Afflatus retains its existing type system and industry-data interactions.
