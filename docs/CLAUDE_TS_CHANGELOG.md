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

**Note (2026-07-23)**: This project migrated to CTS's two-layer distribution model (`rules/cts/**` synced verbatim, `rules/local/**` for consumer overrides, single file-ownership sync — see commit `2413f0c`). Entries below this note that describe the old 3-way-merge sync engine (`cts-sync.sh` merge/conflict markers, phantom-baseline/etalon repairs, `.ctsignore` hand-merge behavior, etc.) are historical record of issues under that superseded model and are left unedited; they do not describe current sync behavior.

---

## 2026-07-28 — [Fix] `rules/cts/nx-generators.md` — vitest target name is `test`, not `vite:test`

- **Component**: `rules/cts/nx-generators.md` § 3 "Post-generator corrections by framework" › "Vitest Test Target Configuration"
- **Type**: Fix
- **What happened**: The section states the Nx plugin registers the test target as `vite:test` (with instructions to use `pnpm nx vite:test <project>`), but the actual registered target name is simply `test` (run via `pnpm nx test <project> --skip-nx-cache`). Confirmed via `nx show project budget-data-access --json` showing the actual target name is plainly `test`.
- **Why it matters upstream**: Any claude-ts consumer reading the post-gen checklist will be misdirected to use `nx vite:test`, which fails silently when the target doesn't exist (Nx does not error — it just never runs the intended test). This causes tests to be skipped in CI/post-gen audits if followed as written.
- **Suggested upstream change**: In `rules/cts/nx-generators.md` § 3, correct the "Vitest Test Target Configuration" subsection: change the registered target name from `vite:test` to `test` and update the command examples accordingly (`pnpm nx vite:test <project>` → `pnpm nx test <project>`).
- **Status**: pending-port

---

## 2026-07-27 — [Enhancement] MCP config gotchas: `.mcp.json` `${VAR}` placeholders fail open, and project `.env` is never auto-sourced by Claude Code

- **Component**: `.mcp.json` / MCP server configuration guidance (no specific rules file yet — `rules/cts/mcp-stack.md` documents tool usage but not credential wiring)
- **Type**: Enhancement
- **What happened**: Two related gotchas surfaced while diagnosing a broken `context7` MCP server in this repo (since resolved by going plugin-only and deleting `.mcp.json` entirely, so neither is currently live here, but both are stack-agnostic Claude Code behavior worth documenting for future/other consumers). (1) `.mcp.json` `${VAR}` placeholders fail open: if the referenced env var is unset, Claude Code starts the server anyway with the placeholder left unexpanded, so the failure surfaces as a vendor auth error (e.g. "Invalid API key") rather than anything indicating a missing variable — `claude mcp list`'s footer (`Missing environment variables:`, `[Conflicting scopes]`) is the actual diagnostic. (2) A plain project `.env` is a deliberate security boundary and is never sourced by Claude Code — only the `env` block in `.claude/settings.local.json` (or a shell-profile export before launching `claude`) feeds `${VAR}` expansion in `.mcp.json`. If a project-scoped MCP server needs a `.env`-stored secret, the working recipe is wrapping the server command: `bash -c 'set -a; . ./.env; set +a; exec …'` inside `.mcp.json`, keeping the secret out of any committed/settings file.
- **Why it matters upstream**: Any claude-ts consumer using `.mcp.json` with `${VAR}` placeholders will hit the identical "looks like a vendor auth error, is actually a missing/unsourced env var" failure mode, with no error pointing at the real cause.
- **Suggested upstream change**: Add a short "MCP secret wiring" subsection to `rules/cts/mcp-stack.md` (or a new `rules/cts/mcp-config.md`) covering: the fail-open placeholder behavior + `claude mcp list` as the diagnostic, the project-`.env`-is-never-sourced boundary, and the `bash -c 'set -a; . ./.env; set +a; exec …'` wrapper recipe for consumers who need a project-scoped secret without committing it.
- **Status**: pending-port

---

## 2026-07-28 — [Enhancement] Tailwind v4 `@theme` token removal/rename fails silently — no build/type error

- **Component**: `rules/local/code-style-angular.md` (new "Tailwind v4 @theme token migration" subsection under Styling) — no equivalent section exists yet in `rules/cts/code-style.md` or an Angular-specific CTS rule
- **Type**: Enhancement
- **What happened**: During an ADR-009 dark-token migration (renaming `--radius-sm/md/lg` → `--radius-card/btn/tile`, dropping `--shadow-card`), one template (`balance-card.html`) was missed by the implementing agent and still referenced the old utility classes (`rounded-lg`, `shadow-card`). Neither `nx build` nor typecheck caught it: Tailwind v4 does not error when a utility class's backing `@theme` custom property is removed or renamed — it silently falls back to Tailwind's own built-in default value for that utility (e.g. `rounded-lg` reverts to Tailwind's stock 0.5rem instead of failing). The gap was only caught by the `tester` quality-gate stage doing an explicit workspace-wide grep for old utility class names, not the old CSS custom-property names (which have zero remaining references once removed) — this required an ad hoc guard test to be added (`design-tokens.guard.spec.ts`) rather than existing gate tooling catching it automatically.
- **Why it matters upstream**: Any claude-ts consumer using Tailwind v4 `@theme` tokens will hit this identical silent-fallback failure mode on any token rename/removal migration — the risk is generic to Tailwind v4's CSS-variable-driven theming, not specific to this project's dark-mode work. Without documented guidance, an implementing agent has no reason to grep for old utility class names specifically (as opposed to old custom-property names, which is the intuitive but insufficient check).
- **Suggested upstream change**: Add a "Tailwind v4 @theme token migration" subsection to a CTS-level styling rule (`rules/cts/code-style.md` or a new Tailwind-specific rule if one of the frontend framework rules already covers Tailwind setup) documenting: (1) the silent-fallback behavior when a `@theme` custom property is removed/renamed, (2) the mitigation — grep the whole workspace for the _old utility class names_, not just the old `--custom-property` names, since the class names are the only remaining trace once the property is gone, and (3) a reminder that this is especially important when a token migration is split across multiple feature/screen tasks, since templates added in parallel or subsequent tasks may still reference the old class names.
- **Status**: pending-port

---

## 2026-07-27 — [Enhancement] Quality gate has no acceptance-testing phase — a green gate cannot detect an entirely missing feature

- **Component**: `rules/local/workflow.md` (new "Phase 4.5 — Acceptance Verification" section), `CLAUDE.local.md` (pointer under "Orchestrator (Dispatcher) Core")
- **Type**: Enhancement
- **What happened**: Two independent implementations of the same task (`screen-bill-balance-rates`) were built; one shipped a raw balance card and rate table but completely omitted the screen's core behavior (currency conversion — the legacy `page-bill` screen's central feature). It nonetheless passed the entire mandatory quality gate: `tester` green (93 tests passing), `reviewer` green, `qa` green, lint/build/tsc all green, knowledge capture done, `METRICS.md` row added. Every gate stage (`tester`, `reviewer`, `qa`, build/tsc) verifies only the code that exists — a feature never written has no diff to review, no code to cover, no flow to exercise, so it is invisible from inside the gate by construction. `ba` writes acceptance criteria in Phase 1 and the task file carries a `## Acceptance criteria` block, but no phase ever read it back against the finished work. Added a mandatory "Phase 4.5 — Acceptance Verification" orchestrator step (after the quality gate closes, before `docs-writer`): re-read the task file's acceptance criteria and Context/Why **from disk**, cite the specific file/line satisfying each criterion, and — for parity tasks — open the named legacy source via `git show <ref>:<path>` and enumerate its behaviors before accepting the replacement (an explicit, narrow exception to the orchestrator's normal read restriction). Failure routes back to Phase 3, not into the `## Fix Now` restart-cycle budget, since a missing feature is unbuilt work, not a defect in built work. Deliberately not implemented as a new agent or gate stage — it's one orchestrator read-and-compare pass over a document that already exists.
- **Why it matters upstream**: Any claude-ts consumer's mandatory quality gate (`tester`/`reviewer`/`security-scanner`/`qa`) has this exact structural blind spot — conformance testing of the diff, with no acceptance testing against the original ask. It's most dangerous on `ba`-planned (T2/T3) tasks, where a detailed `## Acceptance criteria` block is written and then never read back, giving false confidence that the block was enforced. This generalizes well beyond this project's tier system.
- **Suggested upstream change**: Add an equivalent "Phase 4.5 — Acceptance Verification" step to `rules/cts/workflow.md`, positioned between the quality gate (Phase 4) and documentation (Phase 5), generalized to be tier-system-agnostic: orchestrator re-reads the task/spec's stated acceptance criteria from disk (not memory) after the gate closes, cites concrete evidence per criterion, and — when the task is a behavior-parity replacement — verifies against the actual legacy source rather than a prose description of it. Route failures back to the implementation phase, explicitly outside the existing Fix-Now restart-cycle budget. Also add the same "a green gate is not evidence of a complete feature" caveat next to the existing "a green build is not evidence of correctness" sentence in `rules/cts/workflow.md`.
- **Status**: pending-port — currently lives only in this project's unsynced `rules/local/workflow.md` + `CLAUDE.local.md` as a stand-in.

