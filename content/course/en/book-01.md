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
