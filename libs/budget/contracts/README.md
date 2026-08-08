# budget-contracts

**Tags:** `scope:budget` · `type:contracts` · `platform:shared`

Request/response DTOs for the budget vertical, consumed by both `apps/web` (Angular) and `apps/api` (NestJS). May import only `scope:budget` + `scope:shared` (in practice: `shared-util` for `CurrencyCode`/`SerializedMoney`). No framework imports; no runtime logic.

Per ADR-007, budget DTOs live here rather than in `shared-contracts` — they are domain-specific, not cross-cutting. `TransactionType` and `DEFAULT_WORKSPACE_ID` are also authoritatively defined here.

Amounts travel as `SerializedMoney` (integer minor units encoded as a string, precision-safe for transport) on responses, or as a plain minor-units integer (`amountMinorUnits`) on write requests, paired with LIVR validation schemas colocated in `budget/application`. Dates travel as ISO strings (`YYYY-MM-DD` for calendar dates, `YYYY-MM` for budget months).
