## New section: CI scoping — `nx affected -t <target> --exclude <project>` semantics

When scoping CI targets with `nx affected`, remember that `--exclude` applies to project names, not target names. Before using `--exclude` to scope an invocation, enumerate every project that exposes that target name (via `nx show projects` and `grep project.json`). An exclude-list covering only the one project you thought of is silently wrong the moment another project gains the same target.

Example: `nx affected -t e2e --exclude smoke-e2e` doesn't stop at smoke-e2e — if `apps/api` also defines an `e2e` target (Jest, needs live Mongo), it will also run. Fix: scope explicitly with `-p web-e2e -t e2e` instead.

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

**Why this is structural, not a quality-gate defect**: Every phase of the quality gate (tester, reviewer, qa, lint/tsc) verifies _the code that exists_. A feature that was never written has no diff to review, no code to cover, and no flow to exercise — it is invisible from inside the gate by construction, exactly as the gate is designed to be when correctness-checking built code. A green gate therefore proves conformance of the implementation that shipped, not completion of the original ask. This is especially visible in parity tasks (feature replacement where the legacy code already implements the new behavior) — the absence of currency conversion in a "bill balance card" replacement only surfaced by diffing the legacy `page-bill` screen against the new implementation and finding it rendered three separate currency conversions nowhere present in the replacement.

### Parity tasks carry an extra obligation

When a task file's `## Context / Why` or acceptance criteria name a legacy source for behavior parity, the orchestrator opens that source (`git show <ref>:<path>`) and enumerates the behaviors it implements. A replacement feature is not accepted until it has been checked against the legacy behavior in code, not against a written description of that behavior. This is an exception to the orchestrator's normal read restriction (orchestrator normally reads only `.claude/**`, `rules/**`, `AGENTS.md`, plan files, agent reports) — reading the legacy source file directly is in the same spirit as reading a plan file or an agent report: it is external factual evidence for a claim, not reading the project's own source code inline. A parity claim that does not cite the legacy file is not evidence of parity.

### Failure routes back to Phase 3, outside the restart budget

If acceptance verification fails (a criterion cannot be pointed at a specific file/line, or a parity claim cannot be verified in the legacy code), orchestrator routes back to Phase 3 (implementation). This is **not** a `## Fix Now` fix-retry cycle, and does not consume the 2-cycle restart budget that manages gate `## Fix Now` phases. A missing feature is unbuilt work, not a defect in built work: the implementation phase must extend to deliver what was asked, not iterate on quality of what was partially delivered.
