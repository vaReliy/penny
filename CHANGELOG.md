# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en-1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Task 04 — CSP nonce server-side injection via nginx sub_filter)

- **`apps/web/nginx.conf`** — per-request CSP nonce injection using nginx `$request_id` (128-bit CSPRNG, 32 hex chars): `sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">'` replaces the minified placeholder in `index.html` at request time (Angular's esbuild production build minifies `content=""` → `content`, so the match targets the minified form); `add_header Content-Security-Policy` on the `location /` block emits a full policy with `style-src 'self' 'nonce-$request_id'` and `frame-ancestors 'self'`; `gzip off` co-located to prevent silent sub_filter bypass on compressed responses.
- **`apps/web/src/index.html`** — added `<meta name="csp-nonce" content="">` in `<head>` as the nginx sub_filter injection target for Angular's `CSP_NONCE` token.
- **`apps/web/src/app/app.config.ts`** — root `CSP_NONCE` provider using `useFactory: () => document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content || null` so Angular's `ViewEncapsulation.Emulated` adds the nonce attribute to all dynamically inserted `<style>` elements.
- **`apps/web/src/app/app.config.spec.ts`** — unit tests for the `CSP_NONCE` provider: verifies `useFactory` (not `useValue`), null for absent element, `null` for empty-string content (un-replaced placeholder), correct nonce string for valid content.
- **`docs/rebuild/tasks/todo/2026-06-29-07-upgrade-insecure-requests-csp.md`** — backlog task (parked until HTTPS topology confirmed) to add `upgrade-insecure-requests` to both the nginx and NestJS CSP directives.

### Changed (Task 04 — CSP nonce server-side injection via nginx sub_filter)

- **`apps/api/src/middleware/csp-policy.ts`** — removed `'unsafe-inline'` from `styleSrc`; NestJS Helmet now emits `style-src 'self'` on API responses, consistent with the nonce-based policy on the HTML document.
- **`apps/api/src/middleware/csp-policy.spec.ts`** — updated regression test: asserts `style-src 'self'` is present and `'unsafe-inline'` is absent, guarding against accidental reintroduction.

### Added (Task 18 — Docker multi-stage + compose + CI image build)

- **`apps/api/Dockerfile`** — multi-stage (deps → build → runtime); non-root `USER node`; production deps only in runtime layer; `--ignore-scripts --no-optional` on prod install to skip husky hook.
- **`apps/cli/Dockerfile`** — same multi-stage pattern as api; no health check (CLI is not a long-running service).
- **`apps/web/Dockerfile`** — Node.js build stage (`npx nx build web`) → `nginx:1.27-alpine` runtime; non-root `USER nginx` on port 8080; copies `dist/apps/web/browser`.
- **`apps/web/nginx.conf`** — SPA routing (`try_files → index.html`), `/api/` reverse proxy to `api:3000`, cache headers per asset type, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `server_tokens off`) repeated in every location block (nginx add_header inheritance requires this).
- **`docker-compose.yml`** — prod-like stack: `web` (nginx:8080→host:80) + `api` (NestJS:3000) + `mongo` (mongo:7); MongoDB authentication via `MONGO_INITDB_ROOT_USERNAME/PASSWORD`; sequential startup via health check `condition: service_healthy`; isolated bridge network `penny_net`.
- **`.dockerignore`** — excludes `node_modules`, `.nx/cache`, `.angular/cache`, `dist`, `.git`, test files, `.env`/`.env.*` (secret leak prevention).
- **`.env.example`** — documents all required env vars: `MONGO_DB_NAME`, `MONGO_USER`, `MONGO_PASSWORD`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`.
- **`.github/workflows/ci.yml`** extended — `build-images` job: builds all 3 images with Docker Buildx + GHA layer cache; runs after `ci` job passes (`needs: [ci]`); no registry push yet (extension point documented).

### Backlog tasks emitted (Task 18)

- `2026-06-29-02-dockerfile-build-stage-ignore-scripts.md` — add `--ignore-scripts` to build stage pnpm install in all 3 Dockerfiles.
- `2026-06-29-03-compose-api-healthcheck-wget.md` — replace `wget` healthcheck (not in node:22-alpine) with Node.js inline HTTP check so API service reaches `healthy`.
- `2026-06-29-04-pin-github-actions-sha.md` — pin all GHA action tags to immutable SHA digests.
- `2026-06-29-05-nginx-hsts-header.md` — add HSTS header once TLS termination topology is decided (PARKED).
- `2026-06-29-06-nginx-api-duplicate-security-headers.md` — suppress duplicate security headers on `/api/` proxy responses via `proxy_hide_header`.

### Changed

- **`apps/api/src/app/app.module.ts`** — registered `BaseErrorFilter` and `UnknownErrorFilter` as global exception filters via `APP_FILTER` DI token (from `@nestjs/core`), matching the existing `APP_GUARD` pattern. Both filters are now fully DI-wired and can receive injected dependencies in the future.
- **`apps/api/src/main.ts`** — removed `app.useGlobalFilters(new BaseErrorFilter(), new UnknownErrorFilter())` and the now-unused filter imports; filters are registered through the module providers array instead.

### Backlog tasks emitted

- `2026-06-29-03-filters-migrate-to-pino-logger` — both filters still use `new Logger(FilterName.name)` (NestJS built-in) instead of `@Inject(PINO_LOGGER)`; filter log lines flow through NestJS default formatter rather than the unified pino stream.

### Added

- **`loginGuard: CanActivateFn`** in `libs/identity/data-access` — protects the `/login` route from already-authenticated users: `active` → `/greeting`; `pending`/`rejected` → `/access-status`; 401/unauthenticated → allowed through. Complements the existing `statusGuard` (which guards the opposite direction). Exported from the data-access barrel.
- **Route update** (`apps/web/src/app/app.routes.ts`) — `/login` now has `canActivate: [loginGuard]`.
- **Unit tests** (`login.guard.spec.ts`) — 4 tests covering all three branches (active, pending/rejected, unauthenticated error), using `TestBed.runInInjectionContext` + real `Router` for `UrlTree` assertions.
- **E2E scenario** (`auth-flow.spec.ts`) — active user navigating directly to `/login` is redirected to `/greeting`; verified across Chromium, Firefox, WebKit.

### Backlog tasks emitted

- `2026-06-28-04` — expanded scope to include `login.guard.ts` (bare `'active'`/`'pending'`/`'rejected'` literals should use `UserStatus.*` constants from `shared-contracts`, same as pre-existing issue in `status.guard.ts`).
- `2026-06-28-18` — delete stale `example.spec.ts` Nx scaffold (expects `"Welcome"` h1; app shows login page — has been failing since routes were wired up).

### Added

- **`libs/shared/infrastructure`** — new NX lib (`scope:shared`, `type:infrastructure`, `platform:server`) housing `createPinoLogger` / `PinoLoggerConfig`; path alias `shared-infrastructure` registered in `tsconfig.base.json`. Logger construction is now a shared cross-cutting concern rather than an identity-domain export.
- **`libs/shared/infrastructure/src/lib/pino-logger.spec.ts`** — smoke tests for `createPinoLogger` (6 tests, all pass).

### Changed

- **`libs/identity/infrastructure`** barrel no longer exports `createPinoLogger` / `PinoLoggerConfig`; all logger import sites (`apps/api`, `apps/cli`) updated to `shared-infrastructure`.

### Backlog tasks emitted

- `2026-06-28-08` — Add missing `scope:shared` tag to `libs/shared/util/project.json` (pre-existing omission found during review).

### Added (cont.)

- **`libs/shared/contracts` — `Role` constant and `RoleType` union** (`ADMIN: 'admin'`, `USER: 'user'`): single source of truth for JWT roles claim values; exported via the contracts barrel.
- **Runtime role validation in `JwtTokenIssuer.isTokenClaims()`** — `VALID_ROLES: ReadonlySet<string>` mirrors the compile-time `RoleType` union at decode time; tokens with unknown role values (e.g. `['superadmin']`) now throw `AuthenticationError`, matching the existing `VALID_USER_STATUSES` pattern.

### Changed

- **`TokenClaims.roles`** typed as `readonly RoleType[]` (was `string[]`); all callers (`set-user-status.service.ts`, CLI `user-approve` / `user-reject` commands) updated to use `Role.ADMIN` / `Role.USER` constants.

### Backlog tasks emitted

- `2026-06-28-03` — Replace `status: 'active'` literal in CLI admin caller fixtures with `UserStatus.ACTIVE`.
- `2026-06-28-04` — Replace bare status string comparisons in `status.guard.ts` with `UserStatus.*` constants.
- `2026-06-28-05` — Replace bare status literals in `access-status-page.ts` with `UserStatus.*` constants.
- `2026-06-28-06` — Align `CallerIdentity.roles` type with `RoleType[]` (Nx boundary decision needed).
- `2026-06-28-07` — Forward JWT roles claim into `SessionUser` and `ServiceContext.caller` for future RBAC HTTP guards.

### Added (cont.)

- **`libs/identity/feature-access-status`** — `AccessStatusPageComponent` (standalone, Angular 17+, SCSS) showing distinct pending/rejected messaging driven by `GET /auth/me`; subscription lifecycle managed with `takeUntilDestroyed(destroyRef)`.
- **`libs/identity/feature-greeting`** — `GreetingPageComponent` (standalone) calling `GET /api/hello`; renders personalized greeting with loading/success/error states via discriminated-union signal; `catchError` in pipe keeps error handling declarative.
- **`statusGuard: CanActivateFn`** in `libs/identity/data-access` — cookie-based status routing: 401 → `/login`; `pending`/`rejected` → `/access-status`; `active` → allow. Bidirectional: active user on `/access-status` bounced to `/greeting`.
- **`getHello()` method** on `IdentityService` — `GET /api/hello` with `withCredentials: true`.
- **`apps/web/proxy.conf.json`** — dev-server proxy routing both `/api` and `/auth` to `http://localhost:3000`; wired into `apps/web/project.json` serve target via `proxyConfig`.
- **Route table update** (`apps/web/src/app/app.routes.ts`) — root redirects to `/greeting`; `/access-status` and `/greeting` protected by `statusGuard`; `/login` remains open.
- **Playwright E2E** (`apps/web-e2e/src/auth-flow.spec.ts`) — 5 scenarios × 3 browsers (Chromium/Firefox/WebKit) = 15 tests: unauthenticated redirect, pending redirect, rejected redirect, active greeting, active bounced from access-status. All mocked via `page.route()` — no real session required.
- **Unit tests** — `status.guard.spec.ts` (6/6 branches), `greeting-page.spec.ts` (loading/success/error), `getHello()` in `identity.service.spec.ts`.

