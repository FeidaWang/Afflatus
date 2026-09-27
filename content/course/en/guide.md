# From vibe coding to a personal FDE

> A 24-week practice route for people with AI-coding experience and some IT foundations, without requiring a computer-science degree. Learn to turn real problems into tools you can understand, verify, deploy, maintain and actually use.

**Manuscript reference baseline: 27 September 2026 · Public edition 1.0 · Self-study and project labs. This is not a degree, certification or employment promise.**

Weeks, time budgets, experiment sizes and acceptance criteria are course-design suggestions. Research and platform rules are linked to their original sources. A course link does not grant access to all assignments, certificates or paid material. Recheck current documentation before implementation.

## Why this route exists
Generating a page or application is no longer the whole challenge. A broken tool may still leave you asking a model to rewrite everything. A convincing demonstration may add maintenance to daily life. A growing reading list may fail to improve your next decision. A new model release may prompt another unnecessary rebuild.

The missing chain is: **notice a repeated problem → choose the simplest solution → understand the implementation → verify outcomes → operate it appropriately → recover failures → show why it is worth keeping.**

“Personal FDE” borrows the end-to-end working style of a Forward Deployed Engineer and makes you the first user. It is this course's learning-path name, not an industry credential. RSI means Recursive Self-Improvement here, limited to controlled changes in prompts, tools, workflows and code. The course makes no claim of foundation-model self-training or unlimited intelligence growth.

Three questions recur: **Can I explain it? Can I verify and recover it? Does it improve my daily life?**

## Who it is for
If you have tried AI programming but your foundations are uneven, begin with the diagnostic. Complete beginners can take a bridge; experienced engineers can use the acceptance checks to target gaps. You do not need to finish every linked university course or buy a particular model first.

Twenty-four weeks is a workload plan, not a streak. Each week has a main question, a visible deliverable and an independent exercise. Progress depends on demonstrated capability. Improve an existing low-risk project when possible. Otherwise use the three teaching projects below, actively developing only one at a time.

## A sustainable weekly rhythm
| Activity | Core budget | What remains afterward |
|---|---:|---|
| Selected courses and official documentation | 2 hours | Understanding and one or two concrete questions. |
| Build and verify | 5 hours | One useful small change and actual checking results. |
| Practice without code generation | 1 hour | Your own explanation, modification or repair. |
| Real low-risk use | 1 hour | Observed friction, not just a demonstration. |
| Review, maintenance and source updates | 1 hour | A decision to keep, simplify, pause or remove. |

Allow two optional hours for foundations. At 10–12 hours per week the planned total is 240–288 hours. Six hours weekly spreads the same work over about 40–48 weeks; prior knowledge and task difficulty can extend it further.

Reading-table minutes are suggested budgets, not official course durations. Required, optional and foundation readings do not mean taking every course in full. After two hours, prioritise the current blocker and use the buffer selectively. Reading is neither sufficient proof of mastery nor a barrier to a small understood delivery.

## Diagnose before purchasing
Spend 60–90 minutes with official documentation allowed, preserving your unaided first answers.

| Check | Ready when you can… | Bridge |
|---|---|---|
| Functions and data | Explain input/output and predict a new example. | R12 or R27: functions, variables and collections. |
| Errors and tests | Read an error location and write a counterexample with an expected result. | R03 and R13. |
| Files and runtime | Explain current directory, read/write locations and startup. | R02 and R14. |
| Git and safe changes | Read a diff, save a working version and undo a change. | R04 and R31. |
| Web data flow | Distinguish browser, server and external API. | R26 and R32. |
| Data and secrets | Distinguish zero from unknown and keep credentials out of public code. | R17 and R59. |

If many areas are unfamiliar, allow roughly 4–8 weeks for a bridge: functions and data; files, errors and tests; Git, environments and Web flow; then one small local tool. Continue longer if needed. Select algorithm, memory or data-structure material from R16 according to gaps instead of completing a whole degree syllabus first.

## One main stack
The default route is **JavaScript / TypeScript → React → Node → SQL → Git**. Keep an existing stable stack if you have one. Python supports foundation learning and research experiments; avoid building two backends in the first six weeks.

