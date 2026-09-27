# A field handbook for the work ahead

Deployment, cost, improvement, privacy and learning templates accompany the weekly lessons. The supplied manuscript's reference baseline is **27 September 2026**; these are design practices and dated source notes, not certification of a system or a promise about future product rules.

## Deployment: choose one route
**A · Local personal tool.** Use an explicit working directory and manual triggers. If scheduling is necessary, use a system mechanism you understand. Explain sleep, shutdown, offline and signed-out behaviour. Mark cloud model inference on the data-flow diagram: a local executor does not imply local data processing. Shared devices, backups and sync remain relevant.

**B · Controlled hosted service.** Deploy a mock service, verify authentication, object permissions and persistent state, then add a few authorised read-only calls before scheduling. R71 is one example, not a required purchase. Recheck pricing, runtime, storage, region, logs and access control. A free plan may not suit background work. Keep databases off ephemeral disks; inspect R72 and R73 separately because scheduling and disk capabilities differ by service type.

| Before release | Evidence to collect |
|---|---|
| Where and under which identity does it run? | Runtime and identity description. |
| Who may trigger it and read results? | Unauthenticated, unauthorised and wrong-object rejection tests. |
| Where does data go? | Input, output, model, log and backup destinations and retention. |
| How does work start and stop? | Trigger, cancellation, total timeout and stuck-run handling. |
| Can retries duplicate effects? | Duplicate and concurrent cases; uncertain-outcome review. |
| How are costs constrained? | Billing identities and executor limits covering every retry. |
| How do real failures become visible? | User-outcome checks beyond a healthy process or HTTP status. |
| How is recovery performed? | Actual rollback and restore records, including potential data loss. |
| How is the service retired? | Stop schedules, handle queues, revoke credentials, manage stored data and external output. |

Filling a table is not a security certification. Test in the actual environment. Organisational and consequential uses need appropriately authorised review. R66 provides a risk-identification framework.

## Increase action permissions gradually
| Level | Example | Course boundary |
|---|---|---|
| L0 · No external action | Mocks, local synthetic files, offline statistics. | Begin immediately without overwriting source data. |
| L1 · Public read-only | Evidence from fixed documents. | Explicit source and network scope; traceable output. |
| L2 · Draft | Reminder text, plans and proposed patches. | Human inspection before sending or merging. |
| L3 · Reversible write | One event in a dedicated test calendar. | Specific target/content approval, deduplication, revocation and audit. |
| L4 · Consequential action | Payment, permanent deletion or production permission changes. | Outside default course automation. |

Enforce scope in the executor and server. Authentication establishes identity; authorisation determines permitted actions on a particular object. Hidden buttons, secret URLs and CORS do not replace it. See R60.

## Three separate budgets
| Budget | Typical purpose | What to verify |
|---|---|---|
| Coding subscription | Interactive development, tutoring, supported personal automation. | Authentication, tools, shared allowance, windows and extra-spend settings. |
| Application API | Model calls from your application. | Project, credentials, billing units, budget, retries and concurrency. |
| Hosting and storage | Services, schedules, databases and logs. | Runtime, persistence, network/log charges and costs after stopping. |

R53 and R54 distinguish OpenAI subscription and API billing and point to the supported Codex path. R55 and R56 distinguish Claude subscription authentication from API keys. The source manuscript records a June 15 update to R56 stating a proposed change had been paused and related SDK usage still counted toward subscription limits. This is a dated source note, not a statement of a reader's current allowance; old credit announcements must not be treated as a current balance. Recheck the official page before use.

Do not copy login tokens into unauthorised proxies, resell accounts or bypass limits. A product's “5x” marketing label is not a fixed cross-provider token quantity.

With one subscription, prioritise development and tutoring and reserve capacity for recovery and foundations. A second can review an important design, patch or difficult fault; unlimited model-to-model debate and exhausted quotas are not success metrics. Start ordinary tasks on configurations already adequate for your comparable work. Record real settings instead of assuming effort labels are equivalent across products.

Mock stopping first, then constrain total task time, tool steps, retries, concurrency and authorised expense across all subcalls. Stop or seek a new decision when funds are insufficient; never silently escalate. Provider budget alerts may not be hard caps. Example limits such as ten steps and two retries are teaching defaults, not standards. They become controls only when executed and tested. Concurrent workers need a coordinated shared budget.

## Four bounded layers of RSI
| Layer | Actual behaviour | Learning value | Claim to avoid |
|---|---|---|---|
| R0 · Record | Task metadata, observed results and failures. | Traceable experience. | Model self-report proves success. |
| R1 · Summarise | Comparable-task time, retries and configuration fit. | Evidence-informed choices. | A small sample is universal calibration. |
| R2 · Propose candidates | Limited prompt/tool changes and independent evaluation. | Adopt or reject on evidence. | The best attempt represents all attempts. |
| R3 · Propose code | Restricted-environment patches and human-reviewed release. | Controlled engineering improvement. | Autonomous changes to permissions, budgets or scoring. |

GEPA and DGM (R51–R52) are research entry points. Their settings and results do not establish benefits for your system, and this course does not claim to reproduce them or achieve unlimited self-improvement.

