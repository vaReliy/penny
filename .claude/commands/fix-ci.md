---
model: sonnet
---

You are diagnosing and fixing CI/CD failures on a Pull Request in your project's GitHub repository. This command assumes GitHub-hosted CI using GitHub Actions. The workflow filename, job names, per-job commands, and Docker commands throughout this file are specific to this template's own CI shape. Consumers must adapt them to their own workflow structure, job naming scheme, and development environment.

CRITICAL: For PR metadata, prefer `github` MCP tools over `gh` CLI. For GitHub Actions CI data (run logs, job status), use `gh` CLI commands — `gh run list`, `gh run view`, `gh pr checks`. Do NOT scrape GitHub URLs or use `curl`/`WebFetch` for CI data.

## Input

The user provided: `$ARGUMENTS`

## Step 1: Parse the PR reference

Parse the input to determine the repository and PR number. Supported formats:

- `123` or `#123` — PR in current repo (detect via `git remote`)
- `repo#123` — PR in `{your_org}/repo`
- `{your_org}/repo#123` — full org/repo path
- `https://github.com/{your_org}/{your_repo}/pull/123` — full URL

If the input is empty or cannot be parsed, ask the user for the PR reference.

## Step 2: Fetch PR metadata

**Primary — `github` MCP:** Use `mcp__github__pull_request_read` with:

```json
{"owner": "{your_org}", "repo": "<REPO>", "pullNumber": <NUMBER>}
```

**Fallback — `gh` CLI:**

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh pr view <NUMBER> --repo {your_org}/<REPO> --json title,body,headRefName,baseRefName,files,additions,deletions,commits
```

Extract `headRefName` (the PR branch name) — you will need it for CI run lookups.

## Step 3: Fetch GitHub Actions failure data

Run these commands in parallel:

**3a. Quick CI status check:**

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh pr checks <NUMBER> --repo {your_org}/{your_repo}
```

**3b. Find the latest CI run for the branch:**

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh run list \
  --branch <headRefName> \
  --repo {your_org}/{your_repo} \
  --workflow ci.yml \
  --limit 5 \
  --json databaseId,status,conclusion,displayTitle,createdAt
```

If all checks are green (no failures), inform the user that CI is passing and stop.

**3c. Get failed job details (once you have the run ID):**

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh run view <run-id> \
  --repo {your_org}/{your_repo} \
  --json jobs \
  --jq '.jobs[] | select(.conclusion=="failure") | {name, conclusion, steps: [.steps[] | select(.conclusion=="failure") | {name, conclusion}]}'
```

**3d. Get failure logs:**

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh run view <run-id> \
  --repo {your_org}/{your_repo} \
  --log-failed