---

## 2026-07-27 — [Fix] Post-generator checklist missing dead demo-component cleanup; vitest test target name correction

- **Component**: `rules/cts/nx-generators.md` § 3 "Post-generator corrections by framework"
- **Type**: Fix (two items)
- **What happened**: (1) Generator-produced dead code: `@nx/angular:library` scaffolds a demo component matching the lib name (e.g., `identity-feature-access-status.ts/.html/.spec.ts`); once a real feature component is added alongside it, nothing forces deletion of the boilerplate — it silently survives as unrouted dead code that test/lint/typecheck ignore. A post-generator checklist line was missing: "delete the generator's default demo component once a real feature component replaces it; grep for zero external references before deleting." (2) Vitest target name: `rules/cts/nx-generators.md` currently states the registered test target is `vite:test` (with instructions to use `pnpm nx vite:test <project>`), but the actual registered name is simply `test` (use `pnpm nx test <project> --skip-nx-cache`).
- **Why it matters upstream**: (1) Any claude-ts consumer using `@nx/angular:library` or similar generators will silently ship dead generator boilerplate unless a post-gen checklist reminds them to check for unrouted scaffolding. (2) The stale `vite:test` documentation misdirects any agent following the post-gen checklist, since running `nx vite:test` fails silently when the target doesn't exist (it can still be a valid but unrelated npm script name, so Nx does not error — it just never runs the intended test).
- **Suggested upstream change**: In `rules/cts/nx-generators.md` § 3: (a) add a new bullet to the post-generator checklist under "Angular Generator Flag Requirements" or create a new subsection "Dead Demo-Component Cleanup": "After adding a real feature component to a generated lib, delete the generator's default demo component (e.g., `<lib-name>.ts/.html/.spec.ts`) — it carries no business logic and is often unrouted. Grep for zero external references before deleting; lint/test/typecheck all pass while dead code silently survives." (b) In the "Vitest Test Target Configuration" subsection, correct the registered target name from `vite:test` to `test` and update the command examples accordingly.
- **Status**: pending-port

---

## 2026-07-27 — [Enhancement] Orchestration tuning: atomic/pointable AC authoring, tier-based orchestrator model, bounded subagent reports, ledger verify-before-transcribe

- **Component**: `rules/local/task-authoring.md` (new), `rules/local/workflow.md`, `CLAUDE.local.md`, `AGENTS.local.md`
- **Type**: Enhancement
- **What happened**: Follow-up to the Phase 4.5 acceptance-verification gate (previous entry, `2026-07-27`): that entry closed the _read-back_ hole, this one closes the _authoring_ and _cost_ holes it exposed. Added (a) atomic/pointable acceptance-criteria authoring rules with a worked counter-example — a screen-parity task's ambiguous `Parity: balance + 3-currency display + refresh` compound criterion — and its correct decomposition; (b) a parity-task obligation that legacy sources be named as resolvable ref+path and their behaviors enumerated as individual AC lines, cross-linked bidirectionally with the Phase 4.5 orchestrator-side obligation; (c) tier-based orchestrator model selection (T0–T2 → Sonnet, T3 → Opus) based on a measured ~2× session-budget difference between two orchestrator runs of the identical task with no measurable quality gain from the stronger model on a T2-shaped task; (d) a 200-line cap on subagent report narration/detail (with on-demand scratch-file overflow), explicitly exempting `## Fix Now`/`## Emit as Task` sections and finding-supporting evidence from truncation; (e) a ledger-honesty rule requiring `file:line` or command+result verification before a subagent-reported learning is transcribed into `docs/KNOWLEDGE_INBOX.md`, with a real counter-example (a subagent's unverified `AuthModule` DI-crash claim that contradicted the branch's own merge-base). All items landed only in project-local files per this project's two-layer sync model; `rules/cts/**` untouched.
- **Why it matters upstream**: (a)–(b) and (d)–(e) are project-agnostic — any claude-ts consumer's `ba`/orchestrator can write compound or unpointable acceptance criteria, re-send unbounded subagent output on every turn, or transcribe an unverified subagent claim into a permanent knowledge ledger. (c), the tier→model mapping, is more Penny-specific (its exact tier definitions) but the _principle_ — measure whether a stronger orchestrator model actually earns its cost multiplier per tier, rather than assuming it does — generalizes.
- **Suggested upstream change**: Port (a), (b), (d), (e) into `rules/cts/task-authoring.md` and `rules/cts/workflow.md` largely as-is, generalized away from this project's specific counter-example (keep a generalized version of it, it's concrete and clarifying). For (c), add a tier-system-agnostic version of the guidance ("measure whether your strongest-tier orchestrator model is earning its multiplier on your other tiers before defaulting to it everywhere") rather than porting the specific T0–T3 mapping.
- **Status**: pending-port — currently lives only in this project's unsynced `rules/local/task-authoring.md`, `rules/local/workflow.md`, `CLAUDE.local.md`, `AGENTS.local.md`.

---

## 2026-07-27 — [Enhancement] Rule/doc prose has no self-check against embedded task-ID leakage

- **Component**: `rules/local/workflow.md` (new "Task-ID Leakage Self-Check" section)
- **Type**: Enhancement
- **What happened**: In the same session that added the orchestration-tuning rules above, two separate task-ID references (`task 16`, an explicit task-file ID) leaked into newly-authored durable rule/doc prose (`rules/local/task-authoring.md`, `docs/KNOWLEDGE_INBOX.md`) and survived an initial review pass before being caught by the operator. `AGENTS.md`'s existing rule against this ("never reference task IDs, decision IDs, or task file paths in comments — these go stale") is scoped to code comments only; nothing extended it to rule/doc prose, which is exactly where an agent authoring rules out of a task-driven session is most likely to leak one. Added a mechanical self-check: before finishing an edit to `rules/**`/`CLAUDE.md`/`AGENTS.md`/non-ledger `docs/*.md`, grep the diff for task-ID/decision-number-shaped patterns, with the three intentionally-dated ledgers (`docs/METRICS.md`, `docs/KNOWLEDGE_INBOX.md`, `docs/CLAUDE_TS_CHANGELOG.md`) as explicit exceptions.
- **Why it matters upstream**: Any claude-ts consumer whose orchestrator authors or edits rule/doc files while working a specific task (the common case) risks the same leakage — a task ID embedded in prose reads as authoritative today and as meaningless noise once the task file is archived or deleted (`tasks/**` is typically gitignored). A mechanical grep is more reliable than "remember not to," since the existing comment-scoped rule already existed and still didn't prevent this.
- **Suggested upstream change**: Extend the existing "no task IDs in comments" guidance in `rules/cts/code-style.md` to explicitly cover rule/doc prose, not just code comments, and add the grep-based self-check to `rules/cts/workflow.md`'s write-time checklist. Also worth a `cts-rule-auditor` structural check (a 12th check) that scans `rules/**`, `CLAUDE.md`, `AGENTS.md` for task-ID/decision-number-shaped patterns outside declared ledger exceptions, as a periodic backstop for when the write-time check is skipped.
- **Status**: pending-port — currently lives only in this project's unsynced `rules/local/workflow.md`.

