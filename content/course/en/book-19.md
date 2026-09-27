> **The question:** Is your model recommendation based on comparable tasks, or the impression left by one recent success?

**Before you begin:** Distinguish tasks, attempts, outcomes and human review. A small dataset is acceptable; do not claim it is calibrated.

### Concepts and learning objectives
Begin P3, the AI task and cost ledger. Retain only task category, environment, actual model or tool version, available reasoning configuration, attempt count, active time, outcome and usage provenance. Represent unknown as null or an explicit state, never zero. Do not collect raw prompts or personal material by default.

Difficulty, permissions, context length and retries confound model comparisons. A median describes typical behaviour but needs failure rates and worse cases alongside it. Small samples support local observations only; no magic sample count establishes calibration. Subscription percentages do not automatically convert into uniform token counts. Label measured, estimated and unavailable values.

### Reading and selected sections
@readings
R17|Required review|Aggregation, filtering and queries; separate task grain from attempt grain.|35
R42|Required review|Repeated attempts, outcomes and regression records.|35
R65|Safety option|Minimise usage and tracing metadata.|30
@end

### Studio lab
1. Define a contract separating model-claimed success from independently confirmed success. Include failures, timeouts, cancellations and unknown outcomes.
2. Label provider-reported, directly measured, estimated and unknown quantities. Preserve provenance when precise cost or context length is unavailable.
3. Aggregate only comparable task groups after checking duplicates and missing data. Report insufficient evidence when appropriate.
4. Draft a modest recommendation rule: use a configuration already adequate for this low-risk category and escalate only after specified failures. Review it manually rather than changing settings after every result.
5. Use P3 to choose and record a budget for the next actual session. Local statistics do not require another model call.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Trustworthy ledger | Tasks and attempts are distinct; outcomes and usage have provenance. |
| Qualified summary | Comparable tasks, retained unknowns and failures. |
| Local recommendation | Explicit scope and abstention when evidence is inadequate. |

**Independent exercise:** Inspect synthetic duplicates and missing values, explain why a naïve average misleads and write the correct query.

**Privacy and safety:** Use official, authorised exports. Do not inspect opaque internal databases, extract session credentials or bypass interfaces for quota information. Minimise task names and paths; even aggregates may expose activity and should not publish automatically.

**Everyday use:** Choose an already-tested configuration by task rather than defaulting to maximum intensity. Measure reduced rework and switching rather than subscription consumption.

**Pass or revisit:** Distinguish measurement, estimation and unknowns. Insufficient data is valid; do not manufacture tasks to inflate the sample.

### A reusable collaboration prompt
```text
Create a minimal-metadata ledger separating tasks, attempts, outcomes and usage sources. Compare similar tasks only. Do not replace unknowns with zero or invent model and quota information. Use local statistics for limited recommendations without extra reflection calls.
```
