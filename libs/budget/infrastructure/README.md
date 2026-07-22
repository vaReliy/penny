# budget-infrastructure

**Tags**: `scope:budget · type:infrastructure · platform:server`

**May import**: `scope:budget/core`, `scope:shared/*` (errors, util)

Typegoose schemas (`CategoryModel`, `MonthlyBudgetModel`), explicit mappers, and Mongo repository implementations (`MongoCategoryRepository`, `MongoMonthlyBudgetRepository`) for the budget bounded context. Mongoose/BSON types never escape this library — only `libs/budget/core` domain entities are returned from public repository methods (per ADR-007 in `DECISIONS.md`).

## Building

Run `nx build budget-infrastructure` to build the library.

## Running unit tests

Run `nx test budget-infrastructure` to execute the unit tests via [Vitest](https://vitest.dev/).

Integration tests require a running MongoDB instance (`docker compose up -d mongo`) and `MONGO_TEST_URI` set — see `libs/identity/infrastructure/README.md` for the same pattern this library mirrors.
