# Sectors 81k redesign — acceptance evidence (Task 15)

Branch `feat/sectors-81k-redesign`, base `2a1d081`. Measured on 2026-09-28 against a local
`vite preview` of `npm run build`. Not deployed.

## 1. Build and tests

| Check | Result |
|---|---|
| `npm run build` (incl. data, site, header, CSS, i18n, OG checks) | Pass |
| `npm test` (vitest, whole repo) | 1822 passed, 97 failed. **The 97 failures are identical, test by test, to the base commit `2a1d081`** (portfolio, arena, homepage, course, serial, brand and one sectors media-contract test). This branch adds 250 passing tests and no new failures. |
| `npx vitest run tests/sectors` | 305 / 306; the one failure is the pre-existing `sectorsMediaContract` "defers the graph visualizer" case |
| Playwright `sectors-story` + `sectors-bfcache` + `visualization-accessibility` | 46 passed, 1 skipped (`test.fixme`, see §4), 1 failed: the Arena equity-chart test (Arena is untouched on this branch) |
| Playwright `quality-gates` | Sectors passes the axe WCAG gate. The two "active-route" gates fail on **every** route, sectors included: they look for `[data-afflatus-nav]` / `.nav-labs__trigger`, which only `games.html` and `league.html` have, on the base commit as well. |
| axe (serious / critical) on `<main>` | 0 |

The e2e runs used an uncommitted config (Chromium at `/opt/pw-browsers/chromium`, project `desktop-chromium`) because the
pinned Playwright headless shell is not installed in the cloud workspace. That project does not apply
`reducedMotion: 'reduce'`, so page tests exercise the live stage.

## 2. Numbers against the data

- Snapshots: frontier `2026-09-27` — 15 models, 180 observations; industry `2026-09-27` — 55 companies, 41 edges, 0 unverified edges.
- Every number rendered in the S1 counts, chapters 02, 03, 04 (layer cards), 06 was extracted from the page (en and zh) and matched against the two JSON files (billions × 10 for 亿). 0 unmatched.
- Derived values recomputed independently: S1 — US 7 configurations / 0 open-weight / median 51; China 7 / 7 / 42. Layer cards — labs 14, apps 5, compute 8, foundry 5, memory 6, network 7, infra 4, power 6. All match the page.

## 3. Screenshots

`final-{en,zh}-{320,390,768,1440}-*` — 8 language × width combinations, reduced motion (static stage):

| File | Content |
|---|---|
| `final-<lang>-<w>-page.jpg` | whole page |
| `final-<lang>-<w>-usLeaders.png` | 02 US leaders |
| `final-<lang>-<w>-usChina.png` | 03 US and China |
| `final-<lang>-<w>-industryGlobe.png` | 04 company globe |
| `final-<lang>-<w>-industryGraph.png` | 05 relationships (the SVG is hidden below 769px; the picker + ledger replace it) |
| `final-<lang>-<w>-capital.png` | 06 capital |
| `final-<lang>-390-static-s{1,3,5}.png` | reduced-motion static frames of stage scenes |

Automated checks on all 8 combinations: no horizontal scroll, no clipped HTML text, no SVG text outside its frame, no page errors.

Earlier per-task evidence in this folder: `stage-*` (Task 8), `globe-*` (Task 9), `graph-*` (Task 10), `leaders-*` / `uschina-*` (Task 11),
`capital-*` (Task 12), `stage-s1-counts-*`, `stage-live-s1-fade-in-en.png`, `issuers-chapter-mobile-zh.png` (Task 13), `fonts-capital-*` (Task 14).

## 4. Lighthouse (sectors, mobile, 3 runs, medians)

Same container, same method, base commit vs this branch:

| | base `2a1d081` | this branch | recorded baseline (macOS, 2026-08-20) |
|---|---|---|---|
| LCP | 3.6 s (globe poster image) | **5.7 s** (stage legend text) | none recorded (`NO_LCP`, "warning-only") |
| CLS | 0.49 | 0.48 | 0.019 |
| TBT | 1189 ms | 390 ms | — |
| FCP | 2.25 s | 2.42 s | 1.5 s |
| Script transfer | 192 KB | 83 KB | 36 KB |

- **CLS 0.48 is not from this branch.** The shared site header renders expanded (478 px on phones) until its script sets
  `data-enhanced`, then collapses to 60 px (`public/styles/shared-header.css`, `#afflatus-header:not([data-enhanced])`). Base shows
  the same value; `npm run test:lighthouse` fails CLS on most routes for the same reason.
- **LCP regressed.** Cause, found by tracing LCP candidates and Element Timing: the S0 heading first paints while the header is
  still expanded, so it sits below the fold in its first frame (y = 958 in an 823 px viewport) and is never an LCP candidate; the
  13 px stage legend becomes the LCP element. The stage canvas and the font preloads (the plan's first suspects) were tested and
  ruled out. The old page's LCP was an image that finished after the header collapsed.
  **Not fixed — needs a decision:** (a) keep the shared header collapsed from the first frame when scripting is on (fixes CLS on
  every route too, but changes the shared header), or (b) move the S0 card up on phones (a design change). `e2e/sectors-story.spec.js`
  holds the regression test as `test.fixme('the S0 heading is the largest contentful paint')`.
- Script size is 57% below base but still above the recorded 36 KB budget (which predates the new chapters).

## 5. Independent review

A reviewer that did not take part in the implementation read spec §8, the plan and the ledger and reviewed `2a1d081..039fdf2`.
Plan focus items: (1) leads/trails from computed results — pass for all JS verdicts; the chapter-02 lede is user-confirmed static copy
(Task 11); the gap sentence's verb is now computed from the sign. (2) `projection` / `lab_claimed` labels visible — pass.
(3) logo sources on official domains — pass. (4) colour tokens in effect — pass; `--us-tint`/`--cn-tint` gaps addressed below.

Fixed in one pass, each with a test that failed first (commit `ff815bf`):

- clicking a relationship line threw and blanked the network;
- graph node logos ignored the paper-ready web files (dark-background brands were invisible);
- keyboard focus was lost after Enter on a graph node;
- company list fell under the globe instead of beside it;
- US and China land were not tinted (spec §8.3 chapter 4);
- chapter 04 lede claimed every company trades in New York (7 do not);
- three labels said 23 September next to data from the 27 September snapshot (the no-script fallback table really is 09-23 and keeps its date);
- chapters 03 and 06 showed no sources; the §8.3 appendix ledger (companies, relationships, logos) was missing;
- one failed logo-manifest fetch blanked the stage and chapters 02, 03 and 06;
- reduced motion had no stage visualisation (spec §3.4 static frames);
- the gap sentence always said "leads".

Also fixed during acceptance: relationship-graph column headings and tickers cut at the frame edge (`039fdf2`).

Deferred minors are listed in the final hand-off message.
