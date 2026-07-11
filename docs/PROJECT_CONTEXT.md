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

### Domain Entity Patterns

**`User.props` is private** — When building a status-overridden User in dev/CLI commands (bypassing `transitionTo()`), use public getters to construct mutated copies:

```typescript
// ✓ Correct — uses public getters
const updatedUser = new User({
  id: user.id,
  telegramId: user.telegramId,
  username: user.username,
  firstName: user.firstName,
  status: targetStatus,
  updatedAt: new Date(),
});

// ❌ Wrong — User.props is private
new User({ ...user.props, status: targetStatus });
```

If spread-with-override recurs, consider adding a `toProps(): UserProps` accessor or `User.withStatus(status): User` factory to the entity.

### Open Questions & TODOs

- **JWT refresh tokens** — `ITokenIssuer` is a seam, but `refresh_token` claim logic not yet implemented.
- **Event sourcing** — Approve/reject services prepared to emit domain events; no event store yet.

## Serving Topology (Locked)

**Production architecture:** Nginx/web reverse-proxies API requests to NestJS backend:

- **Web (Nginx)** — serves static Angular SPA at port 80; reverse-proxies `/api/*` → `api:3000`
- **API (NestJS)** — serves only JSON on port 3000; never serves HTML

This topology is **locked** — future CSP nonce delivery, static asset optimization, and routing decisions depend on it. When the topology was undecided, hardening attempts (per-request CSP nonces) produced half-wired features; now that it's locked, such work can proceed with full confidence.

## Security & Content Security Policy

### Telegram Login Widget & HMAC Verification

The redirect-mode Telegram widget appends sensitive query params (`hash`, `id`, `auth_date`) to the login URL. Nginx logs contain the full URL by default, exposing the HMAC `hash` in access logs — an attacker with log read access can replay the payload within the 24-hour `auth_date` window.

**Current mitigation (Option A: nginx log_format scrubbing):**

- Custom nginx `log_format scrubbed` directive uses `$original_uri` (extracted via map from `$request_uri` before internal rewrites) to strip query strings
- Scrubbed format also excludes `$http_referer` (which can carry query string hashes in Referer header via `Referrer-Policy: strict-origin-when-cross-origin`)
- Result: neither URL nor Referer header leaks the HMAC in nginx access logs; per-route observability preserved

**Other options considered:**

- Callback mode (fewer params in URL, but requires CSP `'unsafe-eval'` exemption for postMessage) — rejected
- Accept the risk given 24h window + browser history exposure — rejected

### Angular + CSP `style-src`

Angular's default `ViewEncapsulation.Emulated` inserts `<style>` blocks at runtime. Removing `'unsafe-inline'` from `style-src` breaks all component styles. Proper replacement is per-request `'nonce-{value}'` wired into every generated `<style>` tag — requires Angular build pipeline integration and serving-topology coordination.

**Current state:** `style-src 'unsafe-inline'` is an intentional skeleton-phase tradeoff. Security hardening of this is parked until the CSP nonce pipeline is wired (per-request nonce generation, nginx `sub_filter` injection, Angular CSP_NONCE DI provider integration). See `rules/architecture.md` for the CSP nonce pipeline pattern.

## Infrastructure & Plumbing

### Mongo Connection (`libs/identity/infrastructure`)

- **Factory functions** — `createMongoConnection()`, `disconnectMongoConnection()`, `pingMongo()` built on Mongoose's independent connections (not global singleton).
- **Config injection** — `MongoConnectionConfig` (URI, db name, optional `serverSelectionTimeoutMS`, default 5000ms); no `process.env` reads in lib code.
- **Logging** — `createPinoLogger()` factory with JSON vs `pino-pretty` mode selection via injected parameter.
- **Local dev** — `docker-compose.dev.yml` includes `mongo:7` service; healthchecks use `mongosh` (legacy `mongo` shell not in mongo:7).

## CLI & Dev Tools

### CLI Configuration Pattern

CLI apps that call admin services (e.g., `ApproveUserService`, `RejectUserService`) only need `MONGO_URI` and `MONGO_DB_NAME`. They should not require unrelated secrets like `JWT_SECRET` or Telegram widget credentials.

Pattern: create a separate `loadCliConfig()` that validates only necessary vars, using the same `API_CONFIG` symbol token. Each NestJS app maintains its own DI container, so symbol identity is per-app and not global:

```typescript
// In the CLI main entry
const config = loadCliConfig(); // validates MONGO_* only
const app = await NestFactory.create(CliIdentityModule, { config });
```

This lets the CLI reuse `CliIdentityModule` without requiring unrelated env vars.

### Docker MCP Server Configuration

Docker-based MCP servers (e.g., GitHub integration) must be named via `--name` in the args array of `.mcp.json`, otherwise Docker generates a random adjective+scientist name (`strange_goldstine`, `sleepy_watson`, etc.). Add to the server config:

```json
{
  "mcp": {
    "command": "docker",
    "args": ["run", "--rm", "--name", "github-mcp-server", "mcp-github:latest"]
  }
}
```

Note: `--name` prevents two simultaneous instances, which is fine since Claude Code starts one per session.

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
