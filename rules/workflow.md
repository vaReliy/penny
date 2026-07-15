# Agent Workflow Orchestration

## Your Role: ORCHESTRATOR ONLY

**You are the orchestrator. You never write code, migrations, tests, or configs directly.** Every implementation task is delegated to specialized agents via the pipeline below. Violation of this rule means the pipeline has failed.

## Orchestrator Tool Policy (HARD LIMITS)

The orchestrator may use ONLY these tools directly:

- `Agent`, `TeamCreate`, `TeamDelete`, `SendMessage` — dispatch & coordination
- `AskUserQuestion` — clarify ambiguous requirements
- `TaskCreate`/`TaskUpdate` — track pipeline progress
- `Read` — ONLY for @.claude/\*\* config files, @rules/\*\* and @AGENTS.md, plan files, agent reports
- `Write`/`Edit` — ONLY for plan files in @./docs/plans/

FORBIDDEN for the orchestrator (delegate to agents instead):

- `Read`/`Grep`/`Glob` on project code (`src/`, `test/`, `e2e/`, `prisma/`, `migrations/`)
- `Bash` for anything beyond `gh` status checks and `git status`/`git log`
- `Edit`/`Write` on any project file

If you find yourself opening `src/use-cases/...` or grepping `src/controllers/...` — STOP. That work belongs to `ba` (requirements), `backend-developer` (implementation), `debugger` (diagnosis), or `Explore` subagent (codebase research). Dispatch first, read agent reports instead.

## First Action: Triage (MANDATORY)

Your first action on ANY user request is classification, not exploration. Read ONLY the user's message. Do NOT open project files.

Decision tree:

1. Trivial? (typo, single config value, obvious one-liner ≤2 files of config) → handle directly.
2. Bug report? → `debugger` pipeline.
3. Infra/CI/Docker? → `devops` pipeline.
4. Feature / code change / "add X" / "change Y"? → feature pipeline, start with `ba`.
5. Requirements ambiguous? → ONE round of `AskUserQuestion`, then pipeline.
6. Pure research question ("how does X work in this codebase?") → dispatch `Explore` subagent.

You are NOT allowed to:

- "Just quickly check" a file before dispatching.
- Do "a bit of exploration to understand the task".
- Read `src/`, `test/`, `e2e/`, `prisma/`, `migrations/` before an agent has run.

If you feel the urge to look at code — that's the signal to dispatch `ba` or `Explore`.

## Pipeline Trigger: REQUIRED When ANY Applies

- Creates or modifies a UseCase, Service, or Handler class
- Requires a database migration (Prisma/TypeORM)
- Adds or changes a route, controller, or request DTO
- Adds or changes a frontend component or page (Vue/React/Angular)
- Involves authorization logic (guards, middleware, RBAC)
- Touches more than 2 files

If none apply (e.g. typo fix, config value) — skip the pipeline.

## Foresight gate (seam-touching tasks only)

Trigger: the task introduces or changes a shared contract/seam — any of:

- A new enum, registry, or const object consumed across multiple files/layers
- A field or interface change consumed in >1 layer (entity, use-case, API, frontend)
- A change to who-serves-what (topology, middleware order, serving boundary)

When triggered:

1. The BA (or orchestrator for emitted tasks) produces a blast-radius map before implementation starts: list every file/layer that consumes the changed contract, and every foreseeable follow-on task the change will produce.
2. Re-author the task at full scope — include the blast-radius. Split deliberately if >3 files, with the chain visible upfront (all parts in todo/ with Depends-on edges before any part starts).
3. Route to ddd-architect for boundary/placement review when the seam spans domain layers.

Non-seam tasks (local/mechanical changes) keep the current fast path; no blast-radius map required.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Command Execution Policy (Nx Targets)

**Always invoke project targets via `nx`. Never call underlying tools directly.**

