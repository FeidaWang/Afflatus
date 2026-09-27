> **The question:** When the model says “done,” did the file, database or user-visible outcome actually succeed?

**Before you begin:** Reproduce a tool execution in the minimal agent and record its final state.

### Concepts and learning objectives
An evaluation specifies a task, expected result, permissible evidence, failure types and cost. Separate machine-checkable conditions, human quality judgement and model-assisted assessments requiring review. Valid structure, authentic citations, task completion and fluent prose are different dimensions.

Include missing evidence, wrong versions, tool failures and required refusals. Ten or twenty initial cases form a smoke test, not a reliability certification. Repeat stochastic runs when useful, but retain every attempt rather than the best one. Set thresholds for your own task instead of borrowing another organisation's results.

### Reading and selected sections
@readings
R42|Required|Outcomes, execution traces, grading and regression.|55
R13|Review|Turn clear expected results into independently runnable checks.|25
R36|Optional|Evaluation and practice entry points; certification does not replace project verification.|30
@end

### Studio lab
1. Define success before writing 10–20 synthetic cases. Record input, expected behaviour, evidence location, refusal conditions and severity.
2. Check valid structure, existing citation identifiers, prohibited tool use and actual stopping. Retain human review for whether evidence supports the answer.
3. Evaluate baseline and agent. Record success, failure, indeterminate and timeout, including the full denominator. Untested is not successful.
4. Reproduce two failures minimally and fix one shared cause. Rerun the same cases without changing questions or standards to improve the score.
5. Separate development and held-out cases. Keep final answers away from candidate generation through real directory permissions or execution identities, rather than a polite instruction.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Initial evaluation set | Clear expectations, sources and failure categories, including bad inputs and refusals. |
| Inspectable report | Every attempt and external final state, not only model prose. |
| Error analysis | Distinguishes tool, source, reasoning and verification failures. |

**Independent exercise:** Design a case that fools a superficial correctness check. Improve the checker without leaking the answer to the evaluated agent.

**Privacy and safety:** Cases, traces and held-out answers may contain secrets. Publish reviewed synthetic examples and methods only. Minimise recorded parameters and outputs; do not send private examples to external graders.

**Everyday use:** Keep a few review questions for a frequent personal task. Run them before accepting a new model or prompt.

**Pass or revisit:** Demonstrate a result that passes format checks but fails the task, and reproduce a key failure before granting more capabilities.

### A reusable collaboration prompt
```text
Define externally verifiable success before creating a small boundary-focused evaluation. Record failures, timeouts and unknowns; never infer success from a model's claim. Separate development and held-out cases, and let me add an independent counterexample.
```
