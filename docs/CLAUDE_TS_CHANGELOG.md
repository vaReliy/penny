# Claude-TS Upstream Changelog

Tracks divergences, overrides, conflicts, fixes, and enhancements discovered in this project's `.claude/agents/**`, `.claude/skills/**`, and `rules/**` — all inherited from the `claude-ts` template repo. Each entry has enough detail to port directly into a PR against `claude-ts`. Entries are removed only when actually ported upstream (mark `Status: ported` with the PR link first, then delete on the next cleanup pass) or when explicitly decided as not-applicable upstream (`Status: project-local-only`, kept for record).

## Entry format

```
## YYYY-MM-DD — [Type] short title

- **Component**: e.g. `devops` agent / `rules/workflow.md` / `tester` agent
- **Type**: Override | Conflict | Fix | Enhancement
- **What happened**: concrete description of the divergence/bug/gap, from this project's actual usage
- **Why it matters upstream**: why other claude-ts consumers would hit the same issue
- **Suggested upstream change**: concrete patch/diff or instruction, ready to apply to the template repo
- **Status**: pending-port | ported (PR link) | project-local-only
```

---

## 2026-06-25 — Conflict: devops overrouting on mixed infra + code tasks

- **Component**: orchestrator routing table / `rules/workflow.md` Agent Quick Routing
- **Type**: Conflict
- **What happened**: A task mixing docker-compose config with an application-level Mongoose connection-factory module (TypeScript library code with strict typing, Nx tags, DI boundaries) was dispatched entirely to `devops`. The resulting code used `mongoose.connect()` (a global singleton, not reusable across callers as required) and unpinned dependency versions — both flagged and fixed in review.
- **Why it matters upstream**: The routing table's "Infra/CI/Docker → devops" entry is too broad. Other consumers of claude-ts will encounter mixed infra+code tasks (e.g., integrating a new database driver, adding a Redis queue connection factory, or refactoring config loading). Without explicit guidance on when to split tasks, tasks will continue to route entirely to `devops`, resulting in library code written without proper Clean Architecture layering, DI patterns, or dependency discipline.
- **Suggested upstream change**: In `rules/workflow.md` Agent Quick Routing table, after the "DevOps / Docker / CI" entry, add a note: "Mixed infra + code tasks: split scope — compose/CI files → devops; application library modules (connection factories, config loaders, drivers) → backend-developer. Infra agent should route code paths back to backend-developer if discovered during implementation."
- **Status**: pending-port

---

## 2026-06-25 — Enhancement: comment hygiene rule + broaden claude-ts trigger

- **Component**: `AGENTS.md` + `rules/code-style.md` + `rules/workflow.md`
- **Type**: Enhancement
- **What happened**: Added explicit comment hygiene rule to `AGENTS.md` Code Style Essentials (one bullet) and expanded `rules/code-style.md` with a full Comments section. Rule: comments are the exception; write only when WHY is non-obvious and cannot be expressed through renaming; never reference task/decision IDs (`D9`, `D10`, `task 11`) or task file paths; `// TODO:` / `// FIXME:` must be self-contained and removed when done; cross-references use symbol name only. Also broadened `rules/workflow.md`'s claude-ts changelog trigger from `.claude/agents/**` + `.claude/skills/**` only to all claude-ts-inherited files (`AGENTS.md`, `CLAUDE.md`, `rules/**`, `.claude/agents/**`, `.claude/skills/**`).
- **Why it matters upstream**: Sub-agents (cold start, no auto-memory access) had no rule against writing stale task/decision ID references in code comments. The rule existed only in orchestrator auto-memory, which sub-agents cannot read. Moving it into `AGENTS.md` (always loaded) and `rules/code-style.md` (on-demand detail) ensures all implementing and reviewing agents enforce it. Broadening the claude-ts trigger ensures rule changes to inherited files are captured automatically without manual reminders.
- **Suggested upstream change**: Apply the one-bullet addition to AGENTS.md Code Style Essentials, add the full Comments section to rules/code-style.md, and update the knowledge capture decision rule in rules/workflow.md to trigger on all claude-ts-inherited files, not just .claude/agents/** and .claude/skills/**.
- **Status**: pending-port

---

## 2026-06-26 — Enhancement: dep-pin audit rule + quality gate "never skip" + Phase 3 handoff checklist

- **Component**: `AGENTS.md` Code Style Essentials / `rules/workflow.md` Phase 3 + Quality Gate
- **Type**: Enhancement
- **What happened**: Three gaps discovered during task 13 implementation review:
  1. `AGENTS.md` Code Style Essentials had no rule about exact-pinning npm dependencies. Nx generators write caret ranges (`^`) by default for injected deps (e.g. `webpack`, `webpack-cli`), and sub-agents passed these through without auditing. Added an explicit bullet with the audit command (`grep -E '"\^|"~' package.json`) and resolution steps (`pnpm why <pkg>` for the exact version).
  2. `rules/workflow.md` Quality Gate section had no "never skip" language. The orchestrator accepted a webpack build pass as sufficient, skipping `tester` + `reviewer`. Added: "Never skip. 'The build passes' is not a substitute for the quality gate."
  3. `rules/workflow.md` Phase 3 lacked a handoff checklist. Added three items: dep-pin grep exits empty, build exits 0, generated tsconfigs match the sibling-lib strict pattern.
- **Why it matters upstream**: All three gaps apply to any claude-ts consumer: (a) generators universally write caret ranges; (b) build-pass-equals-done is a common shortcut that lets tsconfig and correctness issues through; (c) the checklist forces the orchestrator to verify the generator's output before advancing.
- **Suggested upstream change**: (a) Add exact-pin bullet to `AGENTS.md` Code Style Essentials with audit command. (b) Add "Never skip" note to the Quality Gate section of `rules/workflow.md`. (c) Add the three-item handoff checklist to Phase 3 of `rules/workflow.md`.
- **Status**: pending-port
