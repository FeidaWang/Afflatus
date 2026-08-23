# M17 — Release candidate, cleanup and push review

Date: 2026-08-24
Scope: all 18 active routes, English/Chinese documents, homepage capability profiles, retained redirects and specialist interactions.

## Release result

M17 completes the modular refactor and the push review. Horizontal overflow, clipped text, overlapping header controls and accidental multi-line control labels are now build failures across all active localized routes and the configured desktop/iPhone/Galaxy projects. React-owned mission/content navigation is enhanced before first paint, content index heroes use the available desktop measure, and Portfolio dossier choices cannot be overwritten by queued scroll-observer callbacks.

Confirmed unused static-journey PNG intermediates were removed after their AVIF derivatives rendered in the browser. The generated originals remain recoverable from the Image Gen workspace paths recorded in the asset README. Legacy redirects and `/portfolio.html` remain because they have published inbound/anchored dependencies and are the documented rollback surface.

## P6 20-point acceptance

| # | Acceptance item | Status / evidence |
|---:|---|---|
| 1 | Brand identity | Pass — adaptive AFFLATUS wordmark retained across route personas. |
| 2 | Deep-space language | Pass — restrained near-black homepage; no generic dashboard chrome. |
| 3 | Monumental scale | Pass — carrier scale comes from hull apertures, windows and sparse references. |
| 4 | Camera discipline | Pass — authored path; mobile reduced to three meaningful shots. |
| 5 | Single dominant visual | Pass — one carrier/planet relationship, no competing hero collage. |
| 6 | UI reduction | Pass — homepage persistent UI is navigation, Motion, Command and locale only. |
| 7 | One primary CTA | Pass — Explore Systems leads the opening; Command is persistent utility. |
| 8 | True Command | Pass — objective, trajectory and next action are factual and static-first. |
| 9 | Information architecture | Pass — Capital, Intelligence, Field Notes and Experiments own focused indexes. |
| 10 | Quiet inner routes | Pass — migrated content routes have no continuous canvas. |
| 11 | One-canvas rule | Pass — homepage owns one decorative scene canvas. |
| 12 | Performance profiles | Pass — High/Medium/Mobile/Static/Reduced matrix and governor are explicit. |
| 13 | Core Web Vitals | Pass in lab for the release homepage: LCP 1.953–1.957s, CLS 0, TBT 0; field INP remains a stated post-release limit. |
| 14 | Reduced Motion / Save-Data | Pass — scene chunk is not requested and no continuous RAF starts. |
| 15 | Accessibility | Pass in automated/semantic baseline — skip, landmarks, keyboard, focus, axe and text resize gates. |
| 16 | Color discipline | Pass — ion cyan is status/accent; orange is Command/decision emphasis. |
| 17 | Lighting discipline | Pass — no DOF; bloom restricted to High engine emissives. |
| 18 | Migration integrity | Pass — subjects moved without deleting original records or anchors. |
| 19 | Footer discipline | Pass — compact identity, locale, disclosure and nominal status. |
| 20 | Monumental Quiet mood | Pass — visual audit accepted the homepage and quiet content surfaces. |

## Push-review evidence

- Final browser summary: `docs/refactor/audit/m17/final/release-audit.json`.
- Accepted current-run screenshots: `docs/refactor/audit/m17/final/`.
- Localized layout gate: 18 active routes, 35 published locale documents and three browser/device profiles; 105 route-locale-device states passed with zero overflow, clipped text, overlapping header controls or accidental control wrapping.
- Deterministic visual gate: 18 routes × two viewport positions × three profiles = 108 complete viewport PNG captures.
- Additional 320px floor: all active routes plus Boot and 404 passed without page-level horizontal overflow.
- Manual in-app browser audit: 52 English/Chinese desktop/mobile states plus seven accepted final captures; the only detected 430px Portfolio CTA wrap was corrected before final capture.
- Console: the browser fixture reported zero unexplained console errors or uncaught exceptions on executed routes. Three.js `useLegacyLights` messages in the preliminary ad-hoc audit were dependency warnings, not release errors; the new scene source does not set that deprecated switch.

## Performance and resource result

Three final mobile-simulated Lighthouse runs for `/` recorded:

| Metric | Result | Gate |
|---|---:|---:|
| Performance score | 0.98 | baseline warning floor passed |
| LCP | 1,953.3–1,956.5 ms | ≤2,500 ms |
| FCP | 1,803–1,806 ms | monitored |
| TBT | 0 ms | regression gate passed |
| CLS | 0 | ≤0.1 |
| Initial script transfer | 84,869 B | regression gate passed |
| Initial total transfer | 359,800 B | regression gate passed |

The complete 18-route, three-run Lighthouse matrix passed hard assertions; existing total-transfer warnings on specialist data routes remain warnings rather than hidden failures. The final production build contains 5,096 transformed modules. Homepage eager JS is 230.88 kB / 84.28 kB gzip, homepage CSS is 24.34 kB / 6.37 kB gzip, and the 743.97 kB / 191.40 kB gzip Three.js vendor chunk remains deferred. Static, Reduced Motion and Save-Data paths do not request it.

The render-governor browser contracts pass for High, Mobile, Static and context recovery. Physical-device sustained-FPS and field INP are not inferred from emulation; their targets remain 55–60 fps on a high-performance desktop, 40–60 fps on an ordinary laptop, about 30 fps on a high-performance phone and INP ≤200ms at field p75.

## Final command results

| Gate | Result |
|---|---|
| `npm run build` | Pass — 22 build routes, 35 localized route documents, 456 localized novel documents and 35 social cards emitted. |
| `npm test` | Pass — 215 files / 2,065 tests. |
| `npm run typecheck` | Pass. |
| M16/M17 targeted browser run | Pass — 58 passed / 8 expected project skips. |
| Full E2E release run | 422 passed / 225 expected skips; one desktop Portfolio observer race was found, fixed and its rebuilt regression passed. |
| Post-fix brand/Portfolio/visual rerun | Pass — 82 passed / 2 expected project skips across all three profiles. |
| Visual capture matrix | Pass — three project tests, 108 route captures. |
| `npm run linkcheck` | Pass — 635 links. |
| `git diff --check` | Pass. |

## Known limits

- Lab Lighthouse cannot supply field INP; the release records lab interaction evidence and keeps the ≤200ms INP target in the privacy-bounded Web Vitals collector.
- Browser emulation and accessibility-tree inspection do not replace final physical-device VoiceOver/TalkBack review.
- Browser emulation does not prove sustained FPS on the named physical device tiers; the governor, frame-budget and lifecycle contracts are release evidence, with physical profiling retained as an operational follow-up.
- `/portfolio.html` and specialist visualization routes intentionally retain their established visual systems; M17 gates their geometry, localized content and errors without restyling their published records.

## Rollback

1. Force `VITE_AFFLATUS_EXPERIENCE_MODE=static` to remove homepage WebGL while retaining the complete designed route.
2. Force `VITE_AFFLATUS_EXPERIENCE_MODE=legacy` to return `/` to the retained portfolio shell.
3. Revert the M16/M17 asset and source changes together; keep manifest redirects and localized route documents intact.
4. Regenerate sitemap/SEO/social cards and rerun build, link and browser gates before republishing.
