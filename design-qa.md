# Homepage film player QA

final result: passed

## Findings

No actionable P0/P1/P2 findings remain in the final combined visual comparisons. A return-to-page arrow pointing the wrong way was found in the first icon comparison and corrected before this pass.

## Reference and implementation evidence

Source visual truth is the user's attached screenshots, saved in `artifacts/film-player/`:

- `reference-main.png` (866 × 578), `reference-mini.png` and `reference-header.png` (570 × 360): original player composition.
- `reference-seek-inline.png` (1562 × 250) and `reference-seek-mini.png` (1060 × 124): toolbar/seek spacing and split-track pill thumb.
- `reference-icons.png` (310 × 110) and `reference-window-actions.png` (309 × 126): sound/fullscreen and mini window actions.
- `reference-mini-fraction.png` (866 × 602): a small floating film with an unobstructed picture-in-picture stage.
- `reference-volume.png` (225 × 128) and `reference-muted.png` (226 × 129): volume capsule and solid slashed speaker.

Later user instructions override the original screenshots: no ordinary-player brand, a custom mark plus `rsiagent.app` only in the mini header, mini instead of a settings menu, no bottom-right mini buttons, a translucent white play surface, centered 10-second digits, proportional controls, pointer-leave hiding, 1× playback, and reduced download access.

Browser-rendered implementation captures:

- `ui-updated-inline.jpg` (968 × 1150), `ui-updated-inline.png` (865 × 487): ordinary controls and tighter seek spacing.
- `ui-volume-48.jpg` and `ui-volume-muted.jpg` (640 × 853), with full-player crops `ui-volume-48-player.png` and `ui-volume-muted-player.png` (574 × 323): actual drag to 48%, then mute. The mute capture uses the final solid speaker/slash asset.
- `ui-mini-final-desktop.jpg` (968 × 1150) and `ui-mini-final.png` (570 × 321): final corrected outward-arrow icon, glass play surface, centered skip digits, and pill seek thumb.
- `ui-mini-mobile-320.jpg` (320 × 740), `ui-mini-320.png` (240 × 136), `ui-mini-mobile-390.jpg` (390 × 844), `ui-mini-390.png` (257 × 146): final corrected icon on narrow layouts.
- `ui-mini-quiet-context.jpg` (640 × 853), `ui-mini-quiet-422.png` (422 × 238), and `ui-mini-hidden.png` (570 × 321): pointer outside, no controls or dark shade over the movie.

The film comparisons are paused at 0:30 / 3:33. The volume pair intentionally uses 48% for the adjustment state and mute for the slashed speaker state. The reference's blue outline is keyboard focus chrome; mouse activation in the implementation does not force a persistent blue border. A blue focus outline remains available for keyboard use.

Screenshots use one image pixel per CSS pixel. Full mini comparison places the original 570 × 360 reference beside the final 570 × 321 implementation without resizing either. Blank padding accounts for the requested replacement film's 16:9 aspect ratio. Main source and implementation are normalized to 570px width; focused source/implementation crops are normalized to a common width for shape and spacing inspection. Enlarged icon references are detail crops, not evidence that controls should grow to those pixel sizes. The page-context fraction comparison has different surrounding content and video frame, and is used only to check the requested picture-in-picture composition, not pixel equality.

Combined comparisons opened and reviewed:

- Full views: `ui-comparison-mini.png`, `ui-comparison-inline.png`, `ui-comparison-fraction.png`.
- Focused regions: `ui-comparison-actions.png`, `ui-comparison-seek.png`, `ui-comparison-volume.png`, `ui-comparison-muted.png`.

Preview: http://127.0.0.1:4173/en/ (Chinese route also available at `/zh/`). The user's existing tab remains open with its viewing state preserved. Temporary viewport overrides were reset and separate QA tabs were closed.

## Required fidelity surfaces

| Surface | Result |
| --- | --- |
| Fonts and typography | Product sans typography matches the reference's control/wordmark role. Wordmark, times, and labels scale with the actual mini width. No wrapping or clipped brand at 320px or 390px. Movie typography belongs to the supplied film and is not reconstructed as overlays. |
| Spacing and layout | The main seek track sits 6px below the toolbar rather than 18px. The mini track has a tall pill with gaps on both sides. Header spacing separates logo/wordmark from utility actions. Mini width is 66vw with a 240px minimum and 570px maximum, constrained by viewport width/height. Compact width is 44vw with a 360px maximum. The 240px mini separates center play and seek hit regions. |
| Colors and tokens | White sound, slashed mute, square fullscreen corners, minimize, outward return arrow, and close follow the requested shapes. Central play is translucent white with blur and a subtle white border. Header, center controls, footer, and dark shade all disappear when the pointer leaves. Brand remains the requested copper generated mark. |
| Image quality and assets | The requested H.264/AAC 1920 × 1080 movie is contained at 16:9. Its 82,576,797-byte web encode preserves source audio and fast-start metadata. Generated logo transparency is retained. Official Material SVGs supply `back_to_tab` and `volume_off`; existing Phosphor icons supply other controls. No image placeholders or handcrafted asset substitutes were introduced. |
| Copy and content | Ordinary/fullscreen player has no upper-left brand. Mini reads `rsiagent.app`; inline slot displays a localized picture-in-picture caption. Accessible labels remain bilingual. No settings, speed selector, movie download links, or bottom-right mini buttons remain. |

