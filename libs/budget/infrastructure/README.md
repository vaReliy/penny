# budget-infrastructure

**Tags**: `scope:budget · type:infrastructure · platform:server`

**May import**: `scope:budget/core`, `scope:shared/*` (errors, util)

Typegoose schemas (`CategoryModel`, `MonthlyBudgetModel`, `TransactionModel`), explicit mappers, and Mongo repository implementations (`MongoCategoryRepository`, `MongoMonthlyBudgetRepository`, `MongoTransactionRepository`) for the budget bounded context. Mongoose/BSON types never escape this library — only `libs/budget/core` domain entities are returned from public repository methods (per ADR-007 in `DECISIONS.md`).

## Building

Run `nx build budget-infrastructure` to build the library.

## Running unit tests

Run `nx test budget-infrastructure` to execute the unit tests via [Vitest](https://vitest.dev/).

Integration tests require a running MongoDB instance (`docker compose up -d mongo`) and `MONGO_TEST_URI` set — see `libs/identity/infrastructure/README.md` for the same pattern this library mirrors.

## `transactions` collection: justified index set

Penny's hottest-read collection — balance, history, planner, and chart all read it via `MongoTransactionRepository`. Three indexes cover every query shape the repository's methods issue:

| Index                                    | Serves                                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{workspaceId:1, date:-1}`               | `findByWorkspace` with no `categoryId`/`accountId` narrowing — unscoped period/history listing, newest-first.                                                                                            |
| `{workspaceId:1, categoryId:1, date:-1}` | `findByWorkspace` narrowed by `categoryId`; `sumExpenseByCategory` (planner/chart rollups, `$match` on `workspaceId`+period then `$group` by `categoryId`); `existsForCategory` (archive-validation UX). |
| `{workspaceId:1, accountId:1, date:-1}`  | `findByWorkspace` narrowed by `accountId`; `sumAmountsByType` (derived-balance aggregation, always filtered by `accountId`, optionally by a date range).                                                 |

**Deviation from the ADR-007 index sketch:** ADR-007's appendix additionally lists `{workspaceId:1, accountId:1, type:1}` as a fourth, balance-specific index. This library does not add it — `sumAmountsByType`'s `$match` stage only needs an index prefix of `{workspaceId, accountId}` (optionally further narrowed by the `date` range) to select the matching documents efficiently; the subsequent `$group` stage groups the already-matched documents in memory regardless of whether `type` also appears in the index. Adding a fourth compound index sharing the same `{workspaceId, accountId}` prefix as `{workspaceId:1, accountId:1, date:-1}` would cost every write an extra index maintenance with no measurable read benefit, so the three-index set above is the final, implemented shape — confirmed against the repository's actual query patterns as instructed by the task's 2026-07-22 addendum.

**Money storage:** `amount` is a Mongoose-native `BigInt` SchemaType (BSON 64-bit `long`), `currency` a sibling string field — same rationale as `MonthlyBudgetModel`, no float, `$sum`-aggregation compatible.

**Aggregation result type gotcha:** Mongoose does not cast aggregation pipeline output back through its schema (aggregation results are plain POJOs, not hydrated documents — confirmed via Mongoose's own docs). A `$sum` over the `amount` BigInt field can therefore surface as a native `bigint`, a BSON `Long`-like object, or a plain `number`, depending on the exact driver/BSON version in play — `MongoTransactionRepository`'s `toBigIntAmount` helper normalizes all three shapes to `bigint` explicitly rather than assuming one.
