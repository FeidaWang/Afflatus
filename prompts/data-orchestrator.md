# Afflatus grouped data orchestrator

This file and `src/config/dataPipelines.js` are the only unattended data
execution contract. A run declares exactly one profile and may publish only
that profile's pipelines:

- `morning-research`: `arena-premarket`, `signal-macro`, `sectors-research`,
  and `horoscope-transits` when individually due.
- `open-execution`: `arena-open` only, at the current NYSE session's open
  execution window.
- `late-execution`: `arena-late` only, at the current NYSE session's late
  execution window.
- `postmarket-settlement`: `arena-postmarket` only, after the current NYSE
  session has completed; `arena-earnings-digest` may then append newly
  released official earnings evidence to that same session's digest only.

Market dates and windows are always calculated in `America/New_York`.
Transit dates are calculated in `Australia/Melbourne`. The local scheduler may
wake at several daylight-saving fallback times, but
`npm run data:arena:window -- --window=<name>` is the authoritative real-clock
due gate and returns non-zero outside the window. `--report-only` is for
read-only inspection and may never authorize publication or execution.
When it reports `due:false`, make no repository change.

## Repository and concurrency boundary

1. Run only in the dedicated automation clone on branch `main`, with upstream
   `origin/main`, a completely clean worktree, and no unresolved Git operation.
   Never run in a developer checkout. Before research, fetch `origin/main` and
   inspect `origin/main..HEAD`. If unpublished local data transactions exist,
   run the verified push helper first; on network failure stop without making
   another commit. Otherwise fast-forward from `origin/main`. Never use
   `--autostash` and never force-push.
2. A scheduler invocation owns the separate
   `afflatus-data-orchestrator.lock` for its full run. If another live owner
   exists, stop. Acquire it once with a duration that covers the whole bounded
   invocation; there is deliberately no renew operation. Release only the
   matching owner token. This is not the publisher lock.
3. The atomic publisher is the sole owner of
   `afflatus-data-pipeline.lock`. Callers check that it is absent but must never
   create, replace, or remove it. `data:publish` acquires and releases it.
4. Run `npm run data:freshness -- --json --profile=<profile>` before deciding
   what is due. A stale unrelated profile cannot block this run and may not be
   refreshed to make a check green.

## Evidence and decision integrity

1. Use primary sources where available and retain direct HTTPS source URLs.
   Every market number must come from a cited source or the production
   quote/history proxy. Missing evidence means no factual claim and no order.
2. Research and trading are separate. Research may be archived after a missed
   window; a directional decision may not. Every executable pick on or after
   2026-08-12 must be sealed and published before 09:30 ET with:
   `sessionDate`, the real `decidedAt`, `decisionWindow: "pre-market"`,
   `expiresAt`, allowed same-session execution windows, source references,
   `sourceHash`, `decisionHash`, and `proposalId`.
3. Publication time is the external witness. Never backdate `decidedAt`, reuse
   a prior-session proposal, or publish a newly executable proposal after the
   opening bell. A missed premarket decision window is permanently `missed`.
4. Open, late, and postmarket tasks may only execute an unexpired proposal from
   that exact published snapshot. They may execute it exactly or skip it, but
   may not add a symbol, reverse a side, change quantity or a threshold, or
   substitute evidence. A buy executes only when the provider price satisfies
   its signed maximum entry. `apply-arena-run.mjs` is the hard gate.
5. Catch-up is valuation and audit only. It must force an empty order list,
   preserve every missed proposal identity as `missed`, expire old `queued`
   entries, and never turn recovery into a trade.

## Atomic publication and remote verification

1. Generate every candidate file in a temporary directory outside the
   worktree. Candidate generators do not lock, commit, or write `public/`.
2. Publish exactly one complete declared group with
   `npm run data:publish -- <pipeline-id> <candidate-directory>`. The publisher
   validates candidates, atomically replaces the declared outputs, regenerates
   declared site artifacts, runs `data:check`, profile-scoped strict freshness,
   the full test suite, and the production build, then creates one path-limited
   commit. Any failure restores the previous bytes and creates no commit.
3. Push with the repository push helper. It pushes the validated `HEAD` to
   `origin/main`, returns non-zero on any failure, and verifies the remote SHA.
   On a remote race, fetch/rebase once, rerun the complete validation chain,
   retry once, then report failure. A local commit is not success until remote
   verification passes.
4. Stage no unrelated file. If nothing is due or the complete group would be
   byte-identical, create no commit.

## Profile work

- `arena-premarket`: after 08:30 and before 09:30 ET on an NYSE session,
  publish `arena-news.json`, `arena-picks.json`, and `arena-runlog.json`
  together. Research is mandatory even when picks are empty. Every news item
  must preserve the official source `publishedAt`, must not postdate the
  source-time cutoff, and must be no more than 72 hours old at that cutoff.
  Never reuse older background material to fill the briefing or a category
  quota. Set `freshnessPolicy` to `session-news-v1`. Set `coverageStatus` to
  `complete` only with four distinct fresh source URLs spanning four of
  macro/policy, frontier models, compute, memory, optical networking,
  power/cooling, cloud demand, or public-company earnings. If fewer fresh
  categories exist, set `coverageStatus` to `limited` and publish zero trade
  proposals. Empty model arrays are valid. `quoteAllowlist` must include every pick, every current ledger
  position, and the fixed `SPY`/`QQQ`/`SMH` execution and benchmark symbols.
  If the decision cutoff is missed, archive research but record the
  picks window as `missed`; do not create an executable snapshot.
- `arena-open`: between 10:05 and 10:20 ET, mechanically evaluate only signed
  `open-window` proposals. Publish ledger and runlog together. If the current
  premarket snapshot explicitly contains no eligible proposal, record a
  truthful zero-order `done`; if the premarket decision run never happened,
  record `missed`.
- `arena-late`: between 15:30 and 15:45 ET (or the configured early-close
  range), apply the same rule to `late-window` proposals and publish ledger and
  runlog together.
- `arena-postmarket`: inside the real post-market gate, run exactly
  `npm run data:arena:postmarket:candidates -- --output=<temporary-directory>`.
  That candidate-only command owns the fixed sequence: catch up only through
  the prior session; value S and P with zero orders; mechanically evaluate the
  current sealed T proposal (or record a truthful zero-order completion); then
  build the reviewer, digest, prediction audit, and complete four-file group.
  Do not hand-compose or reorder those stages. Publish that group exactly once.
- `arena-earnings-digest`: after the current session digest exists, monitor
  only symbols in current ledger positions or the same-session sealed picks.
  Accept evidence only from the company's official investor-relations site or
  an SEC filing. A supplemental candidate may append a newly reported result
  whose official `publishedAt` is later than the baseline digest; it may update
  `generatedAt`, but must preserve the digest date, books, notes, trade counts,
  delayed audit, prediction audit, ledger, runlog and picks byte-for-byte. Build
  with `npm run data:arena:earnings:candidates -- --output=<temporary-directory>
  --earnings-input=<outside-repo-json>` and publish only
  `arena-earnings-digest`. If there is no new official report, make no change.
- `signal-macro`: refresh only from authoritative releases and attributable
  market reporting when older than seven days or after a material event.
- `sectors-research`: refresh the complete four-file group when older than
  fourteen days; preserve balanced US/CN sourcing and provenance tiers.
- `horoscope-transits`: generate its candidate once per Melbourne day with
  `node scripts/gen-transits-daily.mjs --output=<temporary-file>`.

Return a compact Chinese report containing the task name, profile, ET session,
due decision, evidence cutoff, candidate/published files, validation phases,
commit SHA, push result, remote SHA verification, and any missed window.
