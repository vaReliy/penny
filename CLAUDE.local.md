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

**Tester/QA scope backstop (every `tester(verify)` and `qa` dispatch)**: Both agents hold `Edit`/`Write` and are instructed in their own agent definitions to touch only test/fixture files, never production code — but an instruction is not a guarantee. Immediately after either agent reports back, the orchestrator runs `git diff --stat` scoped to that dispatch and flags any non-test file touched. A violation is not silently kept — treat it as a `## Fix Now`-equivalent finding: revert or hand back the non-test change, then re-verify from `tester(verify)`. `security-scanner` is exempt (no `Edit`/`Write` tools, structurally incapable).

## Overrides `rules/cts/workflow.md` § "Quality Gate" (`qa` trigger)

`rules/cts/workflow.md`'s Stage 3 trigger for `qa` ("a user-visible flow changed") is too broad for Penny — in an Angular app nearly every change is user-visible, and dispatching a full Playwright/MCP browser session per cosmetic tweak is expensive relative to the value it verifies. Replace that trigger with:

**`qa` fires only when a money- or state-mutating flow changed**: transaction create/edit/delete, budget/category create/edit/delete, or auth/login. A cosmetic-only change (colors, labels, spacing, non-critical copy) never triggers `qa`, even though it's technically user-visible.

**Test-pyramid boundary** (governs what `qa` actually covers once triggered — full text lives in `.claude/agents/qa.md`): unit tests verify each component/util in isolation as a "black box"; integration tests (owned by `tester`/implementation agents, at module/component level) verify the relations between already-tested black boxes, trusting that each box works as its own tests prove; `qa` (E2E) sits at the top of the pyramid and covers only (a) the triggering critical flow end-to-end, and (b) interactions genuinely impractical to prove at a lower level (real cross-page navigation, a real backend round-trip, a third-party redirect) — never a re-verification of what a lower level already covers.

**Orchestrator model selection by tier** (default; operator may override per task): T0/T1/T2 → Sonnet orchestrator — with Phase 4.5 acceptance verification in place, read-back is a document comparison, not a judgment call. T3 → Opus orchestrator — structural tradeoffs, domain boundaries, and topology choices are where the stronger model demonstrably contributed (the `scope:web` composition-root allowlist versus deletion; exact `bigint` FX arithmetic with verified rate direction).
