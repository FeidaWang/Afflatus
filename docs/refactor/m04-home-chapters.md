# AFFLATUS M04 semantic home handoff

## Six-chapter contract

The V2 home now exposes one stable semantic section for every narrative phase:

| Chapter | `data-chapter` | Primary content |
|---|---|---|
| 01 Cold Void | `01-cold-void` | H1, premise, CTA and one Current Signal row |
| 02 The Approach | `02-the-approach` | Operating posture and transition into the system |
| 03 Parallel Drift / Operating Systems | `03-parallel-drift` | Capital, Software and Intelligence entry points |
| 04 Bridge Aperture / Current Intelligence | `04-bridge-aperture` | Current evidence summary and retained transmission links |
| 05 The Wake / Field Record | `05-the-wake` | Method summary and legacy field-record link |
| 06 Departure / Manifesto | `06-departure` | Manifesto, About and disclosure copy |

M07 may consume these identifiers but must not make their content depend on a
Canvas or scroll-state runtime.

## De-clutter result

The V2 home no longer renders hero telemetry, feature fact tiles, the complete
closed-cycle canvas chart, a second Signature Deck hero, Signature facts,
three principle cards, combat/radar controls, public FPS or weapon-energy HUD.
Links to Signal, Experiments, Field Notes, the field record and the legacy
Command deck remain available.

The Header Command action now opens a poster-only DOM preview. The M01
experience resolver and legacy redirect remain intact; M06 owns any future
capability-gated scene.

## No-JavaScript and footer contract

`index.html` includes the same six chapter identifiers, complete primary
navigation, the H1/body/CTA and retained destination links before React runs.
Its stylesheet is loaded directly from the document, so disabling JavaScript
does not remove either meaning or layout.

The footer is limited to AFFLATUS, Melbourne, Language, Motion preference,
Privacy/Disclosure and one nominal-status line.

## Performance change

Compared with the recorded pre-M04 build in this task:

- home CSS fell from 22.95 kB to 13.48 kB (about 41% smaller);
- home JavaScript fell from 233.35 kB to 219.42 kB (about 6% smaller);
- the separate 6.35 kB `DeckScene` entry is no longer emitted by the home;
- the V2 home renders zero Canvas elements in cinematic, static and reduced
  modes until M06 introduces a capability-gated scene.

## Verification

- `tests/m04HomeChapters.test.js` checks chapter order, removed surfaces,
  no-JS content and nominal-status cardinality.
- `e2e/m04-home.spec.js` checks semantic headings, Poster-only Command,
  Escape focus return, mobile overflow and JavaScript-disabled navigation.
- Desktop evidence: `docs/refactor/screenshots/m04-home-desktop-1440x900.png`.
- Mobile evidence: `docs/refactor/screenshots/m04-home-mobile-390x844.png`.
- Reduced Motion evidence:
  `docs/refactor/screenshots/m04-home-reduced-390x844.png`.

The M01 legacy redirect remains available. M05 can begin; M06 must continue to
use the chapter DOM as the source of meaning and treat any scene as enhancement.
