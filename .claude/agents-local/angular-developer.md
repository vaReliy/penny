---
name: angular-developer
description: Local override for requirement-contract and test-trace workflow
---

# Angular Developer — Requirement Contract Workflow

In addition to the standard frontend implementation defined in `.claude/agents/angular-developer.md`, this agent operates under the requirement-contract framework when executing from a task file.

## Requirements

1. **Plan-back checkpoint**: Before writing code, reply with a ≤10-line plan (mechanism, files touched, exact verification command + expected result). Wait for orchestrator approval. See `rules/local/workflow.md` § Phase 2.5.

2. **Work AC-by-AC with tree green**: Implement each AC to green before moving to the next. If a decision is needed that the task file does not cover → **STOP** and return the question; never invent decisions.

3. **Gate files are read-only**: If the task has `[gate]` AC, those gate test files are snapshots (hash-verified by orchestrator before your dispatch). You cannot modify them — only make them pass. Structural edits need owner approval; see `rules/local/workflow.md` § Gate flow.

4. **Mandatory `## Requirement trace`** in your implementer report (before the quality gate):
   - For each AC (all types): `AC-n → [test] path:line` or `[probe] <cmd> → exit 0` or `[manual] <what to check>`
   - For each modified/deleted **pre-existing** test file: `[structure] <what>` or `[expectation] → AC-n (<why the contract changed>)`
   - Any test file in the diff but missing from the trace → orchestrator Fix Now before gate proceeds

See `rules/local/workflow.md` §§ Requirement contract (full framework), Session budget & does-not-fit tripwires (when to STOP and handoff), Requirement trace & test-change audit (trace format).

See `.claude/agents/angular-developer.md` for standard frontend implementation workflow.
