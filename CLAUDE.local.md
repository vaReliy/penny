## Overrides CLAUDE.md § "Triage" (T1 tier)

**T1 local** — ≤3 files, foresight gate does not fire, no new endpoint/migration → skip `ba`, **orchestrator writes full requirement contract** (AC tagged with evidence types `[test]`/`[probe]`/`[manual]` + out-of-scope + DoD reference) before dispatch (see `rules/local/workflow.md` §§ Requirement contract, Definition of Done); impl directly; full quality gate still runs.

The contract lives in `<session scratchpad>/contract-<slug>.md` and is re-read at Phase 4.5 for acceptance verification. This replaces the "5-line acceptance criteria" baseline from CLAUDE.md.

## Overrides CLAUDE.md § "Routing" (Frontend row)

Penny is Angular-only — no Vue/React agents installed. Replace the Frontend row with:

| Need     | Agent                             |
| -------- | --------------------------------- |
| Frontend | `angular-developer` (Angular 17+) |

## Overrides CLAUDE.md § "Skills"

Frontend: `angular-expert` only (Vue/React skills pruned, not installed).

## Extends CLAUDE.md § "Orchestrator (Dispatcher) Core"

**Dispatch-Prompt Cross-Reference (every dispatch)**: When writing a dispatch prompt, cross-reference `AGENTS.md`'s on-demand rules index against the task's described file-touching surface to identify task-specific rules the target agent's pre-flight may miss (new lib → `rules/cts/nx-generators.md`; new endpoint/migration → `rules/cts/validation-authorization.md`/`rules/cts/migrations-queue.md`; etc.). This is a second layer of defense alongside each agent's own pre-flight list — an agent's pre-flight can drift out of sync with a specific task's needs.

**Plan-back checkpoint (every implementation dispatch for a task-file task, T1–T3)**: The orchestrator owns the outcome of the full cycle, not just the routing of it. Every implementation dispatch prompt for a task executed from a task file (T1–T3) must require the agent to reply with a ≤10-line plan — mechanism, files it expects to touch, and the exact verification command with its expected result — and to wait for approval before writing code. The orchestrator judges that plan **only** against what it already holds (the task file and the rules cited in the dispatch prompt), never by reading source, then approves, corrects once, or re-routes to a different agent. One correction round maximum, then proceed. T0, and ad-hoc T1 work with no task file, skip this. The checkpoint also stops the task before code when the plan exceeds the session budget or names a decision absent from the task file. Full criteria, bounds, and the re-routing case: `rules/local/workflow.md` § "Phase 2.5 — Plan-back checkpoint before implementation".

**Acceptance verification (every task)**: After the quality gate (Phase 4) closes and before `docs-writer` (Phase 5), the orchestrator performs a single read-and-compare pass over the task file's acceptance criteria against the working tree. This step is mandatory and separate from the gate; see `rules/local/workflow.md` § "Phase 4.5 — Acceptance Verification" for the full checklist, parity-task obligations, and failure routing.

**Tester/QA scope backstop (every `tester(verify)` and `qa` dispatch)**: Both agents hold `Edit`/`Write` and are instructed in their own agent definitions to touch only test/fixture files, never production code — but an instruction is not a guarantee. Immediately after either agent reports back, the orchestrator runs `git diff --stat` scoped to that dispatch and flags any non-test file touched. A violation is not silently kept — treat it as a `## Fix Now`-equivalent finding: revert or hand back the non-test change, then re-verify from `tester(verify)`. `security-scanner` is exempt (no `Edit`/`Write` tools, structurally incapable).

## Overrides `rules/cts/workflow.md` § "Quality Gate" (`qa` trigger)

`rules/cts/workflow.md`'s Stage 3 trigger for `qa` ("a user-visible flow changed") is too broad for Penny — in an Angular app nearly every change is user-visible, and dispatching a full Playwright/MCP browser session per cosmetic tweak is expensive relative to the value it verifies. Replace that trigger with:

**`qa` fires only when a money- or state-mutating flow changed**: transaction create/edit/delete, budget/category create/edit/delete, or auth/login. A cosmetic-only change (colors, labels, spacing, non-critical copy) never triggers `qa`, even though it's technically user-visible.

**Test-pyramid boundary** (governs what `qa` actually covers once triggered — full text lives in `.claude/agents/qa.md`): unit tests verify each component/util in isolation as a "black box"; integration tests (owned by `tester`/implementation agents, at module/component level) verify the relations between already-tested black boxes, trusting that each box works as its own tests prove; `qa` (E2E) sits at the top of the pyramid and covers only (a) the triggering critical flow end-to-end, and (b) interactions genuinely impractical to prove at a lower level (real cross-page navigation, a real backend round-trip, a third-party redirect) — never a re-verification of what a lower level already covers.

**Orchestrator model selection by tier** (default; operator may override per task): T0/T1/T2 → Sonnet orchestrator — with Phase 4.5 acceptance verification in place, read-back is a document comparison, not a judgment call. T3 → Opus orchestrator — structural tradeoffs, domain boundaries, and topology choices are where the stronger model demonstrably contributed (the `scope:web` composition-root allowlist versus deletion; exact `bigint` FX arithmetic with verified rate direction).

**Two-directional test-protection backstop (implementation + verification agents)**: After implementation agents (`backend-developer`, `angular-developer`) complete their dispatch, the orchestrator runs `git diff HEAD --diff-filter=MD --name-only -- <test globs>` to check for modified/deleted test files. If any test file appears in the diff but is missing from the implementer's `## Requirement trace` section of their report, this is a `## Fix Now` finding — route back to the implementer to complete the trace before the task proceeds to the gate. This reverses the existing backstop (preventing `tester`/`qa` from touching production code) by also preventing implementation agents from changing tests without justification documented in the trace.

**Requirement contract framework** (extends T1 treatment from CLAUDE.md): Every task has a contract written **before** implementation. For T1 / bug / ad-hoc prompt flows (no task file), the orchestrator writes `<session scratchpad>/contract-<slug>.md` containing acceptance criteria + out-of-scope + gate hashes before dispatching the first agent. Phase 4.5 re-reads the contract from disk to verify completion. See `rules/local/workflow.md` §§ Requirement contract, Definition of Done, Gate flow, Requirement trace & test-change audit for the full framework.

**Hard tool limits — extensions for orchestrator**: In addition to CLAUDE.md's baseline, orchestrator may run Bash for:

- `git diff --name-only` / `git diff --stat` (scoped to dispatch + changed files)
- `git hash-object <files>` (to snapshot gate files before implementation)

These are mechanical file-presence checks and hashing, not source code reading.
