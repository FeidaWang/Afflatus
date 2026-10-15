# Redis / Python / performance release — 2026-10-15 Melbourne

**Status: candidate verification. Final publication awaits successful cloud CI
and fresh production-environment API/browser acceptance.** The previous public
deployment remains active, honoring the user's all-checks-pass requirement.

## User constraints and target

Free plans only. Never enable automatic upgrades, paid add-ons or payment
options. Preserve installed browser bundles and personal profiles. The user
explicitly included existing whole-site Lighthouse failures in this release.

Workspace `/Users/feida/.codex/worktrees/53ac/afflatus`, branch
`codex/redis-free-rate-limit`, repository `FeidaWang/Afflatus`.
Vercel project `feidawangs-projects/afflatus`,
`prj_BzzQ0aus6yHaqaqpeBS0ghrfD0VP`; public domain `https://feida.au`.

## Free Redis and Python acceptance

Resource `afflatus-rate-limit` / `store_TOk293RjbNXZklJZ` is connected to
production only. Actual storage API metadata verified: plan **free**,
**autoUpgrade=false**, **prodPack=false**, **eviction=false**, iad1,
paymentMethodRequired=false, preauthorizationAmount=0, 500000 monthly commands.
Vercel team plan is **Hobby/active**. No paid resource or upgrade was selected.
The provider exposes no balance information here; no billing balance is inferred.

Atomic REST EVAL counters and expiry cover the Node quote/history/treasury
routes and Python models. Models enforce 20/client/minute and 120 globally;
Node per-client limits remain 60/20/45. Keys use environment/route namespaces
and hashed trusted client IPs. Redis failures/missing config fail closed with
503; exhausted counters return 429 and Retry-After. Only local development may
use a bounded Map. This does not claim an account-wide provider-data quota.

Real Redis test: 12 simultaneous Node/Python calls shared one counter; exactly
7 allowed and 5 denied at limit 7; count 12; TTL, expiry and recovery passed.
Temporary test key removed. Real deployed model/DTO/input/method checks and 429
were also verified before the performance work; fresh release checks remain
required. No assumptions or raw IPs are stored in Redis, and no tokens appear
in reports, source, or command arguments. Local env files are ignored/private.

Clean Python 3.12 installed all 13 pinned dependencies. Hash-checked Linux
binary wheels and pip check passed; 11 Python model/HTTP/limiter tests passed.
Existing versions were compatible; no dependency conflict was reproduced.
Root requirements now include hashes, and CI uses binary-only/hash verification.

## Whole-site performance changes

The pre-change CI failures were existing: all 31 JS/CSS assets requested in its
reports were byte-identical between `0bfe3bf0` and `359589b5`. The user then
authorized repairing the entire performance gate rather than waiving it.

- Preact 11.0.1 compatibility replaces the heavy browser rendering runtime.
  Existing component interfaces remain; actual server/dev JSX paths and icon
  dependencies are configured consistently and tested.
- Home/Arena ship HTML generated from their real components and hydrate it.
  When the visitor's stored language, watchlist or layout differs, rebuild instead of hydrating
  mismatched links. Fixed English/Chinese pages preserve their own locale.
- Local CSS is inlined with original cascade/media/import order and correct
  asset URLs. Enhancement begins after actual first contentful paint, with
  early button clicks replayed; there is no arbitrary multi-second delay.
- Complete normal font character/weight coverage is retained in smaller text
  optical instances. The optical-size axis is fixed at 28 instead of automatic
  per-size variation; original font files remain preserved for reproduction.
  Lab UI and library glyph subsets avoid downloading the full reading font.
- Responsive AVIF versions preserve the original illustrations/texture. Hidden
  music artwork and reading-only pagination/anchors/notes/block rendering/audio
  load when needed. The music player does not preload its playlist on the shelf.
- Sectors evidence is a separately cached JSON asset rather than executable JS.
- Horoscope reserves its date/copy space before initialization. The shelf hides
  the unopened reader. Static chapter/book content and links still work without
  JavaScript, including when metadata requests fail.
- A reading button stays disabled until metadata is ready; native chapter hrefs
  remain usable before enhancement. Delayed-response, passage recovery, locale
  links and opt-in audio have explicit browser regression coverage.
