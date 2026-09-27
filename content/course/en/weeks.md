## Week 01
> **The question:** Which small task do you repeat every week that would be worth reliably removing once?

**Before you begin:** Be comfortable using a computer and installing ordinary software. Confirm you may install development tools on this device; prior mastery of a programming language is not required.

### Concepts and learning objectives
Distinguish a file, which contains data, from a program, which describes processing rules, and the runtime, which determines where those rules execute. Draw input, processing and output as three boxes, then add failure and recovery paths. Your diagnostic should cover reading a small function, inspecting arrays and objects, explaining JSON, identifying the terminal's working directory, distinguishing browser from server, reviewing a code diff and recognising secrets. Mark gaps honestly; do not have AI answer the diagnostic for you.

Choose a low-risk first tool: remove duplicates from a text list, total study-task durations or organise a public bibliography. A script or offline page is sufficient. Email access, new subscriptions, accounts, automatic deletion and bulk renaming are outside this week's scope.

### Reading and selected sections
@readings
R02|Required|Paths, working directories and standard input/output. Run examples only in a practice directory.|35
R27|Required|Grammar and types; Functions. Explain variables, parameters and return values.|45
R12|Foundation|Functions and variables as a conceptual bridge; keep your main project in its existing language.|40
@end

### Studio lab
1. Describe three recurring tasks: trigger, input, expected output, previous active time and cost of an error. Pick the lowest-risk task likely to recur this week. Write one page of requirements and explicit non-goals.
2. Spend 60–90 minutes on the diagnostic. Classify items as explainable, solvable with documentation or needing a bridge. Keep your initial answers; this time comes from the lab budget.
3. Create a practice directory containing synthetic examples. Write an input and expected output yourself, then ask a coding agent for the smallest implementation. Require a clear account of changed files, startup and unverified behaviour.
4. Run normal, empty and duplicate inputs. Inspect the outputs yourself. Preserve source input and write a new file or preview.
5. Use the tool for one genuine low-risk task. Record confusion before adding features, and choose a natural place to open it next time.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| One-page problem brief | Task, inputs, outputs, non-goals, data boundary and an actionable example. |
| One local output | You ran it and can point to the producing logic; empty input fails intelligibly. |
| One use record | Actual observations; anticipated savings are not reported as measured results. |

**Independent exercise:** Predict a function's output for new input before running it. Explain parameters and return values without having a generator provide the answer.

**Privacy and safety:** Keep practice files separate from private documents. Exclude usernames, real paths, employers and credentials from public examples. A locally running tool does not mean the development agent keeps all code on your device; check its accessible directories.

**Everyday use:** Replace one old operation and identify its next trigger. The outcome should remove a step or expose an error, rather than create another unused dashboard.

**Pass or revisit:** Continue when you can explain input, output and failure. If functions, files and execution still make no sense, take the foundation bridge first.

### A reusable collaboration prompt
```text
Act as a tutor: let me complete a short diagnostic independently, then build the smallest local tool for one low-risk recurring task. Define inputs, outputs and non-goals. Do not connect accounts or overwrite source files. Verify normal and empty inputs, then give me a small modification exercise without supplying its answer.
```

## Week 02
> **The question:** Can incomplete, reordered or duplicate input still produce an explainable result?

**Before you begin:** Run last week's tool and recognise functions, parameters, arrays and objects. Fill these gaps before adding an interface.

### Concepts and learning objectives
Separate pure processing from side effects: receiving input, computing a result and writing a file or updating a page should not be one enormous function. Understand strings, numbers, booleans, arrays, objects and the roles of Map and Set. Explain why an empty string and an absent value cannot both silently become zero. Learn the minimum useful branching, loops, exceptions and modules.

Type declarations help during development, but data from files, networks and models still needs runtime validation. Understand one validation rule yourself before introducing a library. Three fields do not require an elaborate framework. Incorrect examples often reveal boundaries better than repeated correct ones.

### Reading and selected sections
@readings
R27|Required|Control flow and error handling; Indexed collections; Keyed collections; Functions.|60
R28|Required|Everyday Types and Narrowing; distinguish type hints from checking actual inputs.|35
R13|Foundation|Independent inputs and expected outputs for a function.|25
@end

### Studio lab
1. Separate input, pure processing and output without changing behaviour. Refactoring and a new feature should be separate changes.
2. Define fields, units and valid ranges: integer minutes, empty-title policy and the identity used for deduplication. Mark missing information rather than inventing a plausible value.
3. Prepare normal, empty, missing-field, wrong-type and duplicate cases. Predict acceptance or rejection before running each. Errors should tell the user what to fix.
4. Lock the behaviour down with one testing method in your current toolchain. AI may generate repetition, but you must review the expected values.
5. Add preview-only operation or keep writing to a new file. Trace one input through every function and simplify the hardest function until you can read it line by line.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Data contract | Fields, types, units, missing values and duplicate rules are explicit. |
| Boundary tests | Repeatable normal and abnormal cases with personally checked expectations. |
| Understandable errors | Invalid input is rejected or labelled, never quietly converted into other valid data. |