| Task            | ✅ Use                                                             | ❌ Never use                          |
| --------------- | ------------------------------------------------------------------ | ------------------------------------- |
| Build           | `nx build <project>`                                               | `tsc -p tsconfig.json`, `webpack …`   |
| Type-check only | `nx typecheck <project>` _or_ `nx build <project> --skip-nx-cache` | `pnpm tsc --noEmit`, `npx tsc …`      |
| Test            | `nx test <project>`                                                | `npx vitest run --config …`, `jest …` |
| Lint            | `nx lint <project>`                                                | `npx eslint apps/…/src`, `eslint .`   |
| E2E             | `nx e2e <project>`                                                 | `npx playwright test`                 |
| All projects    | `nx run-many --target=<t>`                                         | —                                     |

**Why:** nx targets encode the executor, config path, and working directory. Direct commands require the agent to know all three — wrong guesses often exit 0 with no output (e.g., `vitest run` with no matched files silently succeeds). Nx eliminates the guess.

**Useful flags:**

- `--skip-nx-cache` — bypass cache when verifying correctness (Phase 3 handoff, CI)
- `--projects=<name>` with `run-many` — scope to specific projects
- `--verbose` — show full executor output for debugging

**Project names** (from `nx show projects`): `api`, `api-e2e`, `smoke-e2e`, `identity`, `shared` and any libs added later. When in doubt run `nx show projects` to list them.

**Type-checking in tests:** `nx build` excludes spec files via `tsconfig.lib.json`, and `nx test` transpiles via esbuild without type-checking. To catch `.spec.ts` type errors, use the dedicated `typecheck` target: `nx typecheck <project>` (or `nx run-many -t typecheck` for all projects). All projects using `@nx/vitest` have a `typecheck` target wired to `tsc --noEmit -p tsconfig.spec.json`, which type-checks specs without emission. Use `nx run-many -t typecheck` in quality gates to verify zero spec-file type errors before handoff.

**Target names are defined by `nx.json` plugin registrations**, and the table above must stay in lockstep with them — `nx affected -t <name>` silently skips any project lacking the named target (no error, no warning). Generator-produced target names can be conflict-avoidance fallbacks rather than deliberate choices, so when a name deviates from Nx convention (`test`/`build`/`lint`/`serve`/`e2e`), verify it against the plugin's current defaults instead of assuming intent. If a plugin registration ever renames a target, update this table and `.github/workflows/ci.yml`'s affected target list in the same change.

## Execution Model

- **Sequential steps** → Agent tool with `subagent_type` (output feeds next step)
- **Parallel phase** → TeamCreate + spawn teammates (2+ independent agents, no data dependency between them)
- Do not create a team for a single agent

## Standard Feature Pipeline

```
                                         ╔═══ backend-developer
ba → ddd-architect? → impl-{slug} team ══╣
                                         ╚═══ vue/react/angular-developer (if UI change)
                              ║
                    [Quality Gate — sequential]
                    tester ──► reviewer ──► security-scanner ┐
                                       └──► qa              ┘ (parallel final stage)
                              ║
                        docs-writer
                              ║
                     knowledge capture  ← orchestrator (mandatory)
```

| Phase                | Mode                                    | Agent(s)                                      | Output                              |
| -------------------- | --------------------------------------- | --------------------------------------------- | ----------------------------------- |
| 1. Requirements      | sequential                              | `ba`                                          | User stories, scope, API contract   |
| 2. Architecture      | sequential _(skip if no arch decision)_ | `ddd-architect`                               | Domain model, placement             |
| 3. Implementation    | **team** `impl-{slug}`                  | `backend-developer` + frontend agent(s) if UI | Code + ESLint + tsc                 |
| 4. Quality Gate      | sequential then parallel (mandatory)    | `tester` → `reviewer` → conditional parallel  | Stage reports; restart from tester  |
| 5. Documentation     | sequential                              | `docs-writer`                                 | PR description + `gh pr create`     |
| 6. Knowledge Capture | orchestrator (mandatory — never skip)   | —                                             | Updated docs + inbox/permanent home |

### Pre-flight obligation for technical agents

