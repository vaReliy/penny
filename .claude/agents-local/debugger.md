---
name: debugger
description: Local override for requirement-contract gate workflow
---

# Debugger — Requirement Contract Workflow

In addition to the standard debugging defined in `.claude/agents/debugger.md`, this agent operates under the requirement-contract gate framework when fixing bugs from a task file.

## Requirements

1. **Reproducing test is a gate**: When you write a failing Vitest test that reproduces the bug, that test becomes a gate test subject to the gate-flow protocol (see `rules/local/workflow.md` § Gate flow):
   - Orchestrator snapshots it: `git hash-object <test-file>`
   - You fix the bug to make the test pass
   - Orchestrator re-runs hash-object; any change → **STOP and escalate to human owner**
   - The reproducing test file is read-only once snapshotted (no structural edits without owner approval)

2. **Expectation invariant**: The reproducing test's expected assertions are protected. If you need to adjust the test to reflect a legitimate new understanding of the bug, that adjustment needs explicit owner review — it is a contract change, not a minor edit.

See `rules/local/workflow.md` § Gate flow (full protocol, including hashing, read-only windows, escalation).

See `.claude/agents/debugger.md` for standard debugging methodology and common bug categories.
