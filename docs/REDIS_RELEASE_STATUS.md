# Redis release checkpoint — 2026-10-15 (Melbourne)

## Scope and constraints

User authorized Redis distributed rate limiting, Python dependency repair,
verification, then production deployment. Additional user constraint: **free
plans only, no paid options in this website**. Never enable automatic upgrades,
choose a paid Redis plan, or add purchase/upgrade UI. Preserve installed browser
app bundles and personal profiles; browser checks use isolated Playwright cache.

Workspace: `/Users/feida/.codex/worktrees/53ac/afflatus`.
Branch: `codex/redis-free-rate-limit`; base: `0bfe3bf0`.
Vercel target: `feidawangs-projects/afflatus`, project
`prj_BzzQ0aus6yHaqaqpeBS0ghrfD0VP`, production alias `feida.au`.

## Implemented

- Atomic Redis REST EVAL counter + expiring keys for quote/history/treasury and
  Python models. Environment/route scoped hashed IPs, platform client header,
  2s Redis timeout, 429 + Retry-After, 503 on Redis failure/missing config.
- Python models: 20/client/minute and 120/global/minute before calculation.
- Existing Node route rates retained: quote 60, history 20, treasury 45 per minute.
- Only local development can use bounded in-memory counters. Production cannot.
- Python 3.12 direct/transitive requirements now include hashes. CI installs
  binary wheels with `--require-hashes --only-binary=:all:` and runs `pip check`.
- Existing versions installed successfully; no dependency conflict was reproduced.
  Linux manylinux_2_28 wheels are available. manylinux2014 is too old for this
  NumPy wheel and is not the production compatibility target.
- No new client UI, paid service, feature flag change, or production release.

## Verified locally

- Existing JS baseline before edit: 1,415 passed, 0 failed.
- Updated complete Vitest suite: 1,421 passed, 0 failed.
- Python HTTP/model/limiter tests: 11 passed, including fail-closed, per-client
  and global gate, input boundaries, fixed-source integrity, synthetic maths,
  Redis errors/schema/timeout, no credential disclosure.
- Clean Python 3.12 environment: all 13 dependencies installed, pip check passed.
- All 13 Linux x86_64/manylinux_2_28 wheels installed into an isolated target with
  binary-only and hash verification (wheel availability, not execution on Linux).
- Typecheck, full prebuild/build, emitted SEO and bundle budget passed.
- Isolated preview on port 4189: 24 active-route render/metadata/viewport smoke
  tests passed across desktop Chromium, iPhone WebKit and Android Chromium.
  Initial port-4173 checks reused an existing unrelated preview; WebKit reported
  TLS failures there. Those results are superseded by the isolated current build.
  The existing port-4173 service was not modified or terminated.
- Full browser accessibility/visual suite was not run for this backend change.

## External blocker and remaining release steps

`vercel integration installations` returns no installations. Redis provisioning
stopped with `integration_terms_acceptance_required`, `userActionRequired=true`.
The operator must personally complete the terms page:
https://vercel.com/feidawangs-projects/~/integrations/accept-terms/upstash?source=cli
The user's free-only reply is not evidence that this external step completed.
Do not claim Redis provisioned, actual Redis concurrency tested, or deployed.

After acceptance, retry exactly this free-only provision (no resources have been
created by the failed command):

```sh
vercel integration add upstash/upstash-kv --name afflatus-rate-limit --plan free -m primaryRegion=iad1 -m autoUpgrade=false -m eviction=false -m prodPack=false -e production --no-claim --no-env-pull
```

Verify the actual plan is free, auto-upgrade disabled, and project connected.
Do not proceed if any payment/card/paid requirement appears. Keep tokens out of
logs, reports, command arguments and Git. Verify real Redis atomic counts and
expiry using a temporary test namespace; never substitute mocks for acceptance.

Current production `dpl_4NA3YuTTPBiN23Zv5EUjTDJErJnp` is READY, with model server
and UI flags false. After Redis readiness, enable only `VIBE_MODELS_ENABLED`
and `VITE_VIBE_MODELS_ENABLED` for this release. Existing private bridge and
research capabilities remain independently gated. Stage a production build with
`--prod --skip-domain`, verify actual option_model/option_payoff/catalogue DTOs,
429 and Retry-After, then promote that same deployment. Verify feida.au and both
EN/ZH Arena pages. Record exact deployment ID, commit and live results here.
Do not switch production aliases before acceptance passes.

Rollback candidate: keep existing production deployment above; restore the two
model flags if needed. Redis failure must not silently bypass limits.


## Provisioning and real Redis verification — continued 2026-10-15

The operator completed terms. Resource `store_TOk293RjbNXZklJZ`
(`afflatus-rate-limit`) is available, connected to production only. Actual Vercel
storage API metadata confirms `autoUpgrade=false`, `prodPack=false`,
`eviction=false`, primary region iad1. Billing plan ID is `free`, payment method
not required, preauthorization 0, monthly commands 500000. Vercel team billing
plan is `hobby`/active. No paid resource or upgrade was selected.

`node --env-file=.env.production.local scripts/verify-redis-rate-limit.mjs`
passed against this real Redis: PING/PONG; 12 concurrent Node and Python calls
share one counter, exactly 7 allowed and 5 blocked at limit 7; count 12;
positive TTL; expiry and subsequent recovery passed. Test keys were removed.
No token values are included in this report or command arguments.

Found and fixed the model UI's dependency on two unrelated UI flags: Arena and
quant mount when the independent model UI flag is enabled. Server research
flags remain off. Only the two model flags were enabled in production config.
Staging deployment and actual deployed API/browser acceptance remain pending.