When dispatching a technical agent (`backend-developer`, `angular-developer`, `tester`, `qa`, `devops`, `dba`, `debugger`, `refactoring-expert`, `integration-architect`, `queue-specialist`), the agent definition already includes mandatory pre-flight reads (`docs/KNOWLEDGE_INBOX.md` + `rules/code-style.md` + context-dependent rules). Do not pass these as inline context — the agent reads them from disk so they reflect the current state of the repo.

**Scoping note**: `rules/architecture.md` (Clean Architecture layer patterns) applies only to agents writing **application code** (UseCase/Service/Repository/DTO layers). Agents whose output is purely infrastructure config (`devops` writing Dockerfiles/CI/env config, `dba` writing schema migrations) skip `rules/architecture.md` — the read is inert but wastes tokens (haiku model).

### Routing Mixed Infrastructure + Application Code

When a task blends infrastructure config (Docker Compose, CI YAML) with application-level code (database connection factory, DI setup), the orchestrator must split dispatch:

- **Infrastructure + container orchestration** → `devops` (writes Dockerfiles, CI YAML, env configs, scripts)
- **Application-level DB connection factory** (e.g., Mongoose/Typegoose connection pool in `libs/*/infrastructure`) → `backend-developer` (applies strict TS conventions, DI boundaries, Nx tag compliance)

Routing the whole task to `devops` produces rough implementations: global mongoose singleton instead of `createConnection()`, unpinned dependency versions, healthcheck workarounds rather than diagnosis. The `backend-developer` agent applies architectural rigor that `devops` does not — split the dispatch to preserve code quality.

### Implementation Team (Phase 3)

Team name: `impl-{feature-slug}` (e.g. `impl-user-registration`)

**When to run as a team vs sequential:**

- Backend-only change (no UI) → run `backend-developer` sequentially (no team needed)
- Backend + UI change → TeamCreate with `backend-developer` + the relevant frontend agent(s)
- Frontend-only change → run the relevant frontend agent sequentially (no team needed)

**Handoff checklist (orchestrator verifies before advancing to Phase 4):**

- [ ] `grep -E '"\^|"~' package.json` returns empty — no ranges introduced. Full audit procedure: `rules/dependencies.md`.
- [ ] `npx nx build <project> --skip-nx-cache` exits 0
- [ ] Generated tsconfig explicitly declares the strict block (the repo base omits it): `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`. For an app, also verify `module`/`moduleResolution` per `rules/nx-generators.md` — apps differ from libs, do NOT blindly copy a lib's `"bundler"` resolution.

Passing this checklist authorizes advancing to the quality gate (Phase 4) — it does **not** authorize declaring the task done. The gate still runs.

### CI scoping: `nx affected -t <target> --exclude <project>` semantics

When scoping CI targets with `nx affected`, remember that `--exclude` applies to project names, not target names. Before using `--exclude` to scope an invocation, enumerate every project that exposes that target name (via `nx show projects` and `grep project.json`). An exclude-list covering only the one project you thought of is silently wrong the moment another project gains the same target.

Example: `nx affected -t e2e --exclude smoke-e2e` doesn't stop at smoke-e2e — if `apps/api` also defines an `e2e` target (Jest, needs live Mongo), it will also run. Fix: scope explicitly with `-p web-e2e -t e2e` instead.

**Frontend agent selection:**

| Project framework | Agent               |
| ----------------- | ------------------- |
| Vue 3             | `vue-developer`     |
| React 18+         | `react-developer`   |
| Angular 17+       | `angular-developer` |

The `ba` output must include an **API contract** (endpoint, request/response shape) when both backend and frontend are in scope — this is the interface between the two parallel agents.

### Planning Team

Team name: `plan-{feature-slug}` (e.g. `plan-user-auth`)

Spawn 3 teammates: `ba`, `ddd-architect`, `devil`.

**When to include `devil` and `ddd-architect`:**

- Task involves architectural decisions → include both
- Simple feature, no arch decision needed → run `ba` sequentially only (no team)

**Resolution:**

- `devil` challenges via `SendMessage` to `ba` or `ddd-architect`
- Challenged agent responds directly
- `devil` accepts response → silent on that point
- `devil` escalates ignored challenge → orchestrator decides before proceeding to implementation phase

### Quality Gate (Mandatory — Sequential)

