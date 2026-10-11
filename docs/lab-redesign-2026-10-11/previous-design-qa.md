# Global header menus — design QA

final result: passed

Source: user screenshot, preserved at `docs/global-menu-evidence/reference.png` (566 × 816 pixels, cropped reference; CSS viewport/density unknown).
Implementation: `menu-en-1280.png` (1280 × 800 CSS/pixels, density 1), `menu-more-980.png`, `menu-zh-390.png` (390 × 844), and `menu-zh-portfolio-1280.png` in the same directory.

The reference and desktop implementation were emitted together for visual comparison. The reference is a cropped, enlarged menu; comparisons assess the requested panel geometry, positioning and silhouette, not exact source text size or content-dependent height. No image resampling was used.

## Fidelity surfaces

- Typography: navigation retains the existing local Anthropic Sans. Dropdown destinations now use a 21px serif stack with Chinese Songti fallback, following the reference's contrast between sans-serif triggers and serif destinations. Links wrap within the panel; a 44px minimum target remains.
- Layout: desktop panel is 320px wide with 24px internal padding, centered on the trigger, 12px below the header. The last group aligns its right edge with the trigger to stay inside the viewport. An invisible pointer bridge covers the gap. Compact navigation uses 16px viewport insets, 20px padding and an inline nested panel.
- Colors: dropdowns use #faf9f5 paper against the #e8e6dc header; subtle warm edge and restrained shadow follow the supplied reference. Mobile nested groups use #f0eee7.
- Assets: existing caret and menu assets are unchanged; the supplied reference contains no new raster assets to produce.
- Copy: destination names and bilingual labels are preserved. No new categories or links were introduced.

## Findings

No remaining actionable P0/P1/P2 findings. The reference's long, grouped menu has more destinations than Afflatus's three-link Markets menu and single-link More menu, so panel heights intentionally follow their content. Mobile uses an inset expandable navigation card to fit existing responsive behavior.

Full-view evidence shows the floating panel relative to the header and page. Focused panel details are readable in the desktop screenshot and the source crop. Mobile screenshot verifies panel insets, nesting, rounded edges and text wrapping.

## Verification

- Production build passed, including shared-header, CSS, localization, site and emitted SEO gates.
- In-app browser: English sectors Markets menu at 1280px; English arena More menu at 980px; Chinese sectors navigation and nested Markets at 390px and 320px; Chinese portfolio Markets at 1280px.
- At 980px the last menu's right edge is 814.4px within the viewport. At 320px the compact menu's right edge is 304px and bottom is 527px in a 568px-high viewport, with no document overflow.
- Escape closes a nested group, then the compact navigation and returns the existing controller's focus behavior.
- Fresh final browser console error logs: empty.
- No controller logic or browser installation changed. No new tests added for this CSS-only presentation edit.

Implementation applies through `public/styles/shared-header.css`, already loaded by all public templates. Existing no-script geometry and reduced-motion behavior remain supported in the stylesheet.

## Checklist

- Completed shared desktop and compact geometry, contour, spacing and typography.
- Completed representative bilingual route and breakpoint verification.
- Kept the local preview; no deployment, commit or push.

## Follow-up: chapter navigation gap

The shared header now exposes its actual breakpoint height through `--af-header-height`; the eight-chapter sticky navigation consumes that variable at all widths. Browser measurements at 1280, 980, 979, 674, 620 and 390px show `chapterTop - headerBottom = 0`. Build passed. Evidence: `docs/global-menu-evidence/chapter-gap-fixed-390.png`.

## Follow-up: menu typography

The latest revision supersedes the serif dropdown typography above. Dropdown items now inherit the same Anthropic Sans stack as the navigation trigger: 15px on desktop and 16px in compact navigation. Computed styles for the trigger, link and label were identical at 1280px and 390px. Existing card geometry is unchanged. Production build passed.
