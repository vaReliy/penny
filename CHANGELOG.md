# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en-1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`libs/shared/kernel`** — Core abstractions for clean architecture: `BaseService<TParams, TResult>` abstract class (request validation via LIVR → authorization → execution → typed result), `ServiceContext<TConfig>` interface for dependency injection (constructed by the interface layer, never reads `process.env`), `IRepository<TEntity, TId>` generic ORM-agnostic repository interface, `registerLivrRules()` bootstrap hook for validation rule registration at application startup, and `ServiceValidationError` extending the existing `ValidationError` from `libs/shared/errors`.
- **Nx linting boundaries** — Fixed ESLint rules to permit `type:infrastructure`, `type:application`, `type:core`, and `type:kernel` to depend on `type:errors` (previously incorrectly closed off). Added `bannedExternalImports` to `type:kernel` (`@nestjs/*`, `@angular/*`, `mongo`, `mongoose`) to enforce framework-freedom at the kernel layer via lint.
- **`livr` runtime dependency** — First backend runtime dependency, added to root `package.json` for validation rule registration and execution in kernel layer.
