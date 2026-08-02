# Metrics Ledger

Append-only ledger of completed tasks, one table row per task, written during Phase 6 (Knowledge Capture). This is raw data collection, not a dashboard — no aggregation, no analysis, no pruning. A dedicated measurement-design session happens later, once 20–30 real rows exist.

**Note**: The measurement-design session is overdue (header states it is due at 20–30 rows; this ledger currently holds ~54 rows). A dedicated session to define metrics, sampling, and analysis goals has not yet run. Measurements below are raw collected values pending later distillation.

**Hard constraint:** never `@`-reference this file from `CLAUDE.md` or `AGENTS.md` — that would force-load it into every conversation as noise (same constraint that applies to `docs/KNOWLEDGE_INBOX.md`). Reference it only as a plain path in on-demand indexes.

## Column format

Each completed task is one row in the table below.

| Field                | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Date`               | ISO date the task completed (`YYYY-MM-DD`)                                                                                                                                                                                                                                                                                                                                                                                    |
| `Repo`               | Repo name                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Task`               | Task file slug or short identifier                                                                                                                                                                                                                                                                                                                                                                                            |
| `Tier`               | Triage tier at dispatch (`T0`–`T3`)                                                                                                                                                                                                                                                                                                                                                                                           |
| `Cycles`             | Number of quality-gate restart cycles consumed (0 if it passed first try)                                                                                                                                                                                                                                                                                                                                                     |
| `Fix Now (t/r/s/q)`  | `## Fix Now` item counts per gate stage, in order: tester / reviewer / security-scanner / qa (e.g. `1/0/0/2`)                                                                                                                                                                                                                                                                                                                 |
| `Emitted`            | Count of pre-existing findings routed to `## Emit as Task` (backlog, not blocking)                                                                                                                                                                                                                                                                                                                                            |
| `Hardstop`           | `yes`/`no` — whether the 2-cycle hard-stop limit was hit                                                                                                                                                                                                                                                                                                                                                                      |
| `Executor model`     | Model tier of the primary implementation agent dispatched for the task (`deep`/`standard`/`cheap`). Renamed from `Model` to disambiguate against `Orchestrator model` below.                                                                                                                                                                                                                                                  |
| `Orchestrator model` | Model tier used for the orchestrator, but **only when it overrides** the `CLAUDE.local.md` tier default (T0–T2 → `standard`, T3 → `deep`) — leave blank when the default was followed, since it's otherwise fully derivable from `Tier` and recording it every row would just duplicate that column. Self-reportable — the orchestrator knows its own model identity and can fill this at Phase 6 without any external check. |

## Entries

<!-- Append one row per completed task to the table below — ALWAYS use the last table row as the Edit anchor to avoid mid-table insertion. Read the file tail first if unsure. -->