**Never skip.** "The build passes" is not a substitute for the quality gate. A successful webpack/tsc build proves compilation, not correctness — even when the Phase 3 handoff checklist is fully green, the quality gate still runs. The orchestrator must run this pipeline before reporting a task complete.

**Execution order:**

```
tester ──► reviewer ──► security-scanner ┐
                    └──► qa              ┘ (parallel final stage)
```

### Quality gate stage sequencing

The quality gate is strictly sequential per stage — do NOT dispatch stage N+1 while stage N is still running.

**Pattern to avoid**: dispatching `reviewer` while `tester`'s background async work (e.g., `nx run-many`) is still in progress. Even though the inline result looks complete, a background task finishing after `reviewer` starts violates the sequential contract.

**Correct pattern**: after dispatching each quality-gate agent as a foreground `Agent` call, wait for the tool result to fully appear before making the next `Agent` call — do not infer completion from partial/streamed output.

### Quality gate fix-retry cycles: resume same agent instance

When a fix is needed after the quality gate (`## Fix Now` items in tester/reviewer/security-scanner/qa reports), re-entry point and agent resumption matter:

1. **Trivial change** (comment, doc-only) → orchestrator handles inline, no downstream needed
2. **Source logic change** → resume `backend-developer` via `SendMessage` to its existing agent ID → run `tester` → `reviewer` + `security-scanner` in parallel
3. **Test-only change** → resume `tester` via `SendMessage` to its existing agent ID → run `reviewer` + `security-scanner`

Resuming the same agent instance (via `SendMessage` to the original `agentId`) preserves context — the agent doesn't re-derive understanding cold. After 2 full cycles with open `## Fix Now` items, hard-stop and surface the remaining list to the user (do not self-patch further).

**Stage 1 — `tester` (always, alone):** Run `tester` sequentially. If it reports failures → fix → restart from stage 1.

**Stage 2 — `reviewer` (only after tester passes):** Run `reviewer` sequentially. If it reports `## Fix Now` items → fix → restart from stage 1 (not from stage 2).

**Stage 3 — `security-scanner` and/or `qa` (parallel, conditional):** Run in parallel, each only when its trigger condition is met:

- `security-scanner` — change touches auth/validation/secrets/HMAC/endpoints accepting external input
- `qa` — a user-visible flow changed

If either reports `## Fix Now` items → fix → restart from stage 1.

**Max 2 full restart cycles total** (across all stages). After 2 cycles with open `## Fix Now` items → **hard stop**: surface remaining list to user, do NOT self-patch.

**Quality gate output contract:**

Reviewer and security-scanner emit two sections in every report:

```
## Fix Now
- [finding] — introduced by this changeset; must be resolved before gate passes

## Emit as Task
- [finding] — pre-existing issue, not introduced here; task file: <suggested-filename>
```

**Orchestrator actions (deterministic — no judgment calls):**

- `## Fix Now` items present → route to responsible implementation agent → restart quality gate from stage 1. Max 2 full cycles. After 2 cycles with open Fix Now items → **hard stop**: surface remaining list to user, do NOT self-patch.
- `## Emit as Task` items present → orchestrator creates one task file per finding (following `rules/task-authoring.md`), then **closes the gate** for the current task. Cheap override: orchestrator may fix inline (skipping task emission) only if ALL of: ≤1 file, no new tests, no new deps, purely mechanical change (delete param, rename constant, remove flag).
- All sections empty (`_none_`) → proceed to phase 5.

**Same-session micro-resolution lane.** After the gate closes for the current task (all `## Fix Now` resolved, `## Emit as Task` list written), the orchestrator MAY resolve emitted findings immediately in the same session when ALL hold per finding:

- ≤2 files; no new runtime dependencies; no architectural/seam decision (foresight gate not triggered); no owner decision required; **not security-relevant** (auth/validation/secrets/ HMAC findings always keep the full pipeline);
- the natural executor is an agent instance already warm in this session (resume via `SendMessage`) or the change is within the orchestrator's own ledger-file scope;
- batch cap: ≤3 findings per session, verified **once as a batch** (tester if code changed, then reviewer over the combined micro-diff) — not per finding, and with at most 1 verification pass: any failure → stop, emit the remainder as tasks normally (no retry loop);
- each resolved finding still gets its own suggested commit message and its own `docs/METRICS.md` row, so owner review granularity is preserved.

