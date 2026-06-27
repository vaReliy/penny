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

## 2026-06-27 — Enhancement: quality gate two-section finding classification contract

- **Component**: `rules/workflow.md` / `reviewer` agent / `security-scanner` agent
- **Type**: Enhancement
- **What happened**: Quality gate "max 2 fix-retry cycles, then escalate" prose caused infinite review loops — reviewer treated all findings as Fix Now regardless of origin. Pre-existing findings triggered fix cycles that added new review surface, structurally guaranteeing the loop would continue. Fix: reviewer and security-scanner now emit `## Fix Now` (introduced by this changeset) / `## Emit as Task` (pre-existing). Orchestrator actions are deterministic per section: Fix Now → retry impl (max 2 cycles, then hard stop, no self-patch); Emit as Task → task file per finding, gate closes. Bug Fix Pipeline verify resolution also updated to origin-based routing. Scope annotations added to each agent's legacy severity-grouped output format to eliminate ambiguity with the new pipeline format.
- **Why it matters upstream**: Any claude-ts consumer running multi-file features will hit the review loop pathology. The fix is purely additive (two sections + scope annotations) and requires no source code changes.
- **Suggested upstream change**: Apply `## Finding Classification (mandatory — always two sections)` to `reviewer.md` and `security-scanner.md`; replace quality gate Resolution block in `rules/workflow.md` with the deterministic contract; add scope annotation "(for PR reviews)" / "(for standalone audits)" to each agent's legacy output format section; update Bug Fix Pipeline verify line to use origin-based language.
- **Status**: pending-port

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

---

## 2026-06-26 — Enhancement: Nx generator hygiene, dep-pin extraction, LIVR bootstrap, quality-gate mandatory framing

- **Component**: `rules/workflow.md` / `AGENTS.md` / `CLAUDE.md` / `rules/validation-authorization.md` / new `rules/nx-generators.md` / new `rules/dependencies.md`
- **Type**: Enhancement
- **What happened**: Six problems slipped through after `nx g @nx/nest:application api` produced a passing webpack build: (1) generator-injected `^` caret ranges on webpack/axios were not audited; (2) generated tsconfig used deprecated `"moduleResolution": "node"` (TS5110) with no documented fix; (3) generated tsconfig missing the strict block (the repo base intentionally omits it); (4) new `main.ts` omitted `registerLivrRules()` from `shared-kernel`, a silent runtime failure; (5) quality gate was skipped — the orchestrator accepted a build pass as "done"; (6) generated `apps/api-e2e` contained blanket `/* eslint-disable */` directives left unaudited. Fixes: created `rules/nx-generators.md` as a single generator-output audit checklist covering all six; extracted dep-pin procedure into `rules/dependencies.md` (on-demand, single-sourced) and shrunk the `AGENTS.md` bullet to the one-line invariant + pointer; added LIVR bootstrap section to `rules/validation-authorization.md`; renamed "Quality Gate (Conditional)" → "Quality Gate (Mandatory)" in both `CLAUDE.md` and `rules/workflow.md` with explicit "even when the build passes" language; added a "checklist ≠ done" note closing Phase 3.
- **Why it matters upstream**: All six gaps are universal to claude-ts consumers: Nx generators always inject caret ranges; the sparse base tsconfig forces explicit strictness declarations in generated projects; any `BaseService`-style pattern requiring manual bootstrap has the same silent-failure risk; "build-pass = done" is a recurring shortcut; generators routinely scaffold lint-disabled companion projects.
- **Suggested upstream change**: Add `rules/nx-generators.md` and `rules/dependencies.md` to the template. Shrink the `AGENTS.md` dep-pin bullet to invariant + pointer referencing `rules/dependencies.md`, add both new rules to the On-Demand Rules Index. Replace "conditional" with "mandatory" in the quality-gate heading in `CLAUDE.md` and `rules/workflow.md` with the "even when build passes" clarification. Update the Phase 3 handoff checklist tsconfig item to name the exact strict options and explain the app-vs-lib moduleResolution difference. Add a "checklist ≠ done" note closing Phase 3.
- **Status**: pending-port

