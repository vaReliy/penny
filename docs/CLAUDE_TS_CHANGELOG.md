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

## 2026-06-28 — Enhancement: object destructuring rule added to rules/code-style.md

- **Component**: `rules/code-style.md`
- **Type**: Enhancement
- **What happened**: Added an "Object Destructuring" section. Rule: when forwarding ≥2 fields from the same source object into a function call or object literal with no transformation, destructure first to eliminate repeated `source.fieldName` references. Exception for single-field access or renamed fields. Emerged from a review of `LoginWithTelegramService` where `{ firstName: params.firstName, ... }` x4 was replaced with a pre-destructure + shorthand properties.
- **Why it matters upstream**: The pattern (`source.field: source.field` repetition) appears in any service/use-case that maps request params to a repository call. Without the guideline, agents and reviewers produce inconsistent style and the fix-retry loop catches it late.
- **Suggested upstream change**: Add the "Object Destructuring" section to `rules/code-style.md` immediately after the "Import Ordering" section, with the prefer/avoid example and the single-field/rename exception.
- **Status**: pending-port

---

## 2026-06-28 — Fix: devops agent pre-flight read of rules/architecture.md removed

- **Component**: `.claude/agents/devops.md`
- **Type**: Fix
- **What happened**: The blanket pre-flight enhancement (all technical agents read `rules/architecture.md` + `rules/code-style.md`) was applied to `devops` without scoping check. `rules/architecture.md` covers Clean Architecture layers (UseCases, Services, DTOs, bounded contexts) — none of which applies to the devops agent's scope (Dockerfiles, CI YAML, shell scripts, env config). The read was inert but consumed tokens on every haiku invocation.
- **Why it matters upstream**: Any claude-ts consumer that adds `rules/architecture.md` to the blanket pre-flight list will hit the same waste for infra-only agents. The upstream enhancement entry should carve out devops (and similarly scoped agents) from the architecture.md read.
- **Suggested upstream change**: In the upstream pre-flight enhancement, split the "additionally read" list by agent type: application agents (`backend-developer`, `angular-developer`, `tester`, `refactoring-expert`, etc.) read `rules/architecture.md` + `rules/code-style.md`; infrastructure agents (`devops`, `dba`) read only `rules/code-style.md`.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: mandatory pre-flight reads for all agent definitions

- **Component**: all `.claude/agents/**` + `rules/workflow.md`
- **Type**: Enhancement
- **What happened**: Technical agents (backend-developer, angular-developer, qa, devops, tester, refactoring-expert, integration-architect, queue-specialist, dba, debugger) were writing code without reading accumulated project conventions first, causing avoidable reviewer findings that extended the fix-retry cycle. Added a `## Pre-flight` section to every agent definition. All agents now read `docs/KNOWLEDGE_INBOX.md` before acting; technical agents additionally read `rules/architecture.md` + `rules/code-style.md` before writing any code. Added a dispatch note to `rules/workflow.md` reminding the orchestrator that agents read these from disk (not inline context) to reflect the current repo state.
- **Why it matters upstream**: Any claude-ts consumer accumulates project-specific conventions in KNOWLEDGE_INBOX over time. Without this pre-flight, agents ignore that knowledge and reproduce the same violations — wasting review cycles on issues already documented.
- **Suggested upstream change**: Add `## Pre-flight` section to all agent definitions immediately after the opening description paragraph. Non-technical agents: KNOWLEDGE_INBOX read only. Technical agents: KNOWLEDGE_INBOX + `rules/architecture.md` + `rules/code-style.md`. Add dispatch note to `rules/workflow.md` `### Implementation Team (Phase 3)` section.
- **Status**: pending-port

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

## 2026-06-28 — Fix: CLAUDE.md quality gate omitted cheap-override reference