**Independent exercise:** Add a positive-duration rule or trim title whitespace. Write a failing example first; do not ask for a complete generated patch.

**Privacy and safety:** Minimise output and avoid retaining raw-input debug copies. Do not interpolate user text into executable commands or SQL. Leave external actions out when they are unnecessary.

**Everyday use:** Use validation on a task previously prone to copy-and-paste mistakes. Earlier error detection is useful even when it saves no clicks.

**Pass or revisit:** Explain a validation failure and independently add a rule. A test that only asserts no exception is not yet a correctness check.

### A reusable collaboration prompt
```text
Clarify the data contract and separate parsing, pure logic and output. Write minimal tests for real boundaries without expanding the framework. Let me add a validation rule and check that I understand static types versus runtime validation.
```

## Week 03
> **The question:** Can you restore a usable project after AI breaks it, or recreate it in a clean environment?

**Before you begin:** Have a small tool with basic tests and understandable core functions. Use a practice repository without secrets.

### Concepts and learning objectives
Understand history, working trees, commits, branches, diffs and undo. The goal is to explain what changed, why and how to recover, rather than memorise every Git command. Distinguish a dependency manifest, lockfile, runtime version and configuration. Reproducibility comes from a clear environment, not from copying a private directory.

Debug by reproducing, narrowing, forming a hypothesis and checking it. Read the error location and call relationships before changing code. Do not repeatedly send full logs and repositories to different models hoping for a rescue. Build a small intuition for one-pass traversal, nested loops and set lookup; understand and measure before optimising.

### Reading and selected sections
@readings
R04|Required|Commits, diffs, branches and recovery.|40
R03|Required|Reproduction, debugger use, logs and fault localisation.|45
R07|Optional|Types and code-quality feedback; install only checks you currently need.|35
@end

### Studio lab
1. Commit a working state with startup instructions and a lockfile. Review staged files; exclude credentials, raw records, dependencies and caches.
2. Introduce a small fault, such as minutes being interpreted as hours or broken deduplication. Record its trigger, actual result and expected result; locate it with a debugger or minimal logs.
3. Fix only the cause. Run relevant tests and review the diff. Record hypothesis, evidence and repair.
4. Recreate the project in a clean temporary directory. Identify network-dependent steps and review new dependency sources and installation scripts.
5. Restore the previous usable version, then the repaired version. Preserve shared history rather than force-pushing over another person's work.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Reproducible instructions | Startup succeeds from a clean directory; runtime, package manager and lockfile relationships are clear. |
| An explainable fix | Failing example, minimal diff and actual verification. |
| A recovery drill | You performed rollback; it is more than a README claim. |

**Independent exercise:** Locate a planted bug with the generator closed. Documentation is allowed; write your own causal hypothesis before editing.

