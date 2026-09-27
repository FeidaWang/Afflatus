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
