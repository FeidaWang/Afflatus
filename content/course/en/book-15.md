> **The question:** Will the task run when your laptop closes, whose account pays, and who can open its results?

**Before you begin:** P2 works manually with basic evaluations and data boundaries. Understand browser versus server and be able to restore code.

### Concepts and learning objectives
Deploy a controlled execution environment rather than a chat window on a webpage. Distinguish the development agent, application agent and evaluation tools: their models, identities and budgets may differ. Choose either a manually triggered local tool or an authenticated, read-only hosted service. Both are valid; cloud purchases are not compulsory.

Do not schedule automatically yet. Specify trigger, runtime identity, storage, access and stop controls. Separate subscription, API and hosting costs. Supported subscription automation depends on current official rules; arbitrary applications are not automatically covered by a subscription. Consult [R53](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform) and [R54](https://developers.openai.com/codex/pricing/).

### Reading and selected sections
@readings
R24|Required selections|Node services, HTTP interfaces and deployment.|40
R60|Required|Identity, roles, object-level access checks and default deny.|35
R71|Hosted option|Official Node Express deployment steps; check costs separately.|40
@end

### Studio lab
1. Draw the runtime: manual trigger, permitted public sources, optional model, controlled result storage. Label network arrows with fields, identity and payer.
2. Choose local Node with explicit sleep, offline and shutdown limits, or one hosted service using established authentication or managed access control.
3. Deploy a no-model health check and mock task first. Verify from an unauthenticated session that restricted requests fail without leaking configuration.
4. Store secrets using the platform's mechanism. Confirm authentication and budget before one or two explicitly authorised read-only calls. Record measured cost or unknown.
5. Document stopping, credential revocation, output location and cleanup. Keep real configuration separate and public examples in mock mode.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Read-only runtime | Location, trigger and behaviour during shutdown are explicit. |
| Access test | An unauthorised session cannot trigger tasks or access private results. |
| Three-part cost account | Subscription, API and hosting have identified sources; unknown cost does not trigger automatic execution. |

**Independent exercise:** Trace a mock HTTP request through executor and output. Remove a configuration value and confirm clear rejection rather than fallback to a real service.

**Privacy and safety:** Exclude production secrets from frontend builds, screenshots, logs and evaluation attachments. Local code does not imply local model inference. A consumer subscription is not institutional data-processing approval. Review hosting logs and backups separately.

**Everyday use:** Complete one public-information task through a fixed entry point and retain a manual alternative.

**Pass or revisit:** Stop the runtime, explain access and payment, and demonstrate denial before adding scheduling. Otherwise keep local manual operation.

### A reusable collaboration prompt
```text
Deploy a mock read-only runtime first. Explain local or hosted operation, authentication, storage, stopping and costs. Keep real paid calls disabled and secrets out of the browser. Verify unauthorised access is rejected before expanding visibility.
```
