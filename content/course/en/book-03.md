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
