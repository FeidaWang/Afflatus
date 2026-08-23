# AFFLATUS M11 — Opening Journey, Chapters 01–03

Date: 2026-08-23
Scope: Cold Void, Approach and Parallel Drift integration.

## Outcome

The first half of the home page is now one continuous editorial flight:

- Chapter 01 leads with brand copy; the canvas reveal waits 520 ms and keeps the first viewport free of dashboard furniture;
- `Explore Systems` remains the quiet discovery action while `Enter Command` is the primary destination;
- Chapter 02 keeps the bow cropped beyond the viewport and pairs it with a visible small-craft reference;
- Chapter 03 presents the three systems as sequential route rows, not cards.

`EditorialLink` and `TransmissionRow` emit short, scene-neutral intent signals on focus and pointer entry. The active system produces one bounded navigation-light pulse without changing layout or starting persistent flashing. Every destination remains an ordinary link when Three.js is absent.

## Equivalent paths

Desktop cinematic, Mobile poster and Reduced Motion preserve the same headings, descriptions and links. The no-JavaScript fallback contains the same opening journey and Command entry.

## Verification

- opening-copy, delay, link and non-card contracts: `tests/m11OpeningJourney.test.js`;
- desktop, mobile, keyboard signal and Reduced Motion browser coverage: `e2e/m11-opening-journey.spec.js`;
- visually inspected evidence:
  - `docs/refactor/screenshots/m11-opening-desktop-1440x1000.png`;
  - `docs/refactor/screenshots/m11-approach-mobile-412x892.png`;
  - `docs/refactor/screenshots/m11-opening-reduced-440x956.png`.

No commit was created for M11.
