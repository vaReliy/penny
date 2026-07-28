# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en-1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed (`libs/budget/infrastructure` — reject non-positive Monobank rates)

- `monobank-currency-client.ts`'s shape guard (`isOptionalFiniteNumber` → renamed `isOptionalPositiveFiniteNumber`) now requires `rateBuy`/`rateSell`/`rateCross` to be strictly positive, not merely finite. A malformed/hostile payload with a zero or negative rate is filtered out silently by the existing `.filter(isRawMonobankRate)` step, same as any other shape-invalid entry — no throw path added, no `rateToBase` string can go negative.
- Emitted from `monobank-fx-integration`'s security-scanner gate (correctness, not exploitable — display-only, string output, no injection/crash path).
- Tests: 2 boundary cases added by `tester` during verify (zero `rateCross`, small-positive-value acceptance) on top of the 4 written with the implementation. Gate: tester → reviewer, 0 cycles, 0 emitted.

### Added (`libs/budget/feature-account` + `libs/budget/ui` — first migrated budget screen)

- **Screen «Рахунок»** — the first migrated budget screen, replacing the `account` route's placeholder. Shows the derived balance from `GET /api/budget/balance`, that balance converted to UAH/USD/EUR from server-cached `GET /api/rates`, a `fetchedAt` staleness indicator, and a refresh action. Behavior parity with `master:src/app/system/page-bill/` minus the three things deliberately not ported: client-side Monobank calls, float `bill.value * rate` math against seed rates, and the artificial loading delay.
- **`libs/budget/ui`** (new Nx lib, `scope:budget`/`type:ui`/`platform:web`) — dumb `BalanceCardComponent`/`RatesCardComponent` (pure `OnPush`, signal `input()`/`output()`, native control flow, no store or HTTP access), plus `convert-balance.util.ts` and `format-money.util.ts`. Conversion is exact `bigint` arithmetic: the decimal-string rate is parsed into a `{numerator, denominator}` fraction by string manipulation so `Number`/`parseFloat` never touches it, with round-half-away-from-zero. `formatMoney`'s only dependency is `Money`, already `type:util`-scoped — it was subsequently relocated to `libs/shared/util` as the single canonical implementation (see task `2026-07-27-07`) rather than kept as a duplicate.
- **`libs/budget/feature-account`** (new Nx lib, `scope:budget`/`type:feature`/`platform:web`) — the smart `AccountPageComponent` composing both cards against signal stores, lazy-loaded under the shell's existing `account` route and inheriting its `statusGuard`. Loading / ready / error / empty states, all strings via the Transloco `budget` scope (uk), mobile-first (`grid-cols-1 md:grid-cols-2`).
- **`RatesStore`** added to `libs/budget/data-access` — task 15 shipped a bare `RatesClient` with no store, unlike every other domain; mirrors `DashboardStore`'s signal shape and `BudgetRequestState.run()` delegation exactly.
- **`eslint.config.mjs` + `apps/web/project.json`** — `apps/web` retagged `scope:identity` → a dedicated composition-root tag `scope:web`, whose `onlyDependOnLibsWithTags` lists every domain the app composes. `@nx/enforce-module-boundaries` ANDs all matching `depConstraints`, so an app carrying two exclusive domain scopes can import from neither; verified no library gained reach and all 8 `identity/*` libs keep their original constraint.
- Route naming settled: routes stay **flat** (`/account`, and `history`/`planner`/`records` for screens 17–19). `budget` is an Nx scope tag — a compile-time dependency boundary — never a URL segment; identity already proves the pattern with flat `/greeting`, `/login`, `/access-status`. The task file's literal `/budget/bill` predates task 04's actual shell and was stale.
- Gate: tester → reviewer → qa, 1 restart cycle. Reviewer's single `## Fix Now`: a failed `refresh()` set `RatesStore.error()` but the template never read it once `ready`, so stale rates rendered with no failure indication; fixed with an inline `role="alert"` beside the still-visible stale data (stale data deliberately not discarded). 2 findings emitted as tasks (`2026-07-27-05` shell-mobile e2e `/api/config` mock, `2026-07-27-06` `convert-balance.util.ts` naming). `security-scanner` not triggered — no auth/validation/secrets/external-input surface.
- Tests: `budget-ui` 23, `budget-feature-account` 5, `budget-data-access` 60, `web` 16, plus 18 Playwright e2e across chromium/firefox/webkit including a 360 px viewport check (no horizontal scroll, cards stack) and a raw-Transloco-key guard. Nx tag enforcement and the refresh-error regression were both confirmed by scratch-violation proof, not assertion.
- **`docs/KNOWLEDGE_INBOX.md`** — five entries: the `scope:<app>` composition-root tag pattern; `type:ui` ⊥ `type:data` duplication-plus-pointer precedent; the bigint-exact FX conversion recipe and its shared-minor-unit-decimals precondition; `HttpTestingController.match()` for concurrent same-URL request testing; and a design note that a binary `loading|error|ready` page `state()` cannot express post-`ready` partial failure — to be raised in task 17's `ba` pass before screens 17–19 each reinvent it.

