## New section: CI scoping — `nx affected -t <target> --exclude <project>` semantics

When scoping CI targets with `nx affected`, remember that `--exclude` applies to project names, not target names. Before using `--exclude` to scope an invocation, enumerate every project that exposes that target name (via `nx show projects` and `grep project.json`). An exclude-list covering only the one project you thought of is silently wrong the moment another project gains the same target.

Example: `nx affected -t e2e --exclude smoke-e2e` doesn't stop at smoke-e2e — if `apps/api` also defines an `e2e` target (Jest, needs live Mongo), it will also run. Fix: scope explicitly with `-p web-e2e -t e2e` instead.

### Companion: `nx affected` vs `nx run-many` flags

The `-p`/`--projects` flag exists on `nx run-many`, not on `nx affected`. When passed to `nx affected`, an unrecognized flag is silently forwarded to the underlying task command (e.g., Playwright), which will error with "unknown option '-p'" — making it look like a tool error rather than an nx invocation error. (2026-07-21)

**Current workaround**: `nx affected -t <target> --exclude=project1,project2` works but is a denylist (will silently fail to exclude the 4th project added later). **Preferred**: use positively-stated scoping — `nx run web-e2e:e2e` when only one project needs to run, or tag-based targeting when available (future: `nx affected -t e2e --tags scope:identity,scope:web`).

Practical diagnostic tip: if an `nx affected` command is failing with a tool error, double-check the flag spelling against `nx affected --help` first.

## Nx CI Reliability Gotchas

### Nx success banner counts projects, not tasks — scoped runs report incomplete coverage as success

Nx `--affected` filtering works, but the final banner message "✓ Running target test for X projects" is true regardless of whether you intended Y projects. Scoped runs mask the omission. (2026-08-06)

### `nx-set-shas` makes `--affected` inversely proportional to CI health

Each push runs `nx-set-shas` to cache SHA bounds for the next run. On a broken branch where CI never completes, the cached SHAs are never updated — all subsequent runs use stale bounds and report the wrong affected set. (2026-08-06)

### Path-anchored ESLint rules are inert under per-project `nx lint`

Root-config `files: ['libs/*/application/**/*.ts']` globs never match when `cwd` IS `libs/identity/application` — the path segment is stripped from every relative path. Use `cd <project> && npx eslint --print-config <file>` to verify. Fix: export rules from root config, apply via `files: ['**/*.ts']` from each project's local config. (2026-08-06)

### Stale Nx daemon plugin workers — `nx reset` clears the daemon cache

An `@nx/vitest` plugin can infer stale targets if the daemon worker is out of sync. Running `nx reset` clears the daemon and forces fresh re-inference. (2026-08-06)

### Killing an `nx serve` process leaves an orphaned lock; resolve PID from port, not path

`pkill -f "dist/apps/api/main.js"` also kills `nx serve api`'s child process while the parent still holds the target lock. Future `nx serve` attempts silently no-op. Resolution: use `ss -tlnp | grep :3000` to find PID from port, then `kill` that specific process. (2026-07-28)

## New section: Quality gate stage sequencing

The quality gate is strictly sequential per stage — do NOT dispatch stage N+1 while stage N is still running.

**Pattern to avoid**: dispatching `reviewer` while `tester`'s background async work (e.g., `nx run-many`) is still in progress. Even though the inline result looks complete, a background task finishing after `reviewer` starts violates the sequential contract.

**Correct pattern**: after dispatching each quality-gate agent as a foreground `Agent` call, wait for the tool result to fully appear before making the next `Agent` call — do not infer completion from partial/streamed output.

## New section: Quality gate fix-retry cycles — resume same agent instance

When a fix is needed after the quality gate (`## Fix Now` items in tester/reviewer/security-scanner/qa reports), re-entry point and agent resumption matter:

1. **Trivial change** (comment, doc-only) → orchestrator handles inline, no downstream needed
2. **Source logic change** → resume `backend-developer` via `SendMessage` to its existing agent ID → run `tester` → `reviewer` + `security-scanner` in parallel
3. **Test-only change** → resume `tester` via `SendMessage` to its existing agent ID → run `reviewer` + `security-scanner`

Resuming the same agent instance (via `SendMessage` to the original `agentId`) preserves context — the agent doesn't re-derive understanding cold.

