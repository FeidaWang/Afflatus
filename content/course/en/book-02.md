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
