# Penny — Domain Context

This document captures the domain language for Penny's bounded contexts. It is the seed for future verticals. New agents and developers should read this before touching domain code.

---

## Bounded Context: `identity`

The `identity` context owns everything related to user identity, authentication, and access control.

### Ubiquitous Language

| Term           | Meaning                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| **User**       | A person who has initiated a Telegram login. The root aggregate of the `identity` context.                           |
| **telegramId** | The numeric Telegram user ID. This is the **durable identity key** — it never changes and is the primary lookup key. |
| **firstName**  | The user's Telegram first name. Optional and mutable (Telegram may update it).                                       |
| **lastName**   | The user's Telegram last name. Optional and mutable.                                                                 |
| **username**   | The user's Telegram `@username`. Optional and mutable.                                                               |
| **photoUrl**   | URL of the user's Telegram profile photo. Optional and mutable.                                                      |
| **UserStatus** | The access state of a User. Exactly three values (see below).                                                        |
| **pending**    | The user has authenticated via Telegram but has not yet been approved by an admin. Cannot access the application.    |
| **active**     | The user has been approved. Can log in and use the application.                                                      |
| **rejected**   | The user's access request was denied by an admin. Cannot log in; session is terminated on the next request.          |
| **auth_date**  | The Unix timestamp from the Telegram auth payload. Used to enforce a 24-hour replay-protection window.               |
| **hash**       | The HMAC-SHA256 signature on the Telegram auth payload. Verified server-side before any DB access.                   |

### User Status Transitions

```
(new login) ──► pending ──► active
                        └──► rejected
```

- `pending → active`: admin runs `cli user:approve <telegramId>`.
- `pending → rejected`: admin runs `cli user:reject <telegramId>`.
- There is no transition from `rejected` back to `pending` or `active` in the skeleton — extend by demand.

### Auth Flow Summary

1. User clicks the Telegram Login Widget in `apps/web`.
2. Widget posts `{ id, first_name, auth_date, hash, … }` to `POST /api/auth/telegram`.
3. API verifies the HMAC and the `auth_date` freshness.
4. API finds the user by `telegramId` (or creates a new `pending` user).
5. API issues a signed JWT in an `httpOnly` + `Secure` + `SameSite=Lax` cookie.
6. Subsequent requests carry the cookie; the API guard re-loads the user from MongoDB on every request to enforce the current `status`.
7. A `pending` or `rejected` user is redirected to the access-status page. An `active` user proceeds.

### Admin Approval (Skeleton)

There is no admin UI in the skeleton. An admin approves or rejects users by running:

```bash
docker compose exec cli npx nest start -- user:approve <telegramId>
docker compose exec cli npx nest start -- user:reject <telegramId>
```

This invokes `ApproveUserService` / `RejectUserService` from `libs/identity/application/` — the same application-layer service that an admin UI would call.

### Key Invariants

- `telegramId` is immutable after creation.
- Profile fields (`firstName`, `lastName`, `username`, `photoUrl`) are updated on every successful login to reflect the latest Telegram data.
- A `rejected` user whose JWT is still valid is blocked on the next API request (DB re-check enforces this).
- No password or email is stored. The HMAC signature on the Telegram payload is the only credential.

---

---

## Bounded Context: `budget`

The `budget` context owns income and expense tracking, monthly spending limits, balance derivation, and foreign currency conversion.

### Ubiquitous Language

| Term                | Meaning                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Account**         | A bank account or wallet scoped to a workspace. Root aggregate. Holds a name and currency code (e.g., UAH).                |
| **Transaction**     | A single income or expense event: date, amount, category, account, and optional description. Root aggregate.               |
| **TransactionType** | The polarity of a transaction: exactly `'income' \| 'expense'`. Stored as a const enum in `budget/contracts`.              |
| **Category**        | A semantic tag for grouping transactions (e.g., "groceries", "transport"). Root aggregate. Supports soft-archive.          |
| **archived**        | A category marked as no longer accepting new transactions. Historical transactions retain the archived tag.                |
| **MonthlyBudget**   | A spending ceiling for a specific category in a specific month (e.g., "€ 50 for transport in July"). Root agg.             |
| **month**           | Represented as an ISO string `'YYYY-MM'`. Boundaries are calendar months in Europe/Kyiv timezone.                          |
| **balance**         | Derived as `Σ(income) − Σ(expense)` across all transactions for an account, never stored. Recomputed on read.              |
| **workspaceId**     | Every budget entity carries a workspace identifier (a UUID string) for multi-tenant scoping. Identity-only ref.            |
| **Money**           | A value object: `{ amount: bigint, currency: 'UAH' \| 'USD' \| 'EUR' }`. Amounts stored as minor units (kopiykas for UAH). |

### Key Invariants

- **Immutable transactions** — Transactions cannot be edited or deleted (additive capability deferred to Q5).
- **Soft-archive only** — Categories are marked `archivedAt` to hide them from UI selections, but archived tags persist on historical transactions for integrity.
- **Derived balance** — No stored balance field; balance is always recomputed from transaction aggregations.
- **Single workspace per session** — MVP uses a single implicit workspace; future multitenancy is backward-compatible (identity-only reference, no schema change needed).

---

## Future Verticals

The `identity` and `budget` contexts are the first two vertical slices and the templates every future vertical copies. Planned future contexts:

- `car` — vehicle history, repairs, expenses.
- `workspace` — (parked) scoped-admin grouping with hard ≥1-admin invariant.

Each new context will follow the same shape: `libs/<domain>/{core,application,infrastructure,feature-*,data-access,ui,testing}` (backend domains omit feature/ui/testing).

---

## Bounded Context: `workspace` (parked)

Not implemented. Today's flat single-role model is already behaviorally equivalent to "one implicit workspace, superadmin as its admin," so the entity below has no functional gap to fill yet — it's recorded so the naming and shape are settled before anyone builds it.

- **Workspace** — the entity name for a scoped-admin grouping (deliberately not "tenant," "group," or "organization"). Membership lives inside the `Workspace` aggregate itself, under a hard ≥1-admin invariant.
- Would live in its own `libs/workspace/*` scope, not folded into `identity`.

---

## Frontend Configuration

### `TELEGRAM_BOT_USERNAME` is frontend config, not API config

`TELEGRAM_BOT_USERNAME` is read only by the Angular `login-page.component.ts` (passed to Telegram Login Widget's `data-telegram-login` attribute) and never by the API. Previously threaded through env → docker-compose build-arg → Dockerfile ARG → generated `.env` file, it was backend config wearing the wrong clothes. (2026-07-21)

**Current state**: the build-arg chain is gone and the migration is **done**, not pending. The value is served at runtime by `GET /api/config` and provided via `provideAppInitializer` in `app.config.ts` — the `useValue: environment.telegramBotUsername` provider it replaced no longer exists. Consumers inject the `TELEGRAM_BOT_USERNAME` token (`libs/identity/data-access/src/lib/telegram-bot-username.token.ts`) and have no knowledge of its origin, which is why swapping the provider was the only frontend change required. One image now serves every environment.

**Testing note**: any spec that spreads the production `ApplicationConfig.providers` into `TestBed.configureTestingModule` implicitly runs this initializer on first `inject()`, firing a real `GET /api/config` even when the test touches an unrelated token — pair it with `provideHttpClientTesting()` and settle `ApplicationInitStatus.donePromise`.

**Why**: Configuration should live at the layer that consumes it. Every hop in the chain is a place it can break, and gitignored generated files force every execution context (CI job, e2e, fresh clone) to independently regenerate before building.