### Added

- **`apps/web`** — Angular 17+ standalone app (no NgModules, signals); shell with `AppComponent` + `RouterOutlet`, `app.config.ts` (`provideHttpClient()` + `provideRouter`), lazy `/login` route.
- **`libs/identity/feature-login`** — `LoginPageComponent` (standalone, signals, `platform:web`, `type:feature`) embedding the Telegram Login Widget via dynamic `<script>` injection; handles auth callback query params and delegates to `IdentityService`.
- **`libs/identity/data-access`** — `IdentityService` (`platform:web`, `type:data`) with `withCredentials: true` on all HTTP methods: `submitTelegramLogin`, `getMe`, `logout`; `TELEGRAM_BOT_USERNAME` `InjectionToken<string>` for build-time bot config sourced from `apps/web/src/environments/environment.ts`.
- **SCSS** — All Angular style files in this session use `.scss`; `apps/web` configured for SCSS throughout.

### Added

- **Mandatory pre-flight reads for all agents** — every agent definition now opens with a `## Pre-flight` section. All agents read `docs/KNOWLEDGE_INBOX.md` before acting; technical agents (backend-developer, angular-developer, tester, qa, devops, dba, debugger, refactoring-expert, integration-architect, queue-specialist) additionally read `rules/architecture.md` + `rules/code-style.md` before writing code. `rules/workflow.md` updated with a dispatch note explaining that agents read these from disk, not from inline orchestrator context, so the knowledge reflects the repo's current state.

