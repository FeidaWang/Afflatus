> **The question:** Do more context and tools improve reliability, or simply enlarge the space for leakage and mistakes?

**Before you begin:** Run evaluations and explain the difference between the executor and model suggestions.

### Concepts and learning objectives
Separate durable project constraints, current task state and untrusted external material. Do not combine them into an ever-growing conversation. A handoff needs the goal, verified outcomes, next step, blockers and necessary file locations, rather than private conversations and full logs.

Skills supply task procedures on demand; MCP connects tools and resources. Neither automatically confers trust. Tool descriptions, repository documents and webpages can contain misleading instructions. Begin with read-only integration, learning identity, parameters, permissions, return values and failure boundaries. If a tool lacks continuation or deletion features, keep a manual process instead of pretending otherwise.

### Reading and selected sections
@readings
R43|Required|Context selection, compression and retrieval trade-offs; use mechanisms only when needed.|35
R57|Required|Versioned guidance on authorisation boundaries, tokens and connector risks.|45
R58|Required selections|Indirect prompt injection, constrained tools and layered protection.|40
@end

### Studio lab
1. Reduce project instructions to one page: startup, boundaries, tests and completion. Write a short handoff and load only relevant modules next time.
2. Capture one recurring low-risk procedure as a skill: triggers, inputs, steps, verification and stop conditions. Do not grant it automatic installation or permission expansion.
3. Write a read-only tool permission table: resources, methods, argument ranges, returned fields and timeouts. Use mock MCP or a verified public service.
4. Put a harmless injection into synthetic material, such as a request to ignore the task and emit a marker. Verify that content remains data and the executor blocks unauthorised actions.
5. Compare a short handoff with full history on the same task. Identify important lost information; keep complexity only if evidence justifies it.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Context and handoff card | A fresh session resumes a concrete task without private logs. |
| Tool permission table | Explicit allowed and denied scope with a performed rejection test. |
| Injection drill | Records actual execution, not merely the model's verbal refusal. |

**Independent exercise:** Implement one resource-scope check and test an out-of-scope parameter. Editing the system prompt alone does not count.

**Privacy and safety:** Avoid token passthrough, shared credentials and unknown MCP services. Read-only data can still be exfiltrated. Restrict unnecessary egress and exclude sensitive tool outputs from traces. Do not disable host permission prompts because a tutorial demonstrates autonomy.

**Everyday use:** Resume an interrupted learning task from a short handoff. The purpose is easier recovery, not managing an elaborate context-monitoring system.

**Pass or revisit:** A new session resumes the task, unauthorised requests are actually rejected and external text is treated as untrusted.

### A reusable collaboration prompt
```text
Create minimal project constraints, a short handoff and permissions for one read-only tool. Test synthetic prompt injection and out-of-scope arguments at the executor. Do not connect real accounts or add arbitrary file or shell access. Remove unnecessary context first.
```