- **Component**: `CLAUDE.md` Orchestrator Core quality gate paragraph
- **Type**: Fix
- **What happened**: The `## Emit as Task` clause in `CLAUDE.md`'s quality gate one-liner had no mention of the cheap-override exception defined in `rules/workflow.md`. An orchestrator reading only `CLAUDE.md` (always-loaded context) would always emit a task file even for pre-existing findings that qualify for the 4-point mechanical override, missing the shortcut. Fixed by appending `(cheap-override exception: see rules/workflow.md)` to the Emit as Task clause.
- **Why it matters upstream**: `CLAUDE.md` is always-loaded; `rules/workflow.md` is on-demand. Any clause with an important exception defined only in the on-demand file is invisible to the orchestrator in sessions where that file isn't read. The pattern of adding a parenthetical pointer keeps `CLAUDE.md` concise while making the exception discoverable.
- **Suggested upstream change**: In `CLAUDE.md` quality gate paragraph, after `## Emit as Task` clause description, append `(cheap-override exception: see rules/workflow.md)` — or the equivalent for whatever cheap-override logic exists in the consumer's workflow rules.
- **Status**: pending-port

---

## 2026-06-27 — task-authoring rule (Penny override)

- **Component**: `rules/task-authoring.md` (new file) + `AGENTS.md` on-demand index
- **Type**: Enhancement / new rule
- **What happened**: Added a rule codifying that every plan/grill/grooming session must emit backlog task files; defines naming (`YYYY-MM-DD-NN-slug`), routing (rebuild vs general todo), sub-index insertion ordering, header format, body sections, splitting criteria, and standing "suggest commit, don't commit" completion rule.
- **Why it matters upstream**: Template repos benefit from a standard task-authoring convention so AI-assisted planning sessions produce immediately executable, consistently formatted task files.
- **Suggested upstream change**: Add a `rules/task-authoring.md` template to the claude-ts template payload; the project overrides routing/branch details.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: split monolithic code-style.md and architecture.md into platform-specific files

- **Component**: `rules/code-style.md`, `rules/code-style-angular.md` (new), `rules/code-style-backend.md` (new), `rules/architecture.md`, `rules/architecture-angular.md` (new), `rules/architecture-backend.md` (new)
- **Type**: Enhancement
- **What happened**: Split two large shared rules files into platform-specific variants to reduce token usage and prevent frontend agents from loading backend-specific patterns and vice versa.
  - `rules/code-style.md` → kept shared TypeScript conventions only (strict mode, naming, imports, comments); split out Angular and backend patterns
  - `rules/code-style-angular.md` (new) → Angular-specific: signals, `toSignal()`, `@let`, templates, SCSS, forms, accessibility
  - `rules/code-style-backend.md` (new) → backend-specific: config, validation, logging (pino DI), auth/cookies, error handling
  - `rules/architecture.md` → kept shared onion/DDD and NX boundaries; split out platform-specific patterns
  - `rules/architecture-angular.md` (new) → Angular injection tokens, lazy-load boundaries, dev-server proxy
  - `rules/architecture-backend.md` (new) → NestJS DI, MongoDB patterns, pipeline re-entry, Penny MongoDB overrides (mongosh, upsert race, unique indexes, $setOnInsert, repository pattern, error handling)
- **Agent pre-flight reads updated**: `angular-developer` reads `rules/architecture-angular.md` + `rules/code-style-angular.md`; `backend-developer` reads `rules/architecture-backend.md` + `rules/code-style-backend.md`; `tester` reads platform-specific rules per test type; `reviewer` reads all 6 rules files; `security-scanner` reads backend rules (auth/validation focus); `devops` unchanged (code-style only, no architecture)
- **AGENTS.md on-demand index updated**: added 4 new rules files with one-line descriptions
- **KNOWLEDGE_INBOX.md cleaned**: removed 17 entries distilled into the new rules files (Angular signals, templates, DI tokens, backend logging, validation, auth, MongoDB patterns, error handling)
- **Why it matters upstream**: Any claude-ts consumer with multiple platforms (backend + frontend, or multiple backend frameworks) will benefit from splitting large shared rules files. This pattern reduces token waste and keeps agent pre-flight reads targeted.
- **Suggested upstream change**: (a) Create `rules/code-style-{platform}.md` and `rules/architecture-{platform}.md` files for each framework/platform in the consumer's stack. (b) Slim base `rules/code-style.md` and `rules/architecture.md` to shared content only (TypeScript conventions, onion/DDD principles, NX tag dimensions). (c) Update agent pre-flight reads to load platform-specific rules. (d) Update AGENTS.md on-demand index to list new files. (e) Port distilled entries from KNOWLEDGE_INBOX into the new rules, then delete from inbox.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: rules-auditor skill (new generic claude-ts skill)