A useful experiment can simply test whether a version filter reduces obsolete citations. Freeze the baseline, change one rule, keep tasks, budget and permissions fixed, test independent cases and count added cost. A person adopts or rejects. Stop when there is no improvement.

Protect success criteria, permissions/budget and independent answers from the proposer. Review genuine criteria changes separately. Track holdout reuse: repeated feedback contaminates independence. Add fresh cases when needed. With inadequate data, an error taxonomy and sampling plan are more honest than a precise reliability claim.

## Put knowledge into daily life
Choose one to three relevant ideas weekly. For each, connect source, explanation, applicability, counterexample, prediction, experiment, behaviour change and reuse. No current problem means no obligation to add material or generate daily content.

Test idempotency by repeating a synthetic task and checking duplicate drafts. Test a context method by comparing a short handoff with the current recovery process. These are exercises, not claims about a real person's results. Reminders should follow natural task triggers rather than create another dashboard obligation.

## Calculate net time honestly
```text
Weekly net time saved
= your old active time for comparable successful tasks
− all new operation, supervision, review and rework, including failures
− maintenance this week
```

Record building, cash costs, unfinished demand and subjective quality separately. Background runtime is not automatically labour, but forced waiting and repeated checking must not disappear.

**Synthetic teaching example:** Twelve comparable tasks previously took six active minutes each: 72 minutes. New operation and review take 18 minutes, maintenance 14, leaving 40 minutes saved. With eight hours of building and stable future performance, simple time payback is 480 / 40 = 12 weeks. This excludes cash costs, learning value and future failures and is not a forecast for a reader.

Persistent negative savings justify reducing scope or frequency, returning to manual work or stopping. A bounded learning project may continue as learning investment. Success is choosing what belongs in your life, not keeping every prototype online.

## Privacy and safety throughout
| Data | Default treatment |
|---|---|
| Synthetic examples and public official documents | Suitable for practice; still check rights, provenance and untrusted content. |
| Ordinary personal material | Minimise and process locally first; external sending needs purpose, authority and policy review. |
| Other people's, workplace or client information | Outside default labs; needs appropriate authorisation and organisational processes. |
| Credentials, private keys and session tokens | Exclude from articles, prompts, code, screenshots, logs and public repositories. |
| Consequential sensitive data and production actions | Outside default scope; require appropriate expert and accountable review. |

Anonymous IDs only remove direct identifiers. Dates, places, roles and routines can still identify someone. Prefer synthetic reconstruction and do not automatically publish real aggregates. See R66 for risk framing, R59 for secrets and R61 for logs.

| Misconception | A more dependable check |
|---|---|
| Local program means no cloud data flow. | Inspect model calls, development tools, telemetry, backups and sync. |
| Read-only agents are harmless. | Constrain readable material, egress, returned data and logs. |
| Installed MCP services are trusted. | Check provenance, permissions, tokens and actual resource access (R57). |
| A prompt forbids abuse, so control is complete. | Test executor rejection using synthetic injection and invalid arguments. |
| An obscure URL is private. | Test real authentication and object-level authorisation. |
| A branch or container is automatically a sandbox. | Inspect identity, mounts, privileges, network and host interfaces. |
| Removing a file repairs a credential leak. | Revoke/rotate first, then address history, copies and logs (R64). |
| A website online means the agent is deployed. | Verify runtime, state, triggers, costs, stopping, recovery and outcomes. |

Prompt injection needs layered boundaries, not a magic sentence (R58). Server-side fetching needs destination, redirect and network restrictions (R62). These references are design starting points, not a professional audit of your implementation.

Before adding packages, plugins, extensions or MCP services, inspect necessity, source, maintenance and permissions. Lock verified versions and record updates, while addressing security fixes promptly. Start with minimal run IDs, status, error categories and usage. If diagnosis requires original text, define access, retention and redaction. Telemetry is another external recipient (R65).

## Update without chasing every release
As a suggested allocation, devote roughly 80% of attention to durable requirements, code, data, networking, validation, permission and maintenance, and 20% to model, SDK and hosting adaptation. This is a planning heuristic, not a research result. Keep business rules separate from model configuration and tool interfaces.

Each update record needs source, release/version date, review date, affected task, cost and permission changes, verification and rollback. Verify actual model IDs and reasoning parameters in the product or official docs.

| Cadence | Work | Stop rule |
|---|---|---|
| Weekly, 20–30 minutes | Review relevant official course, model, SDK and security changes; record at most three adopt/watch/ignore notes. | Stop when nothing affects current tasks. |
| Monthly, one bounded experiment | Compare one old/new approach on fixed tasks; retain costs and regressions. | Keep the current system without clear benefit. |
| Security or deprecation event | Assess impact, pause affected capability and make necessary repairs. | Stop once verified; do not add a full rewrite. |

This describes a maintenance plan; it does not create automatic jobs. Automated checking needs its own environment, sources, permissions and budget, and should propose rather than install or deploy changes.

