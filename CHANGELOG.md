# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en-1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`libs/shared/kernel`** — Core abstractions for clean architecture: `BaseService<TParams, TResult>` abstract class (request validation via LIVR → authorization → execution → typed result), `ServiceContext<TConfig>` interface for dependency injection (constructed by the interface layer, never reads `process.env`), `IRepository<TEntity, TId>` generic ORM-agnostic repository interface, `registerLivrRules()` bootstrap hook for validation rule registration at application startup, and `ServiceValidationError` extending the existing `ValidationError` from `libs/shared/errors`.
- **Nx linting boundaries** — Fixed ESLint rules to permit `type:infrastructure`, `type:application`, `type:core`, and `type:kernel` to depend on `type:errors` (previously incorrectly closed off). Added `bannedExternalImports` to `type:kernel` (`@nestjs/*`, `@angular/*`, `mongo`, `mongoose`) to enforce framework-freedom at the kernel layer via lint.
- **`livr` runtime dependency** — First backend runtime dependency, added to root `package.json` for validation rule registration and execution in kernel layer.
- **`libs/identity/infrastructure`** — Mongo connection plumbing: `createMongoConnection`/`disconnectMongoConnection`/`pingMongo` built on Mongoose's `createConnection` (independent connections, not the global singleton), config injected via `MongoConnectionConfig` (URI, db name, optional `serverSelectionTimeoutMS`, default 5000ms) — never reads `process.env` in lib code. Also adds a `pino` logger factory (`createPinoLogger`) selecting JSON vs `pino-pretty` output via an injected mode parameter. No domain schema yet — pure plumbing layer.
- **`docker-compose.dev.yml`** — Local `mongo:7` service with a named volume and a `mongosh`-based healthcheck (`mongo:7` ships `mongosh`, not the legacy `mongo` shell) for local/integration testing.
- **`mongoose`, `pino`, `pino-pretty` runtime dependencies** — exact-pinned per repo convention.
- **`libs/identity/application`** — Identity session services layer: `LoginWithTelegramService` (find-or-create pending Telegram user, refresh profile, no JWT for non-active), `ITokenIssuer` interface + `JwtTokenIssuer` implementation (HS256 via `jsonwebtoken@9.0.3`, minimum 32-char secret enforced, `UserStatus` claim enum-validated), `ApproveUserService`/`RejectUserService` (admin-gated status transitions `pending→active`/`pending→rejected`, delegate domain transition rules to entity), shared `SetUserStatusService` base class. Framework-free, 32 unit tests passing.
