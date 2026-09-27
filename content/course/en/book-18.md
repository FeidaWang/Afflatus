> **The question:** How will you notice silent failure, stale results or endless retries, and how will you recover?

**Before you begin:** State, authentication, stopping and recovery exist. Continue the low-frequency observations begun in weeks 16–17.

### Concepts and learning objectives
Use the actual observation window; seven days cannot produce fourteen days of real history. Monitor user outcomes and resources: completed tasks, failed and unknown results, queues, latency, budget and freshness. A live server does not prove the task is working.

Keep only a few actionable alerts. Each should imply a response: retry once, inspect a source, pause or disconnect. Delete frequent notifications that nobody acts on. Operation should make a small system controllable, rather than require a second large monitoring platform.

### Reading and selected sections
@readings
R67|Required selections|User-visible faults, latency and errors.|40
R69|Required selections|Incident records, impact and actionable changes.|35
R65|Safety option|Handling sensitive data in telemetry and traces.|35
@end

### Studio lab
1. Consolidate actual week 16–18 runs and state dates and gaps. Judge task outcomes rather than HTTP 200 or a completed model answer.
2. Monitor repeated failure, missing fresh results, approaching budget and stuck runs. Verify both alert and recovery behaviour. Do not notify yourself of every success.
3. Rehearse an unavailable source, revoked configuration or unavailable storage. Pause, diagnose, restore and check for duplicate actions.
4. Write a one-page incident note: discovery, affected tasks, events, evidence, recovery and one important next change. “The model was not smart enough” is not a diagnosis.
5. Count maintenance and review time. Remove unhelpful logs, notifications and unstable features. Reduce frequency or return to manual operation when maintenance outweighs value.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Real operational report | Actual window, failures, unknowns and active maintenance time. |
| One-page runbook | Stop, diagnose, restore, verify and hand off to a human. |
| Drill evidence | A performed mock or test incident clearly distinguished from production. |

**Independent exercise:** Follow the runbook to stop and recover without agent takeover. Correct one misleading log or metric.

**Privacy and safety:** A telemetry service is another data recipient. Default to run IDs, status, usage and trimmed errors. Do not upload entire prompts, pages, personal input or tool responses. Define access and deletion for new logs.

**Everyday use:** Observe whether the service is used at its natural trigger, whether a fallback is understood and whether notification noise causes neglect.

**Pass or revisit:** Independently stop and restore the service and report failures honestly before starting controlled improvement.

### A reusable collaboration prompt
```text
Use the real observation window to report outcomes and maintenance time. Add only actionable alerts. Rehearse one controlled incident, stop and restore using the runbook, and verify side effects. Do not invent operating days or upload private logs.
```