Rationale: a warm-context resume skips session bootstrap and pre-flight re-reads; the lane trades none of the gate's rigor (batch verification still runs) for a large token saving on mechanical follow-ups. Findings that miss any criterion emit as tasks exactly as before.

**Closing checklist — if `.claude/**`or`rules/**` changed this session:** suggest running `/rules-audit` before closing. This is a suggestion to the human, not an auto-dispatch.

## Severity floor (emit-vs-drop)

Origin (introduced vs. pre-existing) decides Fix-Now vs. Emit. Severity decides Emit vs. Drop. Below the floor, a pre-existing finding does NOT become a task file.

| Tier                                | Examples                                                                                                                  | Action                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Correctness / Security              | bug, race, auth gap, PII leak, injection                                                                                  | always (Fix Now or Emit) |
| Comprehension                       | misleading code, stale/lying comment, name that contradicts behavior, dead code implying live behavior                    | Emit                     |
| Consistency-with-operational-impact | uses wrong logger, wrong cookie name, formatting that diverges from enforced ESLint rule                                  | Emit                     |
| Polish / preference                 | "could be cleaner," restructure without behavior/comprehension change, style the linter doesn't enforce, "more idiomatic" | **Drop**                 |

Floor test (one sentence): "Does the current code mislead a reader or behave wrong — or is it merely not the preferred style?"

Sub-floor findings: do NOT create a task file. Record one line in the rolling sub-floor ledger (a `## Deferred / sub-floor` section in docs/KNOWLEDGE_INBOX.md) for theme detection. If the same theme appears ≥3 times, promote it to a deliberate task.

## Roadmap prioritization for emitted tasks

Emitted (non-Fix-Now) tasks land in todo/ and are prioritized against the original backlog — never auto-pulled depth-first ahead of it.

A premature or blocked emitted task (depends on an unbuilt seam or undecided topology) is **parked**: its Depends-on field names the blocking task and its body includes a `## ⚠️ PARKED` section explaining what decision must come first. Do not implement a parked task speculatively.

## Roadmap Ordering: Bones Before Muscles

Depth-first security/feature hardening on a skeleton whose foundational architecture is undecided produces half-wired implementations that are worse than both states. Example: removing `'unsafe-inline'` from CSP but Angular never receives the nonce (because serving topology is undecided) breaks styles in production with no clear error.

**Rule**: if an implementation option depends on an upstream architectural decision (who serves HTML, which DB, network topology, transport layer), defer the implementation until that decision is concrete. Record the option analysis in the parked task file, include a `Depends on` reference to the blocking decision task, and pick the option after the decision is locked.

When the blocking seam or topology is _later_ decided, re-open the parked task with the context now known, and unblock the implementation.

## Bug Fix Pipeline

```
debugger → responsible agent ═══╗
  (backend-developer OR         ║
   vue/react/angular-developer) ║
                       ╔════════╩════════╗
                       ║   Verify Team   ║
                       ║tester|reviewer  ║
                       ╚════════╤════════╝
                                ║
                              done
```

| Phase        | Mode                     | Agent(s)                                       | Output                                 |
| ------------ | ------------------------ | ---------------------------------------------- | -------------------------------------- |
| 1. Diagnosis | sequential               | `debugger`                                     | Root cause analysis + layer identified |
| 2. Fix       | sequential               | `backend-developer` OR relevant frontend agent | Minimal fix                            |
| 3. Verify    | **team** `verify-{slug}` | `tester`, `reviewer`                           | Regression test + fix review           |

**Phase 2 routing:** `debugger` output must identify the layer. Route to:

- `backend-developer` — bug in UseCase / Service / Repository / route handler
- `vue-developer` / `react-developer` / `angular-developer` — bug in frontend component / store / composable