### Fixed (`.claude/settings.json` — dead permission rules)

- Removed two dead `Write(./.cts/**)`/`Write(./rules/cts/**)` deny entries: Claude Code's permission matcher only gates file-mutating tools via `Edit(path)` rules (which already cover `Write`/`Edit`/`NotebookEdit`), so the `Write(...)` forms were silently never enforced. The paired `Edit(...)` rules already provide the intended protection against hand-editing CTS-owned payload; no behavior change, just removal of no-op config. Logged upstream in `docs/CLAUDE_TS_CHANGELOG.md` (2026-07-27 entry) since the same dead-rule shape can affect any claude-ts consumer.

### Added (`libs/budget/core` — entities, invariants, repository interfaces)

- **`libs/budget/core`** (new Nx lib, tags `scope:budget`/`type:core`/`platform:server`) — first code of the budget vertical slice. Framework-free `Account`, `Category`, `Transaction`, `MonthlyBudget` entities (factory `create()`, `DomainError` invariants, immutable-on-mutation, mirroring `identity`'s `User` pattern) plus `TransactionType` as an `as const` object, field shapes/invariants taken verbatim from ADR-007 (`DECISIONS.md`). Repository interfaces (`IAccountRepository`, `ICategoryRepository`, `ITransactionRepository`, `IMonthlyBudgetRepository`) extend `shared-kernel`'s `IRepository<T,string>`, every finder scoped by `workspaceId`; `ITransactionRepository` includes the `sumAmountsByType`/`sumExpenseByCategory` aggregation signatures the future analytics services need (`bigint` return, per ADR — `Money` construction stays above infrastructure). `eslint.config.mjs` gained the ADR-007-mandated `scope:budget → [scope:budget, scope:shared]` depConstraint (prerequisite before any budget lib could land) and `tsconfig.base.json` gained the `budget-core` path alias.
- Zero framework/ORM imports confirmed via a scratch-violation lint demo (temporarily added a `mongoose` import, confirmed `@nx/enforce-module-boundaries` + `@nx/dependency-checks` both fail, reverted). 38 unit tests, 100% stmt/branch/func/line coverage.
- Gate: tester (independent re-run + coverage-gap audit, no gaps found) / reviewer (cross-checked every entity against ADR-007, confirmed exact match) both passed, 0 Fix Now, 0 Emitted. `security-scanner`/`qa` not triggered (no auth/endpoint/UI surface in this task).
- **`docs/KNOWLEDGE_INBOX.md`** — one new entry: any `type:core`/`type:application` lib that constructs `shared-util`'s `Money` **by value** (not just type position) needs its own `"target": "es2020"` override in `tsconfig.json`, since `shared-util`'s own override isn't inherited transitively through source-consumed path aliases.

### Added (Budget domain model ADR — planning session, no implementation)

- **`DECISIONS.md`** ADR-007 (Budget Domain: Entities, Aggregates, and Scoping) — ratifies the budget vertical's domain model. Four aggregates (`Account`, `Category`, `Transaction`, `MonthlyBudget`), each `workspaceId`-scoped by identity-only reference (compatible with the parked Workspace feature; additive when it ships). Key decisions: **derived balance** (aggregation over transactions — no stored counter, no lost-update race, no CAS, no multi-doc txn; materialized snapshot as the additive scale path); money stored as embedded numeric BSON int64 minor units via Mongoose native `BigInt` (the transport-string form of the `Money` VO is never persisted — it breaks `$sum` aggregation; `Decimal128` fallback; the storage type is verified by a spike at the start of the schema work); **type-agnostic categories** (labels/tags — typing is an additive future extension, not a rework); **soft-archive only** for categories (historical tag preserved; aggregation still counts archived-category spend); transactions **editable + deletable** (cheap under derived balance); dropped the legacy "amount ≤ balance" rule; no state machines; month attribution via a TZ-agnostic pipeline fed an app-layer `Europe/Kyiv` UTC instant range. Records repository interfaces, index expectations, the canonical `libs/budget/*` lib layout (mirroring `identity`'s real `data-access`/`feature-<screen>`/`testing` shape), the prerequisite `scope:budget` ESLint depConstraint the first budget lib needs, a Mermaid class diagram, and `devil`'s sign-off (no blocking objections). Planned via the full T3 team (`ba` + `ddd-architect` + `devil`); three product questions resolved with the owner in one round.
- **`docs/KNOWLEDGE_INBOX.md`** — three in-transit learnings logged (budget lib-naming shape vs the earlier `data`/`feature`/`ui` shorthand; derived-balance `$sum` forcing numeric BSON money storage; the "a new Nx `scope:*` domain needs an explicit depConstraint" fuse gap), each marked for deletion once ADR-007 and the downstream work absorb them.

