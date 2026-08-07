# Task Authoring — Acceptance Criteria Rules (local override)

This file extends `rules/cts/task-authoring.md`. On any conflict, this local file takes precedence.

## Atomic criteria rule

One acceptance criterion states one verifiable fact. Compound criteria joined by `+`, `and`, or a comma list must be split into one checkbox per behavior. A criterion an executor can satisfy while omitting part of it is not a criterion.

**Counter-example** (from a screen-parity task replacing a legacy bill-balance card):

The original criterion read:

```
- [ ] Parity: balance + 3-currency display + refresh, per spec above.
```

This admitted two conflicting interpretations:

- _The balance rendered in three currencies_ (correct, per legacy code `master:src/app/system/page-bill/bill-card/bill-card.component.html`)
- _A display of three currency rates_ (what the rejected implementation built)

**Correct decomposition** into atomic criteria:

```
- [ ] The account balance is rendered in the base currency.
- [ ] The same balance is rendered converted to each of the three configured FX rates.
- [ ] A refresh action re-fetches the current balance and FX rates from the API.
```

Each checkbox now represents one verifiable behavior, testable in isolation. An executor cannot partially satisfy one checkbox — each is atomic.

## Pointable criteria rule

Each criterion must be satisfiable by pointing at something — a `file:line`, a grep that returns a known result, a named command that exits zero. Criteria that can only be assessed by opinion ("clean", "idiomatic", "well-tested") belong in the reviewer's remit, not in the AC block.

**Counter-example**: A criterion like "the code is well-tested" is subjective and not pointable; replace it with "test coverage for the balance-conversion flow is ≥90%", which can be verified by running the coverage tool and pointing at a specific line in the report.

**Good criterion**: "The file `src/app/budget/screens/bill-balance-card.component.spec.ts` contains at least one test case for each of the three currency conversions."

## Parity-task authoring obligation

When a task claims behavior parity with a legacy source, the task file must:

1. **Name the legacy source as a resolvable ref+path**, not a prose description. Example: `master:src/app/system/page-bill/bill-card/bill-card.component.html`, not "the old bill card screen".
2. **Enumerate the legacy behaviors as individually checkable AC lines**, each citing that path. Do not write a single "Parity" criterion; instead, read the legacy file and list each behavior it implements as a separate checkbox that references the line.

**Example** (same bill-balance screen-parity task):

Instead of: `- [ ] Parity: balance + 3-currency display + refresh, per spec above.`

Write:

```
- [ ] Legacy source: `master:src/app/system/page-bill/bill-card/bill-card.component.html` (line 42–45).
- [ ] The account balance is rendered in the base currency (see legacy line 43).
- [ ] The balance is also rendered converted to each configured FX rate (legacy line 44–45).
- [ ] A refresh button re-fetches the balance and rates (legacy line 50–52).
```

This makes the parity claim pointable and prevents ambiguity at implementation time.

### Cross-link to Phase 4.5 orchestrator obligation

This authoring-side obligation is paired with an orchestrator-side verification step documented in `rules/local/workflow.md` § "Phase 4.5 — Acceptance Verification". The Phase 4.5 section states that:

> When a task file's `## Context / Why` or acceptance criteria name a legacy source for behavior parity, the orchestrator opens that source (`git show <ref>:<path>`) and enumerates the behaviors it implements. A replacement feature is not accepted until it has been checked against the legacy behavior in code.

The orchestrator's Phase 4.5 reads the task file's AC lines and verifies each against the legacy source you cite here. If your AC lines are ambiguous or miss behaviors, the orchestrator's read-back will catch it and route the work back to implementation. Write atomic, pointable, legacy-linked criteria so the orchestrator's verification step can complete without re-opening the task.

Neither the authoring rule nor the Phase 4.5 orchestrator rule should be distilled or deleted without re-evaluating both together — they are interdependent.

## Pre-Dispatch Checklist

### Task file's pinned branch can go stale between authoring and execution

A branch can be merged, superseded, or abandoned after a task file cites it. Before dispatching any agent against a task-file-pinned branch, run `git log --oneline <branch>..develop` and `develop..<branch>` to confirm freshness — zero unique commits = fully merged and stale. (2026-07-28) This check must happen at triage before the first agent spawn, not after a subagent stalls partway through.

### Task file's cited `rules/cts/*` path can be stale when content lives in a local override

When authoring a task that references a `rules/cts/X.md` file path, verify that the file hasn't been superseded by `rules/local/X.md` in this repo. If it has, cite the local file instead. (2026-08-02)

### Task-file identifier names can drift from what actually shipped

A hardening task described a constant as `MAX_RESPONSE`, but the actual shipped code named it `MONOBANK_MAX_BODY_BYTES` and placed it in a different file. (2026-08-02) Any task describing code implementation should say "verify actual identifier via grep" rather than naming a specific symbol that may have changed during impl.

Concrete pattern: README/doc-sync tasks referencing prior implementation should cite git refs and use grep to confirm identifiers before trusting the task's prose.