---

## 2026-07-27 — [Enhancement] `testing.md` "Guard decorator chains" names the coverage gap but not the mechanism or a fix recipe

- **Component**: `rules/cts/testing.md` § "NestJS-Specific Testing" › "Guard decorator chains: established convention vs. coverage gap"
- **Type**: Enhancement
- **What happened**: A production bug (`BudgetModule` applied `@UseGuards(SessionGuard, ActiveUserGuard)` without importing `AuthModule`, which exports the guards' own DI dependencies) crashed the API at boot with `UnknownDependenciesException`. The existing section already correctly flags that hand-built-`ExecutionContext` guard specs leave "a decorator regression... invisible to the test suite," but doesn't name the specific NestJS mechanism at fault (`@UseGuards(X)` resolves `X`'s dependencies in the _controller's hosting module_, not the module exporting `X`) or give a concrete recipe — it only suggests "a thin e2e-style smoke test... is an option," with no example. This project's fix added a module-compile smoke test instead (`Test.createTestingModule({ imports: [TheModule] }).compile()`), using a local `@Global()` config-stub module for `API_CONFIG` and a URI-less `mongoose.createConnection()` override for the Mongo connection token — cheap (no live DB/network), and confirmed by reverting the fix locally to prove the spec fails with the real error.
- **Why it matters upstream**: Any claude-ts consumer using NestJS with per-controller `@UseGuards` chains and DI-dependent guards can hit this exact class of boot-time bug, and the current section's "smoke test is an option" phrasing under-specifies the fix enough that most agents/devs won't reach for it. A concrete recipe turns a vague suggestion into an actionable pattern.
- **Suggested upstream change**: Extend the "Guard decorator chains" section with (a) a short explanation of the host-module DI resolution mechanism, and (b) the module-compile-spec recipe as a code block (config-stub `@Global()` module + URI-less `mongoose.createConnection()` override), plus the "revert the fix and confirm the spec fails" verification tip. This project's local (non-portable) copy of the full recipe currently lives in `rules/local/architecture-backend.md` § "Per-controller `@UseGuards(X)`" as a stand-in until this lands upstream.
- **Status**: pending-port

---

## 2026-07-27 — [Fix] `.claude/settings.json` deny list had dead `Write(path)` rules alongside the working `Edit(path)` ones

- **Component**: `.claude/settings.json` (`permissions.deny`)
- **Type**: Fix
- **What happened**: The deny list carried both `Edit(./.cts/**)`/`Edit(./rules/cts/**)` and `Write(./.cts/**)`/`Write(./rules/cts/**)`, intending to block edits to CTS-owned payload. Claude Code's file-permission matcher only recognizes `Edit(path)` as the rule form for file-mutating operations — that single rule already covers every tool that writes to a file (`Edit`, `Write`, `NotebookEdit`). The `Write(path)` entries are never evaluated by the path checker and are silently inert; Claude Code itself surfaces a startup warning naming the exact dead rules. Removed the two redundant `Write(...)` deny entries; protection is unchanged since `Edit(...)` already covered `Write`.
- **Why it matters upstream**: Any claude-ts consumer or the template itself that writes a deny rule as `Write(path)` expecting it to gate the `Write` tool gets silent no-op protection — the rule parses fine and shows no error until Claude Code's own startup diagnostic flags it. Worth a template-level lint/audit note (e.g. in `cts-rule-auditor`) to catch `Write(...)`/`Read(...)`-style path rules that aren't `Edit(...)` and flag them as likely-dead.
- **Suggested upstream change**: Add a `cts-rule-auditor` check that scans `.claude/settings.json` permission rules for `Write(<path-glob>)` or similar path-style entries outside the `Edit(...)` form and flags them as probably-inert, pointing at the `Edit(path)`-covers-all-file-tools behavior.
- **Status**: pending-port

---

## 2026-07-22 — [Fix] `docs/METRICS.md` append instruction didn't specify anchoring, so an Edit landed a new row mid-table instead of at the true tail

- **Component**: `docs/METRICS.md` (Entries section header comment)
- **Type**: Fix
- **What happened**: The file instructed appending "one row per completed task" to its table but never said how to perform the edit mechanically. A prior append used an `Edit` with `old_string` anchored on an unrelated earlier row (from 2026-07-08) instead of the file's actual last row, so the new row for a 2026-07-22 task landed spliced between two older, unrelated rows rather than at the end (commit `9301b70`). The `Edit` tool call succeeded silently because `old_string` matched somewhere in the file, just not at the tail — nothing enforced insertion point in a plain markdown table. Fixed by adding an explicit anchoring instruction to the file's own header comment: read the file's tail (or at least its last table row) first, then anchor `old_string` to that physically-last row, never to an earlier one. The misplaced row itself was manually relocated to its correct position.
- **Why it matters upstream**: Any claude-ts consumer with an append-only markdown ledger (this template's own `docs/METRICS.md` pattern) faces the identical gap: "append a row" is not a safe instruction on its own for an `Edit`-based tool, because a stale or loosely-chosen anchor can match mid-file and insert there instead of at the true end. This generalizes beyond METRICS to any append-only table any AI tool maintains in the repo.
- **Suggested upstream change**: In the template's `docs/METRICS.md` file, update the "Append one row..." header comment to require anchoring `Edit` `old_string` to the physically-last row (read the tail first if unsure).
- **Status**: pending-port

---

## 2026-07-22 — [Fix] cts-rule-auditor Check 11 is unrunnable in consumer projects (`cts-payload.txt` lives only in the template repo)

- **Component**: `.claude/skills/cts-rule-auditor/SKILL.md`
- **Type**: Fix
- **What happened**: Running `/cts-rule-auditor` in this consumer hit Check 11 ("hook paths must exist in `cts-payload.txt`") with no `cts-payload.txt` anywhere in the repo — the payload manifest exists only in the CTS template repo, so the check as written can never pass or fail in a consumer, only error out. Fixed by scoping the check: in a consumer (has `.cts-version`, lacks `cts-payload.txt`) run only the local half (each hook `command` in `.claude/settings.json` resolves to an existing executable file) and report the manifest half as `N/A (consumer)`; the full manifest check runs only where `cts-payload.txt` exists.
- **Why it matters upstream**: Every consumer that runs the auditor skill hits the same dead check; without the scoping note, audits either skip Check 11 silently or mis-report a HIGH finding for a file that is structurally absent by design.
- **Suggested upstream change**: Apply the same "Template-repo only" preamble to Check 11 in the template's copy of the skill. Also note: this session's audit ran the local half manually and `knowledge-capture-nudge.sh` resolved fine.
- **Status**: pending-port

---

## 2026-07-22 — [Enhancement] Nx generator post-gen checklist missing Tailwind v4 `@source` registration step for new consuming Angular libs

- **Component**: `rules/nx-generators.md` § 3 "Post-generator corrections by framework"
- **Type**: Enhancement
- **What happened**: Debugging a header-nav styling issue surfaced that `apps/web/src/styles.css` uses Tailwind v4's CSS-first config with `@import 'tailwindcss' source('./app')` plus one manually-added `@source '../../../libs/<path>/src'` line per consuming lib (four such lines existed for `identity/feature-login`, `identity/feature-access-status`, `identity/feature-greeting`, `shared/web-shell`). `source('./app')` scopes Tailwind's automatic content-scanning to the app's own tree and does not reach sibling Nx libs, so every new consuming lib needs its own explicit `@source` line or its Tailwind classes silently never compile — no build/lint/test failure signals the gap, just unstyled elements at runtime. This obligation existed only as an unwritten convention (visible by example in `styles.css`, not stated anywhere in `rules/`). Added a new subsection, "Tailwind `@source` Registration for New Consuming Angular Libs", to `rules/nx-generators.md` § 3, parallel to the existing "Angular Style Files — CSS (not SCSS)" subsection.
- **Why it matters upstream**: Any claude-ts consumer adopting Tailwind v4's CSS-first `@source`-per-lib pattern in an Nx monorepo (rather than Tailwind's default whole-tree auto-detection) hits the identical silent-failure mode on every new lib generation, since Nx generators have no hook to update a consumer app's `styles.css`.
- **Suggested upstream change**: Add the same subsection to the template's `rules/nx-generators.md` § 3, conditioned on projects that actually use the CSS-first `@source`-per-lib pattern (not universal — projects relying on Tailwind's default auto-detection heuristic don't need it).
- **Status**: pending-port

---

## 2026-07-22 — [Fix] Close hand-authored-scaffold gap: mandatory-nx-g rule + agent pre-flight enforcement + dispatch cross-reference

- **Component**: `rules/nx-generators.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/agents/{backend-developer,angular-developer,dba,queue-specialist,integration-architect,refactoring-expert}.md`
- **Type**: Fix
- **What happened**: A backend-developer hand-authored `libs/budget/application` by diffing against `libs/identity/application` rather than running `nx g @nx/js:lib`, missing a required `es2020` target override for BigInt-backed `Money` imports and risking silent config loss. Root cause: the mandatory-nx-g rule existed in `rules/nx-generators.md` but (1) was not cited in any agent's `## Pre-flight` list, (2) was contradicted by AGENTS.md's index line stating hand-authoring was a viable path, and (3) had no enforcement at dispatch time. Fixed three layers: (A) Add "Mandatory: Always run `nx g`" section to `rules/nx-generators.md` explaining hand-authoring is prohibited for all apps/libs, and purge residual permission language from § 6: Nx auto-detecting a hand-written lib is stated as NOT permission, and quality-gate reports must now cite the exact `nx g` command — "hand-authored + diffed against sibling" is no longer a reportable creation path. (B) Update `AGENTS.md` on-demand rules index, line for nx-generators.md, removing "(generated or hand-authored)" to eliminate the false implication that hand-authoring is standard. (C) Add conditional pre-flight line to six agent files (`backend-developer`, `angular-developer`, `dba`, `queue-specialist`, `integration-architect`, `refactoring-expert` — the last because "extract class" work can grow into "extract to new lib"): "Before creating any new app or lib (or after running any `nx g …` generator): `rules/nx-generators.md`". (D) Add dispatch-prompt cross-reference rule to `CLAUDE.md` orchestrator section: "When writing a dispatch prompt, cross-reference `AGENTS.md`'s on-demand rules index against the task's described file-touching surface to identify task-specific rules the target agent's pre-flight may miss." (E) Document in `rules/nx-generators.md` § Post-generator corrections that any lib importing `shared-util`'s BigInt-backed `Money` must include `"target": "es2020"` in its own `tsconfig.json`, mirroring the base pattern set in `shared-util` itself — this is a transitive-config requirement, not an exception.
- **Why it matters upstream**: Any claude-ts consumer allowing hand-authored scaffolds (for TypeScript utilities, non-framework libs, or any other reason) faces the same gap: the rule, the index, the agent pre-flight lists, and the dispatch prompt can all drift out of sync, and an agent takes the hand-author path without ever seeing the rule. Multiple layers are needed because any single layer can decay independently. The mandatory-nx-g rule + three layers of enforcement (agent pre-flight + AGENTS.md index + dispatch cross-reference) ensures the rule reaches agents regardless of which path they choose or which dispatch wording was used.
- **Suggested upstream change**: (1) Add the "Mandatory: Always run `nx g`" section to `rules/nx-generators.md` right after the opening paragraph. (2) Update `AGENTS.md`'s on-demand index line for nx-generators.md to remove hand-authoring parenthetical. (3) Add the conditional pre-flight line to the six agent files listed above, matching each file's existing bullet-list style. (4) Add the dispatch-prompt cross-reference rule to `CLAUDE.md`'s orchestrator section (after Triage, before Routing). (5) Document the es2020 target requirement for Money imports in `rules/nx-generators.md`'s post-generator corrections section. (6) In the template's agent files and CLAUDE.md, ensure the file format permits these edits (pre-flight is already a bullet list in CTS, CLAUDE.md orchestrator section already exists).
- **Status**: pending-port

---

## 2026-07-22 — [Fix] `cts-sync.sh` self-overwrite mid-run produces a spurious non-zero exit after a fully successful sync

- **Component**: `.claude/scripts/cts-sync.sh`; `.claude/skills/cts-update/SKILL.md` (step 2 wording)
- **Type**: Fix
- **What happened**: `cts-sync.sh` copies `.claude/scripts/` last in the payload order specifically so it overwrites itself only after everything else is synced (see comment above `sync_path()`). But bash does not fully buffer a script's source before executing straight-through code — when `copy_one` overwrites the running script file on disk, bash's subsequent reads for the remainder of the script land on bytes from the _new_ file at the _old_ file's byte offset, which don't align to any coherent statement. Observed result: the run completes all real work (payload copied/merged, `.cts-version` written, "Done. Review with: git diff" printed) but then bash throws a parse error and the process exits non-zero. Verified via `.cts-version` matching the new upstream SHA and `git diff --stat` matching the printed merge/conflict list. Re-verified 2026-07-07 in an isolated sandbox after a sync pulled a new `cts-sync.sh` revision (commit `c512bd8`, which only reworked `merge_one`'s temp-file cleanup and left the self-copy ordering/comment untouched): reproduced the same class of failure with a synthetic mid-file upstream diff to `cts-sync.sh` (exit 127, `line: command not found` — a _different_ garbled error than the original run's exit 2, `syntax error near unexpected token '&&'`), confirming the error text/code is arbitrary noise from misaligned byte offsets, not a stable signal.
- **Why it matters upstream**: Every consumer running `/cts-update` on a payload that includes a `cts-sync.sh` revision hits this. The non-zero exit contradicts `cts-update/SKILL.md` step 2's assumption that non-zero exit means "did not run" — a false negative that leads agents and users to mis-diagnose fully successful syncs as failures.
- **Suggested upstream change**: Root cause is structural (self-modifying script under `bash script.sh` invocation) and needs a fix in the sync engine itself — three candidates: (a) re-exec via `exec bash "$0" "$@"` right before the self-copy; (b) defer the self-copy to a `trap ... EXIT` that runs after the interpreter has finished reading the file; (c) copy `.claude/scripts/cts-sync.sh` to a temp path and `cp` it into place as the very last statement with no code after it. Additionally, `cts-update/SKILL.md` step 2 wording should note this known false-negative on exit code.
- **Status**: pending-port — cross-check first: the 2026-07-16 entry below records the `cts-sync.sh` self-overwrite/source-mismatch bugs as "fixed directly at the engine level" in the local `claude-ts` working tree (verified against a scratch repo). If that fix covers this failure mode, the port step reduces to verifying it upstream and confirming the SKILL.md step-2 wording landed, then marking this ported. Either way, the fix has NOT reached this project's installed `.claude/scripts/cts-sync.sh` as of `c512bd8` (re-verified 2026-07-07) — it arrives via the next `/cts-update`.

---

## 2026-07-21 — [Fix] `rules/dependencies.md` prescribed gitignored frontend environment files — an anti-pattern that broke CI in four independent contexts

- **Component**: `rules/dependencies.md` § "Frontend Environment Files"
- **Type**: Fix
- **What happened**: The rule stated that Angular's `environment.ts` / `environment.development.ts` being gitignored is "correct, to avoid committing secrets", and prescribed mitigations for the resulting breakage: document a copy step in `README.md`, ship a checked-in `environment.example.ts` template, and optionally add a postinstall check. The parenthetical is a category error — **a frontend environment file cannot contain a secret**, because everything in a browser bundle is public by construction. In this project the only value involved was a Telegram bot username that the login widget writes into the DOM as `data-telegram-login`. Treating it as secret produced a gitignored generated file, which meant every context compiling the app (the `ci` job, the `e2e` job, the Dockerfile, and any fresh clone) had to regenerate it independently before any `nx` target would compile. That cost a full day and five successive failed fix commits on 2026-07-21 (`53f0570`, `7571396`, `fe9aadf`, `ceb4dfb`, `b6e1a6b`), each patching one context while the next stayed broken; all five were reverted (`ca235cf`) and replaced by simply committing the file. The rule's prescribed mitigations are precisely the machinery that had to be deleted — `environment.example.ts` and the README copy-step instructions were both removed as part of the fix.
- **Why it matters upstream**: Any consumer with an Angular (or Vite/Next) frontend will hit this, because the rule actively directs them into it. The failure is slow and expensive rather than loud: local dev works fine (the developer generated the file once, months ago), so breakage only appears in CI, in Docker, and for new contributors — three audiences who each debug it separately. The template is teaching the anti-pattern, not merely failing to warn about it.
- **Suggested upstream change**: Rewrite the section to invert the default. (1) State the rule: frontend environment files contain **no** secrets by definition; anything reaching the bundle is public, so commit them. (2) Name the real secret boundary — API tokens, signing keys and the like are backend-only and live in `.env` / server config; for Telegram specifically, the bot **token** is secret, the bot **username** is not. (3) Generalize the underlying lesson: gitignoring a generated file that the build depends on converts correctness from a property of the repo into a property of every execution context, with no single place to be right — so if a value genuinely must vary per environment, prefer Angular `fileReplacements` over committed files, or runtime config (`APP_INITIALIZER` fetching from the API) over build-time injection, but never a gitignored generated source file. (4) Delete the `environment.example.ts` / README-copy-step / postinstall-check mitigations, which exist only to make the anti-pattern survivable.
- **Status**: applied locally (2026-07-21 infrastructure task; `rules/dependencies.md` rewritten, `.env.example` updated, `README.md` and `docs/SKELETON.md` updated to describe runtime API config pattern, `docker-compose.yml` wired to pass `TELEGRAM_BOT_USERNAME` to api service, pending upstream port)

---

## 2026-07-20 — Fix: `rules/nx-generators.md` trigger-wording gap exposed hand-author path

- **Component**: `rules/nx-generators.md`, `AGENTS.md`
- **Type**: Fix
- **What happened**: The trigger conditions for when to read `rules/nx-generators.md` were worded as post-hoc ("read AFTER running a generator"), even though §6 of the file explicitly permits hand-authoring non-Angular libs. An agent taking the hand-author path never tripped the stated trigger and thus never saw §6's completeness checklist — the ambiguity was caught only after direct interrogation. Rewording the trigger in both the file header and `AGENTS.md`'s index to "before creating any new app or lib — whether generated or hand-authored" ensures agents read the file regardless of which path they choose. Also added a requirement that completion reports explicitly state which path was taken (exact `nx g` command, or "hand-authored" with companion-file diff confirmation), closing the ambiguity.
- **Why it matters upstream**: Any claude-ts consumer allowing hand-authored non-framework libs (as this project does for plain TypeScript libraries) faces the identical gap: a rule file can permit a path that its own trigger condition doesn't account for. The trigger condition needs to fire on either path, not just one.
- **Suggested upstream change**: In the template's `rules/nx-generators.md` (if hand-authoring is permitted for non-Angular libs), reword the opening trigger from "Read this AFTER running any `nx g …` generator" to "Read this BEFORE creating any new app or lib — whether via an `nx g …` generator or hand-authored." Also add to §6 ("Generator-Hygiene Gotchas") a requirement that any implementation report explicitly state which path was taken (exact generator command, or "hand-authored" + companion-file audit confirmation). In `AGENTS.md`'s index, reword the trigger phrase from "after running ANY `nx g …` generator" to "before creating any new app or lib (generated or hand-authored), or after running ANY `nx g …` generator."
- **Status**: pending-port

---

## 2026-07-19 — Override: Angular CSS (Tailwind) replaces SCSS-only mandate

- **Component**: `rules/code-style-angular.md`, `rules/nx-generators.md`
- **Type**: Override
- **What happened**: Adopting Tailwind v4 (ADR-008) required a repo-wide flip from SCSS to plain CSS across all Angular projects (`apps/web` and feature libs `libs/identity/*`, `libs/budget/*`). Tailwind v4 explicitly does not work with CSS preprocessors and follows Angular's own official integration guide. Updated styling section in `code-style-angular.md` to mandate `.css` (not `.scss`), changed `nx-generators.md`'s "SCSS Only" section to "CSS (not SCSS)" with the rationale, and removed `--style=scss` instructions. Also updated `docs/SKELETON.md` (project-specific, non-template-inherited) to remove `--style=scss` from the Angular lib scaffold command and removed the post-gen "rename `.css` → `.scss`" instruction.
- **Why it matters upstream**: Any claude-ts consumer adopting Tailwind v4 (or any CSS-first framework that forbids preprocessors) for Angular will hit the identical need to flip these rules from SCSS-only to CSS-standard. The current template's SCSS-mandate default would conflict with Tailwind adoption.
- **Suggested upstream change**: For projects choosing to adopt Tailwind v4 or other preprocessor-incompatible styling frameworks, conditionally (or selectively in platform-specific `code-style-angular.md` if the template gains multi-platform split) override the styling section to mandate `.css` with a note: "Tailwind v4 does not work with CSS preprocessors — use plain CSS per Angular's official integration guide (see link to Angular docs)." For projects still using SCSS with other frameworks, the current SCSS-mandate continues to apply.
- **Status**: pending-port

---

## 2026-07-17 — Enhancement: `rules/code-style-angular.md` gained an Internationalization (Transloco) section

- **Component**: `rules/code-style-angular.md`
- **Type**: Enhancement
- **What happened**: The i18n-transloco-foundation task (T2, `ba`-planned) wired `@jsverse/transloco` into `apps/web` and needed a durable, discoverable convention doc for future `angular-developer` dispatches: scope-per-domain pattern (`provideTranslocoScope('<scope>')` co-located in `@Component.providers`), the file-placement convention (`apps/web/public/i18n/<scope>/<lang>.json`, reusing the existing static-asset copy path — no new Nx build wiring), full `<scope>.<key>` naming (scope providers do NOT auto-prefix template pipe keys — see the companion `docs/KNOWLEDGE_INBOX.md` entry on `TranslocoPipe.updateValue()`'s behavior), and the `TranslocoTestingModule` testing pattern (`<scope>/<lang>` module keys, double `detectChanges()`/`whenStable()` needed for pipe resolution). Landed as a new section in the file `AGENTS.md`'s on-demand rules index already points future agents to for Angular component-authoring conventions, rather than a new `docs/` file.
- **Why it matters upstream**: any claude-ts consumer adopting Transloco (or a similarly scope-based Angular i18n library) for the first time will hit the identical "which file documents the key convention" placement question and the identical scope-doesn't-auto-prefix-pipe-keys gotcha — worth a generic (non-Penny-specific) version of this section in the template's own Angular code-style rule, gated behind "if the project uses Transloco" framing since the base template shouldn't assume a specific i18n library choice.
- **Suggested upstream change**: add a generalized (library-choice-agnostic framing, or explicitly Transloco-scoped with a note that other i18n libraries would need their own section) "Internationalization" subsection to the template's `rules/code-style-angular.md`, covering: (1) scope-per-domain co-location pattern, (2) static-asset file placement reusing the existing Nx asset-copy convention rather than inventing new build config, (3) the full-scope-qualified-key-in-templates gotcha, (4) the testing-module setup pattern including the double-`detectChanges` requirement.
- **Status**: pending-port

---

## 2026-07-17 — Fix: phantom-baseline sync loss repaired via etalon; root cause and guards landed upstream

- **Component**: whole CTS payload (22 files: `CLAUDE.md`, `rules/workflow.md`, `rules/nx-generators.md`, `.claude/agents/{tester,backend-developer,angular-developer,qa,reviewer}.md`, `.claude/scripts/cts-sync.sh`, `.claude/skills/{cts-update,cts-contribute,distill-inbox,github-actions}`, `.prettierignore`, `rules/shell-scripting.md` (new), hand-merges into `.ctsignore`'d `AGENTS.md`/`rules/architecture.md`/`rules/code-style.md`)
- **Type**: Fix
- **What happened**: this project's `.cts-version` (`6cbf33b`) recorded content that was never actually received — the "undocumented local simplifications (dropped Tiered Planning Ladder, handoff hard-stop, Generation damping)" admitted in the 2026-07-16 entry above were not intentional simplifications but a **phantom baseline** from round-4's mis-resolved sync conflicts. Every later 3-way merge treated the gap as deliberate local deletion; prettier renormalize (`proseWrap: never` reflow on both sides) suppressed the conflicts that would have exposed it. Repaired directly against the etalon classification (`claude-ts/tmp/cts-update-etalon-classification.md`), not via engine re-run (a merge can never restore phantom-deleted content). AC1–AC6 verified: 125 payload files byte-identical to `7385cef`, all local keeps preserved (7 penny-invented `rules/workflow.md` sections incl. `### CI scoping`, Mongo/Angular/LIVR wording, ADR-005 refs).
- **Why it matters upstream**: any consumer whose stamp advances past received content silently loses features forever; two other consumers' worth of guards now exist.
- **Suggested upstream change**: already implemented in the local `claude-ts` working tree this same session — `baseline_audit()` (`BASELINE INTEGRITY:` lines) + raw-merge cross-check (`MERGE CROSS-CHECK:` lines) in `cts-sync.sh`, blocking triage rules in `cts-update/SKILL.md`, regression tests (cases 6/7), validated against this repo's pre-repair HEAD (`df08687`).
- **Status**: ported (in local claude-ts working tree, pending commit there)

---

## 2026-07-16 — Ported: 28 entries contributed via /cts-contribute

28 `pending-port` entries (spanning `CLAUDE.md`, `rules/workflow.md`, `rules/testing.md`, `rules/task-authoring.md`, `rules/nx-generators.md`, `rules/docker-commands.md`, `rules/code-style.md`, `rules/dependencies.md`, `rules/git-operations.md`, `rules/validation-authorization.md`, `rules/architecture.md`, `ba.md`, `ddd-architect.md`, `.claude/hooks/knowledge-capture-nudge.sh`, `.claude/settings.json`, `.claude/scripts/cts-sync.sh`, `.claude/skills/{cts-rule-auditor,distill-inbox,github-actions,cts-update}`, plus the new `rules/docs-style.md` + `.prettierrc`) were exported to the local `claude-ts` checkout across several `/cts-contribute` sessions. Project-specific content (Mongo/Angular/pnpm-specific wording, task/DECISIONS examples) was generalized during export; the `cts-sync.sh` self-overwrite/source-mismatch bugs and the `rules/workflow.md` Planning Team spawn-context / stale `TeamCreate`-`TeamDelete`-`team_name` Tool API Reference were all fixed directly at the engine/doc level since neither project had actually implemented those fixes yet — verified end-to-end (the `cts-sync.sh` fixes against a scratch repo; the `TeamCreate` cleanup by grepping for every remaining stray reference in the file). Deliberately excluded: `.claude/agents/{tester,qa,angular-developer,reviewer,security-scanner}.md` (upstream is ahead on the TDD-shift), and several undocumented local simplifications in this project's `rules/workflow.md`/`CLAUDE.md` (dropped Tiered Planning Ladder, `handoff`-skill hard-stop, Generation damping) that were never logged as intentional upstream changes. See `../claude-ts/CHANGELOG.md`'s `[Unreleased] — Contributed from penny` section for the itemized list.

- **Status**: ported (pending commit in claude-ts, not yet PR'd upstream from there)

---

## 2026-07-12 — Fix: distill-inbox's Category B/C rubric can never auto-distill an inbox whose entries habitually hedge with "(guess)"

- **Component**: `.claude/skills/distill-inbox/SKILL.md`
- **Type**: Fix
- **What happened**: Ran `/distill-inbox` against a real `docs/KNOWLEDGE_INBOX.md` with ~50 entries. The skill's bucket table puts any entry with `Belongs in (guess):` into Category C ("uncertain — keep untouched") regardless of how single-target/confident the guess actually is; only entries with `Belongs in: <exact-file>` (no "guess") and one candidate qualify as Category B. Because every entry in this project's inbox uses the hedged `(guess)` convention as a matter of habit (and the inbox's own header prose invites that hedge), a literal application of the rubric found **zero** Category B matches out of 50 — the skill could not drain the inbox at all on its own terms. Had to fall back to the orchestrator manually judging a single confident target per entry (overriding the mechanical rubric with the user's explicit sign-off) before any content moved.
- **Why it matters upstream**: Any claude-ts consumer whose inbox-entry convention encourages (or defaults to) hedged "(guess)" wording will hit the identical self-inflicted deadlock — the mechanical bucket rubric can never promote a guessed entry to "clear target" without a human/agent explicitly rewriting the line first, so the skill silently does nothing useful run after run unless someone notices and intervenes.
- **Suggested upstream change**: (1) In the bucket table, redefine Category B as "single confident target, regardless of guess wording" and Category C as strictly "lists multiple candidates or content spans >1 file" — drop `(guess)` wording itself as an automatic C-disqualifier. (2) Add an explicit step instructing the orchestrator/assistant to first pass over all `(guess)`-hedged entries and decide, using its own judgment (with user confirmation), whether each has one clear best-fit target — promoting confident guesses to B before applying the table — rather than leaving every guessed entry untouched by default.
- **Status**: pending-port — note: the post-write-verification half of this entry's original suggestion (independently grep each claimed-distilled entry's target file rather than trusting a subagent's own completion count, plus a structural-corruption check) was already ported in the 2026-07-16 contribution round as Step 4.5; only the Category B/C rubric redefinition above (items 1–2) remains outstanding, and was never actually applied to this project's own copy either.

---

## 2026-07-08 — Fix: `rules/architecture.md`'s onion-layer bullet list didn't document `type:kernel → type:contracts` as an allowed shared-leaf dependency

- **Component**: `rules/architecture.md` (Onion Rules / Backend section)
- **Type**: Fix
- **What happened**: A task relaxed the project's `eslint.config.mjs` `depConstraints` so `type:kernel` may depend on `type:contracts` (to import a shared `RoleType` union onto `CallerIdentity.roles` instead of duplicating it). This extended an existing-but-undocumented pattern: `type:core`, `type:application`, and `type:infrastructure` were already allowed to depend on `type:contracts` (each is a documented "shared leaf" consumer per the file's own "Type-Contracts Boundary" section), but the plain bullet-list description of `type:kernel` still said only "may depend on util and errors," so the doc and the enforced lint rule had drifted apart.
- **Why it matters upstream**: any claude-ts consumer using the kernel/contracts/errors/util "shared leaf" onion pattern will hit the same drift the moment they extend one leaf's allowlist to include another.
- **Suggested upstream change**: in the template's `rules/architecture.md`, either (a) drop the specific "may depend on X and Y" wording from each onion-layer bullet and replace it with a pointer to the authoritative `eslint.config.mjs` `depConstraints` block, or (b) if keeping the inline description, add a one-line reminder next to the "Type-Contracts Boundary" section: "whenever a leaf-to-leaf allowlist changes in `eslint.config.mjs`, update the corresponding bullet above in the same commit."
- **Status**: pending-port — blocked on the structural platform-split below: CTS's current single-file `rules/architecture.md` has no Nx-tag/`depConstraints` documentation at all to attach this fix to.

## 2026-07-08 — Fix: backend-developer.md carried the generic claude-ts default stack instead of this project's actual stack

- **Component**: `.claude/agents/backend-developer.md`
- **Type**: Fix
- **What happened**: The "Project Stack" table (and two prose references in Workflow/Done Criteria) still listed the claude-ts template defaults — `Express / Fastify / NestJS`, `Prisma (primary) / TypeORM / Drizzle`, `Passport.js / JWT / session` — none of which match this repo's actual backend stack (NestJS only, Mongoose + Typegoose confined to the infrastructure layer, JWT delivered via an httpOnly+Secure+SameSite=Lax cookie, MongoDB 7). Fixed by replacing the table with the project's real stack and swapping the two Prisma-specific prose lines for Mongoose/Typegoose equivalents.
- **Why it matters upstream**: Every claude-ts consumer that customizes its actual stack (a different ORM, different auth mechanism) but only edits the table header risks leaving stale Prisma/PostgreSQL references in prose bullets elsewhere in the same file — the generator/template doesn't cross-check table content against prose mentions of the same technology.
- **Suggested upstream change**: When customizing `backend-developer.md` (or any agent template) for a project's real stack, grep the whole file for the default stack's proper nouns (`Prisma`, `PostgreSQL`, `Passport.js`, etc.) — not just the Project Stack table — before considering the customization complete. Consider a `cts-rule-auditor` check that flags stack-default keywords surviving outside a table row.
- **Status**: project-local-only

---

## 2026-06-28 — Enhancement: split monolithic code-style.md and architecture.md into platform-specific files

- **Component**: `rules/code-style.md`, `rules/code-style-angular.md` (new), `rules/code-style-backend.md` (new), `rules/architecture.md`, `rules/architecture-angular.md` (new), `rules/architecture-backend.md` (new)
- **Type**: Enhancement
- **What happened**: Split two large shared rules files into platform-specific variants to reduce token usage and prevent frontend agents from loading backend-specific patterns and vice versa.
- **Why it matters upstream**: Any claude-ts consumer with multiple platforms (backend + frontend, or multiple backend frameworks) will benefit from splitting large shared rules files.
- **Suggested upstream change**: This is a larger structural change requiring genuinely generic (framework-agnostic) content to be authored for CTS, since this project's own split files are Angular/Mongo-specific and are already protected in `.ctsignore` as project-local overrides. A future session should author generic multi-framework variants (Vue/React/Angular for frontend; a couple of common backend patterns) and un-gate the agent pre-flight reads once those files exist upstream. Two generalized fixes that would otherwise target `rules/architecture-backend.md` and the Nx-tag portion of `rules/architecture.md` (the kernel→contracts doc-drift fix above, and the multi-dimension-tag-violation note below) are both blocked on this split — CTS's current single-file `rules/architecture.md` documents no Nx-tag/`depConstraints` system for them to attach to.
- **Status**: pending-port (structural — needs a dedicated session)

---

## 2026-07-15 — Enhancement: `rules/architecture.md` documents that module-boundary violations can span multiple tag dimensions

- **Component**: `rules/architecture.md` (Nx Monorepo Tags & Boundaries section)
- **Type**: Enhancement
- **What happened**: `@nx/enforce-module-boundaries` reports one violation at a time, so fixing the first-reported tag dimension can just surface a violation on a second dimension the pair also differs on. In this repo: a lib flagged for a `scope` violation was also mismatched on `platform` — retagging only `scope` would have re-triggered the same class of error on the next lint run; the fix retagged both dimensions in one pass.
- **Why it matters upstream**: Any claude-ts consumer using a multi-dimension tagging scheme (`scope`/`type`/`platform` or equivalent) with `@nx/enforce-module-boundaries` hits the identical one-violation-at-a-time reporting gap.
- **Suggested upstream change**: Add a note to the template's base `rules/architecture.md` Enforcement section: check `depConstraints` for ALL tag dimensions the flagged pair differs on before choosing a fix, not just the dimension named in the current lint error.
- **Status**: pending-port — blocked on the same structural platform-split as the kernel→contracts entry above (no Nx-tag/`depConstraints` system in CTS's current `rules/architecture.md` to attach this to).

---

## 2026-07-15 — Enhancement: `rules/task-authoring.md` — gitignored-tasks git-op guidance (project-local remainder)

- **Component**: `rules/task-authoring.md`
- **Type**: Enhancement
- **What happened**: Reinforced the existing "`tasks/` is gitignored, use plain `mv`/`rm`" guidance with the originating commit reference (`3476a45`) and the `git check-ignore -v` diagnostic tip. This is specific to this project's own `tasks/` gitignore decision (and its particular commit history), not a generic claude-ts pattern — it duplicates, with project-specific provenance, the general `./tasks/` routing convention already covered by (and ported alongside) the 2026-07-13 entry.
- **Why it matters upstream**: Doesn't — this is project-local by design. The generic "deferred-ADR closing step" half of this entry's original scope was already ported in the 2026-07-16 contribution round.
- **Status**: project-local-only

---

## 2026-07-23 — Enhancement: `.claude/settings.json` — permission-rule overhaul, marketplace self-registration, MCP removal

- **Component**: `.claude/settings.json` (also deleted `.mcp.json`; project-local `.claude/settings.local.json` reorganized in the same session)
- **Type**: Enhancement
- **What happened**: (1) Replaced 26 accreted per-lib compound test-allow entries with 4 composable per-subcommand rules (`Bash(set -a)`, `Bash(set +a)`, `Bash(source .env)`, `Bash(pnpm nx test *)`) — Claude Code evaluates each `&&`-separated subcommand independently, so decomposed rules cover every current/future lib with zero settings churn and stay chain-safe. (2) Promoted the safe read-only command core (git read-only family, `rg`/`grep`/`jq`/etc., prettier, nx lint/build/typecheck, context7 plugin tools, docs-site WebFetch domains) from local to project scope. (3) Hardened deny: `rm -fr` flag-order variant, `Read(./.env.*)`, and blanket `Bash(git commit*)`/`Bash(git push*)` (owner reviews and commits manually — codifies the AGENTS.md Git Safety rule as enforcement). (4) Added `extraKnownMarketplaces.superpowers-marketplace` so the repo self-describes the marketplace its `superpowers@superpowers-marketplace` plugin needs (was registered only in one machine's user settings). (5) Pinned `context7@claude-plugins-official` at project level and deleted `.mcp.json` entirely (context7 now plugin-only; figma/github MCP servers removed as unused).
- **Why it matters upstream**: Three candidates: (a) the CTS template ships `"superpowers@superpowers-marketplace": true` in `.claude/settings.json` WITHOUT the matching `extraKnownMarketplaces` registration — every fresh-machine consumer install has a silently unresolvable plugin; template should ship both keys together (or consider switching to `superpowers@claude-plugins-official`, now at v6.1.1 vs marketplace 5.0.7, which needs no registration). (b) The per-subcommand decomposition pattern for env-sourcing test commands is reusable by any consumer whose tests need `.env`. (c) The commit/push blanket deny is a candidate template default since AGENTS.md already mandates never auto-committing.
- **Status**: pending-port

---

## 2026-07-26 — [Fix] `.prettierignore` lacked exclusions for CTS-owned payload paths, causing spurious ownership warnings on every sync

- **Component**: `.prettierignore`
- **Type**: Fix
- **What happened**: `/cts-update` flagged 8 `.claude/skills/*/SKILL.md` files as `OWNERSHIP WARNING` — diffing each showed the only change was one collapsed blank line, traced to an earlier repo-wide Prettier reformat (`df08687`, `proseWrap: never`) plus `lint-staged.config.mjs`'s broad `*.{...,md,...}` glob having no exclusion for CTS payload directories. Any future commit touching these files would re-trigger the same cosmetic drift and false ownership warning. Fixed by adding CTS-owned paths (`.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/hooks/`, `.claude/scripts/`, `rules/cts/`, `/AGENTS.md`, `/CLAUDE.md`, `docs/USAGE.md`) to `.prettierignore`, mirroring the file's existing vendored-skill exclusion pattern. Explicitly rejected using `.ctsignore` instead — that would have permanently cut these files off from real upstream content updates rather than just stopping formatting churn.
- **Why it matters upstream**: Any claude-ts consumer running Prettier with a broad-glob `lint-staged` config (matching `.md`/`.json`/etc. repo-wide) and no CTS-path exclusion will hit the identical spurious-ownership-warning loop on every sync that touches a CTS skill/agent/rule file, since single-ownership sync treats any local byte difference — including one Prettier reformatted — as a genuine local edit to overwrite and flag.
- **Suggested upstream change**: Add the same CTS-payload exclusion block to the template's own `.prettierignore` (or document it as a required consumer-side addition in the `cts-setup`/`cts-update` skill docs), so fresh installs don't have to rediscover this via a confusing ownership-warning investigation.
- **Status**: pending-port

---

## 2026-08-02 — [Enhancement] Nx generator post-gen checklist missing README.md boilerplate-replacement step

- **Component**: `rules/cts/nx-generators.md` § Post-generator corrections (new section after "Dead Demo-Component Cleanup")
- **Type**: Enhancement
- **What happened**: 5 of 11 `libs/budget/*` libraries shipped with Nx-generator boilerplate README text (`This library was generated with @nx/angular...`) instead of the repo's one-line convention (`# <lib-name>` + `**Tags:** scope:… · type:… · platform:…` matching `project.json` tags). No gate stage (build, lint, test, review) checks README content, so this drifted silently across several implementation tasks until an explicit governance-docs surface sweep caught it manually. Any generator-scaffolded lib can carry the boilerplate indefinitely without triggering any automated failure. A static guard test now enforces this conformance repo-wide, making incomplete READMEs visible in CI — but the post-generation checklist never named this step, leaving it to be discovered by trial-and-error on the first CI run that checked it.
- **Why it matters upstream**: Any claude-ts consumer's `nx g` generators produce identical boilerplate README text, and any consumer with a governance-docs initiative or a static readme-guard test will hit the same silent-failure mode on every new lib unless a post-gen checklist step explicitly mandates the replacement.
- **Suggested upstream change**: Add a new subsection to `rules/cts/nx-generators.md` § Post-generator corrections (after the existing "Dead Demo-Component Cleanup" entry if present, or as a standalone "Replace Generator-Provided README.md" section): document that the generated `README.md` boilerplate must be replaced with a one-line convention (optionally: "matching your repo's existing libs") before the lib's first feature commit. Include a note that no automated gate catches this omission during development, but it is visible under manual review or via a static guard test.
- **Status**: pending-port

---

## 2026-08-02 — [Enhancement] ADR-driven repo-wide convention flips must grep scaffolding rules to prevent silent reversion

- **Component**: `rules/cts/workflow.md` (Foresight gate section or a new "ADR-driven convention flips" subsection)
- **Type**: Enhancement
- **What happened**: Converting `apps/web` + `libs/identity/*` from SCSS to plain CSS (per ADR-008's Tailwind v4 adoption — Tailwind explicitly isn't designed to run through Sass) initially only touched the renamed files and `DECISIONS.md`. Code review caught that `rules/local/code-style-angular.md`, `rules/cts/nx-generators.md`, and `docs/SKELETON.md` all still hard-mandated SCSS-only (`--style=scss` on every generator invocation, "rename `.css` → `.scss`" as a post-gen step) — left unfixed, the next Angular-dev/reviewer agent following those rules would have silently reverted the new components back to SCSS, undoing the ADR. Even after the first fix pass, two more contradictory references survived in the same files (a stale `--style=scss` left in an example command, a stale "SCSS-not-CSS" mention in a scaffolding summary line) — this class of doc drift needs a full grep sweep for the old convention's keyword across `rules/**`/`docs/SKELETON.md`, not just fixing the sections that were obviously about styling.
- **Why it matters upstream**: Any claude-ts consumer doing an ADR-driven repo-wide convention flip (styling, module resolution, naming, file locations, etc.) risks the same silent doc-drift/revert problem if scaffolding/generator rule docs aren't grepped in the same changeset. A stale rule means the next agent implementing a new feature blindly follows it, silently undoing the architectural decision with zero errors — the diff looks correct (new component uses the new convention), but the implementation accidentally reverts the ADR.
- **Suggested upstream change**: Add a checklist item or a new subsection to the orchestrator's triage/ADR-handling section of `rules/cts/workflow.md`: "When an ADR/DECISIONS.md change flips a repo-wide convention (styling, module resolution, naming, etc.), perform a repo-wide grep for the old convention's keyword across `rules/**` and `docs/SKELETON.md` in the same changeset, not just the files the ADR itself touches. Fix any contradictory scaffolding/generator references that would cause the next agent to silently revert the convention flip." Optionally include the concrete example (SCSS→CSS + the three stale rule references) to illustrate the failure mode.
- **Status**: pending-port

---

## 2026-08-02 — [Enhancement] Nx enforce-module-boundaries silently allows unconstrained `scope:*` tags — new domain prerequisite must be documented

- **Component**: `rules/cts/architecture.md` (Nx tag / depConstraints section)
- **Type**: Enhancement
- **What happened**: `eslint.config.mjs`'s `@nx/enforce-module-boundaries` depConstraints currently enumerate only `scope:shared` and `scope:identity`. A source tag with no matching `onlyDependOnLibsWithTags` rule is NOT fenced by default — it can import anything. So standing up `libs/budget/*` has a hard prerequisite: add `{ sourceTag: 'scope:budget', onlyDependOnLibsWithTags: ['scope:budget','scope:shared'] }` to the config BEFORE the first budget lib lands, else the onion/scope fuse silently doesn't apply to budget (no error, no warning). This is an executable-config edit (never trivial-tier). Separately confirmed: `type:validation` libs may depend ONLY on `type:util` (not `type:contracts`) — LIVR schemas are self-contained runtime rule objects and must not import DTO/contract TS types; a budget `type:validation` lib therefore cannot import from a budget `contracts` lib.
- **Why it matters upstream**: Any claude-ts consumer using Nx's `@nx/enforce-module-boundaries` with per-domain `scope:*` tags will hit the same silent gap — a new domain's source tag isn't fenced until its depConstraint is explicitly added, and there's no error/warning when it's missing. The onion/scope fuse opens silently, allowing architecturally-forbidden imports to succeed until reviewed.
- **Suggested upstream change**: Add a note to the architecture rules doc's Nx-tagging section: "Adding a new `scope:*` domain requires an explicit `depConstraints` entry before the first lib in that domain lands — an untagged/unconstrained source tag is NOT fenced by default." Also note the `type:validation` → `type:util`-only constraint (validation libs must not import contract/DTO types) as a related, worth-stating-explicitly rule.
- **Status**: pending-port

---
