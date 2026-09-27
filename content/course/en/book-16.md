> **The question:** What happens when a connection drops, a task triggers twice or the process restarts halfway through?

**Before you begin:** Have a controlled, manual, read-only runtime; locate a request and stop its process.

### Concepts and learning objectives
Model pending, running, succeeded, failed, awaiting-human and cancelled states. Store them durably for the chosen environment; memory and temporary disks may disappear on restart. Side effects have uncertainty windows before and after execution, so retrying cannot simply repeat everything blindly.

Idempotency means repeats do not create additional unwanted effects. Generating an ID alone does not guarantee exactly-once execution. When an external action's outcome is uncertain, inspect the target system or involve a person. Local SQLite may be sufficient; a new orchestration framework is optional.

### Reading and selected sections
@readings
R49|Optional|Persistent state, thread or run identity and recovery concepts.|40
R68|Required selections|Hypothesis-driven investigation of interruptions and retries.|35
R72|Hosted option|Scheduling, run limits and stopping; do not assume persistent-disk support.|35
@end

### Studio lab
1. Assign non-personal run IDs and persist state and minimal results. Distinguish identical triggers, repeated input and genuinely new tasks.
2. Add bounded retries, backoff, total timeout and cancellation. Retry only suitable errors; malformed data and denied permission must not loop forever. Count every retry against the budget.
3. Mock interruption, timeout, duplicate triggers and a result returned before its state was saved. Avoid duplicate drafts and route uncertain completion to human checking.
4. Verify filesystem persistence and service limits. Scheduled jobs need a suitable durable data layer; check [R72](https://render.com/docs/cronjobs) and [R73](https://render.com/docs/disks) independently.
5. Restore a synthetic backup into a new location and compare counts and key fields. Recovery must not replay external actions automatically.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Durable state and deduplication | State survives restart and repeated triggers have tested behaviour. |
| Failure drill | Timeout, interruption, duplication and uncertain completion are covered. |
| Restorable backup | An actual restore, stated recovery point and loss limitations. |

**Independent exercise:** Trigger the same task concurrently and inspect which executions acquire permission. Explain why disabling a UI button does not solve server concurrency.

**Privacy and safety:** Protect backups and state tables with access and retention controls. Minimise logs; see [R61](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Stopping new work does not automatically cancel queued or already-sent actions.

**Everyday use:** If ready, schedule a low-frequency, finite read-only task. Skip inference when nothing changes and make failure notifications actionable.

**Pass or revisit:** Recover, deduplicate and stop, and know how to handle uncertain outcomes before attempting approved writes.

### A reusable collaboration prompt
```text
Add persistent state, deduplication, bounded retry and cancellation to a read-only task. Mock interruptions and repeats without promising exactly-once external execution. Distinguish temporary from durable storage and actually restore a synthetic backup.
```