### Changed

- **Quality gate contract** — reviewer and security-scanner now emit two mandatory sections (`## Fix Now` / `## Emit as Task`) classifying every finding by origin (introduced vs pre-existing). Orchestrator actions are now deterministic: Fix Now triggers fix-retry (max 2, then hard stop); Emit as Task triggers task file creation and gate closure. Bug Fix Pipeline verify resolution rule updated to match. Scope annotations added to each agent's severity-grouped output format to eliminate ambiguity with the new origin-grouped pipeline format.

### Added

- **`apps/api/src/logger/pino-nest-logger.ts`** — NestJS `LoggerService` adapter bridging to a pino root instance. Methods map `log→info`, `error→error`, `warn→warn`, `debug→debug`, `verbose→trace`, `fatal→fatal`. `setLogLevels(levels)` maps NestJS's allowlist model to pino's threshold model.
- **`apps/api/src/logger/pino-nest-logger.spec.ts`** — 19 unit tests covering all five Nest logging methods and `setLogLevels()` level mapping.
- **Backend-only `.js`-extension ESLint gate** — `no-restricted-syntax` rule in `eslint.config.mjs` errors on any relative `import`/`export` statement missing the `.js` extension in `apps/api`, `apps/cli`, and server/shared libs (`libs/**/core`, `libs/**/application`, `libs/**/infrastructure`, `libs/**/kernel`, `libs/**/errors`, `libs/**/contracts`, `libs/**/validation`, `libs/**/util`). Angular's `moduleResolution: bundler` resolves extensionless imports silently, so the rule is intentionally excluded from `apps/web` and `platform:web` libs (`libs/**/feature`, `libs/**/ui`, `libs/**/data`).
- **`libs/shared/kernel`** — Core abstractions for clean architecture: `BaseService<TParams, TResult>` abstract class (request validation via LIVR → authorization → execution → typed result), `ServiceContext<TConfig>` interface for dependency injection (constructed by the interface layer, never reads `process.env`), `IRepository<TEntity, TId>` generic ORM-agnostic repository interface, `registerLivrRules()` bootstrap hook for validation rule registration at application startup, and `ServiceValidationError` extending the existing `ValidationError` from `libs/shared/errors`.
- **Nx linting boundaries** — Fixed ESLint rules to permit `type:infrastructure`, `type:application`, `type:core`, and `type:kernel` to depend on `type:errors` (previously incorrectly closed off). Added `bannedExternalImports` to `type:kernel` (`@nestjs/*`, `@angular/*`, `mongo`, `mongoose`) to enforce framework-freedom at the kernel layer via lint.
- **`livr` runtime dependency** — First backend runtime dependency, added to root `package.json` for validation rule registration and execution in kernel layer.
- **`libs/identity/infrastructure`** — Mongo connection plumbing: `createMongoConnection`/`disconnectMongoConnection`/`pingMongo` built on Mongoose's `createConnection` (independent connections, not the global singleton), config injected via `MongoConnectionConfig` (URI, db name, optional `serverSelectionTimeoutMS`, default 5000ms) — never reads `process.env` in lib code. Also adds a `pino` logger factory (`createPinoLogger`) selecting JSON vs `pino-pretty` output via an injected mode parameter. No domain schema yet — pure plumbing layer.
- **`docker-compose.dev.yml`** — Local `mongo:7` service with a named volume and a `mongosh`-based healthcheck (`mongo:7` ships `mongosh`, not the legacy `mongo` shell) for local/integration testing.
- **`mongoose`, `pino`, `pino-pretty` runtime dependencies** — exact-pinned per repo convention.
- **`libs/identity/application`** — Identity session services layer: `LoginWithTelegramService` (find-or-create pending Telegram user, refresh profile, no JWT for non-active), `ITokenIssuer` interface + `JwtTokenIssuer` implementation (HS256 via `jsonwebtoken@9.0.3`, minimum 32-char secret enforced, `UserStatus` claim enum-validated), `ApproveUserService`/`RejectUserService` (admin-gated status transitions `pending→active`/`pending→rejected`, delegate domain transition rules to entity), shared `SetUserStatusService` base class. Framework-free, 32 unit tests passing.

### Changed

- **`apps/api/src/main.ts`** — Unified logging pipeline: creates pino logger via `createPinoLogger(config)` before app bootstrap, wires `app.useLogger(new PinoNestLogger(pinoLogger))`, passes same pino instance to `pino-http` middleware so all log streams share one configured pipeline. `bufferLogs: true` now correctly paired with `useLogger`.
- **`libs/identity/infrastructure/src/lib/pino-logger.ts`** — Development branch now sets `level: 'debug'` to surface debug-level logs locally.
