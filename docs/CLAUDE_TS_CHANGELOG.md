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
