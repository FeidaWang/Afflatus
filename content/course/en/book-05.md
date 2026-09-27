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
