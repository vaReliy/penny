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

| Date       | Repo  | Task                                               | Tier | Cycles | Fix Now (t/r/s/q) | Emitted | Hardstop | Model          |
| ---------- | ----- | -------------------------------------------------- | ---- | ------ | ----------------- | ------- | -------- | -------------- |
| 2026-07-07 | penny | distill-shared-contracts-alias-into-architecture   | T1   | 0      | 0/0/0/0           | 0       | no       | standard       |
| 2026-07-07 | penny | distill-jwt-array-claim-guard-into-validation-rule | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |
| 2026-07-07 | penny | skeleton-review-dod-audit-and-backlog-regroom      | T2   | 0      | 0/0/0/0           | 4       | no       | deep           |
| 2026-07-08 | penny | integration-test-mongo-auth                        | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |
| 2026-07-08 | penny | eslint-injectable-ban                              | T2   | 2      | 2/1/0/0           | 2       | yes      | cheap→standard |
| 2026-07-08 | penny | cleanup-batch                                      | T2   | 1      | 0/1/0/0           | 0       | no       | cheap          |
| 2026-07-08 | penny | coverage-thresholds                                | T2   | 1      | 0/1/0/0           | 0       | no       | cheap          |
| 2026-07-08 | penny | ci-e2e-target                                      | T2   | 2      | 1/4/0/0           | 0       | no       | standard       |
| 2026-07-08 | penny | session-guard-roles-and-opaque-errors              | T2   | 0      | 0/0/0/0           | 2       | no       | standard       |
| 2026-07-08 | penny | fix-fakeuserrepository-missing-interface-methods   | T0   | 0      | 0/0/0/0           | 0       | no       | standard       |
| 2026-07-09 | penny | telegram-hash-nginx-logs                           | T2   | 2      | 0/1/1/0           | 1       | no       | standard       |
| 2026-07-10 | penny | session-guard-full-opaque-401                      | T2   | 1      | 1/0/0/0           | 2       | no       | standard       |
| 2026-07-09 | penny | wire-request-caller-identity-from-session-user     | T2   | 1      | 0/2/0/0           | 1       | no       | standard       |
| 2026-07-10 | penny | session-guard-timing-and-cookie-signal             | T2   | 1      | 0/0/1/0           | 1       | no       | standard       |
| 2026-07-11 | penny | admin-role-assignment-and-jwt-issuance             | T2   | 1      | 0/1/0/0           | 0       | no       | standard       |