**Privacy and safety:** A gitignore cannot revoke a disclosed secret or erase committed history. Revoke or rotate exposed credentials first, then follow [R64](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Deleting the current file is insufficient.

**Everyday use:** Give your tool a reliable answer to “what if it breaks?” Preserve a minimal reproduction next time instead of rebuilding everything.

**Pass or revisit:** Locate the relevant function from an error, understand a patch and restore a prior version. Break unexplained rewrites into smaller changes.

### A reusable collaboration prompt
```text
Do not rewrite the project. Reproduce the specified failure, propose one testable cause, make a minimal patch and run relevant checks. Document clean-environment reproduction and rollback, then let me locate a second small error independently.
```

## Week 04
> **The question:** As records accumulate, can you explain every number and how duplicates and missing values are handled?

**Before you begin:** Understand objects, arrays, validation and basic Git. Distinguish raw data from calculated results.

### Concepts and learning objectives
Use local SQLite or a familiar relational database. Define what one row means before drawing relationships. Learn primary and foreign keys, non-null and unique constraints, filters, sorting, aggregation and joins. Keep zero, unknown and not applicable distinct. Mixing data at different grains is often more dangerous than SQL syntax.

Start with two entities: tasks and runs. A task can have multiple runs, including failures. Understand transactions and migrations: related writes must not half-succeed, and schema changes need a version and recovery path. Use synthetic data rather than building a cloud analytics platform.

### Reading and selected sections
@readings
R18|Required|Filtering, sorting and aggregation; compare results with hand calculations.|45
R19|Required|Keys, constraints and table relationships.|45
R17|Optional|Joins in Relating; writes and transactions in Writing.|30
@end

### Studio lab
1. Draw two tables and define one row in each. Make a small synthetic dataset with duplicates, missing values and failures; hand-calculate several query answers.
2. Write schema and seed scripts. Insert invalid data deliberately and confirm both database rejection and an understandable application error.
3. Query unfinished tasks, actual runs by category and elapsed time for records with known values. Keep failed and unknown outcomes separate and state the success-rate denominator.
4. Add a status field through a migration. Back up, migrate, verify and restore; a successful command exit alone is not proof.
5. Write a minimal data dictionary: meaning, unit, null semantics, provenance and retention. Remove fields with no actual purpose.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Schema and migration | Constraints actually trigger and a local backup is restored. |
| Three verifiable queries | Results match manual calculations; joins do not unexpectedly multiply rows. |
| Data dictionary | Grain, source, units and missingness are explicit. |

**Independent exercise:** Write a query finding tasks with a failed run and no later success. Establish the answer on paper first.

**Privacy and safety:** Database files, backups and CSV exports can all contain sensitive information. Publish synthetic seeds only. Parameterise queries and keep backups out of public static directories.

**Everyday use:** Add just enough structured history to locate frequent failures, rather than collecting a full record of your life.

**Pass or revisit:** Explain join behaviour and aggregation denominators and recognise duplicate writes. Displaying missing information as zero fails this checkpoint.

### A reusable collaboration prompt
```text
First review what one row means, then design minimal relational tables and constraints. Use synthetic records, three manually checkable queries and a reversible migration. Do not connect a cloud database or use real personal or work records as seeds.
```

## Week 05
> **The question:** After a click, where is the data processed, who receives it, and what does the user see when something fails?

**Before you begin:** Understand data structures and core processing functions. Read Web fundamentals before attempting an entire full-stack course.

### Concepts and learning objectives
Distinguish four execution locations: browser, server, database and external model. Learn methods, status codes, JSON, timeouts and asynchronous handling. Interfaces need empty, loading, success and error states. Learn only the React components, props, state and events required for this task.

The browser alone may be sufficient for the local planner. Add a backend only for a concrete reason. Browser environment variables and build output cannot conceal API keys. Authentication and permissions are not a matter of displaying a button. Use mock APIs before connecting accounts.

### Reading and selected sections
@readings
R32|Required|Requests, responses, clients and servers.|35
R29|Required|Components, rendering data, events and state; build a minimal form.|50
R22|Foundation|Browser/server interaction and the network panel.|35
@end

### Studio lab
1. Build a page with only necessary fields, reusing pure functions and tests. Walk through one common task using synthetic input.
2. Inspect a request in the browser network panel. Explain method, path, status and body. If nothing is sent, establish that from observation.
3. Simulate a slow response, offline operation, a server error and malformed data. Show an actionable recovery message. Prevent accidental repeated clicks while recognising that server-side deduplication is still needed.
4. Render user and model content as text. Do not trust arbitrary HTML merely to support Markdown. Check keyboard access, labels and error placement.
5. Draw the data flow: local fields, transmitted fields and retention. Remove unnecessary requests and third-party components.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Minimal interactive page | All four states can be demonstrated and the core flow works by keyboard. |
| Data-flow explanation | Trace an input through the interface, processing and output. |
| Boundary checks | No secrets in the page or build; untrusted content cannot execute as HTML. |

**Independent exercise:** Add an error state or extract a long event handler into a testable function. Describe the trigger first.

**Privacy and safety:** CORS is not authentication, and a hidden button is not authorisation. Use controlled Markdown rendering; see [R63](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html). Identify the exact step when data leaves the device.

**Everyday use:** Put the tool somewhere you naturally open, such as a bookmark. Reminders cannot compensate for an unnecessarily difficult workflow.

**Pass or revisit:** Explain observed requests and demonstrate failure paths. A screenshot alone does not demonstrate understanding.

### A reusable collaboration prompt
```text
Connect existing pure logic to a minimal page. Add empty, loading, success and error states using synthetic input and a mock API. Explain each network request and let me independently add one error handler. Avoid a new large architecture.
```

## Week 06
> **The question:** What separates working in your development window from a tool someone can run by following instructions?

**Before you begin:** Have a small page or local tool, and know how to test it, inspect networking and revert code.

### Concepts and learning objectives
Distinguish a development server, production build and release. Understand build inputs, locked dependencies, configuration, relevant checks and version notes. Delivery can be a local runnable package; public hosting is optional. Shipping an ordinary tool prepares you to deploy an agent later.

Use proportionate verification: fast tests for core logic, one important interface journey and startup in a clean environment. Preserve actual commands, exit results and necessary logs. An agent's assertion that tests passed is not evidence, and every CSS edit does not need a full-site screenshot matrix.

### Reading and selected sections
@readings
R05|Required|Builds, versions and delivery.|45
R30|Required|Runtime and project-startup sections needed for your project.|35
R35|Optional|Page structure and form feedback; check the core journey.|40
@end

### Studio lab
1. Choose one delivery target: an offline page, a local command-line package or a private test site containing synthetic data.
2. Write startup instructions for a newcomer, including versions, dependencies, configuration and offline limitations. Missing settings must fail clearly instead of connecting to a real service.
3. Run checks relevant to your change, then open the release in a clean directory or environment. Compare core development and release behaviour and inspect included data.
4. Save a verified version with brief release notes. Perform rollback. Explain whether schema changes require restoring data as well as code.
5. Review the release contents: source, archive directories, screenshots, logs, build files, hidden files and history. Package only what a reader needs.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| A usable release | Starts in a clean environment and completes one real core journey. |
| Verification record | Executed and unexecuted checks are distinguished. |
| Recovery path | Rollback was performed and migration limitations are documented. |

**Independent exercise:** Remove one harmless configuration value, read the error and recover without regenerating the project.

**Privacy and safety:** Exclude environment files, real databases, private logs, conversations, browser exports and whole working directories. A public address is not access control. Do not expose a development server without appropriate restrictions. See [R64](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

**Everyday use:** Use the release at least twice. Note whether ordinary operation still requires opening developer tools.

**Pass or revisit:** A newcomer or your future self can start it, stop on failure and restore a version. Reduce scope if this remains difficult.

### A reusable collaboration prompt
```text
Package the current minimal tool reproducibly and run checks relevant to the change. List verified and unverified behaviour, startup and rollback. Check the release for private data. Do not deploy publicly or perform a large refactor.
```

## Week 07
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

## Week 08
> **The question:** When the task happens again, will you naturally open the tool a second time?

**Before you begin:** P1 has a minimal workflow, a defined scope and a way to export, retain and recover local data.

### Concepts and learning objectives
Focus on daily usability. Distinguish dates, time zones, durations, all-day events and recurrence. For ICS, study VEVENT, UID, DTSTART, DTEND and text escaping. Start with one-off events before recurrence and time-zone changes.

Standards compliance and a particular calendar client's import behaviour are separate concerns. Stable identifiers do not guarantee that reimport updates rather than duplicates events. Record actual behaviour in a test calendar. Local export is not two-way sync; be explicit about update and deletion limitations.

### Reading and selected sections
@readings
R33|Required|Event components, time fields, unique identifiers and text escaping; selected sections only.|50
R35|Required|Keyboard use, labels, error messages and page structure.|30
R75|Optional|Observe completion of a task rather than asking whether someone likes the interface.|40
@end

### Studio lab
1. Plan a real week using non-sensitive names. Observe entry, copy, editing, conflict feedback and export. Fix blockers before adding animation.
2. Test overnight events, empty titles, non-ASCII text and overlaps. State the source of dates and zones; reject unsupported situations rather than silently changing times.
3. Export ICS into a separate test calendar. Check times, duration, text and reimport behaviour. Remove test events afterward; avoid experimenting in your primary calendar.
4. Provide explicit local save, export and clear controls. Explain browser retention versus downloaded files and inspect networking for unnecessary uploads.
5. Check one complete keyboard journey, narrow-screen readability and errors that do not rely on colour. Document remaining limits.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Usable P1 release | Completes actual planning without developer intervention to repair data. |
| Compatibility record | Names the tested client and scenarios; makes no claims for untested clients. |
| Habit and exit paths | A natural entry point plus export and clearing; explicitly not cloud sync. |

**Independent exercise:** Draw a timeline, change a time-boundary rule and test it. Explain why overnight events cannot be compared using hour numbers alone.

**Privacy and safety:** Titles, locations, attendees and notes can jointly expose private patterns. Use synthetic public examples. Consider browser sync, system backups and shared devices; “no backend” does not mean “no traces.”

**Everyday use:** Use P1 once for real planning and again when revising. If an existing calendar works better, retain only the input or export function your tool improves.

**Pass or revisit:** Demonstrate repeat use and clear export boundaries. Remove features and repair the core flow before adding AI chat.

### A reusable collaboration prompt
```text
Prioritise actual friction in the local planner. If ICS is needed, implement minimal standard fields and record behaviour in a test calendar. Do not claim untested compatibility or call export synchronisation. Let me independently explain a time boundary.
```

## Week 09
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

## Week 10
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

## Week 11
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

## Week 12
> **The question:** Can you return to original evidence, or are you reading a fluent explanation without a traceable basis?

**Before you begin:** Handle structured data, run a read-only agent and understand the distinction between documents and instructions.

### Concepts and learning objectives
Begin P2, the knowledge-to-action workbench. Keep a small public-source library with title, URL, author or institution, publication date or version, access date, topic and evidence location. Publication and retrieval dates are different; unknown dates must stay unknown.

Start with tags, keywords or SQLite full-text search before embeddings. Test Chinese tokenisation and mixed-language queries rather than assuming good recall. Separate source facts, your inference and unanswered questions. Retrieving a related article does not prove it supports a generated claim.

### Reading and selected sections
@readings
R34|Required selections|Full-text search, queries and tokenisers; test your own language examples.|40
R43|Review|Select relevant context for a question instead of fetching everything.|30
R62|Required selections|Fixed-source and network boundaries; understand arbitrary-URL fetch risk.|40
@end

### Studio lab
1. Select 5–10 relevant public official documents. Enter metadata manually. Store your summaries, necessary evidence locations and links instead of mirroring courses or restricted articles.
2. Build a simple retrieval interface and test known evidence. Record misses before changing splitting or retrieval techniques.
3. Produce an evidence card: claim, source location, applicability and counterexample or limitation. Allow insufficient-evidence outcomes.
4. Open every important citation. A working link is only the first check; inspect whether it supports the sentence and applies to the current version. Expose conflicting sources.
5. Add fetching only when updates require it. Limit sources, redirects, response sizes, timeouts and destinations. Manual import is valid when network boundaries are not adequately implemented.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Minimal source library | Versions, access dates and evidence locations are traceable; unknowns remain explicit. |
| Supported answer | Facts, inference and uncertainty are distinct; major claims point back to the source. |
| Retrieval-failure record | Includes a miss or insufficient-evidence case. |

**Independent exercise:** Choose a generated claim, ignore the model's explanation and independently locate supporting or contradicting text. State its conditions.

**Privacy and safety:** Fetchers must not reach localhost, private networks or cloud metadata addresses. Recheck redirected destinations. Without adequate protection, use manually selected public text. Never render outside content as active HTML.

**Everyday use:** Create one evidence card for a concrete technical question rather than collecting an entire article to forget later.

**Pass or revisit:** Trace sources, stop without evidence and detect retrieval errors before adding action experiments. More documents alone are not progress.

### A reusable collaboration prompt
```text
Build a small source library and evidence cards from public official material. Begin with simple retrieval. Separate facts, inference and unknowns and make citations manually checkable. Do not fetch private material, enable arbitrary URLs or mirror copyrighted articles.
```

## Week 13
> **The question:** Which decision, action or workflow changed because of something you learned this week?

**Before you begin:** Have traceable sources and evidence cards, and distinguish facts, inferences and hypotheses.

### Concepts and learning objectives
Give knowledge an exit into practice. Turn a claim into an observable prediction: under which conditions will changing which variable affect which result? Include counterexamples, costs and stopping conditions. Improvement after a change does not prove causation; a small comparison helps resist wishful thinking.

Choose a low-risk technical question: whether structured input reduces rework, short handoffs shorten recovery or source filters reduce obsolete citations. Health, investment, employment and other consequential decisions are outside these experiments. Change one principal variable and keep failed results.

### Reading and selected sections
@readings
R47|Optional|Extract one small, transferable hypothesis about feedback or constraints.|35
R42|Required review|Convert an expected improvement into outcome checks.|35
R45|Required selections|Task delivery versus learning; respect the study's limited scope.|35
@end

### Studio lab
1. Pick an evidence-backed claim relevant to an actual friction. Write your own explanation and prediction before asking the model. Include conditions under which it may fail.
2. Design a 30–60-minute experiment with a fixed task, baseline and decision rule. Count preparation, execution and review, not only generation speed.
3. Run baseline and changed versions and retain all results. Where model variation matters, repeat modestly and record the spread.
4. Decide to adopt, reject or gather evidence. Adoption should change code, a checklist or a default, rather than produce an “I should remember” note.
5. Attach the change to a natural trigger for a real task, then plan a later test on a fresh example. Avoid an ever-growing reminder system.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Action card | Source, explanation, prediction, counterexample, experiment, result and actual change. |
| Reproducible experiment | Baseline, intervention and checking conditions; failures retained. |
| Behavioural decision | A change is implemented or explicitly rejected for a reason. |

**Independent exercise:** Propose a second explanation for the result and design a small check to distinguish it. Another model's agreement is not a substitute.

**Privacy and safety:** Change behaviour in isolated copies using synthetic data. Sending messages, deleting, paying or changing important calendars are not low-risk experiments.

**Everyday use:** Apply the rule to a task that recurs this week. Observe hesitation, search and rework, including the possibility that the old habit was already sufficient.

**Pass or revisit:** A claim leads to an observable decision, including rejection. If only summaries accumulate, stop expanding the source library.

### A reusable collaboration prompt
```text
Turn one sourced technical claim into a testable hypothesis. Design a low-risk experiment with a fixed baseline and stopping condition. Change one main variable, retain failures and alternatives, and allow adoption, rejection or insufficient evidence.
```

## Week 14
> **The question:** Away from the original example and model answer, can you apply the method to a new problem?

**Before you begin:** Complete an action card and try it in a real low-risk task.

### Concepts and learning objectives
Understanding an explanation is not the same as independent ability. Practise closed-book explanation, repair and transfer to a new setting. Identify inputs, boundaries, failures and verification again. AI may ask questions and provide feedback after you answer, rather than reveal the solution first.

Day-seven and day-21 retests are suggested course rhythms, not universal optimal memory intervals. Review earlier learning now and schedule later checks for current material. A knowledge base also needs subtraction: remove duplicate, unsourced and obsolete cards without historical value.

### Reading and selected sections
@readings
R45|Required review|Separate task completion from independent understanding; avoid broad claims from one study.|30
R27|As needed|Return to functions, async code or error handling where weaknesses appear.|45
R16|Foundation|Only the algorithm or data-structure concepts you cannot yet explain.|45
@end

### Studio lab
1. Answer three earlier questions without a generator: explain a concept, find a counterexample and describe an application. Preserve first answers separately from later research.
2. Transfer one principle: calendar deduplication to document import, or API error states to file handling. Explain differences as well as similarities.
3. Make a small change independently, then let the model review and question it. If the model replaces your entire answer, shrink the exercise.
4. Review cards for actual use, evidence and actionable next steps. Merge duplicates, mark version scope and delete unused generated summaries.
5. Schedule a few important retests. Count maintenance of the learning system itself in your weekly review.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Independent retest | First answers and corrections are distinct. |
| Transfer application | The principle works in a new scenario and changed boundaries are explained. |
| Knowledge-base cleanup | Clear reasons for deletion or consolidation; collection size is not the metric. |

**Independent exercise:** Repair a small unseen problem without a generator. Official documentation is allowed; explain why the fix works.

**Privacy and safety:** Use no other person's private information in exercises. Follow the originating course's academic-integrity rules, including [R15](https://cs50.harvard.edu/python/honesty/). Keep your own AI-assisted projects separate from restricted coursework.

**Everyday use:** Notice whether you repeat fewer searches, avoid rework or recognise a risk sooner. Needing more foundation practice is a legitimate result.

**Pass or revisit:** Demonstrate one independent transfer before increasing deployment complexity. Delay week 15 if the existing tool is still unexplained.

### A reusable collaboration prompt
```text
Be a questioner, not an answer generator. Give new scenarios for three concepts and wait for my answers before feedback. Help consolidate useless notes and schedule a few retests without building a large learning-management system.
```

## Week 15
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

## Week 16
> **The question:** What happens when a connection drops, a task triggers twice or the process restarts halfway through?

**Before you begin:** Have a controlled, manual, read-only runtime; locate a request and stop its process.

### Concepts and learning objectives
Model pending, running, succeeded, failed, awaiting-human and cancelled states. Store them durably for the chosen environment; memory and temporary disks may disappear on restart. Side effects have uncertainty windows before and after execution, so retrying cannot simply repeat everything blindly.

Idempotency means repeats do not create additional unwanted effects. Generating an ID alone does not guarantee exactly-once execution. When an external action's outcome is uncertain, inspect the target system or involve a person. Local SQLite may be sufficient; a new orchestration framework is optional.

### Reading and selected sections
@readings
R49|Optional|Persistent state, thread or run identity and recovery concepts.|40
R68|Required selections|Hypothesis-driven investigation of interruptions and retries.|35
R72|Hosted option|Scheduling, run limits and stopping; do not assume persistent-disk support.|35
@end

### Studio lab
1. Assign non-personal run IDs and persist state and minimal results. Distinguish identical triggers, repeated input and genuinely new tasks.
2. Add bounded retries, backoff, total timeout and cancellation. Retry only suitable errors; malformed data and denied permission must not loop forever. Count every retry against the budget.
3. Mock interruption, timeout, duplicate triggers and a result returned before its state was saved. Avoid duplicate drafts and route uncertain completion to human checking.
4. Verify filesystem persistence and service limits. Scheduled jobs need a suitable durable data layer; check [R72](https://render.com/docs/cronjobs) and [R73](https://render.com/docs/disks) independently.
5. Restore a synthetic backup into a new location and compare counts and key fields. Recovery must not replay external actions automatically.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Durable state and deduplication | State survives restart and repeated triggers have tested behaviour. |
| Failure drill | Timeout, interruption, duplication and uncertain completion are covered. |
| Restorable backup | An actual restore, stated recovery point and loss limitations. |

**Independent exercise:** Trigger the same task concurrently and inspect which executions acquire permission. Explain why disabling a UI button does not solve server concurrency.

**Privacy and safety:** Protect backups and state tables with access and retention controls. Minimise logs; see [R61](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). Stopping new work does not automatically cancel queued or already-sent actions.

**Everyday use:** If ready, schedule a low-frequency, finite read-only task. Skip inference when nothing changes and make failure notifications actionable.

**Pass or revisit:** Recover, deduplicate and stop, and know how to handle uncertain outcomes before attempting approved writes.

### A reusable collaboration prompt
```text
Add persistent state, deduplication, bounded retry and cancellation to a read-only task. Mock interruptions and repeats without promising exactly-once external execution. Distinguish temporary from durable storage and actually restore a synthetic backup.
```

## Week 17
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

## Week 18
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

## Week 19
> **The question:** Is your model recommendation based on comparable tasks, or the impression left by one recent success?

**Before you begin:** Distinguish tasks, attempts, outcomes and human review. A small dataset is acceptable; do not claim it is calibrated.

### Concepts and learning objectives
Begin P3, the AI task and cost ledger. Retain only task category, environment, actual model or tool version, available reasoning configuration, attempt count, active time, outcome and usage provenance. Represent unknown as null or an explicit state, never zero. Do not collect raw prompts or personal material by default.

Difficulty, permissions, context length and retries confound model comparisons. A median describes typical behaviour but needs failure rates and worse cases alongside it. Small samples support local observations only; no magic sample count establishes calibration. Subscription percentages do not automatically convert into uniform token counts. Label measured, estimated and unavailable values.

### Reading and selected sections
@readings
R17|Required review|Aggregation, filtering and queries; separate task grain from attempt grain.|35
R42|Required review|Repeated attempts, outcomes and regression records.|35
R65|Safety option|Minimise usage and tracing metadata.|30
@end

### Studio lab
1. Define a contract separating model-claimed success from independently confirmed success. Include failures, timeouts, cancellations and unknown outcomes.
2. Label provider-reported, directly measured, estimated and unknown quantities. Preserve provenance when precise cost or context length is unavailable.
3. Aggregate only comparable task groups after checking duplicates and missing data. Report insufficient evidence when appropriate.
4. Draft a modest recommendation rule: use a configuration already adequate for this low-risk category and escalate only after specified failures. Review it manually rather than changing settings after every result.
5. Use P3 to choose and record a budget for the next actual session. Local statistics do not require another model call.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Trustworthy ledger | Tasks and attempts are distinct; outcomes and usage have provenance. |
| Qualified summary | Comparable tasks, retained unknowns and failures. |
| Local recommendation | Explicit scope and abstention when evidence is inadequate. |

**Independent exercise:** Inspect synthetic duplicates and missing values, explain why a naïve average misleads and write the correct query.

**Privacy and safety:** Use official, authorised exports. Do not inspect opaque internal databases, extract session credentials or bypass interfaces for quota information. Minimise task names and paths; even aggregates may expose activity and should not publish automatically.

**Everyday use:** Choose an already-tested configuration by task rather than defaulting to maximum intensity. Measure reduced rework and switching rather than subscription consumption.

**Pass or revisit:** Distinguish measurement, estimation and unknowns. Insufficient data is valid; do not manufacture tasks to inflate the sample.

### A reusable collaboration prompt
```text
Create a minimal-metadata ledger separating tasks, attempts, outcomes and usage sources. Compare similar tasks only. Do not replace unknowns with zero or invent model and quota information. Use local statistics for limited recommendations without extra reflection calls.
```

## Week 20
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

## Week 21
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

## Week 22
> **The question:** Can someone who does not understand the implementation complete a task without you coaching every click?

**Before you begin:** At least one project runs, stops and recovers, with synthetic demonstration data and a clear data explanation.

### Concepts and learning objectives
The next step is testing whether another person can use your understanding, not growing a user base. Invite one consenting person to attempt a realistic task using synthetic data. They can stop and need not provide private information. If nobody is available, revisit an unfamiliar task yourself after a delay and label this as weaker self-testing.

Observe where they hesitate, misunderstand, avoid a control or struggle to recover. Constant coaching hides problems. A handoff needs startup, data flow, cost, limits, stopping and recovery, not just a product introduction. Do not infer universal needs from one person's preferences.

### Reading and selected sections
@readings
R75|Required|Task design, moderation and observation.|40
R76|Required|Purpose, recording scope, withdrawal and informed consent.|30
R08|Optional|Maintenance, collaboration and handoff.|35
@end

### Studio lab
1. Write a plain invitation: purpose, expected time, synthetic data, recording scope and how to stop. Obtain separate consent before audio, video or contact collection.
2. Give a goal such as arranging three activities and checking an export, rather than a button-by-button script.
3. Record observations: pauses, mistakes, questions and recovery. “The user is not technical” is not an actionable finding.
4. Fix the biggest obstacle only, then check with the person or a fresh synthetic task.
5. Write a one-page handoff covering startup, data destinations, cost, limits, export, clearing, stopping, recovery and version. Public feedback must be an agreed anonymous summary.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Consent and observation plan | Defined records and withdrawal without private-data requirements. |
| Real feedback or stated alternative | External observation distinguished from self-testing; no fabricated endorsement. |
| Handoff guide | A newcomer can start, stop and respond to errors. |

**Independent exercise:** Rewrite one misunderstood message yourself and test a new scenario. More words are not necessarily clearer.

**Privacy and safety:** Removing a name does not guarantee anonymity; role, timing, tasks and screenshots may identify someone. Prefer synthetic reconstructions over transcripts or recordings. Workplace trials require their own organisational approval.

**Everyday use:** Notice whether the tool reduces explanation. Your future self is also a second user who needs to understand, repair and retire it.

**Pass or revisit:** Observe and improve one important problem and produce a usable handoff. State recruitment limitations honestly.

### A reusable collaboration prompt
```text
Design a single-task usability observation with synthetic data and clear consent, recording and withdrawal. Observe rather than coach. Fix the main obstacle and create startup, data, stop and recovery guidance. Do not invent user feedback.
```

## Week 23
> **The question:** Does the tool make life easier, or replace the original work with supervising models and maintaining software?

**Before you begin:** Have actual use and maintenance records and distinguish measured, estimated, unknown and synthetic results.

### Concepts and learning objectives
Compare equivalent tasks at similar quality. Include your operation, supervision, review, rework and maintenance, including failed attempts. Background model runtime during which you can do other things is not automatically human labour. Record one-time building, cash expense and ongoing operation separately.

Time is not the only value: fewer omissions, traceability and independent skill matter too, but report them separately. An experiment may have negative financial or time returns while teaching something useful, provided it is labelled learning investment. Stopping unused work is an engineering decision.

### Reading and selected sections
@readings
R17|Required review|Aggregate comparable tasks and inspect denominators and missing data.|30
R67|Optional review|Assess user outcomes rather than busy infrastructure.|30
R74|Optional review|Return to the original problem and check the need still exists.|30
@end

### Studio lab
1. For P1, P2 and P3, list actual uses, outcomes, active time, review and maintenance. Say “no record” when absent; do not infer human savings from model runtime.
2. Calculate weekly net time saved: comparable successful tasks' old active time minus all new operation, review, failed rework and maintenance. List unfinished demand separately.
3. Separate build time, incremental subscription costs, API and hosting. State allocation assumptions for subscriptions already used elsewhere and avoid double-counting.
4. Keep, simplify, pause or delete. Remove unused features from the main flow. A negative-saving project may continue as bounded learning, with a stated reason.
5. Give saved time a concrete purpose: focused study, exercise or rest. Avoid pouring every spare hour into unlimited model comparisons.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Honest value report | Measurements and assumptions separated; failures and maintenance included. |
| Retention decision | At least one feature reviewed for necessity, with reasons to keep or remove it. |
| Next-month use plan | Natural triggers and maintenance limits, not only a feature roadmap. |

**Independent exercise:** Calculate net time on synthetic records containing failed runs and maintenance. Explain why two minutes of generation is not a measure of saved labour.

**Privacy and safety:** Timestamps and task categories reveal routines. Publish reviewed aggregates or labelled synthetic examples with methods and sample scope, not a private raw ledger.

**Everyday use:** Revisit week one's friction. Stop valueless reminders, jobs, connectors and cloud resources and revoke permissions no longer needed.

**Pass or revisit:** Make a real trade-off supported by an honest report. Negative savings are not a result to conceal.

### A reusable collaboration prompt
```text
Audit actual records, including failure, review and maintenance. Separate building and cash costs. Do not convert unknowns into precise benefits. Give evidence for keeping, simplifying or pausing each project without assuming more features are needed.
```

## Week 24
> **The question:** Can you take an unfamiliar small requirement from discovery to recovery, beyond repeating a course demonstration?

**Before you begin:** Aim to have a deterministic tool, a controlled agent workflow and an evidence-backed improvement experiment. State incomplete parts honestly.

### Concepts and learning objectives
Graduation is end-to-end ability rather than video or agent counts. Define a new small requirement, its inputs, permissions and success criteria. Implement, verify, use and recover it. Independently repair one small fault without code generation; documentation remains allowed.

Keep the curriculum adaptable. Requirements, data, networking, verification, permissions and maintenance are durable capabilities; models, SDKs and some control techniques change. New models may make old mechanisms unnecessary, so updates should include deletion. Treat engineering announcements as proposals to evaluate, not orders to migrate everything.

### Reading and selected sections
@readings
R09|Review|Compare current AI-assisted development topics with your gaps, without claiming degree equivalence.|25
R46|Optional|Runtime and control-mechanism trade-offs; identify logic that may be removable.|35
R40|Further study|Select planning, tools or verification topics from the Spring 2025 archive according to an actual bottleneck.|40
@end

### Studio lab
1. Define a new requirement and non-goals yourself. Collaborate on implementation while personally reviewing data flow, permissions and important diffs. Record unverified behaviour.
2. Perform core checks and real use, then introduce a recoverable fault. Stop, diagnose, restore and verify outstanding external effects yourself.
3. Complete a generator-free repair or rule change and explain its cause and verification. Record remaining gaps for the next learning cycle.
4. Prepare public work: problem, architecture, synthetic examples, verification and limitations. Distinguish actual reviewed aggregates from demonstrations. Do not invent a success story.
5. Evaluate one model or SDK update on fixed tasks with unchanged budget and permissions. Keep the option not to upgrade. Record version, sources, adoption criteria and rollback; choose one next-month learning focus.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| End-to-end new task | A coherent account of requirements, implementation, verification, use and limits. |
| Independent recovery | You take over failure without asking a model to regenerate the project. |
| Public work and update rules | No private records; facts and demonstrations distinct; next steps follow real gaps. |

**Independent exercise:** With the generator closed, explain a key module, repair a new small defect and recover a known failure. Mark what you cannot yet do.

**Privacy and safety:** Review files, build output, links, images, metadata and history before publishing. A clean secret scan is not proof of safety. Separately inspect authentication, hosting logs, analytics and permissions. External works retain their own copyright and terms.

**Everyday use:** Keep two or three tools that naturally fit your life and retire the other prototypes. Reduce burden rather than making every routine depend on complex automation.

**Pass or revisit:** Deliver, verify, recover, explain value and recognise your limits. This learning route is not a degree or employment guarantee.

### A reusable collaboration prompt
```text
Assess me through a new requirement, independent repair and recovery drill using real evidence. Prepare public synthetic demonstrations and honest limitations. Compare a model or SDK upgrade within a budget, allow no upgrade, and choose one next learning direction from demonstrated gaps.
```
