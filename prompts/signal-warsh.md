# Signal — weekly Policy & AI Index research

Review every Monday at 09:00 in `Australia/Melbourne`, including daylight-saving
changes. This is the research contract for the bilingual Signal pages, whose
historical series starts on 1 January 2026. The filename is retained for existing
callers; do not assume a particular Fed chair, administration, policy stance or
interest-rate range from the filename or from memory.

## Research and evidence

Read the current `public/signal-events.json`, `src/lib/validateSignalEvents.js`
and `src/lib/signalIndexModel.js` before preparing an incremental candidate.
Review releases since the previous `checked_at`, and revisit documents for
corrections or changes in legal status. Keep existing history and stable event
IDs. Research a missed week retrospectively without backdating the review.

Use dated primary sources:

- Federal Reserve: the FOMC calendar, statements, implementation notes, minutes,
  economic projections, Monetary Policy Reports and attributable speeches.
- New York Fed: implementation and market-operation notices. For rolling pages,
  preserve a dated archival reference when available and identify the historical
  observation window; never treat the current page as proof of an old number.
- Treasury, IRS and OMB: financing/refunding, tax implementation, budget requests,
  spending and fiscal measures relevant to capital investment and AI.
- White House and the responsible agencies: current-government AI policy,
  procurement, security, trade, data centers, energy and workforce measures.
- Congress.gov or an enacted statute for legislative status; BEA and BLS for
  relevant economic context, using release-specific archival URLs.

Check the document body and publication date, rather than inferring the date
from its URL. Do not publish future events as accomplished facts. Announced
future meetings belong in `schedule`. Distinguish a speaker's opinion from an
FOMC decision, a budget request from enacted spending, guidance from a statute,
and a voluntary pledge from a binding rule. Track fiscal policy separately from
monetary policy and government AI policy.

For each material new record provide faithful Chinese and English versions of
the official fact, policy status, conditional AI-industry transmission and next
items to monitor. Explain the channels through financing costs, taxes, debt
supply, compute, cloud, power, productivity, applications and security. Attribute
government claims to the government. Do not invent a consensus estimate,
market reaction, return, probability, impact score or causal price move. If no
dated market evidence was reviewed, say so. Keep summaries concise and in your
own words; link the source.

## Dataset contract

Preserve `version: 2` and its compatibility fields. The Policy & AI Index also
requires `indexVersion: 1`, `coverage_start`, `checked_at`, bilingual
`coverage_note`, `overview.summary`, `overview.policyRate` and `schedule`.
`updated` and `checked_at` are the real review date; `as_of` is the actual review
timestamp. A successful source review may advance the checked date even when
there is no new policy announcement. A failed or partial check must not claim a
complete fresh review.

Every record retains the existing named bilingual fields (`name`, `before`,
`print`, `marketWindow`, `repricing`, `equityReaction`, `industryTransmission`,
`verdict`), a direct HTTPS `source`, `marketSources`, and compatible legacy
fields. It also requires a known `topic`, `status`, `agency` and nonempty
`sectors` from the shared model. Only FOMC rate decisions carry `rate`, with
`lower`, `upper`, signed `changeBps` and the verified vote. Set the overview
range/date/source from the latest recorded FOMC decision. Do not infer a cut or
hike from a speech or an implementation-only note.

Update `coverage_note` to describe the actual scope and decision/minutes counts,
the current overview, legacy summaries and the next verified calendar dates.
Do not silently promote a selected archive into a claim of exhaustive coverage.
The page derives its rate chart, record counts, industry tags, month filters and
latest policy highlights from the dataset; no parallel bilingual HTML edit is
needed for weekly data updates.

## Publication

Follow `prompts/data-orchestrator.md` and the canonical `signal-macro` pipeline.
Declare profile `morning-research` but publish only `signal-macro`; this weekly
invocation does not authorize refreshing other pipelines. Use the dedicated
automation clone at `/Users/feida/Developer/afflatus/dist_automation`, on clean
`main` tracking `origin/main`, with the orchestrator lock. Never write into a
developer checkout or reset another task's files.

Fetch and reconcile before research as specified in the orchestrator contract.
Verify that `origin/main` includes `indexVersion: 1` and the redesigned Signal
renderer before publication. If the initial redesign is not released, preserve
the researched candidate outside the checkout and report that release is
required; do not replace the live dataset with an incompatible schema.

Prepare `signal-events.json` in a temporary candidate directory outside the
checkout. Inspect scoped freshness with
`npm run data:freshness -- --json --pipeline=signal-macro`. Publish the complete
candidate with `npm run data:publish -- signal-macro <candidate-directory>` and
push only through `scripts/push-data.sh public/signal-events.json <audit-message>`.
The publisher's validation, strict scoped freshness, full tests, production
build, path-limited commit and remote SHA verification remain mandatory. Do not
relax or skip gates to compensate for unrelated failing tests. On failure retain
the candidate and report the failed phase without claiming the website updated.

After a successful push, verify both `https://feida.au/en/signal.html` and
`https://feida.au/zh/signal.html`, and the deployed dataset's checked date.
Stay quiet when there is no material new policy or actionable change. Notify
in this chat only for a substantive weekly update, publication failure, initial
release dependency or required user action. Do not send email or other messages.