---

## 2026-06-26 — Enhancement: bundler-contract prescription in nx-generators.md §2 + AGENTS.md .js-extension clarification

- **Component**: `rules/nx-generators.md` §2 / `AGENTS.md` Code Style Essentials
- **Type**: Enhancement
- **What happened**: The existing `rules/nx-generators.md` §2 prescribed the deprecated Nest-app tsconfig override (`module: commonjs` + `moduleResolution: node10` + `ignoreDeprecations: "5.0"`). This was the correct workaround at the time but was superseded once the decision to standardize on `moduleResolution: "bundler"` was locked. The rule was rewritten to state the bundler contract: base inherits `bundler`+`esnext`; Nest apps must **not** override module/moduleResolution; webpack emits CJS regardless of the TS resolver. The `AGENTS.md` line "`.js` extensions in imports (NodeNext)" was also clarified to "enforced backend-only via ESLint; resolver is `bundler`, not NodeNext" — the original wording implied the resolver itself was NodeNext, which was never true and confused the two concerns.
- **Why it matters upstream**: Any claude-ts consumer who generates a Nest app will follow §2 and introduce the deprecated override. The `AGENTS.md` wording also causes agents to conflate "we enforce `.js` extensions" (an ESLint gate) with "we use the NodeNext resolver" (a tsconfig setting) — a confusion that led to the node10 override being introduced in the first place.
- **Suggested upstream change**: In `rules/nx-generators.md` §2, replace the Nest-app `node10`/`commonjs`/`ignoreDeprecations` prescription with a bundler-contract block: (1) base sets `bundler`+`esnext`; (2) Nest apps inherit — no override; (3) webpack output is CJS regardless; (4) libs are ESM via `"type":"module"` + `index.ts` barrels; (5) `.js` relative-import extensions are enforced by ESLint, not by the resolver. In `AGENTS.md` Code Style Essentials, replace "`.js` extensions in imports (NodeNext)" with "`.js` extensions in relative imports — enforced backend-only via ESLint; resolver is `bundler`, not NodeNext".
- **Status**: pending-port

---

## 2026-06-26 — Enhancement: Stop hook + spec fixes for reliable knowledge capture

- **Component**: `rules/workflow.md` Phase 6 / `CLAUDE.md` Orchestrator Core / all `.claude/agents/*.md` Report Format sections / new `.claude/hooks/knowledge-capture-nudge.sh`
- **Type**: Enhancement
- **What happened**: Agents consistently wrote project-level learnings to private auto-memory instead of `docs/KNOWLEDGE_INBOX.md`. Three structural causes: (1) `rules/workflow.md:234-235` routed config gotchas to auto-memory and had an escape hatch ("Claude-session-specific gotchas still go to auto-memory") that let any learning be rationalized as private; (2) Phase 6 was framed as "after every pipeline" so direct edits never triggered capture; (3) none of the 16 agent definitions mentioned the inbox. Fix: created `.claude/hooks/knowledge-capture-nudge.sh` (Stop hook that blocks once per session per unmet obligation — inbox + CLAUDE_TS_CHANGELOG); rewrote Phase 6 spec to decouple from pipeline, remove the auto-memory escape hatch, and add a litmus test ("would another dev or AI benefit?" → inbox); amended `CLAUDE.md` Hard tool limits to carve out ledger docs as orchestrator-writable; added a `## Learnings` handoff bullet to the Report Format section of all 12 implementation agents.
- **Why it matters upstream**: This is a universal claude-ts problem. Private auto-memory is machine/user-local; any learning stored there is invisible to teammates and other AI tools. The spec's auto-memory routing and pipeline-only framing mean the knowledge gap is structural, not just a model failure. Other consumers will hit the same pattern: learnings evaporate after each session.
- **Suggested upstream change**: (a) Add Stop hook scaffolding (`knowledge-capture-nudge.sh`) to the template. (b) Rewrite Phase 6 heading to "after every session that touches files" (not "pipeline"). (c) Remove auto-memory as a first-class output of Phase 6; demote it to `feedback` type only. (d) Add the litmus test to the Decision rules section. (e) Add the `## Learnings` handoff bullet to every agent's Report Format section. (f) Add the ledger-doc write carve-out to `CLAUDE.md` Hard tool limits.
- **Status**: pending-port