Use R28, R29 and R30 as language and runtime references. Full Stack Open expects prior programming and Web knowledge; read R21 before selecting sections. Vector databases, Kubernetes, fine-tuning, agent fleets and complex queues are not prerequisites.

Use rules when rules suffice, a model when language understanding helps, a workflow for fixed steps and an agent only for constrained action selection. R41 provides the simple-first engineering background.

## What to take from current AI practice
The supplied manuscript uses the 2026 MIT Missing Semester material for shell, Git, debugging, delivery and agentic coding. It describes Stanford CS146S Fall 2026 as requiring substantial programming background equivalent to CS111/CS161; a syllabus does not imply every future lecture and assignment is already open. See R01, R06 and R09.

Learn environments, repository information, feedback and result checking alongside prompting. R47 and R42 inform original exercises here; their organisations' internal outcomes are not promised personal results. R45 discusses a controlled study of AI assistance and skill formation: task completion and independent understanding differ, but a bounded study does not show that all AI-assisted learning is harmful.

Keep a small reading spine: MIT, MDN and relevant CS50 chapters for foundations; Full Stack Open and official docs for Web delivery; Hugging Face and one SDK for agents; later, selected Berkeley 2025, GEPA and DGM material. Choose the vendor training you actually use from R38 or R39. Staying current means checking changes, experimenting narrowly and removing obsolete mechanisms—not rebuilding constantly.

## Three projects that continue across the course
| Project | Problem | First-version boundary | Main phase |
|---|---|---|---|
| P1 · Local weekly planner | Repeated entry, conflicts and export. | Local processing and manual export; configurable availability; no private cloud-calendar writes. | Weeks 1–8 |
| P2 · Knowledge-to-action workbench | Untraceable information and learning without application. | A few public sources, read-only retrieval, evidence and action cards. | Weeks 9–18 |
| P3 · AI task and cost ledger | Model choices based on impressions and unclear rework. | Authorised minimal metadata; no full private conversations. | Weeks 19–24 |

All names, records and tasks are generic teaching designs. Do not republish examples after filling them with real personal or workplace records.

```text
P1: user input → local rules and validation → preview → deliberate export
P2: fixed public sources → read-only retrieval → optional model
    → evidence check → action draft → human decision → minimal run record
P3: authorised task metadata → local statistics → improvement proposal
    → isolated evaluation → human adoption or rejection
```

This is a teaching architecture, not a claim of a deployed service. Reassess data, permission and cost at every network boundary. A model's proposed action is not execution authorisation.

## How to learn with a coding agent
Use this loop: **predict first → implement collaboratively → explain data flow → make an independent change → verify in a new scenario.**

Give the current week's goal, necessary files, inputs/outputs, non-goals and boundaries. Ask the agent to inspect the actual project before proposing a minimal plan. End each cycle with real verification, unverified items and a next step. Do not instruct it to execute all 24 weeks continuously.

One model can act as tutor, developer and reviewer at different stages; a second tool may offer another perspective. Agreement between models is a clue, not a substitute for execution, original evidence and human checking. During independent work, the tutor can ask questions but should withhold full answers.

```text
Act as my engineering tutor and collaborator. Check this week's goal and the
actual project state. Work on one small complete task; do not advance weeks.
Explain input, processing, output, failures, permissions, cost and recovery.
Define minimal scope and non-goals, implement a small change and run checks.
Report delivered, verified, unverified, limitations and my independent exercise.
Default to synthetic or public data, mock mode, read-only and manual triggers.
Do not send private data, enable paid calls, connect accounts, publish,
expand permissions or delete/overwrite source data without explicit authority.
Do not confuse a prompt or configuration value with an enforced control.
Never invent tests, runtime history, usage or feedback. Address gaps with
smaller exercises instead of hiding them behind large rewrites.
```

This is a communication template, not an enforceable security boundary. Filesystem, network, budget and action limits belong in permissions and executors. Follow the originating institution's academic-integrity rules, including R15, for formal coursework.

## The 24-week route
@curriculum

## Start with one question
Open week 01, preserve your first diagnostic answers and make one useful local output. Keep the [course handbook](handbook.html) for deployment, budgets, update rules and seven reusable templates, and the [source library](resources.html) for all 78 references and their verification scope.