## New section: Roadmap Ordering — Bones Before Muscles

Depth-first security/feature hardening on a skeleton whose foundational architecture is undecided produces half-wired implementations that are worse than both states. Example: removing `'unsafe-inline'` from CSP but Angular never receives the nonce (because serving topology is undecided) breaks styles in production with no clear error.

**Rule**: if an implementation option depends on an upstream architectural decision (who serves HTML, which DB, network topology, transport layer), defer the implementation until that decision is concrete. Record the option analysis in the parked task file, include a `Depends on` reference to the blocking decision task, and pick the option after the decision is locked.

When the blocking seam or topology is _later_ decided, re-open the parked task with the context now known, and unblock the implementation.

## New section: Milestone Closure & DoD Verification

### Task file in `done/` is not proof of completion

A task file moved to `tasks/<phase>/done/` leaves no git trace (`/tasks` is git-ignored), so a stale or ghost task file can go unnoticed. Before closing a milestone or trusting a `done/` task:

1. Check that `METRICS.md` has a row for the task (METRICS Stop-hook enforces this post-close)
2. Verify acceptance criteria against `git log` and `git diff`:
   - Search for commits that reference the task ID or implementation keywords
   - Grep for config/code changes that should exist (e.g., `grep "sha-256-pinned" .github/` for a Docker fix, `grep "role" src/` for an auth feature)
   - Cross-check against `git show <commit>` for the actual diff

Written claims of completion (task moves, comments, inbox entries) must be verified against the artifact. Also audit plan-vs-reality against the Definition-of-Done checklist before a milestone close — review cycles catch diffs but miss _omissions_ (config not added, feature flag not wired, test not enabled).

## New section: Git and Task File Management

### Task files and git-exclude: never use `git mv`/`git add`

Task files under `tasks/**` are excluded via the committed `.gitignore` (`/tasks`). This means:

- Task files **never** appear in `git status`/`git diff` output
- `git mv`/`git add` fail with "not under version control" on these paths
- Moving between `todo/`/`done/`/`parked/`, creating new task files, or updating existing ones must use plain `mv` and filesystem writes, never git commands

If a git operation unexpectedly fails or a directory shows suspiciously empty `git status` output, run `git check-ignore -v <path>` to check for exclusion rules.

### CTS update: commit only when source is pushed upstream

Running `/cts-update --source ../claude-ts` (or any local/uncommitted CTS checkout) to verify a contribution round-trips cleanly is a dry run, not a release — its diff must stay uncommitted/discarded in this consumer repo. Committing it would make this repo's history claim a template sync that never happened upstream.

**Pattern**: before committing any `/cts-update` output, confirm the CTS source pointed at the GitHub remote (or a local checkout whose HEAD is already pushed there) — not an unpushed local-only state. If in doubt, ask the user.

## New section: ADR-Driven Convention Flips Require Repo-Wide Doc Grep

An ADR/`DECISIONS.md` change that flips a repo-wide convention (styling, module resolution, naming, etc.) must include a repo-wide grep for the OLD convention's keyword across `rules/**` and `docs/SKELETON.md` in the same changeset — not just the files the ADR itself touches. Doc drift from a convention flip is easy to leave half-fixed: left unfixed, the next agent following the stale rule doc will silently revert the new convention, undoing the ADR.

