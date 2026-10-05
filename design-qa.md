# Homepage film premiere: design QA

final result: passed

Source visual truth: `/Users/feida/.codex/generated_images/01a108b2-64a7-78d0-82d6-2826451d74a7/exec-ebc1bf71-b1d6-4334-a54c-98b73235b5d1.png` (the first displayed option selected by the user).

Implementation: `http://127.0.0.1:5179/en/`, current inline screenshot `artifacts/home-redesign/desktop-controls-final.png`, floating screenshot `artifacts/home-redesign/mini-desktop.png`.

Viewport: 1440 × 1600 CSS px; source 1190 × 1322 pixels normalized to 1440 × 1600 for comparison. The browser's full-page capture is 1440 × 2466 pixels (1×); its first 1600 pixels are used for the comparison without scaling. State: page top, English, complete actual film frame at 00:18, paused to make comparison reproducible. The mock's playback label shows 00:00 despite depicting this frame; actual runtime time is retained.

Full-view comparison: `artifacts/home-redesign/comparison-final.png`, both artifacts combined into one 2880 × 1600 image. Inspected the actual reference and browser capture together. Focused comparisons: `comparison-typography.png` and `comparison-controls.png`, each containing the reference and implementation together.

Current control revision comparison: `comparison-controls-update.png`, again containing the selected source and current implementation together at 1440 × 1600 per side. Changes to the film controls below are explicitly requested by the user; typography, composition and imagery retain the approved direction.

## Iteration 1

- [P2, fixed] Introductory paragraph wrapping differed from the selected composition. Its first line included “and”, changing the editorial balance. Narrowed the desktop serif paragraph to 450px while preserving the responsive column and font size.
- [P2, fixed] The desktop navigation spacing override also applied to the mobile disclosure. Scoped it to desktop widths ≥980px.

## Iteration 2

The final full-view and focused comparisons confirm the selected three-line title, three-line introduction, shared gutter, rounded film and horizontal controls. Mobile navigation spacing is verified at 320px and 390px. No unresolved P0, P1 or P2 issues remain.

Accepted differences: project fonts retain the site's typography; the actual film preserves its 1616:1080 aspect ratio and detailed artwork; the seek control displays the actual paused time and uses an accessible native range input. The slightly taller film shifts the subsequent sections down without changing their hierarchy.

## Iteration 3: requested mini player

- Removed “Watch the full film” and extended the desktop progress bar to 952.37px at a 1440px viewport. Fullscreen and mini-player icons are adjacent.
- The same video becomes a 360px floating card, placed 16px from the bottom and right edges. Its time, sound and explicit pause state survive entry and return. The original film area reserves its space and offers a return action.
- Real pointer dragging moved the desktop card from (1064, 616.75) to (564, 276.75). A subsequent mobile drag was clamped to (16, 16). Pointer capture supports drag cancellation; the handle also supports arrow keys.
- [P2, fixed] The shared header originally covered the card's top controls when dragged to the top edge. Raised the card above the header, then verified its Close action at (16, 16). It returned to the inline player at 00:18, still paused and muted, with focus restored to the mini-player button.
- Floating playback continued while the original page position was off screen. Native fullscreen entry and exit from the floating player passed.
- Browser resize keeps the card inside the viewport. English and Chinese at 320 × 800px showed no horizontal overflow, with a 288px card and 44 × 44px controls. At 800 × 390px, the 360 × 268px card fit with 16px edge spacing and retained the complete film frame.
- Inspected `mini-desktop.png`, `mini-mobile.png` and `mini-mobile-zh.png`. No unresolved P0, P1 or P2 issues remain. The production preview reported no console errors or warnings.
- Latest validation: 31 tests passed across six relevant suites; the complete production build, prebuild checks and emitted SEO validation passed. Build log: `artifacts/home-redesign/build-mini.log`.

## Iteration 4: shared course footer and publication