```

IMPORTANT: `--log-failed` output can be very large. If it is truncated, note that earlier failures may be missing.

### Identify failure type

The CI has two job groups. Map the failed job name to one of these:

**Lint matrix** (`🪄 Lints | ...`):

- `🔍 TypeScript` — type check failure (`tsc --noEmit`)
- `🔯 ESLint` — linting failure (often auto-fixable with `npx eslint . --fix`)
- `🅿️ Prettier` — formatting failure (auto-fixable with `npx prettier --write .`)

**Test matrix** (`♻️ Tests | ...`):

- `🔬 Unit` — unit test failure (requires code investigation)
- `🧬 Integration` — integration test failure (requires code investigation)
- `☂️ Coverage` — test coverage failure (may indicate new code without tests)
- `🦠 Mutation` — Stryker mutation testing failure (tests exist but don't catch mutations)

## Consumer Adaptation: Customize CI Job Shape

The job names and environment assumptions in this command are specific to this template's GitHub Actions workflow. Consumers with a different CI structure or development environment must adapt these references to their own setup.

### Template-specific job names

The emoji-tagged job names listed above (`🪄 Lints`, `🔍 TypeScript`, `🔯 ESLint`, `🅿️ Prettier`, `♻️ Tests`, `🔬 Unit`, `🧬 Integration`, `☂️ Coverage`, `🦠 Mutation`) are hardcoded references to this template's CI configuration. Map each to your own CI job names using the failure patterns and tool names (TypeScript, ESLint, Prettier, unit tests, integration tests, coverage, mutation testing) to identify equivalent jobs in your workflow.

### GitHub Actions vs. CI-agnostic components

This command has both GitHub-Actions-specific logic and CI-agnostic logic:

**GitHub-Actions-specific:**

- Step 2 (Fetch PR metadata) — uses `github` MCP or `gh pr view` CLI
- Step 3 (Fetch CI data) — uses `gh run list`, `gh run view`, and `gh pr checks` to retrieve GitHub Actions job and run data
- The `gh run rerun` call in Step 6 to rerun failed jobs
- The `gh run rerun` call in Step 7 to offer reruns for transient failures

**CI-agnostic:**

- Step 1 (Parse PR reference) — pure string parsing, works with any CI system
- Step 4 (Switch to PR branch) — the git operations (`git fetch`, `git checkout`) are CI-agnostic, though the assumption is that a PR branch exists (adjust per your VCS)
- Step 5 (Dispatch debugger) — the debugger agent logic is independent of CI system

**Mixed (requires adaptation):**

- Step 6 includes `docker compose exec app` commands to run lint and test commands. If your development environment uses Docker Compose with a service named `app`, these work as-is. Otherwise, replace `docker compose exec app` with your own command runner (e.g., `npm run`, `pnpm`, or direct shell invocation). Same applies to the test commands in Step 6 (Vitest-specific; adapt to your test framework).

### Creating a consumer override

To maintain your own adapted version of this command, you have two options:

**Option A: Preserve local edits via `.ctsignore` (recommended)**

Add `.claude/commands/fix-ci.md` to the `.ctsignore` file in your consumer project. This prevents `cts-sync.sh update` from overwriting your local edits. Trade-off: you will not automatically receive upstream improvements to this file — you must manually incorporate them yourself when needed.

**Option B: Fork to a separate command file**

For deeper divergence, create your own command file (e.g., `.claude/commands/fix-ci-custom.md`) with your adapted job names, environment setup, and CI-specific tools. This file is not synced by the CTS template. Use it when your CI structure differs significantly and you want a clean separation from the upstream command.

## Step 4: Switch to the PR branch

Before analysis and fixes, check out the PR branch locally so agents work with the correct code:

```bash
git fetch origin <headRefName>
git checkout <headRefName>
```

If there are uncommitted local changes, stash them first and inform the user.

## Step 5: Dispatch the debugger agent

Launch the `debugger` agent with `subagent_type: "debugger"` passing:

1. The `gh run view --log-failed` output
2. The failed job names and their step details from Step 3c
3. The failure type (lint vs test, and which specific tool)
4. The list of files changed in the PR
5. The PR branch name (already checked out locally)

The agent prompt must instruct the debugger to:

- Analyze the GitHub Actions failure logs to identify root cause
- For **lint failures**: identify which files and lines caused the linter to fail; check if the issue is auto-fixable
- For **test failures**: identify the failing `describe/it` block and the assertion that failed; read the failing test file and the code under test from the local codebase
- For **mutation failures**: identify which mutations survived; read the affected test and source files
- Note: GitHub Actions has no built-in flaky test detection. If the failure looks intermittent (timing, random ordering, environment), flag it explicitly and suggest a manual rerun
- Produce a structured diagnosis:
  - Root cause (one sentence)
  - Failure type: lint | unit test | integration test | coverage | mutation
  - Affected files (list of file paths)
  - Failed tests or linter errors (specific list)
  - Whether a code fix is needed or if it is a transient/environment issue
  - Recommended fix approach (brief)

## Step 6: Dispatch the backend-developer agent (if fix needed)

If the debugger determined that a code fix is needed, launch the `backend-developer` agent with `subagent_type: "backend-developer"` passing:

1. The full root cause analysis from the debugger
2. The specific files that need to be modified
3. The failed job names and test/lint errors so developer can verify the fix

The agent prompt must instruct the developer to:

- Apply the minimal fix to resolve the CI failure
- Follow project standards: `CLAUDE.md`, `rules/cts/code-style.md`, `rules/cts/architecture.md`
- For **lint failures**, run the relevant linter to verify the fix:
  ```bash
  docker compose exec app npx tsc --noEmit
  docker compose exec app npx eslint .
  docker compose exec app npx prettier --check .
  ```
- For **test failures**, run the failing test to verify the fix:
  ```bash
  docker compose exec app npx vitest run test/unit/failing-test.spec.ts
  ```
- If tests pass, run the broader suite for the affected area:
  ```bash
  docker compose exec app npx vitest run
  ```
- Do NOT make changes beyond what is needed to fix the CI failure
- Do NOT refactor, improve, or "clean up" adjacent code

If the debugger determined it is a transient or environment issue (not a code problem), skip the developer agent and inform the user directly with the diagnosis and recommended action.

For transient failures, offer to rerun the failed jobs:

```bash
GITHUB_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN gh run rerun <run-id> \
  --repo {your_org}/{your_repo} \
  --failed
```

## Step 7: Present results to user

After all agents complete, present:

**Diagnosis:**

- Which CI jobs failed and why (root cause)
- Whether it is a code issue or a transient problem

**Fix applied** (if applicable):

- Which files were modified
- What was changed and why
- Local verification results (test output / linter output)

**Next steps:**

- Ask the user if they want to commit and push the fix
- If committing: use a clear commit message like `fix: resolve CI failure in [JobName]`
- Remind that pushing will trigger a new CI run

If no fix was applied (transient/environment issue):

- Offer to rerun the failed workflow via the `gh run rerun` command above
- Or suggest investigating persistent failures manually