**Concrete example**: converting `apps/web` + `libs/identity/*` from SCSS to plain CSS (ADR-008's Tailwind v4 adoption) initially only touched the renamed files and `DECISIONS.md`. Code review caught that `rules/local/code-style-angular.md`, `rules/nx-generators.md`, and `docs/SKELETON.md` all still hard-mandated SCSS-only (`--style=scss` on every generator invocation, "rename `.css` → `.scss`" as a post-gen step). Even after a first fix pass, two more stale `--style=scss`-shaped references survived in the same files — a partial grep sweep is not sufficient; the sweep must cover every hit of the old convention's keyword, not just the sections obviously about styling.

## New section: Check `DECISIONS.md` Before Assuming a Repo-Interface Extension Is Needed

Before adding a new repo-interface method to support a new read-model/service, check whether `DECISIONS.md` already pre-anticipated the aggregation and exposed it on an existing interface. Implementing `GetBalance`/`GetPlannerSummary`/`GetHistoryChart` found `ITransactionRepository.sumAmountsByType`/`sumExpenseByCategory`, `IAccountRepository.findByIdInWorkspace`, and `IMonthlyBudgetRepository.findByWorkspaceAndMonth` already exposed every aggregation these read-model services needed — zero repo-interface extensions required, confirming `DECISIONS.md` lines 343-360 had pre-anticipated it.

## New section: CI Diagnostics

### A GitHub Actions run marked "failure" can be mostly green — always read job-level conclusions before concluding the pipeline is broken

Run-level status is the OR of its jobs, so a 2/3-green run and a 0/3-red run are visually identical in the UI and in pasted logs. `gh run view <id> --json jobs` shows the real per-job breakdown. An agent without GitHub API access cannot distinguish these states and will over-report breakage — authenticate `gh` (read scopes suffice) before diagnosing CI.

### An unset GitHub Actions `secrets.*` evaluates to empty string with no error, and masking makes the resulting misconfiguration undebuggable — use `vars.*` for non-sensitive config

An unset secret silently becomes an empty string (no error), secrets can't be used in `if:` conditionals so presence can't be cheaply asserted, and secrets are masked as `***` in logs by design — so when a value is wrong (not missing), the logs can't distinguish the two cases. Use configuration variables (`vars.*`) for non-sensitive per-environment values instead, since they render in plain text and are debuggable. Rule of thumb: masking is a cost paid for confidentiality; paying it for a non-confidential value buys nothing.

### An `actions/cache` key must encode everything that determines the cached CONTENT, not just the lockfile — an exact key hit skips the save step, so a stale cache persists silently forever

A cache key must encode everything that determines cached content, not just a manifest file (e.g. `pnpm-lock.yaml` pins tool version, not which artifacts a step was told to fetch). On an exact key hit, `actions/cache` skips the save step entirely — so if what a step fetches changes without the key changing: restore stale cache → re-download the delta every run → save nothing → repeat forever, silently, with tests still passing. Fix: bump the key prefix (and matching `restore-keys`) whenever the determining inputs change, not just the lockfile hash.

## New section: Quality Gate Pre-Flight Scope

When `reviewer` and `security-scanner` pre-flight, they read:

1. **Durable map**: `PROJECT_CONTEXT.md` / `DECISIONS.md` / `docs/ARCHITECTURE.md` (once topology docs exist)
2. **Seam-touched files**: if the changeset touches a seam (shared contract/registry/cross-layer field), read the full touched files plus their bidirectional consumers/dependencies
3. **Security boundary** (security-scanner only): relevant sections from decision/context docs

A full-repo-scan (reading all source code) should only happen after topology docs exist and a scoped-reading map is in place. Until then, the gap is accepted — `reviewer`/`security-scanner` focus on the touched files + their dependencies, not the whole codebase.

## New section: Phase 4.5 — Acceptance Verification

### After quality gate closes, before `docs-writer`, orchestrator re-reads the task file from disk

**Acceptance verification** is one orchestrator read-and-compare pass, mandatory for every task, positioned after the quality gate (Phase 4) closes and before documentation/knowledge capture (Phase 5 = `docs-writer`).

The orchestrator re-reads the task file's `## Acceptance criteria` and `## Context / Why` blocks **from disk** — not from memory of the Phase 1 dispatch — and checks each criterion against the actual working tree. Each verified criterion must be cited with a specific file path and line number: "Line 42 of `src/x.ts` uses `Money.toJSON()`" is evidence; "the PR looks good" is not. A criterion that cannot be pointed at is not met.

**Why this is structural, not a quality-gate defect**: Every phase of the quality gate (tester, reviewer, qa, lint/tsc) verifies _the code that exists_. A feature that was never written has no diff to review, no code to cover, and no flow to exercise — it is invisible from inside the gate by construction, exactly as the gate is designed to be when correctness-checking built code. A green gate therefore proves conformance of the implementation that shipped, not completion of the original ask. This is especially visible in parity tasks (feature replacement where the legacy code already implements the new behavior) — the absence of currency conversion in a "bill balance card" replacement only surfaced by diffing the legacy `page-bill` screen against the new implementation and finding it rendered three separate currency conversions nowhere present in the replacement. (2026-07-27)

### Quality gate scoped to Nx-affected projects can green-light a task while the live system is broken [CRITICAL]

A task scoped frontend-only (e.g., `angular-developer` on feature libs) with a verify pass building/testing only affected frontend projects can still gate-pass while `apps/api` is broken. Nx `--affected` practice is necessary but not sufficient. (2026-07-28) A system smoke check (hit running app pages/endpoints, not just `nx run-many --target=build`) must run before task close, not just Nx-affected subset.

### Parity tasks carry an extra obligation

When a task file's `## Context / Why` or acceptance criteria name a legacy source for behavior parity, the orchestrator opens that source (`git show <ref>:<path>`) and enumerates the behaviors it implements. A replacement feature is not accepted until it has been checked against the legacy behavior in code, not against a written description of that behavior. This is an exception to the orchestrator's normal read restriction (orchestrator normally reads only `.claude/**`, `rules/**`, `AGENTS.md`, plan files, agent reports) — reading the legacy source file directly is in the same spirit as reading a plan file or an agent report: it is external factual evidence for a claim, not reading the project's own source code inline. A parity claim that does not cite the legacy file is not evidence of parity.

**Paired authoring-side obligation**: This orchestrator obligation is paired with a task-authoring rule documented in `rules/local/task-authoring.md` § "Parity-task authoring obligation". That section requires task authors to enumerate legacy behaviors as individually checkable AC lines, each citing the legacy source. The orchestrator's Phase 4.5 verification reads those AC lines and checks each against the legacy source. Neither the authoring rule nor this Phase 4.5 parity-obligation rule should be distilled or deleted without re-evaluating both together — they are interdependent.

### Green gate + passing tests cannot detect a missing core feature

A gate-passing implementation can still omit a feature never written. Concrete: a screen-parity task shipped without the core behavior (balance converted to three currencies), passing 93 tests, lint, typecheck, `tester`, `reviewer`, `qa`. No gate stage flags an absent feature because every stage verifies only code that exists. Discovery required diffing two independent implementations against legacy code. (2026-07-27) This incident justified Phase 4.5 — the gap is structural to the gate.

### Purely visual/rendering bugs can pass unit tests, e2e, and two code reviews

A visual-only defect (wrong text color, misaligned spacing, missing icon) has no code path to test, no coverage gap to find, and looks correct in text-form review. Caught only during real visual inspection. (2026-07-29)

### A gate finding tagged "no action needed" still requires an explicit accept-or-fix decision

A finding reported as "no action needed" still needs orchestrator acknowledgment before task close — do not skip it, do not default-accept it. (2026-08-02)

### Verify a dispatched agent's claimed diff against `git status`/`git diff` — reported completion is not proof

An agent reported a CI fix as complete while making zero file changes (re-described pre-existing commits as its own work). Caught by running `git status`/`git diff` independently and re-running verification. This practice already applies to `tester`/`qa`; extend it to all dispatched agents with `Edit`/`Write` tools. (2026-08-06)

### Agent idle is not agent passed; background subagents deliver nothing until asked

An agent returning "work complete" while running background async tasks that finish later is not a passing state. Verify completion against `git log` + the agent's explicit task status before crediting completion. (2026-08-06)

### Failure routes back to Phase 3, outside the restart budget

If acceptance verification fails (a criterion cannot be pointed at a specific file/line, or a parity claim cannot be verified in the legacy code), orchestrator routes back to Phase 3 (implementation). This is **not** a `## Fix Now` fix-retry cycle, and does not consume the 2-cycle restart budget that manages gate `## Fix Now` phases. A missing feature is unbuilt work, not a defect in built work: the implementation phase must extend to deliver what was asked, not iterate on quality of what was partially delivered.

## New section: Bounded Subagent Reports

Full subagent reports currently enter orchestrator context and are re-sent on every subsequent turn, which is the fastest-growing cost term in a pipeline. Subagent reports must return **findings plus evidence, bounded to 200 lines** — with any long detail (full diffs, complete test output, file dumps) written to a file under the session's scratchpad directory that the orchestrator reads **on demand** (referenced by path, not carried inline).

**Constraints on bounding (preserve gate fidelity):**

- `## Fix Now` and `## Emit as Task` sections are never truncated — the cap applies to narration and supporting detail only.
- Evidence a finding depends on (failing assertion, offending line, name of rule that fired) stays inline. A bounded report must remain independently actionable — the orchestrator must not need to fetch auxiliary files just to understand what failed.

**Pattern**: a subagent report reads:

```
## Fix Now
- line 42 of src/x.ts uses `Money.toJSON()` but the serializer does not exist (line 18–22 of `src/x.spec.ts` fails).

## Supporting detail (long)
(written to /tmp/claude-<hash>/scratchpad/report-detail.txt)
Full diff between old and new coverage output, complete stdout from failed test run, etc.
```

The orchestrator reads the detail file only if investigating the finding, not by default; the inline evidence is sufficient to act on the finding.

## New section: Ledger Honesty — Verify Before Transcribing

`docs/KNOWLEDGE_INBOX.md` is pre-flight-read by every technical agent, so a wrong entry is a per-dispatch tax and a permanent wrong rule once distilled. Before transcribing a subagent-reported learning into the inbox, the orchestrator must confirm the claim against the working tree and include the `file:line` (or command + result) that establishes it. Claims that cannot be pointed at are dropped, not softened.

**Worked counter-example**: A branch's inbox entry claimed `nx serve api` crashed on a missing `AuthModule` import. However, that branch's merge-base is commit `d432095 fix(api): import AuthModule into BudgetModule`, and the file `apps/api/src/budget/budget.module.ts` already reads `imports: [LoggerModule, AuthModule]`. The claim was transcribed into the permanent ledger unverified, alongside a duplicate entry already present on `develop` and a task-reference that already existed. When the branch was later rejected and reviewed, these unverified entries had already been absorbed into the active knowledge base.

The related existing rules — _"verify working-tree side effects before dispatching tester"_ and _"a plain-English claim that a lint rule will fire is not proof"_ (both in `rules/cts/workflow.md`) — are load-bearing and were both unhonored on that branch. This section extends the same principle to the permanent ledger: a claim with no working-tree evidence does not get transcribed, and a subagent-reported learning that lacks a file/line pointer is incomplete, not ready for ledger.

## New section: Task-ID Leakage Self-Check (durable docs)

Rule/doc prose is meant to outlive any specific task file (`tasks/**` is gitignored and its files are routinely archived or deleted). A task-ID or decision-number reference embedded in such prose reads as authoritative today and as meaningless noise once that task file is gone. This mirrors the existing code-comment rule in `AGENTS.md` § Code Style Essentials ("never reference task IDs, decision IDs, or task file paths in comments — these go stale"), extended explicitly to durable docs and rules, which the comment-scoped wording didn't cover — and which slipped through review twice in the same session before being caught.

**Before finishing any edit to a rules file, `CLAUDE.md`, `AGENTS.md`, or a non-ledger doc under `docs/`**, grep the diff for task-ID/decision-number-shaped patterns and rewrite any hit as a content description instead:

```
git diff HEAD -- <changed files> | grep -E '^\+' | grep -vE '^\+\+\+' | grep -E 'task [0-9]+\b|[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+\b|ADR-[0-9]+'
```

**Exceptions** — these are append-only, dated ledgers where task/decision references are the intended format, not a leak: `docs/METRICS.md`, `docs/KNOWLEDGE_INBOX.md`, `docs/CLAUDE_TS_CHANGELOG.md`.

## Items marked for /cts-contribute (upstream candidates)

The following are project-agnostic and worth pushing to the CTS template:

- **Atomic/pointable acceptance criteria rule** — `rules/local/task-authoring.md` §§ Atomic criteria, Pointable criteria. Rationale: prevents ambiguous criteria, makes executor work auditable, catches missing behavior in read-back.
- **Bounded subagent reports with on-demand detail files** — this section. Rationale: largest cost reduction without quality tradeoff; compound effect with lower orchestrator model tier.
- **Verify-before-transcribe ledger rule** — Ledger Honesty section above. Rationale: prevents unverified claims from permanently distorting future dispatches; extends existing "verify before tester" principle to the durable ledger.
- **Task-ID Leakage Self-Check** — this section. Rationale: any claude-ts consumer writing rule/doc prose out of a task-driven session risks embedding a task ID that outlives the task file; also worth a `cts-rule-auditor` structural check (a 12th check alongside the existing 11) that scans `rules/**`, `CLAUDE.md`, `AGENTS.md` for task-ID/decision-number-shaped patterns outside declared ledger exceptions, catching drift even when the write-time self-check is skipped.