- **Component**: `.claude/skills/rules-auditor/SKILL.md` (new)
- **Type**: Enhancement
- **What happened**: Added a new `rules-auditor` skill that runs 5 structural consistency checks across `.claude/agents/`, `rules/`, `AGENTS.md`, `docs/KNOWLEDGE_INBOX.md`, and `.ctsignore`. Checks: (1) broken `rules/X.md` references in agent pre-flight sections; (2) wrong-platform keyword leaks (Angular terms in backend rules files, backend terms in Angular rules files); (3) stale `Belongs in: rules/X.md` labels in KNOWLEDGE_INBOX that reference non-existent files; (4) rules files present in `rules/` but absent from the AGENTS.md on-demand index; (5) `.ctsignore` entries referencing `rules/` paths without a leading `/` anchor. Mode auto-detects: if `.claude/**` or `rules/**` files changed this session, audit those files immediately; otherwise prompt for a time window (default: last 7 days of git history). Report is ranked HIGH → MED → LOW. Invokes `/to-issues` only after human confirmation. Trigger: run after any change to `.claude/**` or `rules/**`, or periodically to catch silent drift.
- **Why it matters upstream**: Rules files and agent definitions drift silently: pre-flight paths break when files are renamed, platform-specific content leaks across rule boundaries, KNOWLEDGE_INBOX labels go stale, new rules files are added without updating the AGENTS.md index. Any claude-ts consumer accumulates this drift over time with no tooling to catch it. This skill closes the gap for any project using the claude-ts conventions.
- **Suggested upstream change**: Add `.claude/skills/rules-auditor/SKILL.md` to the claude-ts template payload. Check 2 keyword lists and routing-table file names are project-agnostic; projects with additional platforms extend both lists. Register in `AGENTS.md` skills section under a "Maintenance" heading.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: sequential quality gate (tester → reviewer → [security-scanner ∥ qa])

- **Component**: `rules/workflow.md` / `CLAUDE.md` Orchestrator Core quality gate paragraph
- **Type**: Enhancement
- **What happened**: The quality gate previously dispatched `tester`, `reviewer`, `security-scanner`, and `qa` in parallel via a `qg-{slug}` team. This was wasteful: if tests fail, reviewer and security-scanner run on code that will change anyway. Redesigned in a grill-me session on 2026-06-28 to a sequential pipeline: (1) `tester` runs alone first; (2) `reviewer` runs only after tester passes; (3) `security-scanner` and `qa` run in parallel as the final stage, each only when their original trigger condition is met. Any failure at any stage → fix → restart from `tester` (not from the failed stage). Max 2 full restart cycles total. The pipeline ASCII diagram in `rules/workflow.md` was updated to show sequential stages. `CLAUDE.md` quality gate summary was updated to be consistent. A closing-checklist condition was added: if `.claude/**` or `rules/**` changed this session, suggest running `/rules-audit` before closing.
- **Why it matters upstream**: The parallel gate is universally wasteful when tests fail. Running reviewer on code that's about to change produces stale findings. The sequential design reduces token cost without compromising correctness — accepted tradeoff is slightly longer wall-clock time per gate cycle.
- **Suggested upstream change**: (a) Replace the parallel `qg-{slug}` team dispatch in `rules/workflow.md` with the `tester → reviewer → [security-scanner ∥ qa]` sequential pipeline. (b) Update the pipeline ASCII diagram. (c) Update `CLAUDE.md` quality gate summary to name the execution order and the restart-from-tester rule. (d) Add the `/rules-audit` suggestion to the closing checklist condition for `.claude/**` / `rules/**` changes.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: Update agent pre-flight reads for platform-specific rules split

