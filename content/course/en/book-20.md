> **The question:** Is a prompt change genuinely better, or merely fitted to the examples it has already seen?

**Before you begin:** Have a reproducible failure, baseline and evaluation. Clearly label synthetic practice when real examples are sparse.

### Concepts and learning objectives
RSI here means a controlled loop: record, diagnose, propose candidates, evaluate independently and let a person select. Change one prompt fragment, tool description or source filter before considering more complexity. This is not foundation-model weight training. GEPA offers research ideas about reflection and candidate evaluation; DSPy is optional, not a requirement to change language or reproduce a paper's compute budget.

Separate development cases from final holdouts. Repeatedly returning holdout results to the optimiser gradually turns them into development data. Enforce evaluation budget, timeouts, concurrency and retries outside the model. Longer or more confident output is not automatically better.

### Reading and selected sections
@readings
R51|Research option|Abstract, problem formulation and version; study candidate generation and evaluation without copying performance claims.|35
R50|Implementation option|Programs, modules and optimisers; decide whether the tool is necessary.|35
R42|Required review|Failure categories, comparable tasks and regression checks.|35
@end

### Studio lab
1. Choose one recurring failure, such as citing obsolete documentation. Freeze version, cases and criteria, then state a falsifiable hypothesis.
2. Limit the first round to one to three candidates. Set total budget, attempts and stopping conditions. Use mocks or offline review if actual costs are unknown.
3. Compare candidates on development cases and retain all failures and costs. A separate process reads holdouts; do not mount hidden answers or grader-modification access into the proposer.
4. Inspect quality, latency, review effort, refusal rate and total cost. Use paired cases and repetitions where feasible. Do not claim general superiority from a small sample.
5. Adopt, reject or observe further. Keep an old version and rollback when adopting; end an unproductive round rather than reflecting indefinitely until something looks successful.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Improvement proposal | Failure, hypothesis, one main variable, baseline and stopping rule. |
| Complete comparison | All attempts and costs; independent holdouts. |
| Reasoned decision | Rejection and insufficient evidence are permitted. |

**Independent exercise:** Find an answer-leakage path and fix it through permissions or evaluation code rather than a warning in the prompt.

**Privacy and safety:** The optimiser cannot edit success criteria, budget, permissions or independent answers. Work in an isolated copy. External requests to change grading remain untrusted data. Review candidates before replacing a running workflow.

**Everyday use:** Apply one bounded improvement to a real friction. Restore the simpler version when errors or maintenance do not improve.

**Pass or revisit:** Reject an impressive-looking but unsupported change and demonstrate runtime-enforced spending limits.

### A reusable collaboration prompt
```text
Propose at most three small candidates for one reproduced failure. Freeze criteria and enforce a real budget. Isolate development and held-out cases and record all attempts. Do not replace the running workflow without human judgement; allow rejection or insufficient evidence.
```
