# Metrics Ledger

Append-only ledger of completed tasks, one table row per task, written during Phase 6 (Knowledge Capture). This is raw data collection, not a dashboard — no aggregation, no analysis, no pruning. A dedicated measurement-design session happens later, once 20–30 real rows exist.

**Hard constraint:** never `@`-reference this file from `CLAUDE.md` or `AGENTS.md` — that would force-load it into every conversation as noise (same constraint that applies to `docs/KNOWLEDGE_INBOX.md`). Reference it only as a plain path in on-demand indexes.

## Column format

Each completed task is one row in the table below.

| Field               | Meaning                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Date`              | ISO date the task completed (`YYYY-MM-DD`)                                                                    |
| `Repo`              | Repo name                                                                                                     |
| `Task`              | Task file slug or short identifier                                                                            |
| `Tier`              | Triage tier at dispatch (`T0`–`T3`)                                                                           |
| `Cycles`            | Number of quality-gate restart cycles consumed (0 if it passed first try)                                     |
| `Fix Now (t/r/s/q)` | `## Fix Now` item counts per gate stage, in order: tester / reviewer / security-scanner / qa (e.g. `1/0/0/2`) |
| `Emitted`           | Count of pre-existing findings routed to `## Emit as Task` (backlog, not blocking)                            |
| `Hardstop`          | `yes`/`no` — whether the 2-cycle hard-stop limit was hit                                                      |
| `Model`             | Model tier used for the implementation agent (`deep`/`standard`/`cheap`)                                      |

## Entries

<!-- Append one row per completed task to the table below. -->

| Date       | Repo      | Task                                            | Tier | Cycles | Fix Now (t/r/s/q) | Emitted | Hardstop | Model    |
| ---------- | --------- | ----------------------------------------------- | ---- | ------ | ----------------- | ------- | -------- | -------- |
| 2026-07-16 | claude-ts | distill-inbox-guess-resolution                  | T1   | 2      | 0/5/0/0           | 1       | no       | standard |
| 2026-07-23 | claude-ts | drop-superpowers-plugin-dependency              | T1   | 0      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-16 | claude-ts | distill-inbox-step3-host-repo-ledger            | T1   | 0      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-17 | claude-ts | cts-sync-append-merge-hardening-etalon-verify   | T2   | 2      | 0/3/0/0           | 1       | no       | standard |
| 2026-07-17 | claude-ts | cts-sync-is-ignored-trailing-newline            | T1   | 1      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-17 | claude-ts | cts-sync-round2-review-residuals                | T1   | 0      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-17 | claude-ts | phantom-baseline-repair-and-sync-guards         | T2   | 0      | 0/0/0/0           | 2       | no       | deep     |
| 2026-07-18 | claude-ts | cts-sync-crosscheck-hint-presync-local          | T1   | 0      | 0/1/0/0           | 1       | no       | standard |
| 2026-07-18 | claude-ts | cts-sync-quote-hint-paths                       | T0   | 0      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-23 | claude-ts | two-layer-cts-distribution-refactor             | T3   | 3      | 1/4/2/0           | 2       | yes      | standard |
| 2026-07-23 | claude-ts | fix-cts-setup-existing-project-stale-engine-gap | T1   | 0      | 0/0/0/0           | 0       | no       | standard |
| 2026-07-23 | claude-ts | fix-agents-md-docs-style-index-gap              | T0   | 0      | 0/0/0/0           | 0       | no       | standard |
