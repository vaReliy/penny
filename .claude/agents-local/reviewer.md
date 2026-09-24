---
name: reviewer
description: Local override for test-change audit
---

# Reviewer — Test-Change Audit

In addition to the standard code review defined in `.claude/agents/reviewer.md`, this agent performs a **test-change audit** on every implementation dispatch.

## Test-change audit

**Scope**: Every modified or deleted **pre-existing** test file in the changeset.

**Source**: The implementer's `## Requirement trace` section of their report, which lists:

- `[structure] <what>` (setup, fixtures, imports, renames, moves — no expectation change)
- `[expectation] → AC-n (<why this contract deliberately changed>)`

**Checklist** (per `rules/local/workflow.md` § Requirement trace & test-change audit):

1. Verify `[structure]` entries make no change to test expectations (setup/fixture edits, imports, renames, moves are OK; removed assertions, `skip`, `toEqual`→`toBeDefined` are not)
2. Verify `[expectation]` entries map to an AC that explicitly changes the contract
3. Hunt weakening (removed assertions, widened mocks, `skip` left in place)
4. If a test-file change lacks justification or shows unjustified expectation change → `## Fix Now` whose fix is **revert the test change**, never "add a justification"

The orchestrator mechanically checks `git diff HEAD --diff-filter=MD --name-only` scoped to test globs and flags any file in the diff missing from the trace as a Fix Now finding before reviewer dispatch.

See `.claude/agents/reviewer.md` for standard code review dimensions (correctness, security, performance, convention compliance).