---

## 2026-06-26 — Fix: "trivial" triage shortcut bypasses quality gate on executable config changes

- **Component**: `CLAUDE.md` Orchestrator Triage rule 1
- **Type**: Fix
- **What happened**: Triage rule 1 ("Trivial (typo, single config value, ≤2-file config) → handle directly") was applied to an ESLint rule addition (`eslint.config.mjs` + `CHANGELOG.md` — exactly 2 files). The "handle directly" path bypassed both agent delegation and the quality gate. A subsequent explicit reviewer run found 3 real defects: a violated comment-hygiene convention (`D26:` decision ID in source), a CHANGELOG format bug (duplicate `### Added` section), and a glob coverage gap (future domain-scoped leaf libs not covered). None were caught by manual lint verification. Fix: tightened the "trivial" definition to "typo, single scalar config value, doc-only edit" and explicitly called out what is NOT trivial: ESLint rules, CI scripts, tsconfig settings, build configs — even if ≤2 files, these route via the pipeline or require a reviewer pass.
- **Why it matters upstream**: The ≤2-file count is not a reliable proxy for risk. Executable config files (ESLint, CI, build tooling) are correctness-bearing regardless of how many files change — a one-line ESLint selector error silently misscopes a lint gate across the entire monorepo. Any claude-ts consumer will hit this: a human or agent classifies a config change as trivial, skips delegation, and the quality gate never runs.
- **Suggested upstream change**: In `CLAUDE.md` Triage rule 1, replace `"Trivial (typo, single config value, ≤2-file config) → handle directly."` with `"Trivial (typo, single scalar config value, doc-only edit ≤2 files) → handle directly, then run reviewer. **Not trivial:** adding/changing ESLint rules, CI scripts, tsconfig settings, build configs — route those via the pipeline even if ≤2 files, because they are executable and correctness-bearing."`
- **Status**: pending-port

---

## 2026-06-27 — Enhancement: nx command policy — always use nx targets, never direct tool invocations

- **Component**: `rules/workflow.md` / `rules/testing.md` / `rules/docker-commands.md`
- **Type**: Enhancement
- **What happened**: All three files contained direct tool invocations (`npx vitest run`, `npx eslint .`, `npx tsc --noEmit`, `npm run build`) that agents were expected to copy. This is unsafe in an Nx monorepo: agents must guess the correct config path, working directory, and flags. Wrong guesses frequently exit 0 silently (e.g., `vitest run` with no matched files returns success). Added a "Command Execution Policy (Nx Targets)" section to `rules/workflow.md` with a ✅/❌ table, the rationale, useful flags, and project name reference. Updated `rules/testing.md` "Running Tests" section to use `nx test <project>` with a note on single-file pass-through via `--`. Updated `rules/docker-commands.md` Code Quality, Testing, and Build sections to use nx targets; Stryker and Prettier remain as direct invocations (no nx plugin/target exists for them in this repo) with explanatory notes.
- **Why it matters upstream**: Any claude-ts consumer running an Nx monorepo will copy direct-invocation examples from the rules files and hit the same class of failure: tests pass with 0 files matched, type-check silently runs against the wrong tsconfig, lint scopes the wrong directory. The fix is universal: rules files in an Nx workspace should prescribe `nx <target> <project>` as the single canonical invocation form.
- **Suggested upstream change**: Add a "Command Execution Policy (Nx Targets)" section to `rules/workflow.md` (after Core Principles) with the ✅/❌ table. Replace all direct `npx vitest`/`npx eslint`/`npx tsc`/`npm run build` examples in `rules/testing.md` and `rules/docker-commands.md` with `nx test`/`nx lint`/`nx build` equivalents. Keep Stryker as a direct Docker invocation with a comment noting no nx plugin.
- **Status**: pending-port

---

## 2026-06-27 — Fix: task-authoring Dependencies row allowed unresolvable bare numbers

