# AFFLATUS M12 — Closing Journey, Chapters 04–06

Date: 2026-08-23
Scope: Bridge, Wake and Departure integration.

## Outcome

The home page now closes as a content gateway rather than an endless 3D showcase:

- Bridge presents exactly one Current Signal and three Transmission rows;
- Wake introduces the complete engine composition, route-bounded dust and one FY25/26 Field Record summary;
- Departure reveals the first fuller carrier silhouette, reduces motion intensity, consolidates principles into one Manifesto and ends on one `Enter Command` action;
- `ALL SYSTEMS NOMINAL` appears once in the quiet footer.

The six-Chapter document stays within the accepted 480–560vh band in the production browser test. Native scrolling remains the source of truth, and the final camera/RAF state remains stable after reaching the end.

## Verification

- content counts, final-command and footer contracts: `tests/m12ClosingJourney.test.js`;
- page length, dust governance, route links and stable departure state: `e2e/m12-closing-journey.spec.js`;
- visually inspected evidence:
  - `docs/refactor/screenshots/m12-bridge-desktop-1440x1000.png`;
  - `docs/refactor/screenshots/m12-wake-desktop-1440x1000.png`;
  - `docs/refactor/screenshots/m12-departure-desktop-1440x1000.png`.

The former second Signature Deck hero is not restored. No commit was created for M12.
