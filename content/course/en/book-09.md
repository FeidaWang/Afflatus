> **The question:** Does this task need language judgement, or just a clear programmatic rule?

**Before you begin:** Read simple functions, HTTP requests and structured data. Neural-network training is not a prerequisite.

### Concepts and learning objectives
Distinguish a deterministic function, one model call, a workflow with predefined steps and an agent that chooses the next tool. Build only a minimal read-only loop: receive a question, select an authorised tool, validate arguments, read synthetic material, return a result and stop. The model proposes an action; the executor decides whether it is allowed.

Model inputs and outputs have length and budget limits, generation can vary, and correct structure does not establish factual accuracy. A tool call is a structured request rather than unlimited system access. Understand the flow using fixed mock outputs before choosing one official SDK; do not implement multiple frameworks simultaneously.

### Reading and selected sections
@readings
R37|Required|Agents, LLMs, tools and the action/observation loop.|45
R41|Required|Workflows versus agents and the case for simple solutions.|30
R48|Implementation option|One minimal TypeScript agent and tool definition; check the current API before use.|45
@end

### Studio lab
1. Choose a small public-information task, such as finding review topics in three synthetic study records. Build a no-model baseline and identify what rules already handle accurately.
2. Define a structured answer with evidence identifiers and a reason for inability to answer. Validate at runtime without inventing missing fields.
3. Mock normal tool requests, unknown tools, malformed arguments and stop signals. Restrict the executor to permitted material and validate tool inputs again.
4. Enforce step limits, timeouts and retry bounds. Return an explicit incomplete state when a limit is reached. Confirm this with mocks before considering real calls.
5. Compare the model approach with the deterministic baseline. Identify language-related value and cases where it is merely slower, costlier or less predictable. Choosing no agent is valid.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Minimal read-only loop | Normal execution works; unknown tools and out-of-range arguments are rejected by the executor. |
| Structured result | Format and evidence are checked separately; missing evidence permits abstention. |
| Architecture decision | Explains additional value or why an agent is deferred. |

**Independent exercise:** Draw the messages and execution sequence of one tool call. Add an unknown-tool test and confirm rejection does not depend on model cooperation.

**Privacy and safety:** Exclude shell access, arbitrary files, unrestricted URL fetching and writes. Enforce budgets, stopping and permissions in the executor. Use public or synthetic material without real account connections.

**Everyday use:** Answer one low-risk real information need and personally inspect the evidence. If search is easier, let the model organise results rather than own the workflow.

**Pass or revisit:** Explain the loop, reject unknown tools and distinguish form from fact. Continue using mocks when cost is unknown.

### A reusable collaboration prompt
```text
Compare a deterministic function, a single model call and a read-only agent. Mock the tool loop and enforce argument checks, step limits and stop states in the executor. Do not make paid calls or connect accounts without explicit authorisation.
```