- **Component**: `rules/task-authoring.md` Dependencies section
- **Type**: Fix
- **What happened**: The `Depends on` row allowed "roadmap-index number if the task lives in a numbered roadmap" as an alternative to full task identifiers. This produced bare numbers (`12, 13`, `6, 8`) in real task files. Once the originating roadmap doc is archived, these numbers are unresolvable — no file search can find them. Fixed: removed the escape hatch; the rule now requires the full filename without extension including slug (e.g. `2026-06-14-13-approve-user-service`). Header example updated to show a slugged identifier. Existing task files with bare numbers should be updated opportunistically.
- **Why it matters upstream**: Any claude-ts consumer using the task-authoring convention will hit the same drift: agents copy the allowed alternative form, and dependency chains become opaque the moment source roadmap docs are cleaned up.
- **Suggested upstream change**: In `rules/task-authoring.md` Dependencies section, replace `"…or the roadmap-index number if the task lives in a numbered roadmap"` with `"Never use bare sequence numbers or date-only identifiers without a slug — these become unresolvable once the originating roadmap doc is archived."` Update header example to show a full slugged filename.
- **Status**: pending-port

---

## 2026-06-27 — Enhancement: quality gate reviewer/security-scanner two-section output + agent pre-flight reads

- **Component**: `rules/workflow.md` quality gate / all agent definitions (reviewer, security-scanner, technical agents)
- **Type**: Enhancement
- **What happened**: Review cycles compounded into "infinite loops" because (1) reviewer treated all findings as "fix now" regardless of origin, and (2) technical agents had no mandatory pre-flight reads of accumulated project conventions. Root cause confirmed via a grill session: the orchestrator was fixing pre-existing discoveries inline, each fix adding new review surface, creating a structurally guaranteed loop. Decisions: reviewer and security-scanner must output two explicit sections (`## Fix Now` / `## Emit as Task`); classification criterion is origin only (introduced by changeset vs pre-existing); 2-cycle limit applies to Fix Now items only; cheap-override for pre-existing fixes requires a 4-point mechanical check (≤1 file, no new tests, no new deps, purely mechanical); all agents read `docs/KNOWLEDGE_INBOX.md` before acting; technical agents also read `rules/architecture.md` + `rules/code-style.md`. Task files emitted: `2026-06-27-20-01-quality-gate-reviewer-classification.md` and `2026-06-27-20-02-agent-preflight-reads.md`.
- **Why it matters upstream**: Any claude-ts consumer will hit the same compounding-review-cycle problem. The flat finding list gives the orchestrator no signal about whether to fix inline or defer, so it defaults to fixing everything inline. The structural fix — two-section output + origin classification + mandatory pre-flight reads — is universally applicable.
- **Suggested upstream change**: (a) Add `## Fix Now` / `## Emit as Task` two-section output requirement to the reviewer and security-scanner agent definitions. (b) Add origin-classification criterion and cheap-override 4-point checklist to `rules/workflow.md` quality gate section. (c) Add mandatory `docs/KNOWLEDGE_INBOX.md` pre-flight read to all agent definitions. (d) Add mandatory `rules/architecture.md` + `rules/code-style.md` pre-flight reads to all technical agent definitions.
- **Status**: pending-port

---

## 2026-06-27 — task-authoring rule (Penny override)

- **Component**: `rules/task-authoring.md` (new file) + `AGENTS.md` on-demand index
- **Type**: Enhancement / new rule
- **What happened**: Added a rule codifying that every plan/grill/grooming session must emit backlog task files; defines naming (`YYYY-MM-DD-NN-slug`), routing (rebuild vs general todo), sub-index insertion ordering, header format, body sections, splitting criteria, and standing "suggest commit, don't commit" completion rule.
- **Why it matters upstream**: Template repos benefit from a standard task-authoring convention so AI-assisted planning sessions produce immediately executable, consistently formatted task files.
- **Suggested upstream change**: Add a `rules/task-authoring.md` template to the claude-ts template payload; the project overrides routing/branch details.
- **Status**: pending-port