| Date       | Repo  | Task                                                         | Tier | Cycles | Fix Now (t/r/s/q) | Emitted | Hardstop | Executor model | Orchestrator model |
| ---------- | ----- | ------------------------------------------------------------ | ---- | ------ | ----------------- | ------- | -------- | -------------- | ------------------ |
| 2026-07-07 | penny | distill-shared-contracts-alias-into-architecture             | T1   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-20 | penny | budget-contracts-livr-validation                             | T2   | 0      | 0/0/0/0           | 2       | no       | standard       |                    |
| 2026-07-20 | penny | budget-core-transaction-type-migration                       | T1   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-14 | penny | livr-max-length-login-profile                                | T0   | 0      | 0/0/0/0           | 0       | no       | cheap          |                    |
| 2026-07-07 | penny | distill-jwt-array-claim-guard-into-validation-rule           | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-07 | penny | skeleton-review-dod-audit-and-backlog-regroom                | T2   | 0      | 0/0/0/0           | 4       | no       | deep           |                    |
| 2026-07-15 | penny | workflow-micro-resolution-lane-and-distill-ledger-obligation | T1   | 1      | 0/2/0/0           | 0       | no       | standard       |                    |
| 2026-07-08 | penny | integration-test-mongo-auth                                  | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-08 | penny | eslint-injectable-ban                                        | T2   | 2      | 2/1/0/0           | 2       | yes      | cheap→standard |                    |
| 2026-07-08 | penny | cleanup-batch                                                | T2   | 1      | 0/1/0/0           | 0       | no       | cheap          |                    |
| 2026-07-14 | penny | infra-security-hardening-reopened                            | T2   | 0      | 0/0/0/0           | 2       | no       | standard       |                    |
| 2026-07-08 | penny | coverage-thresholds                                          | T2   | 1      | 0/1/0/0           | 0       | no       | cheap          |                    |
| 2026-07-08 | penny | ci-e2e-target                                                | T2   | 2      | 1/4/0/0           | 0       | no       | standard       |                    |
| 2026-07-08 | penny | session-guard-roles-and-opaque-errors                        | T2   | 0      | 0/0/0/0           | 2       | no       | standard       |                    |
| 2026-07-15 | penny | distill-inbox-into-rules                                     | T1   | 0      | 0/0/0/0           | 0       | no       | cheap          |                    |
| 2026-07-08 | penny | fix-fakeuserrepository-missing-interface-methods             | T0   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-09 | penny | telegram-hash-nginx-logs                                     | T2   | 2      | 0/1/1/0           | 1       | no       | standard       |                    |
| 2026-07-10 | penny | session-guard-full-opaque-401                                | T2   | 1      | 1/0/0/0           | 2       | no       | standard       |                    |
| 2026-07-09 | penny | wire-request-caller-identity-from-session-user               | T2   | 1      | 0/2/0/0           | 1       | no       | standard       |                    |
| 2026-07-10 | penny | session-guard-timing-and-cookie-signal                       | T2   | 1      | 0/0/1/0           | 1       | no       | standard       |                    |
| 2026-07-11 | penny | admin-role-assignment-and-jwt-issuance                       | T2   | 1      | 0/1/0/0           | 0       | no       | standard       |                    |
| 2026-07-14 | penny | eslint-dead-fuses-and-unlinted-apps                          | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-11 | penny | skeleton-re-review-dod-verification                          | T2   | 0      | 0/0/0/0           | 4       | no       | deep           |                    |
| 2026-07-13 | penny | ci-run-vitest-and-typecheck-targets                          | T2   | 0      | 0/0/0/-           | 3       | no       | standard       |                    |
| 2026-07-13 | penny | fragile-test-repository-interface-casts                      | T0   | 0      | 0/0/0/-           | 0       | no       | cheap          |                    |
| 2026-07-13 | penny | stale-read-modify-write-races-toctou-cas                     | T2   | 0      | 0/0/0/-           | 1       | no       | standard       |                    |
| 2026-07-14 | penny | nx-typecheck-target-for-vitest-projects                      | T1   | 1      | 0/1/0/-           | 0       | no       | standard       |                    |
| 2026-07-14 | penny | mongo-healthcheck-interval-30s                               | T0   | 0      | 0/0/0/-           | 0       | no       | cheap          |                    |
| 2026-07-14 | penny | stop-hook-docker-app-and-kc-nudge-scope                      | T2   | 0      | 0/0/0/-           | 1       | no       | standard+cheap |                    |
| 2026-07-14 | penny | harden-kc-nudge-input-handling                               | T0   | 0      | 0/0/0/-           | 0       | no       | standard       |                    |
| 2026-07-14 | penny | web-e2e-ci-serves-built-artifact                             | T2   | -      | -/-/-/-           | 1       | no       | standard       |                    |
| 2026-07-14 | penny | fix-stale-e2e-serve-static-example-in-testing-rule           | T1   | -      | -/-/-/-           | 0       | no       | cheap          |                    |
| 2026-07-14 | penny | skeleton-round3-dod-verification-and-close                   | T2   | 0      | 0/0/0/-           | 2       | no       | deep           |                    |
| 2026-07-14 | penny | doc-hygiene-batch-and-skeleton-fork-guide                    | T2   | 1      | 0/1/0/-           | 0       | no       | standard       |                    |
| 2026-07-15 | penny | api-cli-lint-coverage-and-orphaned-test-targets              | T1   | 1      | 0/1/0/-           | 0       | no       | deep           |                    |
| 2026-07-15 | penny | grill-vite-test-target-naming-decision                       | T1   | 0      | 0/0/0/-           | 0       | no       | deep           |                    |
| 2026-07-15 | penny | nx-console-tree-view-grill-and-includedScripts-fix           | T0   | 0      | 0/0/0/-           | 0       | no       | standard       |                    |
| 2026-07-15 | penny | mongo-test-db-parallel-isolation                             | T1   | 1      | 1/1/0/-           | 0       | no       | standard       |                    |
| 2026-07-16 | penny | close-result1-cut-develop-branch                             | T1   | 0      | 0/0/0/-           | 0       | no       | cheap          |                    |
| 2026-07-18 | penny | i18n-transloco-foundation                                    | T2   | 1      | 1/1/-/0           | 0       | no       | standard       |                    |
| 2026-07-19 | penny | budget-domain-model-adr                                      | T3   | 0      | -/-/-/-           | 0       | no       | deep           |                    |
| 2026-07-19 | penny | css-framework-decision-adr-scss-to-css-followup              | T1   | 1      | 0/3/-/-           | 0       | no       | standard       |                    |
| 2026-07-20 | penny | web-shell-mobile-first-restyle                               | T2   | 1      | 0/1/-/0           | 2       | no       | standard       |                    |
| 2026-07-20 | penny | budget-core-entities                                         | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-22 | penny | runtime-bot-config-endpoint                                  | T2   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-22 | penny | budget-application-transactions                              | T2   | 1      | 0/0/1/0           | 2       | no       | standard       |                    |
| 2026-07-22 | penny | budget-application-analytics                                 | T2   | 0      | 0/1/0/0           | 0       | no       | standard       |                    |
| 2026-07-22 | penny | budget-infrastructure-category-budget-repos                  | T2   | 1      | 2/1/-/-           | 0       | no       | standard       |                    |
| 2026-07-22 | penny | header-navlink-active-hover-mobile-fix                       | T1   | 0      | -/-/-/-           | 0       | no       | standard       |                    |
| 2026-07-22 | penny | budget-infrastructure-transactions-aggregations              | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-27 | penny | monobank-fx-integration                                      | T2   | 1      | 0/1/0/-           | 3       | no       | standard       |                    |
| 2026-07-27 | penny | api-endpoints-categories-budgets                             | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-27 | penny | api-endpoints-transactions-analytics-rates                   | T2   | 0      | 0/0/0/-           | 1       | no       | standard       |                    |
| 2026-07-27 | penny | budget-data-client-stores                                    | T2   | 1      | 0/1/-/-           | 0       | no       | standard       |                    |
| 2026-07-27 | penny | fix-budget-module-missing-authmodule-import                  | T1   | 0      | 0/0/0/0           | 0       | no       | standard       |                    |
| 2026-07-27 | penny | screen-bill-balance-rates (Sonnet orchestrator)              | T2   | 0      | 0/0/0/0           | 0       | no       | standard       | Sonnet             |
| 2026-07-27 | penny | screen-bill-balance-rates (Opus orchestrator)                | T2   | 1      | 0/1/-/0           | 2       | no       | standard       | Opus               |
| 2026-07-27 | penny | merge-account-screen-and-relocate-format-money               | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-27 | penny | acceptance-verification-gate-stage                           | T2   | 0      | -/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | dashboard-store-per-concern-request-state                    | T2   | 0      | 0/0/-/-           | 1       | no       | standard       |                    |
| 2026-07-28 | penny | sibling-stores-per-concern-request-state                     | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | dark-design-system-tokens                                    | T1   | 1      | 1/0/-/0           | 1       | no       | standard       | standard           |
| 2026-07-28 | penny | tailwind-source-globs-missing-budget-libs                    | T0   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | monobank-client-response-size-limit                          | T0   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | exchange-rates-inflight-dedup                                | T1   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | reject-negative-monobank-rates                               | T0   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | shell-mobile-e2e-missing-config-mock                         | T1   | 0      | 0/0/-/-           | 1       | no       | standard       |                    |
| 2026-07-28 | penny | convert-balance-util-readability                             | T0   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | shell-mobile-getbyrole-current-option-invalid                | T0   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | screen-records-forms                                         | T2   | 0      | 0/0/-/0           | 0       | no       | standard       |                    |
| 2026-07-28 | penny | screen-history-list-filter-chart                             | T2   | 0      | 0/0/-/0           | 1       | no       | standard       |                    |
| 2026-07-29 | penny | screen-planner-monthly-budgets                               | T2   | 2      | 0/1/0/1           | 0       | no       | standard       |                    |
| 2026-07-29 | penny | planner-progress-bar-overspend-green-red-split               | T1   | 0      | 0/0/-/-           | 1       | no       | standard       |                    |
| 2026-07-29 | penny | cursor-pointer-interactive-elements-audit                    | T1   | 1      | 0/1/-/-           | 0       | no       | standard       |                    |
| 2026-07-29 | penny | record-transaction-account-referential-check                 | T2   | 0      | 0/0/0/-           | 0       | no       | standard       |                    |
| 2026-07-29 | penny | planner-progress-aria-valuenow-overspend-clamp               | T0   | 1      | 0/1/-/-           | 0       | no       | standard       |                    |
| 2026-08-02 | penny | frontend-feature-guide                                       | T1   | 1      | -/4/-/-           | 0       | no       | standard       |                    |
| 2026-08-02 | penny | governance-docs-result2                                      | T1   | 1      | -/2/-/-           | 1       | no       | standard       |                    |
| 2026-08-02 | penny | nx-readme-boilerplate-guard                                  | T1   | 2      | 0/3/-/-           | 2       | no       | standard       |                    |
| 2026-08-02 | penny | update-hardening-follow-ups-section                          | T1   | 0      | -/0/-/-           | 0       | no       | cheap          |                    |
| 2026-08-02 | penny | normalize-budget-infrastructure-readme-tags-format           | T1   | 1      | -/0/-/-           | 0       | no       | cheap          |                    |
| 2026-08-02 | penny | extract-shared-stateful-fake-user-repository                 | T1   | 1      | 0/0/-/-           | 0       | no       | standard       |                    |
| 2026-08-02 | penny | in-memory-user-repository-direct-coverage                    | T1   | 1      | 0/0/-/-           | 1       | no       | standard       |                    |
| 2026-08-02 | penny | add-typecheck-target-identity-testing                        | T0   | 1      | 0/0/-/-           | 0       | no       | cheap          |                    |
| 2026-08-02 | penny | raise-tsconfig-base-target-es2020                            | T2   | 0      | 0/0/-/-           | 0       | no       | standard       |                    |
