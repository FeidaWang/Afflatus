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
