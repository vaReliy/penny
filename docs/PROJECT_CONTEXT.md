# Project Context

Architectural state of record for Penny platform rebuild. This document captures layer boundaries, integration patterns, and domain design decisions to guide future work and onboarding.

## Identity & Authentication

### Core Domain (`libs/identity/core`)

- **`User` entity** — Aggregate root; owns `userId`, `telegramId`, `status` (`pending | active | rejected`), profile fields (`firstName`, `lastName`, `username`).
- **`UserStatus` type** — Enum-like `as const` object: `{ pending: 'pending', active: 'active', rejected: 'rejected' }` (located in `identity-core/src/lib/user-status.ts`, NOT in `shared-contracts`).
- **Domain methods** — `User.approve()` and `User.reject()` enforce transition rules (e.g., only `pending→active` allowed); throw `DomainError` on invalid transitions.

### Repository Interface (`libs/identity/core`)

- **`IUserRepository<TUser>`** — ORM-agnostic abstraction: `find(id)`, `findByTelegramId(id)`, `save(user)`, `exists(id)`, `updateProfile(id, fields)`.
- **NO `updateStatus` method** — The approved pattern is: load entity → call domain method (`approve()`/`reject()`) → `save()`. This enforces domain rule validation and prevents accidental state corruption.
- **Intentional write path separation** — `save()` (via `updateById`) writes all fields including `status` and is only safe to call from `SetUserStatusService` (approve/reject). `updateProfile()` writes only profile fields (`firstName`, `lastName`, `username`, `photoUrl`) and structurally cannot touch `status` or `telegramId`. This split prevents the login path from reverting an approved user's status back to `pending` in a concurrent-write race. Do not consolidate these back to a single `save()` for the returning-user path in `LoginWithTelegramService`.

### Application Layer (`libs/identity/application`)

#### `LoginWithTelegramService`

- **Purpose** — Find-or-create a Telegram user from a verified payload.
- **Flow** — Check `findByTelegramId` → create `pending` user if not found → refresh profile fields → return user. No JWT issued for non-`active` users.
- **Dependency** — `IUserRepository` injected; assumes payload already verified upstream.

#### `ITokenIssuer` Interface & `JwtTokenIssuer` Implementation

- **Token spec** — HS256 signed JWT with `userId`, `userStatus` (enum-validated via `isValidUserStatus()`), `iat`, `exp`.
- **`JwtTokenIssuer(secret, expiresIn)`** — Constructor enforces minimum 32-char secret. Uses `jsonwebtoken@9.0.3` (exact-pinned).
- **Seam for rotation** — Interface allows future `RefreshTokenIssuer` swappable implementation.

#### `ApproveUserService` / `RejectUserService`

- **Admin gate** — Both check `context.caller.roles.includes(Role.ADMIN)` where `Role` is the `as const` object in `shared-contracts` and `RoleType` is its value union.
- **Flow** — Shared base `SetUserStatusService`: load user → call domain method → save → emit event (future).
- **Errors** — `NotFoundError` for unknown userId; domain transition errors bubble from entity method.
- **Transactional safety** — Currently per-save; no distributed transaction orchestration yet.

### Open Questions & TODOs

- **JWT refresh tokens** — `ITokenIssuer` is a seam, but `refresh_token` claim logic not yet implemented.
- **Event sourcing** — Approve/reject services prepared to emit domain events; no event store yet.

## Infrastructure & Plumbing

### Mongo Connection (`libs/identity/infrastructure`)

- **Factory functions** — `createMongoConnection()`, `disconnectMongoConnection()`, `pingMongo()` built on Mongoose's independent connections (not global singleton).
- **Config injection** — `MongoConnectionConfig` (URI, db name, optional `serverSelectionTimeoutMS`, default 5000ms); no `process.env` reads in lib code.
- **Logging** — `createPinoLogger()` factory with JSON vs `pino-pretty` mode selection via injected parameter.
- **Local dev** — `docker-compose.dev.yml` includes `mongo:7` service; healthchecks use `mongosh` (legacy `mongo` shell not in mongo:7).

## Stack Conventions

- **TypeScript 5 (strict mode)** — `unknown` in catch blocks, no `any`.
- **Imports** — `.js` extensions (NodeNext), `type` imports for types, named exports only.
- **File naming** — kebab-case for files, PascalCase for classes/types/interfaces.
- **Constants** — SCREAMING_SNAKE_CASE; enums as `as const` objects.
- **Dependencies** — exact-pinned in `package.json` (no caret/tilde ranges).
- **Testing** — Vitest; unit tests for application layer; integration tests for repositories.

## Related Artifacts

- See `CLAUDE.md`, `AGENTS.md` for team & skill structure.
- See `rules/` for validation, authorization, migrations, Docker commands, architecture guidelines.
- See `KNOWLEDGE_INBOX.md` for learnings awaiting final placement.
