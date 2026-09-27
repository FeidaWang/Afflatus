> **The question:** When someone clicks approve, precisely which object, content, action and time window are authorised?

**Before you begin:** The read-only system authenticates, records, stops and recovers. Check the proposed connector's current account and permission rules.

### Concepts and learning objectives
Choose one connector: a reminder draft or a dedicated test calendar is enough. Begin with mocks, then use only a personal test environment you own and may access. A local draft for manual import is a fully valid alternative to connecting an account.

Approval is not a general licence for an agent to work. Bind it to target, action, exact content, expiry and execution identity. Changed content or destination requires new approval. Recheck authorisation and state at execution time. Payments, permanent deletion, workplace changes and consequential actions are outside the default course scope.

### Reading and selected sections
@readings
R57|Required review|Connector authentication, tokens, scope and trust boundaries.|40
R60|Required review|Object-level checks and default deny.|35
R59|Required selections|Secret storage, least privilege, revocation and rotation.|35
@end

### Studio lab
1. Document why the connector is needed, its test account or container, reads, potential writes and revocation. Exclude unrelated private resources.
2. Implement draft-only operation with a clear preview of destination and content changes. Do not let a long model summary conceal an important difference.
3. Bind approval to a fixed payload and target. Invalidate it after changes, scope expansion or expiry; recheck immediately before execution.
4. Mock unapproved, expired, changed, revoked and repeated actions. If a real write is explicitly authorised, perform one reversible action on a dedicated test resource and personally inspect the external state.
5. Practise stopping and disconnecting. Clean up test output and inspect queues for remaining work.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| One connector brief | Purpose, minimum scope, secret location and revocation are explicit. |
| Effective approval queue | Unapproved or changed actions cannot execute. |
| External-result check | Actual mock or test-resource state, with real integration status stated honestly. |

**Independent exercise:** Change a target or payload after approval and confirm executor rejection. Explain why approval must refer to a specific action.

**Privacy and safety:** Do not distribute personal login tokens as application keys, share credentials, bypass authorisation or move work data into unapproved personal environments. The person must understand and confirm external permission prompts.

**Everyday use:** Let the system prepare repetitive material while you retain the final decision. A useful draft can save more time than autonomous execution requiring constant supervision.

**Pass or revisit:** Demonstrate that unapproved work cannot execute, revocation works and output can be inspected. Otherwise retain local drafts without treating that choice as failure.

### A reusable collaboration prompt
```text
Design one least-privilege connector: mock first, draft next, then consider a reversible action on a dedicated test resource. Bind approval to target and exact content; changes require new approval. Do not connect workplace accounts, pay, delete or expand permissions.
```
