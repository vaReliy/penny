# budget-infrastructure

**Tags**: `scope:budget · type:infrastructure · platform:server`

**May import**: `scope:budget/core`, `scope:shared/*` (errors, util)

Typegoose schemas (`CategoryModel`, `MonthlyBudgetModel`, `TransactionModel`), explicit mappers, and Mongo repository implementations (`MongoCategoryRepository`, `MongoMonthlyBudgetRepository`, `MongoTransactionRepository`) for the budget bounded context. Mongoose/BSON types never escape this library — only `libs/budget/core` domain entities are returned from public repository methods (per ADR-007 in `DECISIONS.md`).

## Integration tests

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

## Monobank FX rates client: `MonobankCurrencyClient` and `GetExchangeRatesService`

`monobank-currency-client.ts` implements `MonobankCurrencyClient`, a typed HTTP client for [Monobank's public `/bank/currency` endpoint](https://api.monobank.ua/docs/) — no authentication required. The endpoint is accessed via a fixed constant `MONOBANK_CURRENCY_URL`; the call accepts no path/query parameters derived from caller input, closing off any SSRF-shaped request-forgery surface. The client enforces a 5-second request timeout (`MONOBANK_REQUEST_TIMEOUT_MS`) to fail fast if upstream hangs.

Monobank's raw payload is untrusted external input: `MonobankCurrencyClient` validates the response shape at runtime before any field access. The `isRawMonobankRate` and `isFiniteNumber` guards reject malformed entries and non-numeric fields; filtered-out entries are silently dropped. For each validated entry, `resolveRateToBase` averages `rateBuy` and `rateSell` when both are present (rounding via `toFixed(RATE_AVERAGE_DECIMAL_PLACES)` specifically to avoid emitting binary-float artifacts like `"27.200000000000003"`), or falls back to `rateCross` when buy/sell are absent. The method returns `ExchangeRatesResponse` — a DTO defined in `libs/budget/contracts/src/lib/exchange-rate.dto.ts` with fields `base` (currency code, always `"UAH"`), `rates` (array of `ExchangeRateEntry` objects), and `asOf` (ISO 8601 timestamp from the upstream payload's most-recent `date` field, or the fetch time if no entries resolved).

`get-exchange-rates.service.ts` wraps `MonobankCurrencyClient` in `GetExchangeRatesService`, a plain TypeScript (non-NestJS) application service that maintains an in-memory TTL cache (`EXCHANGE_RATE_CACHE_TTL_MS` ≈ 5 min 5 sec, sized to respect Monobank's public rate limit of ~1 request per 5 minutes). On a cache miss or stale cache, it calls the client; on upstream failure (network error, timeout, HTTP 429, malformed data), it returns the last-known-good cached `ExchangeRatesResponse` instead of propagating the error — that response's `asOf` timestamp reflects when it was originally fetched, not "now". Only a cold cache (no successful fetch has ever completed) allows upstream failures to reach the caller. This stale-serve strategy trades staleness for resilience: rate lookups remain available even if Monobank is temporarily down or rate-limited, provided at least one prior successful fetch has occurred.

**Known hardening follow-ups** (not yet implemented, tracked as separate backlog tasks): response-size bounds to reject suspiciously large payloads, in-flight-request de-duplication when concurrent cache misses collide (only one fetch should run at a time), and validation to reject non-positive rates — see `tasks/migration/todo/2026-07-27-01-monobank-client-response-size-limit.md`, `-02-exchange-rates-inflight-dedup.md`, and `-03-reject-negative-monobank-rates.md`.