### Fixed (Inbox distillation: 16 KNOWLEDGE_INBOX entries distilled into 8 rules files + 9 CTS ledger entries + 1 task file)

- **Distillation session** — `docs/KNOWLEDGE_INBOX.md` down from 23 to 7 entries (retained 7 upstream/parked learnings; distilled 16). Net effect: (1) `rules/testing.md` — skip-guard verification + Mongo parallel-isolation pattern (task emitted: `2026-07-15-01-mongo-test-db-parallel-isolation.md`); (2) `rules/workflow.md` — 4 quality-gate/dispatch hardenings (git-diff verification, scratch-violation-proof, idle-report protocol, hand-scaffold audit); (3) `rules/nx-generators.md` — 3 generator hygiene gotchas (hand-scaffold lint-drop, `@nx/vitest` typecheck-target, `includedScripts` placement); (4) `rules/architecture.md` — multi-dimension module-boundary violations; (5) `rules/architecture-backend.md` — CAS-via-optional-param TOCTOU pattern; (6) `rules/dependencies.md` — CI SHA-pinning + metadata-only-manifest patterns; (7) `rules/docker-commands.md` — GH Actions health-cmd quoting + healthcheck-log-cadence notes; (8) `rules/task-authoring.md` — deferred-ADR closing AC requirement. `docs/CLAUDE_TS_CHANGELOG.md` received 9 entries for the 8 edited rules files + 1 for the branch-filter ledger-only finding (route to upstream `devops` skill guidance).
- No substance lost: condensation focused on session-log narrative reduction, keeping all durable lessons and examples.
- Deduplication fix: merged redundant `workflow.md` paragraphs on generator-produced target names, avoiding the same-fact-in-two-places anti-pattern.

### Fixed (Doc hygiene: committed-file self-containment + new starter guide)

- **`rules/nx-generators.md`** — dropped a dangling private decision-ID reference (`D26/D29`) on the `.js`-extension-enforcement note; now points at `DECISIONS.md` ADR-005, the committed record of that decision.
- **`.github/workflows/ci.yml`** — reworded two stale comments: the `smoke-e2e`-deferral comment no longer references a private task filename (the deferral reason itself — wiring CI to boot the full docker-compose stack — still holds and is now stated directly); the `typecheck` scope comment no longer hardcodes a stale project count (16 explicit `typecheck` targets now exist workspace-wide, up from the 5 the comment previously claimed) and instead describes the actual mechanism so it can't go stale the same way again.
- **`CHANGELOG.md`** (this file) — de-referenced entries that pointed at private, git-ignored task files or task IDs (`docs/rebuild/tasks/...`, bare `YYYY-MM-DD-NN` identifiers, "Task 04/18" section headers) while keeping every entry's descriptive prose intact, so the change history reads as a self-contained record for anyone cloning the repo fresh.
- **`DECISIONS.md`** ADR-006 (CSP Nonce Delivery) — updated from "Deferred" to "Accepted and implemented": the nginx `sub_filter`-based per-request nonce pipeline (`apps/web/nginx.conf`, `apps/web/src/app/app.config.ts`) shipped and is verified in the codebase; removed the private task-file reference and described the actual implemented mechanism instead.
- **`README.md`** — corrected a stale claim that no apps existed yet (`apps/api`, `apps/web`, `apps/cli` all exist and are documented with their start commands); added a pointer to the new `docs/SKELETON.md`.
- **`docs/SKELETON.md`** (new) — a self-contained guide for forking this repo as a starter for a new Telegram-auth SaaS: what the chassis provides, how to run it locally, a concrete generator-based checklist for adding a new domain vertical (backend/frontend libs, tags, DI wiring, route registration, tests, boundary verification), a rename/strip checklist for Penny-specific naming, and the intended fork/upstream relationship for future chassis fixes.