- **Component**: `.claude/agents/angular-developer.md`, `.claude/agents/backend-developer.md`, `.claude/agents/tester.md`, `.claude/agents/reviewer.md`, `.claude/agents/security-scanner.md`
- **Type**: Enhancement
- **What happened**: Each technical agent's pre-flight section now reads platform-specific rules files in addition to shared ones.
  - `angular-developer`: + `rules/architecture-angular.md`, `rules/code-style-angular.md`
  - `backend-developer`: + `rules/architecture-backend.md`, `rules/code-style-backend.md`
  - `tester`: + platform-specific rules based on test type (backend tests read backend rules, frontend tests read Angular rules)
  - `reviewer`: reads all 6 rules files (shared + platform-specific for both)
  - `security-scanner`: reads backend-focused rules (`architecture-backend.md`, `code-style-backend.md`) + shared
  - `devops`: unchanged (code-style only, not architecture)
- **Why it matters upstream**: The split allows agents to pre-flight only the rules relevant to their platform, improving token efficiency and keeping context focused. Reviewer reads all to evaluate both platforms; backend-focused security scanner reads backend rules since most app security touches backend (auth, validation, error handling).
- **Suggested upstream change**: For each agent, update the Pre-flight section to list all applicable rules files per the pattern established above.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: nx-generators.md — Vitest target name, SCSS enforcement, generator flag fixes, deprecated @nx/vite plugin removal

- **Component**: `rules/nx-generators.md`
- **Type**: Enhancement
- **What happened**: Four post-generator correction rules distilled from KNOWLEDGE_INBOX into `rules/nx-generators.md`:
  1. **Vitest target name**: The Nx plugin registers as `vite:test` (via `testTargetName` in `nx.json`), not `test`. `pnpm nx test <project>` silently resolves to nothing; always use `pnpm nx vite:test <project> --skip-nx-cache`. Supersedes any earlier `@nx/vitest:vitest` executor references (that executor name does not exist in `@nx/vitest@23`).
  2. **SCSS enforcement**: `@nx/angular:app` and `@nx/angular:lib` default to CSS. Generated `.css` files must be renamed `.scss`; `styleUrl`/`styles` references and `project.json` `"styles"` array updated. Pass `--style=scss` to generators.
  3. **`--name` flag required**: `nx g @nx/angular:app <positional>` fails with "Schema does not support positional arguments". Correct form: `--name=<name> --directory=<path>`. Same for `@nx/angular:lib`.
  4. **Deprecated `@nx/vite` plugins**: Generators inject `nxViteTsPaths()` and `nxCopyAssetsPlugin()` (removed in Nx v24, banned by repo ESLint). Replace with `resolve: { tsconfigPaths: true }` and drop the copy-assets call.
- **Why it matters upstream**: All four are universal Nx post-generator footguns: wrong test target name, CSS default, positional-arg schema breakage, and deprecated plugin injection affect any claude-ts consumer using `@nx/angular` on Nx v23+.
- **Suggested upstream change**: Add a "Post-generator corrections (Angular)" subsection to `rules/nx-generators.md` covering all four items with before/after examples.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: testing.md — vi.stubEnv vs delete process.env anti-pattern