- The public model-only panel exposes three available calculations without
  requesting the disabled private research bridge. Limit/unavailable errors
  have bilingual retry messages. Private research and owner features stay off.

No Lighthouse threshold, baseline, route selection or device profile was
relaxed. CI builds and browser/performance tests now enable the actual public
model UI flag used in production.

## Local measurements and checks

Lighthouse mobile, three-run medians, unchanged LCP <=2500 ms / TBT <=200 ms /
CLS <=.1 and original per-route script ceilings:

| Route | Previous CI LCP ms | Local improved LCP ms |
|---|---:|---:|
| Home | 3280 | 2103 |
| Portfolio | 2535 | 1502 |
| Arena, models enabled | 3225 | 1801 |
| Sectors | 3492 | 2402 |
| Signal | 3490 | 2102 |
| Horoscope | 6809 | 1951 |
| Serial | 7696 | 2252 |
| Course | 4854 | 2178 |

CLS is <=.006 in these runs. Existing advisory total-size warnings are distinct
from mandatory failures. Measurements are lab browser emulation, not field p75
or physical-device certification. Cloud CI must confirm the exact release head.

Latest complete unit suite: **1425 passed, 0 failed**. Typecheck, full build,
data/site/header/CSS/i18n/OG/SEO checks and bundle budgets passed. A CSS cascade/
URL regression test was added. Browser regression covers all three configured
profiles, with targeted additions for delayed reader startup, offline native
links, no-JS book/chapter content, locale links and opt-in companion audio.
The exact-head full cloud run is pending; do not report it green prematurely.

Original installed browsers remain untouched. Diagnostics use isolated cached
Playwright browsers or the provided IAB, and dedicated local ports. Earlier
interleaved development Lighthouse runs are not release acceptance evidence.

## Publication and rollback

Current public rollback deployment:
`dpl_4NA3YuTTPBiN23Zv5EUjTDJErJnp`,
`https://afflatus-fv4ddpw1m-feidawangs-projects.vercel.app`.
The prior model candidate was temporarily promoted, then restored when full-site
performance failed. It is not the final active release.

After exact-head CI succeeds: verify Free/auto-upgrade settings, stage a
production build without switching domains, validate the real model DTOs,
429/Retry-After and EN/ZH browser results, then promote that verified deployment.
Record final commit, CI URL, deployment ID, public aliases and error-log result.
Production model server/UI flags are true for candidates; old rollback retains
its captured false flags. No private bridge/research server gate was enabled.

Rollback: restore the deployment above or disable the two model flags. Keep
Redis failures fail-closed, and do not enable a paid service to resolve a quota.

## Cloud candidate follow-up

Exact-head CI for `164b504a` passed unit/build, Python and all three complete
browser jobs. All eight LCP/CLS/script budgets passed; the only mandatory
failure was Portfolio TBT (884 ms median versus 200 ms ceiling).

The decorative Tetris constructor precomputed long desktop/mobile/footer games
synchronously. The follow-up keeps an identical deterministic 32-move initial
preview, computes full scripts in a browser Worker, avoids unused desktop games
on phones and initializes the footer game on view. Typed board buffers are
transferred; no new backend or service is involved. Startup also yields between
chart setup phases. Pure frame/structured-clone tests and real Worker completion
checks across all three browsers pass. Local three-run Portfolio metrics after
this fix: LCP 1502 ms, TBT 3 ms, CLS 0. Mandatory budgets remain unchanged.

Latest complete unit suite with simulation regression coverage: 1429 passed.
A fresh exact-head CI and clean-source production candidate are still required.
Diagnostic source manifests were checked: local env files are excluded, and
final publication is packaged from tracked immutable source, excluding local
reports and generated diagnostic directories.

### Final responsiveness follow-up

Cloud run 38729000857 passed Python, unit/build and all three browser profiles, but retained a Portfolio TBT failure and a 59-byte library script overage. Placement search now runs entirely in the worker (including its former 32-move preview); chart construction yields between small batches. Reader element lookup calls share one helper to reduce transferred code without changing behavior. Local unit suite: 1,430 passed; typecheck passed. Original Lighthouse assertions remain unchanged.
