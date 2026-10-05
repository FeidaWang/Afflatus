# Signal Policy & AI Index

The English and Chinese Signal routes share one research dataset and renderer.
The redesign follows the Economic Index reference's paper, sage, serif headings,
section directory, thin rules and square record tiles. The hero illustration is
original AI-generated artwork, optimized as a 150 KB JPEG.

## Research snapshot

Source review: 5 October 2026. Historical coverage starts on 1 January 2026.
The selected archive contains 35 records: 21 Federal Reserve, 5 fiscal policy,
7 government/AI policy and 2 economic releases. It includes the six released
2026 FOMC decisions and five published meeting minutes, with direct official
URLs. Publication dates are distinct from the date of source review. Scheduled
future releases are separate from completed events.

Rate decisions, implementation, speeches, proposals, guidance and voluntary
pledges carry different labels. AI effects are conditional interpretation;
unverified returns or market reactions are explicitly absent. This is a selected
research collection, not an exhaustive copy of every official publication.

The latest policy range, chart, industry record counts and filters are derived
from the dataset. The existing Treasury yield monitor retains its live endpoint,
quote timestamps, units, refresh control and unavailable/stale states.

## Weekly operation

The active Codex heartbeat `signal-ai` reviews every Monday at 09:00 in
Australia/Melbourne. Its source and publication instructions are in
`prompts/signal-warsh.md`, under `prompts/data-orchestrator.md` and the canonical
`signal-macro` pipeline. It preserves historical records, updates both languages
together and uses the dedicated automation clone. The UI marks an unchecked
snapshot older than eight days as historical.

Publishing requires the complete existing validation/test/build transaction
and remote SHA verification. If the redesign is not on main, or checks fail,
the heartbeat retains its candidate and reports the release dependency or
failed phase. No material change means no routine notification.

## Verification on 5 October 2026

- Production build, localized SEO, data schemas, header/CSS/i18n gates and
  TypeScript check passed.
- 41 focused tests passed across the policy-index, Signal validator, data
  pipeline validators, JSON cache delivery and existing footer suites.
- Browser checks in English and Chinese passed: intersecting topic/month/search
  filters, industry shortcuts, evidence disclosures, table view, clearing and
  loading more records; locale links retain the selected section.
- Chrome at 320 and 390 CSS pixels showed no document overflow. At 320 pixels,
  all seven section links measured 44 pixels high; the 740-pixel data table
  scrolls inside its 272-pixel container. Desktop and 640-pixel layouts were
  inspected in the in-app browser. The local preview correctly shows unavailable
  Treasury quotes because Vite preview does not serve the live API.
- Full unit suite: 1,886 passed and 94 failed in 18 files. A separate clone of
  unchanged commit `f30aed08` reproduced every remaining failure name; there
  are no newly introduced failure names. Its run had 96 failed tests and a
  separate fixture error requiring a local `main` ref. Obsolete Signal narrative tests
  were replaced by the index contracts, and the cache test now uses a coherent
  previous snapshot.
- Emitted English and Chinese Signal footers match the corresponding Portfolio
  footer exactly. The shared footer was checked at 1280, 390 and 320 CSS pixels,
  including localized destinations, social icons and absence of page overflow.
- Browser regression specifications were updated for the new index. The new
  specifications have not been run through the CI browser matrix in this task;
  the behaviors above were verified through the browser UI.

The initial interactive release includes the Portfolio footer in both languages;
Portfolio and Signal now load the same footer stylesheet. The user requested
production publication with the documented baseline failures still present.
Weekly research is scheduled, but unattended publication remains subject to
the complete existing test gates; successful automatic publication must not be
claimed while those gates fail.