### Fixed (Task — Stop-hook chain fails/blocks every agent turn; knowledge-capture nudge scope)

- **`.claude/settings.json`** — removed the two dead `docker compose exec app npx eslint/prettier` Stop-hook commands: no `app` compose service exists (stack is `mongo`/`api`/`web`), and the production images have no dev toolchain and no source bind mount, so in-container `--fix` could never mutate the host tree. Both commands failed on every turn-end (main session + every subagent), paying Docker daemon/compose resolution cost each time — the primary driver of agents appearing to hang without delivering final reports. `knowledge-capture-nudge.sh` is now the sole Stop hook; lint/format enforcement remains in the quality gate + CI.
- **`.claude/hooks/knowledge-capture-nudge.sh`** — nudge is now orchestrator-only: early exit 0 when stdin JSON carries `agent_id`/`agent_type` (subagent/teammate session), in both the jq and grep/sed fallback branches. Subagents surface durable learnings via the `## Learnings` section of their final report instead of being independently blocked once per session (the old per-`session_id` marker never deduped across a multi-agent task).
- **`rules/workflow.md` + `CLAUDE.md`** — new mid-pipeline transcription rule: when a subagent's report contains `## Learnings`, the orchestrator appends the `docs/KNOWLEDGE_INBOX.md` entry immediately upon receipt, before the next dispatch, so later agents' pre-flight inbox reads pick it up; Phase 6 is reframed as the final sweep/verification, not the first write. In-flight parallel teammates still need a `SendMessage` relay for urgent learnings.
- **`.claude/agents/ba.md`, `.claude/agents/ddd-architect.md`** — added the `## Learnings` final-report requirement (previously only the 12 file-touching technical agents had it).
- Gate: tester/reviewer/security-scanner all passed, 0 Fix Now; 1 pre-existing finding emitted as a hardening task and implemented same day (next section).

### Fixed (Task — harden knowledge-capture-nudge.sh input handling)

- **`.claude/hooks/knowledge-capture-nudge.sh`** — three micro-fixes from the previous task's gate findings: (1) `SESSION_ID` is sanitized to `[A-Za-z0-9_-]` before marker-path interpolation, closing a latent path-traversal (`../evil` → `evil`); (2) empty/malformed-parse `SESSION_ID` normalizes to `"unknown"` post-extraction — jq's `// "default"` only applies on successful parses, silently diverging from the grep/sed branch's `|| echo default` on malformed stdin; (3) header comment documents that `agent_id`/`agent_type` presence means "not a plain top-level session" (includes `claude --agent` sessions), the assumption behind the orchestrator-only guard.
- Gate: tester (isolated scratch-repo proof of block path + traversal-payload matrix) / reviewer / security-scanner all passed, 0 Fix Now, 0 emitted; security-scanner explicitly confirmed its prior path-traversal finding CLOSED (marker path is absolute-prefixed, so no leading-`-` argument ambiguity either). Accepted cosmetic residual: jq parse-error noise on stderr for malformed stdin — unreachable via real Claude Code input.

### Fixed (Task — resurrect dead ESLint fuses, lint apps/api and apps/cli)

