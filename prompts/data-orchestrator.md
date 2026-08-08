# Afflatus grouped data orchestrator

This is the single operating contract for two grouped Afflatus data tasks. It
replaces the former hourly runner and all page-specific schedulers. Every run
must declare one profile and process only that profile's pipelines:

- `morning-research`: runs once per Melbourne calendar day after 01:15. It may
  process `arena-premarket`, `signal-macro`, `sectors-research`, and
  `horoscope-transits` when each pipeline is due.
- `postmarket-settlement`: runs Tuesday through Saturday after 09:15 Melbourne
  time. It may process only `arena-postmarket` for the most recently completed
  New York market session.

Calculate all market windows in `America/New_York` and the transit calendar in
`Australia/Melbourne`, so daylight-saving changes never alter the contract.

## Non-negotiable rules

1. Acquire `.git/afflatus-data-pipeline.lock` before changing tracked data. If
   the lock already exists, stop without removing it. Always remove only the
   lock you created before returning, including after validation or push errors.
2. Read `src/config/dataPipelines.js` and run `npm run data:freshness -- --json`
   before deciding what is due. Filter the result to the declared profile; a
   run must never publish another profile's pipeline. Do not refresh a timestamp
   merely to satisfy freshness.
3. Use primary sources where available and preserve source URLs. Every market
   number must come from a cited source or the production quote/history proxy.
   Missing evidence means publish no claim and propose no trade.
4. Arena proposals never write the ledger directly. Use
   `scripts/apply-arena-run.mjs`; use `npm run data:arena:catchup` only for
   missed mark-to-market work. Never create hindsight trades.
5. Draft research outputs in a temporary directory, then publish the complete
   pipeline group with `npm run data:publish -- <pipeline-id> <directory>`.
   A failed validator leaves the currently published group untouched.
6. Run `npm run data:check`, `npm run data:freshness:strict`, `npm test`, and
   `npm run build` before committing. Stage only the pipeline's declared
   outputs. Never stage unrelated or untracked user files.
7. Push one commit containing the complete validated group. On a push conflict,
   fetch/rebase once, rerun validation, and retry once. Report failure after
   that; do not force-push.

## Profile work

- `arena-premarket`: after 08:30 ET on an NYSE session, research and publish
  `arena-news.json` and `arena-picks.json` together. Record the gather and picks
  windows in `arena-runlog.json`. Empty model pick arrays are valid and safer
  than weak recommendations.
- `arena-postmarket`: after 16:30 ET, reconcile missed windows, mark every book
  to provider closes, settle only current-window proposals, update the daily
  digest, and audit prediction coverage. Missed proposal windows remain missed.
- `signal-macro`: refresh only from authoritative releases and attributable
  market reporting when older than seven days or after a material CPI, PCE,
  payrolls, FOMC, earnings, technology, or geopolitical event.
- `sectors-research`: refresh the complete four-file group when older than
  fourteen days; preserve balanced US/CN sourcing and provenance tiers.
- `horoscope-transits`: run `node scripts/gen-transits-daily.mjs
  --output=<temporary-directory>/transits-daily.json`, then validate and publish
  it once per Melbourne calendar day.

If no pipeline in the declared profile is due, make no repository change.
Return a compact result with the Chinese task name, profile, checked time, due
pipelines, files published, validation result, commit, and push status.