## Comparison and fix history

1. Earlier main/mini passes enlarged control text, fixed a narrow central-button/seek overlap, replaced settings with fullscreen, and moved mini access into the previous fullscreen slot. Normal branding was removed; the generated RSI mark and requested mini header were added. Footer actions were removed and controls made container-relative.
2. The user's seek references exposed the mini circular thumb and excessive ordinary toolbar gap. The mini now has a tall rounded thumb and interrupted track; the ordinary gap was reduced by 12px. Post-fix evidence: `ui-comparison-seek.png`, `ui-comparison-inline.png`.
3. The next references exposed missing ordinary volume adjustment, oversized mobile mini dimensions, permanent mini chrome, a blue play surface, off-center skip digits, and icon differences. Added a functioning volume capsule; bounded the mini by 66vw/44vw; hid all overlays on pointer leave; changed play to white glass; centered digits; used solid sound and square-corner fullscreen icons. Narrow captures verify readable controls with no overlap. Post-fix evidence: final desktop/mobile captures and the combined mini/volume comparisons.
4. The final muted reference exposed the outlined speaker mismatch. Replaced it with the official solid `volume_off` asset. Actual volume drag and mute/unmute were verified; `ui-comparison-muted.png` shows the final state.
5. First focused window-action comparison found the return arrow pointing inward after rotation. Replaced that asset with official `back_to_tab` and removed rotation. Recaptured desktop, 320px, and 390px implementations. Final `ui-comparison-actions.png` and `ui-comparison-mini.png` show the outward upper-left arrow and filled lower-right small window.

## Interaction and validation

- Actual pointer drag moved the ordinary volume slider from 100% to 48%. Muting set the rendered state to zero; unmuting restored 48%. Earlier in the iteration, setting the slider to zero and unmuting restored the remembered 35% volume.
- At a 640 × 853 viewport, mini bounds are x 201.602px, y 598.531px, width 422.398px, height 238.469px. When the pointer leaves, all four overlay layers report opacity 0 and pointer-events none. Actual pointer entry reveals controls again.
- At 320 × 740, mini bounds are x 64px, y 588.125px, width 240px, height 135.875px. Utility/skip targets are 36px and central play is 44px. All visible button centers hit their own buttons. Central play ends at 670.063px; seek begins at 671.406px. There is no overlap or horizontal overflow.
- At 390 × 844, mini bounds are x 116.602px, y 682.344px, width 257.398px, height 145.656px. Center-to-seek clearance is 6.234px. There is no horizontal overflow.
- Skip digits measure zero offset from their button center in both axes. Mini seeking, actual narrow play/pause, return-to-page, compact sizing, close, and keyboard movement were exercised across the accumulated iteration. Final return preserved the explicit pause at 30s and current/default playback rate 1.
- Native fullscreen pause retention and ±10-second movement were verified in the preceding player pass. Those actions remain unchanged.
- Both video elements retain rate locking and browser download/speed/remote hints. Right-click suppression, public movie HTTP 206, and obsolete movie HTTP 404 were verified in the previous pass.
- 19 tests passed across playback, drag, and localized static-homepage suites, including rate reset at 0.5×, 1.5×, and 2× plus default-rate changes and cleanup.
- Latest production build, stylesheet checks, localization, and emitted SEO validation passed. Final independent QA page reported no browser console errors. `git diff --check` passed.

## Follow-up polish and limits

P3: icon strokes and font antialiasing can differ slightly from browser-native controls. Physical touch devices and the native-controls cinema fallback were not separately exercised. Touch controls use a 2.8-second hide timer; keyboard-visible focus keeps them accessible.

The supplied replacement film differs in frame composition and aspect ratio from the reference movie. These are expected content changes. Native control hints vary by browser; UI download restrictions cannot prevent network extraction or screen capture. The original high-quality film remains outside the served directory.

The RSI logo prompt is recorded in `artifacts/film-player/rsiagent-logo-prompt.txt`. Material asset source links and Apache 2.0 license location are recorded in `docs/home-film.md`.

## Implementation checklist

- [x] Correct source film and aspect ratio; original remains unchanged.
- [x] Main and mini control layout, volume slider, muted glyph, responsive mini size, pointer hiding, centered digits, and glass play surface.
- [x] Combined full-view and focused visual comparisons, desktop/narrow interaction checks, browser console check.
- [x] Production build, relevant tests, whitespace check, preview handoff, and viewport/tab cleanup.
