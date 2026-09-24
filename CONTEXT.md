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

## Implemented Verticals

`identity`, `budget`, and `workspace` are now shipped. Each follows the onion pattern in `libs/<domain>/{core,application,infrastructure,feature-*,data-access,ui,testing}` (backend domains omit feature/ui/testing).

## Future Verticals

Planned future contexts:

- `car` — vehicle history, repairs, expenses.

Each new context will follow the same shape as the implemented verticals: `libs/<domain>/{core,application,infrastructure,feature-*,data-access,ui,testing}` (backend domains omit feature/ui/testing).

---

## Bounded Context: `workspace`

The `workspace` context owns multi-tenant data isolation and scoped-admin grouping. It establishes the `Workspace` aggregate as the isolation boundary — every budget entity (and future verticals) carry a `workspaceId` identity-only reference to this context.

### Ubiquitous Language

| Term                    | Meaning                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace**           | The root aggregate for a scoped-admin grouping (deliberately not "tenant," "group," or "organization"). The isolation boundary for data. |
| **WorkspaceMemberRole** | Workspace-local authority, orthogonal to platform `Role {SUPERADMIN, USER}`. Values: `admin`, `member`.                                  |
| **Membership**          | A value object: `{ userId, role: WorkspaceMemberRoleType, grantedAt, grantedBy }`. Holds the user's workspace-scoped authority.          |
| **userId**              | A Telegram user ID, stored as identity-only reference — workspace never imports `libs/identity/core`.                                    |
| **admin**               | Workspace membership role. Can manage members, change roles, and remove members (with hard ≥1-admin invariant).                          |
| **member**              | Workspace membership role. Read-only data access; cannot manage members or roles.                                                        |

### Workspace Aggregate

```ts
{
  id: string;
  name: string;
  members: Membership[];
  version: number; // optimistic concurrency
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Invariants

- **Created with one admin:** `Workspace.create(name, initialAdminUserId, grantedBy, now)` always seeds exactly one `ADMIN` membership. Never born admin-less.
- **Unique membership:** A `userId` appears at most once in `members` — `addMember` on an existing member throws `DomainError`.
- **Hard ≥1 admin:** A workspace always keeps at least one admin:
  - `changeRole(userId, 'member')` when that user is the only admin → throws `DomainError`.
  - `removeMember(userId)` when that user is the only admin → throws `DomainError`.
  - Self-demotion (last admin demoting themselves) also throws (the aggregate doesn't care who the caller is).
- **Idempotent role change:** `changeRole(userId, currentRole)` leaves `version` and `members` unchanged (no-op, not an error).
- **Non-member operations error:** `removeMember` / `changeRole` on a `userId` not in `members` → throws `DomainError`.

### Aggregate Methods

- `create(name, initialAdminUserId, grantedBy, now): Workspace` — factory
- `addMember(userId, role, grantedBy, now): void` — adds with the given role, throws if `userId` already present
- `changeRole(userId, role, now): void` — mutates the membership's role, throws on non-member or hard-invariant violation
- `removeMember(userId, now): void` — removes from members, throws on non-member or hard-invariant violation
- `isMember(userId): boolean` — membership test
- `isAdmin(userId): boolean` — admin role test
- `adminUserIds(): string[]` — list of all admin user IDs
- `membershipOf(userId): Membership | null` — look up a single membership

### Repository Interface (`IWorkspaceRepository`)

Located in `libs/workspace/core`. Mirrors the `IUserRepository` pattern:

- `create(workspace): Promise<Workspace>` — persists and returns with assigned `id`
- `findById(id): Promise<Workspace | null>`
- `save(workspace): Promise<void>` — optimistic CAS on `version`; throws conflict error if stored version moved
- `findAll(): Promise<Workspace[]>`
- `findByMemberUserId(userId): Promise<Workspace[]>` — all workspaces this user is a member of
- `findMembership(workspaceId, userId): Promise<{workspaceId, role, grantedAt} | null>` — quick membership lookup

Persistence (Typegoose schema, MongoDB repo impl) is in `libs/workspace/infrastructure` (W2a task). Core only defines the interface.

### ID Convention

Same as other aggregates: `id = ''` on creation; Mongo ObjectId string assigned at persistence. See `libs/shared/util/src/lib/validation-patterns.ts:2` for `ID_PATTERN`.

---

## Frontend Configuration

### `TELEGRAM_BOT_USERNAME` is frontend config, not API config

`TELEGRAM_BOT_USERNAME` is read only by the Angular `login-page.component.ts` (passed to Telegram Login Widget's `data-telegram-login` attribute) and never by the API. Previously threaded through env → docker-compose build-arg → Dockerfile ARG → generated `.env` file, it was backend config wearing the wrong clothes. (2026-07-21)

**Current state**: the build-arg chain is gone and the migration is **done**, not pending. The value is served at runtime by `GET /api/config` and provided via `provideAppInitializer` in `app.config.ts` — the `useValue: environment.telegramBotUsername` provider it replaced no longer exists. Consumers inject the `TELEGRAM_BOT_USERNAME` token (`libs/identity/data-access/src/lib/telegram-bot-username.token.ts`) and have no knowledge of its origin, which is why swapping the provider was the only frontend change required. One image now serves every environment.

**Testing note**: any spec that spreads the production `ApplicationConfig.providers` into `TestBed.configureTestingModule` implicitly runs this initializer on first `inject()`, firing a real `GET /api/config` even when the test touches an unrelated token — pair it with `provideHttpClientTesting()` and settle `ApplicationInitStatus.donePromise`.

**Why**: Configuration should live at the layer that consumes it. Every hop in the chain is a place it can break, and gitignored generated files force every execution context (CI job, e2e, fresh clone) to independently regenerate before building.
