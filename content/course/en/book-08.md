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