- **`eslint.config.mjs`** — the `.js`-extension-on-relative-imports gate and the `localStorage` ban were silently dead under `nx lint <project>`: project-local configs spread `baseConfig`, but ESLint resolves the root config's path-anchored `files` globs against each project's own basePath, so globs like `libs/**/core/**/*.ts` never matched a file at `libs/identity/application/src/lib/foo.ts`. Also resurrected the previously-parked `@Injectable` ban (application/core/kernel layers must stay framework-free) via the same mechanism.
- **`project.json`** (new root-level Nx project) + **`tools/lint-root.mjs`** (new) — a `lint:root` target that runs ESLint from the true workspace root (`cwd: {workspaceRoot}`), so the root-anchored globs resolve correctly. Runs alongside per-project `nx lint <project>`, not instead of it.
- **`apps/api/eslint.config.mjs`**, **`apps/cli/eslint.config.mjs`** (new) — `apps/api` and `apps/cli` previously had no ESLint config and no lint target at all; both are now linted (`nx show projects --with-target lint` now includes `api`/`cli`).
- **`.github/workflows/ci.yml`** — added a `pnpm nx lint:root` step so the resurrected path-anchored rules actually run in CI.
- Verified live: scratch violations introduced and reverted for all three rules (including a combined `.js`-extension + `@Injectable` violation in the same file, confirming no same-key `no-restricted-syntax` clobbering across the merged selector arrays).

### Changed (Task — fix TOCTOU races in status transitions and role promotions via CAS)

- **`libs/identity/core/src/lib/user-repository.ts`** — `IUserRepository.updateStatus`/`updateRoles` gain optional `expectedCurrentStatus`/`expectedRoles` params for optimistic-concurrency control.
- **`libs/identity/infrastructure/src/lib/mongo-user-repository.ts`** — `updateStatus`/`updateRoles` add a compare-and-swap filter (`{_id, status: expectedCurrentStatus}` / `{_id, roles: {$eq: expectedRoles}}`) to `findOneAndUpdate` when the expected value is provided; returns `null` on mismatch (CAS failure) instead of silently overwriting. Omitted-param callers (e.g. `apps/cli/src/commands/dev-token.command.ts`) keep prior no-CAS behavior unchanged.
- **`libs/identity/application/src/lib/set-user-status.service.ts`** — captures the current status before transitioning, passes it as the CAS expectation; a `null` (CAS-failure) result now throws `DomainError.conflict()` (409) instead of the prior generic path.
- **`apps/cli/src/commands/admin-promote.command.ts`** — captures the current roles before promoting, passes them as the CAS expectation; a `null` result logs a clear "changed concurrently" error and exits 1 — no automatic retry.
- Fixes: two admins concurrently approving/rejecting the same user, or two concurrent role-promotion attempts, no longer silently overwrite one another with no audit trail — the loser now gets an explicit 409/error instead.

### Backlog tasks emitted (Task — TOCTOU CAS fix)

- None of the touched `@nx/vitest`-based projects (`identity-application`, `identity-infrastructure`, `cli`, likely others workspace-wide) exposed a working nx `typecheck` target, so spec files were never type-checked by any nx target; pre-existing gap, not introduced by this task (since resolved — see the "Added typecheck targets" entry above).

### Added (Task — wire ServiceContext.caller from session for admin approve/reject)

- **`apps/api/src/identity/user-admin.controller.ts`** — `UserAdminController` exposes `POST admin/users/:userId/approve` and `POST admin/users/:userId/reject` endpoints. Wires the authenticated session user into `CallerIdentity` (userId, status, roles) for the first time in an HTTP handler, constructing `ServiceContext { config: {}, caller }` and passing it to `ApproveUserService`/`RejectUserService`. Guarded by `SessionGuard` (authentication) + `ActiveUserGuard` (account status = ACTIVE, defense-in-depth against deactivated accounts with valid tokens). Authorization (role = ADMIN) is delegated to the services' `authorize()` method, not duplicated at the controller layer.
- **`apps/api/src/identity/user-admin.controller.spec.ts`** — 11 unit tests covering deny-on-missing-auth, deny-on-empty-roles, deny-on-non-admin-role, deny-on-non-active-status (both approve and reject), allow-on-admin+active, and 404-on-unknown-user. Uses real `SessionGuard` + real `ActiveUserGuard` in the chain to exercise the actual auth flow, not a mock.

### Changed (Task — wire ServiceContext.caller from session for admin approve/reject)

