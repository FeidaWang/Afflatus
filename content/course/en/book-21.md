> **The question:** When an agent can edit its tool code, what prevents it from improving its score by weakening the grader or widening permissions?

**Before you begin:** Have compared candidates within a budget and be able to inspect diffs, revert versions and restore data.

### Concepts and learning objectives
Extend improvement from prompts to one specific code defect. A Git branch isolates changes, not execution privileges. Running unfamiliar code requires a restricted identity, filesystem and network. Research self-modification and personal production systems have different risks; DGM is a research reference with limitations, not proof of a safe product.

Separate proposer, evaluator and approver. The agent submits a patch, an independent process runs fixed checks and a person decides. Feature tests may change with explicit new requirements, but acceptance changes need separate review. Production release and permission changes do not belong to an autonomous improvement loop.

### Reading and selected sections
@readings
R52|Research option|Code modification, verification, risks and limitations; do not reproduce promotional performance claims.|35
R70|Environment option|Containers and basic isolation; use an existing controlled environment if sufficient.|35
R31|Required review|Branches, diffs, merging and undo.|35
@end

### Studio lab
1. Choose a small bug demonstrated by a failing test. Define allowed changes and protected boundaries. Preserve the current usable version.
2. Work on a branch inside a constrained runtime. Mount only required code and synthetic fixtures, excluding private directories, production secrets, host-control interfaces and hidden answers.
3. Request a minimal implementation diff, relevant tests and explanation. Inspect for hidden configuration changes, deleted failure cases, bypassed checks or new network dependencies.
4. Have an independent process run evaluation and personally inspect a critical result. Automated passing does not settle permissions, data flow or business effects.
5. Merge or reject manually. If adopted, trial narrowly and actually rehearse rollback. Do not let the agent deploy subsequent versions on its own.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Reviewable patch | Bounded changes without concealed permission, budget or grading changes. |
| Isolated evaluation | Actual runtime and restrictions described; a branch is not called a sandbox. |
| Decision and rollback | Evidence-backed adoption or rejection and a performed recovery. |

**Independent exercise:** Review a patch containing unrelated configuration edits, explain why to split or reject them, then revert a merged test change independently.

**Privacy and safety:** Overbroad mounts, privileged containers and host interfaces undermine isolation. Exclude production secrets and unnecessary networking. When environment risk is unclear, request a patch without running unknown code.

**Everyday use:** Repair one recurring interruption, then observe whether maintenance falls over the following week. Added testing infrastructure is not itself a life benefit.

**Pass or revisit:** Identify scope violations, know when to refuse execution and perform rollback.

### A reusable collaboration prompt
```text
Propose the smallest patch for a specified failure using a separate branch and restricted runtime. Do not change permissions, budget or independent scoring, and do not mount private data or production secrets. Independent evaluation and a person decide on merging; do not deploy automatically.
```