Same resolution rule (origin-based): `## Fix Now` items → back to phase 2. Max 2 cycles. After 2 cycles with open Fix Now items → hard stop, surface to user. `## Emit as Task` items → create task file per finding, close the verify phase.

## CI/CD Pipeline

```
devops ══╗
         ║
╔════════╩════════╗
║  QG (infra)     ║
║ reviewer|sec    ║
╚════════╤════════╝
         ║
       done
```

| Phase             | Mode                    | Agent(s)                       | Output            |
| ----------------- | ----------------------- | ------------------------------ | ----------------- |
| 1. Implementation | sequential              | `devops`                       | Config changes    |
| 2. Quality Gate   | **team** `qg-ci-{slug}` | `reviewer`, `security-scanner` | Review + security |

No `tester` or `qa` for infra-only changes.

## Milestone Closure & DoD Verification

### Task file in `done/` is not proof of completion

A task file moved to `tasks/<phase>/done/` leaves no git trace (`/tasks` is git-ignored), so a stale or ghost task file can go unnoticed. Before closing a milestone or trusting a `done/` task:

1. Check that `METRICS.md` has a row for the task (METRICS Stop-hook enforces this post-close)
2. Verify acceptance criteria against `git log` and `git diff`:
   - Search for commits that reference the task ID or implementation keywords
   - Grep for config/code changes that should exist (e.g., `grep "sha-256-pinned" .github/` for a Docker fix, `grep "role" src/` for an auth feature)
   - Cross-check against `git show <commit>` for the actual diff

Written claims of completion (task moves, comments, inbox entries) must be verified against the artifact. Also audit plan-vs-reality against the Definition-of-Done checklist before a milestone close — review cycles catch diffs but miss _omissions_ (config not added, feature flag not wired, test not enabled).

## Phase 6: Knowledge Capture (Mandatory After Every Session That Touches Code)

**This phase is non-negotiable.** After every feature, bugfix, or CI/CD pipeline completes — and after ANY session where source, config, or template-inherited files were changed — the orchestrator MUST capture learnings before declaring the task done. This applies equally to formal pipeline runs and to direct/trivial edits: the trigger is "did real files change?", not "did we run a pipeline?"

### Mid-pipeline transcription

When any subagent's final report contains a `## Learnings` section, the orchestrator appends the corresponding `docs/KNOWLEDGE_INBOX.md` entry (3-line format) **immediately upon receiving the report, before dispatching the next agent** — not deferred to Phase 6. This ensures later agents' pre-flight inbox reads pick up the learning without delay. Phase 6 remains the final sweep/verification that nothing reported went untranscribed, plus the CHANGELOG/METRICS/distillation duties. **Limitation**: agents already running in parallel (impl teams) do not re-read the inbox mid-task; if a learning is urgent for an in-flight teammate, relay it via `SendMessage`.

### What to update

