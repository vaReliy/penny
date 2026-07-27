## Overrides CLAUDE.md § "Routing" (Frontend row)

Penny is Angular-only — no Vue/React agents installed. Replace the Frontend row with:

| Need     | Agent                             |
| -------- | --------------------------------- |
| Frontend | `angular-developer` (Angular 17+) |

## Overrides CLAUDE.md § "Skills"

Frontend: `angular-expert` only (Vue/React skills pruned, not installed).

## Extends CLAUDE.md § "Orchestrator (Dispatcher) Core"

**Dispatch-Prompt Cross-Reference (every dispatch)**: When writing a dispatch prompt, cross-reference `AGENTS.md`'s on-demand rules index against the task's described file-touching surface to identify task-specific rules the target agent's pre-flight may miss (new lib → `rules/cts/nx-generators.md`; new endpoint/migration → `rules/cts/validation-authorization.md`/`rules/cts/migrations-queue.md`; etc.). This is a second layer of defense alongside each agent's own pre-flight list — an agent's pre-flight can drift out of sync with a specific task's needs.

**Acceptance verification (every task)**: After the quality gate (Phase 4) closes and before `docs-writer` (Phase 5), the orchestrator performs a single read-and-compare pass over the task file's acceptance criteria against the working tree. This step is mandatory and separate from the gate; see `rules/local/workflow.md` § "Phase 4.5 — Acceptance Verification" for the full checklist, parity-task obligations, and failure routing.

**Orchestrator model selection by tier** (default; operator may override per task): T0/T1/T2 → Sonnet orchestrator — with Phase 4.5 acceptance verification in place, read-back is a document comparison, not a judgment call. T3 → Opus orchestrator — structural tradeoffs, domain boundaries, and topology choices are where the stronger model demonstrably contributed (the `scope:web` composition-root allowlist versus deletion; exact `bigint` FX arithmetic with verified rate direction).
