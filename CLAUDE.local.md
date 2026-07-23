## Overrides CLAUDE.md § "Routing" (Frontend row)

Penny is Angular-only — no Vue/React agents installed. Replace the Frontend row with:

| Need     | Agent                             |
| -------- | --------------------------------- |
| Frontend | `angular-developer` (Angular 17+) |

## Overrides CLAUDE.md § "Skills"

Frontend: `angular-expert` only (Vue/React skills pruned, not installed).

## Extends CLAUDE.md § "Orchestrator (Dispatcher) Core"

**Dispatch-Prompt Cross-Reference (every dispatch)**: When writing a dispatch prompt, cross-reference `AGENTS.md`'s on-demand rules index against the task's described file-touching surface to identify task-specific rules the target agent's pre-flight may miss (new lib → `rules/cts/nx-generators.md`; new endpoint/migration → `rules/cts/validation-authorization.md`/`rules/cts/migrations-queue.md`; etc.). This is a second layer of defense alongside each agent's own pre-flight list — an agent's pre-flight can drift out of sync with a specific task's needs.