- **`apps/api/src/auth/auth.module.ts`** — registered `UserAdminController` in the controllers array alongside `AuthController`.

### Added (CSP nonce server-side injection via nginx sub_filter)

- **`apps/web/nginx.conf`** — per-request CSP nonce injection using nginx `$request_id` (128-bit CSPRNG, 32 hex chars): `sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">'` replaces the minified placeholder in `index.html` at request time (Angular's esbuild production build minifies `content=""` → `content`, so the match targets the minified form); `add_header Content-Security-Policy` on the `location /` block emits a full policy with `style-src 'self' 'nonce-$request_id'` and `frame-ancestors 'self'`; `gzip off` co-located to prevent silent sub_filter bypass on compressed responses.
- **`apps/web/src/index.html`** — added `<meta name="csp-nonce" content="">` in `<head>` as the nginx sub_filter injection target for Angular's `CSP_NONCE` token.
- **`apps/web/src/app/app.config.ts`** — root `CSP_NONCE` provider using `useFactory: () => document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content || null` so Angular's `ViewEncapsulation.Emulated` adds the nonce attribute to all dynamically inserted `<style>` elements.
- **`apps/web/src/app/app.config.spec.ts`** — unit tests for the `CSP_NONCE` provider: verifies `useFactory` (not `useValue`), null for absent element, `null` for empty-string content (un-replaced placeholder), correct nonce string for valid content.
- Deferred `upgrade-insecure-requests` CSP directive on both nginx and NestJS CSP policies — parked until an HTTPS/TLS termination topology exists in front of `web`; adding it before TLS is in place would break plain-HTTP local/staging access.

### Changed (CSP nonce server-side injection via nginx sub_filter)

- **`apps/api/src/middleware/csp-policy.ts`** — removed `'unsafe-inline'` from `styleSrc`; NestJS Helmet now emits `style-src 'self'` on API responses, consistent with the nonce-based policy on the HTML document.
- **`apps/api/src/middleware/csp-policy.spec.ts`** — updated regression test: asserts `style-src 'self'` is present and `'unsafe-inline'` is absent, guarding against accidental reintroduction.

### Added (Docker multi-stage + compose + CI image build)

- **`apps/api/Dockerfile`** — multi-stage (deps → build → runtime); non-root `USER node`; production deps only in runtime layer; `--ignore-scripts --no-optional` on prod install to skip husky hook.
- **`apps/cli/Dockerfile`** — same multi-stage pattern as api; no health check (CLI is not a long-running service).
- **`apps/web/Dockerfile`** — Node.js build stage (`npx nx build web`) → `nginx:1.27-alpine` runtime; non-root `USER nginx` on port 8080; copies `dist/apps/web/browser`.
- **`apps/web/nginx.conf`** — SPA routing (`try_files → index.html`), `/api/` reverse proxy to `api:3000`, cache headers per asset type, security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `server_tokens off`) repeated in every location block (nginx add_header inheritance requires this).
- **`docker-compose.yml`** — prod-like stack: `web` (nginx:8080→host:80) + `api` (NestJS:3000) + `mongo` (mongo:7); MongoDB authentication via `MONGO_INITDB_ROOT_USERNAME/PASSWORD`; sequential startup via health check `condition: service_healthy`; isolated bridge network `penny_net`.
- **`.dockerignore`** — excludes `node_modules`, `.nx/cache`, `.angular/cache`, `dist`, `.git`, test files, `.env`/`.env.*` (secret leak prevention).
- **`.env.example`** — documents all required env vars: `MONGO_DB_NAME`, `MONGO_USER`, `MONGO_PASSWORD`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`.
- **`.github/workflows/ci.yml`** extended — `build-images` job: builds all 3 images with Docker Buildx + GHA layer cache; runs after `ci` job passes (`needs: [ci]`); no registry push yet (extension point documented).

### Backlog tasks emitted (Docker multi-stage + compose + CI image build)

- Add `--ignore-scripts` to the build-stage `pnpm install` in all 3 Dockerfiles.
- Replace the `wget` healthcheck (not present in `node:22-alpine`) with a Node.js inline HTTP check so the API service reaches `healthy`.
- Pin all GitHub Actions tags to immutable SHA digests.
- Add an HSTS header once a TLS termination topology is decided (parked).
- Suppress duplicate security headers on `/api/` proxy responses via `proxy_hide_header`.

### Changed

- **`apps/api/src/app/app.module.ts`** — registered `BaseErrorFilter` and `UnknownErrorFilter` as global exception filters via `APP_FILTER` DI token (from `@nestjs/core`), matching the existing `APP_GUARD` pattern. Both filters are now fully DI-wired and can receive injected dependencies in the future.
- **`apps/api/src/main.ts`** — removed `app.useGlobalFilters(new BaseErrorFilter(), new UnknownErrorFilter())` and the now-unused filter imports; filters are registered through the module providers array instead.

### Backlog tasks emitted

- Both filters still use `new Logger(FilterName.name)` (NestJS built-in) instead of `@Inject(PINO_LOGGER)`; filter log lines flow through NestJS's default formatter rather than the unified pino stream.

### Added

- **`loginGuard: CanActivateFn`** in `libs/identity/data-access` — protects the `/login` route from already-authenticated users: `active` → `/greeting`; `pending`/`rejected` → `/access-status`; 401/unauthenticated → allowed through. Complements the existing `statusGuard` (which guards the opposite direction). Exported from the data-access barrel.
- **Route update** (`apps/web/src/app/app.routes.ts`) — `/login` now has `canActivate: [loginGuard]`.
- **Unit tests** (`login.guard.spec.ts`) — 4 tests covering all three branches (active, pending/rejected, unauthenticated error), using `TestBed.runInInjectionContext` + real `Router` for `UrlTree` assertions.
- **E2E scenario** (`auth-flow.spec.ts`) — active user navigating directly to `/login` is redirected to `/greeting`; verified across Chromium, Firefox, WebKit.

### Backlog tasks emitted

- `login.guard.ts` should use `UserStatus.*` constants from `shared-contracts` instead of bare `'active'`/`'pending'`/`'rejected'` literals, same as the pre-existing issue in `status.guard.ts`.
- Delete the stale `example.spec.ts` Nx scaffold (expects a `"Welcome"` h1; the app shows the login page instead — has been failing since routes were wired up).

### Added

- **`libs/shared/infrastructure`** — new NX lib (`scope:shared`, `type:infrastructure`, `platform:server`) housing `createPinoLogger` / `PinoLoggerConfig`; path alias `shared-infrastructure` registered in `tsconfig.base.json`. Logger construction is now a shared cross-cutting concern rather than an identity-domain export.
- **`libs/shared/infrastructure/src/lib/pino-logger.spec.ts`** — smoke tests for `createPinoLogger` (6 tests, all pass).

### Changed

- **`libs/identity/infrastructure`** barrel no longer exports `createPinoLogger` / `PinoLoggerConfig`; all logger import sites (`apps/api`, `apps/cli`) updated to `shared-infrastructure`.

### Backlog tasks emitted

- Add missing `scope:shared` tag to `libs/shared/util/project.json` (pre-existing omission found during review).

### Added (cont.)

- **`libs/shared/contracts` — `Role` constant and `RoleType` union** (`ADMIN: 'admin'`, `USER: 'user'`): single source of truth for JWT roles claim values; exported via the contracts barrel.
- **Runtime role validation in `JwtTokenIssuer.isTokenClaims()`** — `VALID_ROLES: ReadonlySet<string>` mirrors the compile-time `RoleType` union at decode time; tokens with unknown role values (e.g. `['superadmin']`) now throw `AuthenticationError`, matching the existing `VALID_USER_STATUSES` pattern.

### Changed

- **`TokenClaims.roles`** typed as `readonly RoleType[]` (was `string[]`); all callers (`set-user-status.service.ts`, CLI `user-approve` / `user-reject` commands) updated to use `Role.ADMIN` / `Role.USER` constants.

### Backlog tasks emitted

- Replace the `status: 'active'` literal in CLI admin caller fixtures with `UserStatus.ACTIVE`.
- Replace bare status string comparisons in `status.guard.ts` with `UserStatus.*` constants.
- Replace bare status literals in `access-status-page.ts` with `UserStatus.*` constants.
- Align `CallerIdentity.roles` type with `RoleType[]` (Nx boundary decision needed).
- Forward the JWT roles claim into `SessionUser` and `ServiceContext.caller` for future RBAC HTTP guards.

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
