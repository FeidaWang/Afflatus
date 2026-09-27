> **The question:** What is the user really trying to accomplish, and why does the current tool stop short of helping?

**Before you begin:** Have shipped and recovered a small tool. Be ready to observe your actions rather than list desired features.

### Concepts and learning objectives
Use an FDE approach to turn vague frustration into a testable improvement. P1 is a local weekly planner, a generic teaching example with user-configured availability and task categories. Its schedule does not prescribe employment rules or institutional policy.

Separate fact, hypothesis and design. “I repeatedly enter the same tasks” is an observation; “templates will help” is a hypothesis; “copy last week” is a design choice. Check whether a setting, spreadsheet or ordinary script already solves the problem. An agent is not the default answer. One page of workflow analysis is enough.

### Reading and selected sections
@readings
R74|Required|Research goals, questions and suitable observation methods.|40
R09|Required|Intent, specifications and human/AI iteration in the course description; note prerequisites.|20
R47|Optional|Repository information, checkable feedback and execution environments.|45
@end

### Studio lab
1. Record the full process of planning a week: task sources, repeated entry, conflict checking, export and revision. Record steps and active time rather than private screens.
2. Separate pain points, evidence and hypotheses. Pick one main friction; repeated typing may matter more than a polished chart.
3. Write three acceptance scenarios: an ordinary week, an unavailable day and overlapping tasks. Let users configure durations and limits.
4. Build a thin end-to-end slice: enter tasks, view a plan, check conflicts and preview export. Reuse earlier validation, components and tests.
5. Compare old and new workflows. Record remaining friction and explicit non-goals such as chat, collaboration and cloud sync. Ease of implementation is not a reason to expand scope.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| One-page workflow brief | Facts, hypotheses, non-goals, data boundaries and scenarios are separate. |
| One end-to-end improvement | Addresses an observed repeated operation. |
| Old/new comparison | Comparable observations; “not improved yet” is an acceptable result. |

**Independent exercise:** Rewrite “smarter and easier” as a testable scenario. Let someone assess it without explaining your intended design first.

**Privacy and safety:** Default to your own low-risk workflow. Obtain informed consent before interviewing another person. Avoid client records, internal workplace processes and other people's calendars. Demonstrate with generic tasks.

**Everyday use:** Put P1 into the next real planning session. Identify the precise step that would become harder without it.

**Pass or revisit:** Explain which observation justified a feature and exclude at least one non-goal in practice. If everything is mandatory, narrow the pilot.

### A reusable collaboration prompt
```text
Help me separate workflow steps, evidence and assumptions. Pick one frequent low-risk friction and write three acceptance scenarios for a local weekly planner. Implement one end-to-end improvement without assuming an agent, cloud sync or multi-user system is needed.
```