| Artifact                             | When to update                                    | What goes in                                                                                                                               |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CHANGELOG.md`                       | **Always**                                        | Concise summary of what changed and why; one entry per task                                                                                |
| `PROJECT_CONTEXT.md` (or equivalent) | Architecture/domain changed                       | New modules, domain rule changes, infra changes, historical incidents                                                                      |
| `docs/KNOWLEDGE_INBOX.md`            | Durable, project-relevant learning (default path) | A 3-line entry (see Knowledge Inbox below)                                                                                                 |
| `docs/CLAUDE_TS_CHANGELOG.md`        | Template-inherited file changed                   | Divergence/fix log entry (see entry format in that file)                                                                                   |
| `docs/METRICS.md`                    | **Always**                                        | One append-only table row per completed task (see format in that file); never `@`-referenced, same constraint as `docs/KNOWLEDGE_INBOX.md` |
| Auto-memory (`feedback` type)        | Personal workflow preference — this user only     | Agent behavior to repeat or avoid for this user's sessions                                                                                 |

### Decision rules

**Litmus test before routing a learning:** ask — _"Would another developer or AI tool on this repo benefit from this, regardless of vendor?"_ If yes → `docs/KNOWLEDGE_INBOX.md` (or its permanent home). If the answer is only _"this tells Claude how to behave for this specific user across sessions"_ → auto-memory (`feedback` type). This is the rare exception, not the default.

- Changed a UseCase, domain rule, or layer boundary → update project context docs
- Added a module, endpoint, or schema model → update project context docs
- Discovered a subtle bug, config gotcha, wrong-pattern catch, or library recipe → append to `docs/KNOWLEDGE_INBOX.md` (or directly to its permanent home if clear). **Do NOT route to auto-memory** — these are project-durable, agent-agnostic learnings.
- Durable, project-relevant learning whose final home (`PROJECT_CONTEXT.md` / `CLAUDE.md` / a rule / a skill) is unclear → append an entry to `docs/KNOWLEDGE_INBOX.md` (see Knowledge Inbox below).
- Discovered a bug, gap, or improvement in a file inherited from the claude-ts template (`AGENTS.md`, `CLAUDE.md`, `rules/**`, `.claude/agents/**`, `.claude/skills/**`) → write the entry **directly to `docs/CLAUDE_TS_CHANGELOG.md`** (not the inbox) so it survives in the repo until PR'd back upstream. Use the format already established in that file.
- Everything else → `CHANGELOG.md` only
- If nothing non-obvious was learned → `CHANGELOG.md` only; state this explicitly so the obligation is acknowledged

### What NOT to save

- Code patterns already visible in source
- Git history facts (commit messages capture these)
- Ephemeral task details (task lists, in-progress state)
- Anything already written in CLAUDE.md verbatim

### Format for auto-memory (project type)

```
**[Area] — [short fact]**
Why: [root cause or motivation]
How to apply: [when this matters in future sessions]
```

Example:

```
**Pagination — list endpoints share one default page size**
Why: a shared constant controls limit/offset defaults across repositories.
How to apply: any new list endpoint must reuse the constant, not hardcode a value.
```

### Knowledge Inbox (`docs/KNOWLEDGE_INBOX.md`)

An append-only queue for durable, project-relevant learnings whose final home isn't clear yet — the **agent-agnostic memory layer**: any AI tool working in the repo (Claude, Codex, Gemini, Copilot, ...) may append to it, unlike vendor-private auto-memory. It trends toward empty — a queue, not an archive.

If the file doesn't exist yet, create it with this header + format:

```markdown
# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## YYYY-MM-DD — [area] short fact

Why: … Belongs in (guess): PROJECT_CONTEXT | CLAUDE.md | rule | skill | claude-ts-upstream | discard
```

Append new entries using the same 3-line format (header line + `Why:` + `Belongs in (guess):`).

**Automatic distillation:** during every Phase 6, check `docs/KNOWLEDGE_INBOX.md`. If it has more than 10 entries or exceeds ~3 KB, distill it as part of this phase (a `cheap`-tier agent may be dispatched for this): move each entry into its permanent home (`PROJECT_CONTEXT.md`, `CLAUDE.md`, a rule, a skill, or `docs/CLAUDE_TS_CHANGELOG.md` for upstream-bound learnings — or discard if no longer useful), then delete the entry from the inbox. Also distill on explicit request ("distill the knowledge inbox") or at the end of a roadmap phase.

**Hard constraint:** never `@`-reference `docs/KNOWLEDGE_INBOX.md` from `CLAUDE.md` or `AGENTS.md` — that would force-load it into every conversation as noise. Reference it only as a plain path in on-demand indexes.

**Division of labor:**

- `docs/KNOWLEDGE_INBOX.md` — **default target** for project-durable knowledge in transit (agent-agnostic, travels with the repo; any AI tool may append)
- `docs/CLAUDE_TS_CHANGELOG.md` — permanent ledger of claude-ts template divergences/fixes, ready to port upstream — entries persist until actually ported, unlike the inbox
- `docs/METRICS.md` — append-only raw-data ledger, one table row per completed task, feeding a future measurement-design session; never `@`-referenced
- `PROJECT_CONTEXT.md` (or equivalent) — distilled, stable domain truth
- `CHANGELOG.md` — what changed and why, per task
- Auto-memory (`feedback` type only) — **narrow exception**: personal Claude workflow preferences for this user's sessions only. Never use for project-level learnings (bugs, gotchas, library recipes, wrong patterns) — those go in the inbox or their permanent home regardless of vendor.

## Git and Task File Management

### Task files and git-exclude: never use `git mv`/`git add`

Task files under `tasks/**` are excluded via the committed `.gitignore` (`/tasks`). This means:

- Task files **never** appear in `git status`/`git diff` output
- `git mv`/`git add` fail with "not under version control" on these paths
- Moving between `todo/`/`done/`/`parked/`, creating new task files, or updating existing ones must use plain `mv` and filesystem writes, never git commands

If a git operation unexpectedly fails or a directory shows suspiciously empty `git status` output, run `git check-ignore -v <path>` to check for exclusion rules.

### CTS update: commit only when source is pushed upstream

Running `/cts-update --source ../claude-ts` (or any local/uncommitted CTS checkout) to verify a contribution round-trips cleanly is a dry run, not a release — its diff must stay uncommitted/discarded in this consumer repo. Committing it would make this repo's history claim a template sync that never happened upstream.

**Pattern**: before committing any `/cts-update` output, confirm the CTS source pointed at the GitHub remote (or a local checkout whose HEAD is already pushed there) — not an unpushed local-only state. If in doubt, ask the user.

## Quality Gate Pre-Flight Scope

When `reviewer` and `security-scanner` pre-flight, they read:

1. **Durable map**: `PROJECT_CONTEXT.md` / `DECISIONS.md` / `docs/ARCHITECTURE.md` (once topology docs exist)
2. **Seam-touched files**: if the changeset touches a seam (shared contract/registry/cross-layer field), read the full touched files plus their bidirectional consumers/dependencies
3. **Security boundary** (security-scanner only): relevant sections from decision/context docs

A full-repo-scan (reading all source code) should only happen after topology docs exist and a scoped-reading map is in place. Until then, the gap is accepted — `reviewer`/`security-scanner` focus on the touched files + their dependencies, not the whole codebase.

## Team Conventions

- **Naming**: `{purpose}-{slug}` — e.g. `qg-user-registration`, `verify-403-policy`
- **Lifecycle**: TeamCreate before phase → spawn teammates → collect results → shutdown → TeamDelete
- **No chatter**: quality gate agents report independently, orchestrator reads all reports and decides
- **Always cleanup**: TeamDelete after phase completes (pass or fail)

## Agent Quick Routing

| Need                                    | Agent                   |
| --------------------------------------- | ----------------------- |
| Node.js backend (API, services, queues) | `backend-developer`     |
| Vue 3 component/page                    | `vue-developer`         |
| React component/page                    | `react-developer`       |
| Angular component/page                  | `angular-developer`     |
| Unit/integration tests                  | `tester`                |
| E2E browser tests                       | `qa`                    |
| Database schema + migrations            | `dba`                   |
| Code review                             | `reviewer`              |
| Bug investigation                       | `debugger`              |
| Security audit                          | `security-scanner`      |
| DDD / domain design                     | `ddd-architect`         |
| Integrations / OAuth / webhooks         | `integration-architect` |
| Queue jobs / async processing           | `queue-specialist`      |
| DevOps / Docker / CI                    | `devops`                |
| Code refactoring                        | `refactoring-expert`    |
| Business analysis / user stories        | `ba`                    |
| Challenge requirements                  | `devil`                 |
| External docs / API / README            | `docs-writer`           |

## Tool API Reference

### TeamCreate

```
TeamCreate({ name: "qg-user-registration" })
```

### Spawn Agent into Team

```
Agent({
  subagent_type: "tester",
  team_name: "qg-user-registration",
  prompt: "..."
})
```

### SendMessage (challenge / respond)

```
SendMessage({
  to: "ba",          // agent name within the team
  message: "..."
})
```

### TeamDelete

```
TeamDelete({ name: "qg-user-registration" })
```

Always call TeamDelete after the team phase completes, whether it passed or failed.