- **Component**: `rules/testing.md`
- **Type**: Enhancement
- **What happened**: `vi.stubEnv` tracks env var saves/restores for `vi.unstubAllEnvs()`; `delete process.env[KEY]` operates outside that tracking and leaves state leaked across tests. Found in `apps/api/src/config/api-config.spec.ts`. Correct pattern: treat empty string as absent in production readers (`portRaw ? … : default`), then use `vi.stubEnv(KEY, '')` to simulate absence without deletion.
- **Why it matters upstream**: This is a Vitest-specific footgun that affects any test file simulating missing env vars. Without the rule, agents write `delete process.env[KEY]` as the intuitive workaround and introduce cross-test state pollution.
- **Suggested upstream change**: Add an "Environment Variable Stubbing" section to `rules/testing.md` documenting the anti-pattern and the `vi.stubEnv(KEY, '')` + empty-string-as-absent fix.
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: AGENTS.md — Verification Commands section (nx targets, always-loaded)

- **Component**: `AGENTS.md`
- **Type**: Enhancement
- **What happened**: Sub-agents were falling back to raw `npx tsc …` / `npx eslint …` / `npx vitest run …` invocations despite `rules/workflow.md` containing an explicit ✅/❌ command policy table. Root cause: `rules/workflow.md` is on-demand (only read "before creating teams/running pipelines"); agents dispatched for implementation or testing never loaded it and had no other source for the canonical commands. Fix: added a "Verification Commands" section to `AGENTS.md` (always-loaded) with a **mandatory directive** to read `rules/workflow.md` § "Command Execution Policy (Nx Targets)" before running any verification command. The table itself stays exclusively in `rules/workflow.md` — no duplication. This also corrects a discrepancy: `rules/workflow.md`'s table listed `nx test <project>` as the test command, but the `api` project registers its test target as `vite:test` (confirmed via `pnpm nx show project api`); `pnpm nx test api` silently resolves to nothing.
- **Why it matters upstream**: Any always-loaded file (AGENTS.md, CLAUDE.md) is the only reliable delivery mechanism for rules that must apply in every agent invocation, including cold-start agents with no pipeline context. Rules in on-demand files only work when the orchestrator briefs agents explicitly — which is fragile. The `vite:test` vs `test` target-name issue is universal: Nx registers the vitest target name via `testTargetName` in `nx.json`; if a project sets a non-default name, `nx test` silently succeeds with 0 tests run.
- **Suggested upstream change**: (a) Add a "Verification Commands" section to `AGENTS.md` immediately before "Model Tiers" with a mandatory read directive pointing to `rules/workflow.md` § "Command Execution Policy (Nx Targets)" — no table duplication. (b) In `rules/workflow.md` Command Execution Policy, add a caveat to the Test row: "confirm target name via `pnpm nx show project <name>` — custom `testTargetName` in `nx.json` changes the default."
- **Status**: pending-port

---

## 2026-06-28 — Enhancement: workflow.md — explicit split-dispatch guidance for mixed infra+code tasks (reinforcement)

- **Component**: `rules/workflow.md` routing guidance
- **Type**: Enhancement
- **What happened**: The existing "Conflict: devops overrouting" entry (2026-06-25) documented the root cause; this session adds the concrete prescriptive rule to `rules/workflow.md`: when a task mixes docker-compose/CI with an application-level DB connection factory (Mongoose/Typegoose in `libs/*/infrastructure`), the orchestrator must split dispatch — compose/CI files → `devops`; TypeScript library modules → `backend-developer`. The `devops` agent writes global mongoose singletons and unpinned dep versions; `backend-developer` applies DI boundaries, strict TS, and Nx tag compliance.
- **Why it matters upstream**: Reinforces and concretizes the earlier 2026-06-25 routing-conflict entry. The prescriptive language ("split the dispatch", named agent targets) makes the rule actionable in sessions where only `rules/workflow.md` is loaded.
- **Suggested upstream change**: Merge with the 2026-06-25 Conflict entry's suggested upstream change: add the split-dispatch note to the routing table in `rules/workflow.md` immediately after the DevOps row.
- **Status**: pending-port