Launch events, leaderboard results and social demos alone do not justify migration. Resolved failures, less review at equal quality, security fixes, deprecation and maintainability improvements justify testing. Also ask which old workaround can now be deleted; R46 offers engineering context, but your tests decide.

## Seven reusable templates
These original teaching templates organise judgement; they do not enforce budget or permissions. Keep filled private records private.

### A · Problem and workflow brief
```text
Recurring task and natural trigger:
Old workflow and observed active time:
Inputs, outputs and user:
One improvement this round:
Explicit non-goals:
Data leaving the device and destination:
Allowed reads and actions:
One normal and one failure scenario:
External evidence of completion:
Manual fallback, stop and recovery:
Next real use or trigger:
```

### B · Knowledge-to-action card
```text
Question:
Source URL, version/publication date and access date:
Exact supporting location:
Source facts:
My explanation and inference:
Conditions, limits and counterexamples:
Prediction about intervention and outcome:
Baseline, minimal experiment and stop rule:
Actual results and alternative explanations:
Decision: adopt / reject / insufficient evidence
Implemented operation, setting or code:
Fresh-scenario retest and behavioural change:
```

### C · Task and usage record
```json
{
  "schema_version": "1.0",
  "data_kind": "synthetic_example",
  "task_id": "demo-task-001",
  "task_class": "public_document_summary",
  "run_id": "demo-run-001",
  "execution_mode": "mock",
  "model_id": null,
  "reasoning_setting": null,
  "result_status": "not_run",
  "result_verified_by": null,
  "attempt_count": 0,
  "human_active_minutes": null,
  "human_review_minutes": null,
  "human_rework_minutes": null,
  "usage_value": null,
  "usage_unit": null,
  "usage_provenance": "unknown",
  "cost_amount": null,
  "cost_currency": null,
  "raw_prompt_stored": false
}
```
Zero attempts belongs to this unrun example. Missing real measurements remain unknown. Make time categories exclusive or define deduplication before aggregation. Verify actual model IDs, units and cost provenance.

### D · Evaluation case
```text
Case ID and task category:
Material: synthetic / public / separately authorised (state scope)
Input and accessible evidence:
Expected final state:
Machine-checkable conditions:
Human checks and evidence location:
Refusal or escalation conditions:
Failure severity:
Partition: development / regression / independent holdout
Who can read the answers:
Actual attempts, results, cost and unverified items:
```

### E · Improvement proposal
```text
Recurring failure and evidence:
Baseline version:
Falsifiable hypothesis:
One changed variable:
Candidate count and total budget:
Where the budget is enforced:
Development/independent evaluation isolation:
Quality, cost, latency and permission guardrails:
Results of every attempt:
Decision: adopt / reject / insufficient evidence
Approver and adoption scope:
Rollback version and steps:
```

### F · One-page incident runbook
```text
Detection signal:
Stop new triggers and queued work:
Already-sent actions that may be uncancellable:
Minimum necessary inspection and sensitive-data limits:
Distinguish permission, source, model, network and storage faults:
Check whether external action already completed:
Restore version and data recovery point:
Prevent duplicate execution during recovery:
Who verifies the restored outcome:
Impact, evidence and next minimal improvement:
```

### G · Weekly value and learning review
```text
Actually delivered, verified and unverified:
Real uses and comparable completed tasks:
Evidence for old active time:
New operation, supervision, review, failed rework and maintenance:
Net saving and calculation limits:
Build time, cash costs and learning investment:
Independent explanation, repair or transfer evidence:
One behaviour already changed:
Keep, simplify, pause or remove:
One small goal next week:
```

## Publish methods, not private records
Tell the story of problem, constraints, implementation, verification, failure and adoption or rejection. Show synthetic data flow, original sources and actual checking limits. Mark plans and exercises as such instead of turning them into personal success stories. A weekly article should retain audience, prerequisites, source-review baseline and relevant boundaries even when read independently.

Review prose, code blocks, attachments, screenshots, image metadata, archives, HTML and version history. Replace identifying personal, employer and client details, real calendars, private paths, logs, credentials and conversations with generic examples. Public examples should default to mock, read-only and unauthorised; keep real databases, backups and data-bearing source maps out of static directories. Recreate private screenshots synthetically instead of relying on reversible overlays.

Revoke exposed secrets first, then address history and copies using R64. Scanning reduces obvious omissions but does not prove anonymity or a complete security audit.

Keep educational pages separate from running agents. Reading should not require email, calendar, file or model-account access. Prefer static content; isolate any live demonstration with synthetic data and a separate budget. The source manuscript's standalone HTML statement does not describe every host site's analytics, cookies, CDN logs or hosting logs; inspect the integrated site's actual data flow.

Review CSP and referrer policy (R77–R78) in the actual deployment. Some directives, including frame-ancestors, require response headers; do not copy one page's policy blindly across a whole site.

The schedule, exercises and templates are an original educational arrangement without endorsement from cited institutions. External courses, papers, images and code retain their own terms. Links grant no right to resell, copy full works or receive credentials. License only material you have authority to license, preserve review dates and changes, and prefer official replacement links over unknown mirrors. Login-only material, future lectures and every external lab have not been comprehensively verified here.
