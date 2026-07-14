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

## Future Verticals

The `identity` context is the first vertical slice and the template every future vertical copies. Planned future contexts (not yet implemented):

- `budget` — income, outcome, categories, balance (the original Penny domain).
- `car` — vehicle history, repairs, expenses.

Each new context will follow the same shape: `libs/<domain>/{core,application,infrastructure,feature-*,data-access}`.