- Replaced the homepage footer with the course page's `pa-footer` structure and shared `course-chrome.css`, retaining all seven page destinations and three social profiles. English and Chinese static fallbacks match the rendered component.
- Desktop at 1440 × 800px: both footers are 231.1875px high, with the brand at x=84 and columns 390.812px / 547.148px / 254.031px. Mobile at 390 × 800px: both are 416.1953px high, with the brand at x=40 and a 334px single-column content rail. No horizontal overflow.
- Inspected `footer-desktop-comparison.png` and `footer-mobile-comparison.png`, with course and homepage captures together. No unresolved P0, P1 or P2 issues.
- All 33 tests across the seven relevant film, footer, locale and SEO suites passed (`artifacts/home-redesign/test-home-final.log`).
- Production build and typecheck passed. Full unit suite: 1,885 passed, 96 failed. An isolated archive of `origin/main` at `419b35f6` reproduces all 96 failed tests; comparison found no new failure identities. Existing contract tests still expect older homepage, course, brand and Arena structures, and existing imports/API fixtures also fail. Evidence is in `artifacts/home-redesign/test-production.log`, `test-baseline.log`, and `baseline-comparison.json`.

## Fidelity surfaces

- Typography: project Anthropic Sans for bold display and navigation; bundled Newsreader for the serif introduction. Title and introduction follow the selected line wrapping. Existing 15px navigation is retained as a sitewide control size.
- Spacing: warm paper surface, two-column introduction, common page gutter, rounded expansive film and plain three-column work links match the selected hierarchy. Stage retains the real 1616:1080 ratio; its extra height compared with the generated mock's slightly flattened imagery is intentional, preserving the user's complete original frame.
- Color: paper #f0eee6, ink #111110 and fine #ceccc3 separators; visible focus outlines.
- Imagery: supplied actual film and full-resolution extracted poster, without substitutions or cropping. The original manga and AI interface differ in detail from Image Gen's interpretation; the source film is authoritative.
- Copy: selected headline, introduction, film action and three work destinations. “Projects” replaces “products” to describe the existing personal site; subsequent editorial content follows the existing static homepage. Every destination and all playback labels have Chinese equivalents.

## Functional evidence

- Muted inline autoplay, loop and duration 213.013 seconds confirmed in the browser.
- Pause and keyboard seeking confirmed; explicit pause survives scrolling away and back.
- Real pointer drag changed frame width from 1287.375 to 1222.75px with aspect ratio remaining 1.4963. Stage height and controls stayed fixed.
- Sound toggle, seeking and native fullscreen entry/exit confirmed through real controls and accessible state.
- Cinema playback opens at the inline film's time. Escape closes it, restores focus to the opener and retains the viewer's previous pause intent.
- Desktop Markets disclosure supports keyboard opening and Escape closing. Mobile Menu and Markets disclose real destinations and restore focus when closed.
- English and Chinese language links navigate to the correct fixed-locale homepages. Chinese-only Stories destinations are retained.
- No horizontal overflow at English 320px, 390px, 768px and 1440px, and Chinese 320px, 390px and 768px. Mobile playback buttons are 44 × 44px.
- Final responsive captures: `mobile-en.png` and `mobile-zh.png` at 390 × 1000px, `tablet-zh.png` at 768 × 1024px. Full desktop page is retained in `desktop-full.png`.
- Reduced-motion and Save-Data preferences disable automatic playback; reduced motion, touch and coarse pointers suppress pointer stretching. Lifecycle tests cover manual playback and intent preservation.
- Film playback lifecycle and fixed-locale fallback tests: 25 passed across five relevant suites.
- Production build and all required prebuild checks passed.
- Fresh production-preview tab reported no console errors or warnings after playback and navigation interactions.

## Existing repository limitations

The unrelated `tests/localizedSite.test.js` has an obsolete hard-coded Arena title assertion; the current title is already present in the unmodified HEAD manifest. It failed during exploratory testing, while the two other tests in that suite passed. Vite also reports pre-existing missing stylesheet references on Signal, Stories and Horoscope; none are requested homepage resources.
