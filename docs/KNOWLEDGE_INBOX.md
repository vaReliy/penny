# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## 2026-07-09 — testing: no repo pattern exercises `@UseGuards(...)` chains via real HTTP dispatch — all guard specs invoke `canActivate` directly against a fake `ExecutionContext`

Why: While verifying the newly added `@UseGuards(SessionGuard, ActiveUserGuard)` on `UserAdminController` (task `2026-07-08-01-wire-request-caller-identity-from-session-user`), a tester agent confirmed the controller's own spec calls `controller.approve(...)`/`controller.reject(...)` methods directly — Nest never reads the `@UseGuards` decorator metadata in that path, so a spec like this cannot, by itself, prove a guard is actually wired into the route. Checked whether any sibling controller does this differently (`hello.controller.spec.ts`, `active-user.guard.spec.ts`): none do — the established repo-wide convention is to unit-test each guard's `canActivate` directly against a hand-built fake `ExecutionContext`, and controller specs mock `@nestjs/common`'s `UseGuards`/`SetMetadata` to no-ops rather than exercising real Nest routing (no `Test.createTestingModule` + supertest, no `NestFactory` + real HTTP). This is an accepted tradeoff so far (keeps specs fast, avoids DI/Mongo bootstrap), but it means a decorator regression (wrong guard, wrong order, guard silently dropped) is invisible to the test suite and only reviewable by manual diff-reading. Worth deciding deliberately (add a thin e2e-style smoke test per guarded controller, or accept the gap) rather than leaving it implicit.
Belongs in (guess): rules/testing.md (NestJS guard/decorator-chain testing section — document the convention explicitly and note the coverage gap it implies)

## 2026-07-09 — architecture: `SetUserStatusService.authorize()` is still the only `context.caller?.roles` check site in the repo — canonical fail-closed pattern for future admin-gated services

Why: Re-confirmed (third time, across `2026-07-07-07-session-guard-roles-and-opaque-errors` and this task) that `!context.caller?.roles.includes(ADMIN_ROLE)` in `libs/identity/application/src/lib/set-user-status.service.ts` is the sole authorization check in the codebase, and it fails closed on `null`/empty `roles` with no `??`/default-true fallback anywhere. `UserAdminController` (`apps/api/src/identity/user-admin.controller.ts`) is the first HTTP call site to actually exercise it, via `caller: { userId: user.id, status: user.status, roles: user.roles }` built straight from `SessionGuard`'s JWT-verified `req.user`. Any future admin-gated service should reuse this exact idiom rather than re-deriving a new role-check pattern.
Belongs in (guess): rules/validation-authorization.md (canonical authorize() fail-closed pattern) — consider promoting out of the inbox once a second consumer exists.

## 2026-07-09 — security: nginx scrubbed log_format must also exclude $http_referer to prevent hash leakage via Referer header

Why: Task `2026-07-07-10-telegram-hash-nginx-logs` mitigated Telegram HMAC `hash` appearing in nginx access logs by using a custom `log_format scrubbed` directive with `$uri` (which strips query strings) instead of `$request_uri`. However, the same `scrubbed` format initially included `"$http_referer"` (captured from the request's `Referer` header). Nginx serves the Angular SPA at `/login?id=...&hash=...` (a same-origin route containing sensitive query params), and `Referrer-Policy: strict-origin-when-cross-origin` causes the browser to send the full originating URL (including the `hash` param) as the `Referer` header on same-origin POST requests (e.g., from `/login` to `/api/auth/telegram`). That request proxies through the `/api/` location in `nginx.conf`, which uses the `scrubbed` access_log — so the Telegram HMAC leaked via the `$http_referer` field despite the query-string scrubbing. Fix: remove `"$http_referer"` from the `log_format scrubbed` directive entirely. Add a comment explaining why. The mitigation is now complete: neither `$uri` (query string stripped) nor `$http_referer` (removed from format) can carry the hash. Verified: nginx -t syntax green, `nx web:lint` green, the token budget for this fix is minimal.
Belongs in (guess): rules/architecture.md (nginx CSP section) | KNOWLEDGE_INBOX (milestone: 2026-07-07-10 task fully secure) | task closed 2026-07-09, $http_referer leakage fixed

## 2026-07-09 — security: Telegram hash mitigation (Option A) — nginx log_format scrubbing via $original_uri (REVISED)

Why: Task `2026-07-07-10-telegram-hash-nginx-logs` implemented the owner's chosen mitigation (Option A): added a custom `log_format scrubbed` directive to `apps/web/nginx.conf` that strips query strings to prevent the Telegram Login Widget's HMAC `hash` param from appearing in nginx access logs. Initial impl used bare `$uri`, which is the URI _after_ internal rewrites — the SPA's `try_files $uri $uri/ /index.html` rewrite caused all client-side routes (`/dashboard`, `/settings`) to log identically as `"GET /index.html HTTP/1.1"`, destroying per-route observability across the whole site. Regression fixed 2026-07-09: replaced bare `$uri` with a server-level `map` directive that evaluates once per request before location matching (and before try_files' internal rewrite can overwrite `$uri`), extracting the original path from `$request_uri` via regex (`~^(?<path>[^?]*).*$ $path;`), capturing everything before the first `?` and storing it in `$original_uri`. This preserves both the security fix (query strings stripped, HMAC `hash` never logged) and per-route visibility (requests to `/dashboard` now log as `"GET /dashboard HTTP/1.1"` instead of the rewritten `/index.html`). Verified: syntax green, empirical test confirms SPA routes log correct paths without query strings, lint green.
Belongs in (guess): PROJECT_CONTEXT (security decisions section) | task closed 2026-07-09, regression fixed 2026-07-09

## 2026-07-08 — eslint/nx: root-config `files` globs anchored on a project's own directory name never match when linted via `nx lint <project>`

Why: Nx runs `eslint .` per project with `cwd` set to that project's own root, and every project has a local `eslint.config.mjs` that spreads the root config array. ESLint flat config resolves every `files` glob — even on objects that originated in the spread root config — against the basePath of the config file it actually loads (the nearest one to cwd), not the repo root. So a root-config rule scoped via e.g. `files: ['libs/*/application/**/*.ts']` can never match when `cwd` IS `libs/identity/application` — that path segment is stripped from every relative path ESLint evaluates (`src/lib/foo.ts`, never `libs/identity/application/src/lib/foo.ts`). `--print-config` run from the repo root against a full path gives a false-positive "rule is configured" reading; the only reliable check is `cd <project-dir> && npx eslint --print-config <file>` and confirming the rule key isn't `null`. Discovered while implementing task `2026-07-07-06-eslint-injectable-ban`: two attempts to fix only the selector syntax failed because the real bug was this basePath issue, not the selector. Fix pattern: export the rule object as a named export from root config, then apply it via `files: ['**/*.ts']` (no path-segment dependency) from inside each affected project's own local `eslint.config.mjs`. Also confirmed a related flat-config gotcha: same-named rule keys (e.g. two `no-restricted-syntax` blocks) do NOT merge across config objects — the last one wins silently, so any future fix to the two other pre-existing path-anchored `no-restricted-syntax` rules in root `eslint.config.mjs` (the `.js`-extension gate, the `localStorage` ban — both likely suffer the identical basePath bug and may be silently non-firing repo-wide today) must merge selector arrays into the same key per project rather than adding a competing block.
Belongs in (guess): rules/code-style.md or a new rules/eslint-flat-config.md section — this is a repo-wide gotcha that will bite again if anyone tries the naive path-anchored-glob approach for a new layer-scoped rule. Also flag the two likely-broken pre-existing rules for a follow-up devops task.

## 2026-07-08 — nx/CI: `testTargetName: vite:test` means CI's `nx affected -t lint,test,build` never runs vitest-plugin-inferred project tests

Why: `nx.json`'s `@nx/vitest` plugin registers the inferred test target as `vite:test`, not `test` (already documented in two earlier entries below re: local command usage). `.github/workflows/ci.yml` runs `pnpm nx affected -t lint,test,build` — since no project defines a `test` target (only `vite:test`), Nx silently skips these projects for that target; there is no error, just an absent task. This means unit tests for every vitest-plugin-inferred project (`identity-core`, `identity-application`, `identity-data-access`, `identity-feature-access-status`, `web`, etc.) — and by extension any `coverage.thresholds` configured in their `vitest.config.mts` — currently never execute in CI, regardless of `coverage.enabled`. Discovered while implementing coverage thresholds (task `2026-07-07-04-coverage-thresholds`); setting `coverage.enabled: true` in the vitest config only guarantees local/manual runs are gated, not CI. Fix needs `ci.yml`'s target list changed to include `vite:test` (e.g. `-t lint,test,vite:test,build`), which is devops-owned CI config, not something a coverage-thresholds task should silently absorb.
Belongs in (guess): rules/docker-commands.md or a new CI task file (devops) — flag for a dedicated task, e.g. extending `2026-07-07-05-ci-e2e-target`'s sibling scope to unit tests.

## 2026-07-08 — testing: `apps/web-e2e/src/auth-flow.spec.ts` mocked `/api/hello` with the wrong response field name (`message` vs `greeting`)

Why: `IdentityService.getHello()` (`libs/identity/data-access/src/lib/identity.service.ts`) types the response as `{ greeting: string; telegramId: string }`, and `GreetingPageComponent` renders `r.greeting`. The e2e spec's three "active user" scenarios mocked the route response as `{ message: 'Hello, ...' }` — a field the component never reads — so `state.message` was always `undefined` and the assertion on the visible text failed on all 3 browsers (9 of 21 e2e tests) even though the underlying app logic and routing guards were correct. This was pre-existing before the `2026-07-07-03-cleanup-batch` task (verified via `git stash` against baseline) and unrelated to any `UserStatus` guard changes made in that task. Fixed by renaming the mocked field to `greeting`. General rule: e2e route mocks must be checked against the actual DTO/response type consumed by the component, not just against the visible assertion text — a field-name typo in a mock silently produces a runtime `undefined` with no compile-time signal (Playwright mocks aren't type-checked against the real API response type).
Belongs in (guess): rules/testing.md (e2e mock/fixture section) — consider whether Playwright route mocks should be built from a shared response-type import to get compile-time safety.

## 2026-07-08 — architecture: `type:feature` Nx libs cannot import `type:contracts` directly; re-export through the `type:data` lib in the same domain

Why: `@nx/enforce-module-boundaries` restricts `type:feature` libs to importing only `type:feature`, `type:ui`, `type:data`, `type:util` — `type:contracts` (e.g. `shared-contracts`, tagged `type:contracts`) is not in that allow-list. Importing `UserStatus` from `shared-contracts` directly in `libs/identity/feature-access-status/.../access-status-page.ts` (a `type:feature` lib) fails lint with `A project tagged with "type:feature" can only depend on libs tagged with "type:feature", "type:ui", "type:data", "type:util"`. Fix: re-export the needed contract from the domain's `type:data` lib (`libs/identity/data-access/src/index.ts` already re-exports `RawTelegramLoginPayload` from `shared-contracts`; added `export { UserStatus } from 'shared-contracts';` alongside it) and have the feature lib import from `identity-data-access` instead. This keeps contracts flowing through the architectural boundary the tags encode, rather than reaching past the data-access layer.
Belongs in (guess): rules/architecture.md or rules/architecture-angular.md (NX boundary tags section)

## 2026-07-08 — docker: `wget`/`localhost` in Alpine healthchecks can fail on IPv4-only nginx due to IPv6-first resolution

Why: `penny-web`'s Dockerfile/compose healthcheck used `wget --spider http://localhost:8080/health`. Inside the Alpine container, `wget` resolved `localhost` to `[::1]` (IPv6) first, but nginx only bound to `0.0.0.0:8080` (IPv4), so the probe got connection-refused and the container stayed `unhealthy` even though the app itself worked fine and `/health` returned 200 via `curl` or `127.0.0.1`. Fix: switch container healthchecks from `wget` to `curl -sf`, which resolves `localhost` correctly across IPv4/IPv6 in this image; also worth bumping `start_period` a bit (5s → 10s) for margin. General rule: never assume `wget --spider http://localhost:PORT/...` is a safe healthcheck primitive on Alpine-based images — verify against `127.0.0.1` or switch to `curl`. Confirmed `nginx:1.27-alpine` ships `curl` at `/usr/bin/curl` by default (alongside busybox `wget`), so switching needs no extra `apk add` layer. Root mechanism: BusyBox `wget --spider` doesn't fall back across multiple resolved addresses (no happy-eyeballs), while `curl` does — any other service healthchecking `localhost` on an IPv4-only bind is exposed to the same gotcha (e.g. worth double-checking `api`'s healthcheck too).
Belongs in (guess): rules/docker-commands.md (healthcheck section)

## 2026-06-30 — cli: inline `process.env` secret reads must own full validation (presence + entropy floor)

Why: CLI commands that read secrets inline (instead of through the NestJS Config service) bypass the Config service's validation. A falsy-only check (`if (!secret)`) passes single-char values that produce structurally valid but cryptographically weak tokens. Pattern: after the presence check, assert minimum length (32 chars for HMAC-SHA256 secrets) before constructing any cryptographic primitive. The production-mode guard limits blast radius but does not substitute for entropy validation because the same `JWT_SECRET` is shared with the API server.
Belongs in (guess): rules/code-style-backend.md (CLI/secret-read section)

## 2026-06-30 — typescript: `import type` does NOT re-export through `export *`

Why: When an interface is moved from being declared inline in module A to being `import type`-d from module B, `export * from './module-a.js'` no longer carries that symbol — `export *` only propagates declared/exported members, not type-imported ones. Downstream consumers that imported the symbol from module A get a compile-time "has no exported member" error. Checklist for type-lift refactors: after replacing an inline declaration with `import type`, grep every file that imported the symbol from the original module and update them to the authoritative source.
Belongs in (guess): rules/code-style.md (import hygiene section)

## 2026-06-29 — nestjs: APP_FILTER selection is specificity-based, not registration-order-based

Why: When multiple `APP_FILTER` providers are registered, NestJS matches the thrown exception type against each filter's `@Catch()` decorator arguments and invokes the most specific match — not the last-declared one. Registration order only matters when two filters have equal specificity (e.g., two `@Catch()` catch-alls). A specific `@Catch(BaseError)` filter always wins over a `@Catch()` catch-all regardless of which appears first in the providers array. This is counterintuitive to developers who assume reverse-order stack semantics (like middleware or pipes).
Belongs in (guess): rules/code-style-backend.md

## 2026-06-29 — testing: assert pino (obj, msg) both args in exception filter specs; hoist mockLogger to describe scope

Why: When testing NestJS exception filters that use pino, assert both arguments of the pino call — `logger.warn({ statusCode }, '[CODE] message')` — not just that the logger was called. pino's structured-first signature `(obj, msg)` is opposite to winston/console `(msg, meta)`, so a single-arg assertion (`toHaveBeenCalled()`) won't catch a metadata-less call. Also: `mockLogger` must be declared as `let` at the `describe` scope; a `const` inside `beforeEach` is inaccessible to `it` blocks.
Belongs in (guess): rules/testing.md

## 2026-06-29 — skills: renaming a Claude Code skill requires four touch-points

Why: The dispatch system routes `/skill-name` via the `name:` frontmatter field, not the directory name. A rename that only moves the directory leaves the old name active. Full rename checklist: (1) rename directory, (2) update `name:` in SKILL.md frontmatter, (3) update `triggers:` list (remove old name trigger if present), (4) grep for self-references in the skill body and update prose. Also update any AGENTS.md skill tables and CLAUDE_TS_CHANGELOG.md.
Belongs in (guess): claude-ts-upstream

## 2026-06-28 — angular: CanActivateFn with zero explicit parameters avoids unused-variable lint noise

Why: `@typescript-eslint/no-unused-vars` is configured with `args: "after-used"` (Nx default). In a `CanActivateFn`, when neither `route` nor `state` is needed, declaring underscore-prefixed params (`_route`, `_state`) still triggers warnings. TypeScript structural typing allows a narrower signature — declaring `(): Observable<boolean | UrlTree> => { ... }` with no parameters satisfies `CanActivateFn` because the router call site passes the arguments at runtime regardless. Only add `state` (or `route`) to the signature when actually consumed; omit both when not needed.
Belongs in (guess): rules/code-style-angular.md

## 2026-06-28 — agents: rules/architecture.md scope is app-layer Clean Architecture only — not applicable to devops

Why: When adding pre-flight reads to all technical agents, devops was given `rules/architecture.md` alongside `rules/code-style.md`. The reviewer correctly flagged this: `rules/architecture.md` covers UseCases, Services, Repositories, DTOs — Clean Architecture application concerns. Devops writes Dockerfiles, CI YAML, env config, shell scripts — none of which reference those layers. The read is inert but wastes tokens (haiku model). Rule: `rules/architecture.md` pre-flight applies only to agents that write application code; agents whose output is purely infrastructure config should skip it.
Belongs in (guess): rules/workflow.md (pre-flight obligation note) | agent definitions (devops pre-flight)

## 2026-06-25 — code review: flag history-flavored words in doc comments

Why: a comment that says "no longer does X" / "now does Y" / "used to be Z" describes the diff that produced the current code, not the current invariant — it reads fine right after the change but rots the moment the next change lands, since nobody remembers to revisit prose. Comments should state the present-tense rule/contract ("does not do X; callers must do Y"), never the change history (that belongs in the commit message/PR description).
Belongs in (guess): rule (rules/code-style.md, as a review checklist item) or reviewer agent instructions

## 2026-06-26 — identity: LIVR optional `['string']` rule passes null through; `!== undefined` filter does not catch it

Why: LIVR treats `null` input on an optional field as "not provided" (skips rule execution) but does not strip the key from the validated output — `validParams` still carries `{ username: null }`. Filtering with `value !== undefined` misses it. In `buildDataCheckString` this produces `username=null` in the HMAC string; Telegram's server omits the key entirely → HMAC mismatch → `AuthenticationError`. Fails closed (no bypass), but misleading error. Telegram's widget never sends `null` for absent fields so the practical risk is negligible today. If a stricter guard is wanted: `value !== undefined && value !== null`, or add a `not_empty` LIVR rule to the optional field slots.
Belongs in (guess): rules/validation-authorization.md or PROJECT_CONTEXT

## 2026-06-26 — workflow: pipeline re-entry point after a fix determines which agents to run

Why: When a fix is needed after the quality gate, the orchestrator must re-enter the pipeline at the right stage — not just patch inline and skip downstream steps. Rule: (1) trivial change (comment, doc-only) → orchestrator handles directly, no downstream needed; (2) source logic change → re-enter at `backend-developer` → `tester` → `reviewer` + `security-scanner` → user review; (3) test-only change → re-enter at `tester` → `reviewer` + `security-scanner` → user review. Writing tests directly and then running reviewer/security-scanner is half-right — the gate ran but `tester` was bypassed as the authoring agent, which undermines independent authorship and review separation.
Belongs in (guess): rules/workflow.md (quality gate / fix-retry section)

## 2026-06-27 — nx: every lib that directly imports a shared lib needs its own package.json entry

Why: When `shared-contracts` became the authoritative `UserStatus` source, the implementer added `"shared-contracts": "0.0.1"` to `identity-core/package.json` but missed `identity-infrastructure/package.json`, which also has direct imports (`user.model.ts`, `user.mapper.ts`). `@nx/dependency-checks` catches this as a hard lint error. Rule: after adding a new intra-monorepo import path alias to any lib, check that lib's `package.json#dependencies` — not just the most obvious consumer.
Belongs in (guess): rules/dependencies.md | AGENTS.md checklist

## 2026-06-27 — typescript: bare `export { X }` re-exports both value and type when X is a declaration merge

Why: In `identity-core/src/lib/user-status.ts`, `export { UserStatus } from 'shared-contracts'` covers both the const object (value namespace) and the `UserStatus` type alias (type namespace) in a single statement — no `export type { UserStatus }` needed alongside it. This works because the source file has a declaration merge (const + same-name type alias). Callers can use both `UserStatus.ACTIVE` (value) and `status: UserStatus` (type) from one import binding.
Belongs in (guess): rules/code-style.md (re-exports section)

## 2026-06-28 — pnpm monorepo: nest-commander (and workspace-root-only deps) require `-w` flag

Why: In a pnpm monorepo with `node-linker=hoisted`, `pnpm add <pkg> --save-exact` without `-w` is rejected because there is no `package.json` in the app subfolder — all deps live at the workspace root. Always use `pnpm add <pkg> --save-exact -w` when adding shared or app deps in this repo.
Belongs in (guess): rules/dependencies.md

## 2026-06-28 — nx: @nx/angular:lib generator silently ignores positional arg when --directory is absent

Why: Running `nx g @nx/angular:lib identity/feature-access-status` (positional) strips the `libs/` prefix and places the lib in the wrong location. Always pair `--name=<project-name>` with `--directory=libs/<path>` explicitly. The generator confirms the resolved root in its output — verify it matches the intended path before proceeding.
Belongs in (guess): rules/nx-generators.md

## 2026-06-28 — nx: new Angular libs must be scaffolded via nx g, never created manually

Why: Manual lib creation (project.json, tsconfig files, eslint.config.mjs, vite.config.mts written by hand) does not register the project in the NX workspace graph, omits the tsconfig inheritance chain, and produces targets whose executors may not match the rest of the repo. The result builds locally but never appears in `nx affected` and may silently misconfigure lint/test runners. Always use `nx g @nx/angular:lib <path> --tags=… --style=scss --standalone --no-interactive`, then audit for caret/tilde ranges and verify the strict TS block per rules/nx-generators.md.
Belongs in (guess): rules/nx-generators.md | CLAUDE.md (orchestrator guidance for angular-developer dispatch)

## 2026-06-28 — nx: manually created JS libs (non-Angular) are auto-detected via project.json — no registry update needed

Why: When `nx g @nx/js:lib` was skipped in favour of hand-crafting `project.json` + tsconfigs (e.g., for `shared-infrastructure`), the NX workspace graph still auto-detects the project. Unlike Angular libs (which must use `nx g @nx/angular:lib`), plain TypeScript libs that follow the existing `shared-kernel`/`shared-contracts` structure can be safely created manually without breaking `nx affected` or graph inference. However, Angular libs must always use the generator (see earlier inbox entry).
Belongs in (guess): rules/nx-generators.md (manual lib creation note for JS/TS-only libs)

## 2026-06-28 — security: `timingSafeEqual` pre-check must compare Buffer byte lengths, not string `.length`

Why: `string.length` counts Unicode code points; `Buffer.from(str).length` counts UTF-8 bytes. A crafted header with 32 two-byte chars (`'ä'.repeat(32)`) has `.length === 32` matching a 64-char hex cookie token, but `Buffer.from(...).length === 64` — `timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` (→ 500) instead of returning `false` (→ 403). Pattern: always create both Buffers first, then compare `.byteLength` before calling `timingSafeEqual`.
Belongs in (guess): rules/code-style-backend.md (security patterns section)

## 2026-06-28 — security: cookie-pair invariant — every setter path must have a matching clearer path

Why: `auth.controller.ts` sets both `AUTH_COOKIE_NAME` (httpOnly) and `XSRF_COOKIE_NAME` (readable) on login. Initial impl only cleared `AUTH_COOKIE_NAME` in `logout()` and `SessionGuard` invalidation branches — leaving a stale, 1-hour-lived XSRF cookie after logout/expiry. Rule: when two cookies are always issued together, audit every `clearCookie` call site (logout handler, session guard error branches) to confirm both are cleared. Add as a checklist item whenever a second cookie joins an existing auth pair.
Belongs in (guess): rules/code-style-backend.md (cookie/auth section)

## 2026-06-28 — nestjs: global guards that use Reflector must use APP_GUARD, not `app.useGlobalGuards(new Guard())`

Why: `app.useGlobalGuards(new CsrfGuard())` instantiates the guard outside the NestJS DI container. `Reflector` cannot be injected into it, so `getAllAndOverride()` (needed to read `@SetMetadata` / `@SkipCsrf()` decorator metadata) is unavailable. Fix: register via `{ provide: APP_GUARD, useClass: CsrfGuard }` in a module's `providers` array — this resolves the guard through DI so `Reflector` is injected normally.
Belongs in (guess): rules/architecture-backend.md (NestJS guard patterns)

## 2026-06-28 — testing: `vi.mock('@nestjs/common')` in controller specs must stub `SetMetadata`

Why: Adding a `@SkipCsrf()` decorator (which calls `SetMetadata` internally) to a controller causes the controller's spec to crash at import time if `@nestjs/common` is mocked without `SetMetadata`. The stub must include `SetMetadata: vi.fn().mockReturnValue(() => undefined)`. Pattern: any NestJS spec that mocks `@nestjs/common` needs `SetMetadata` in the factory whenever any decorator in the import chain calls it at module-load time.
Belongs in (guess): rules/testing.md (NestJS mock patterns)

## 2026-06-29 — security: CSP `form-action` does not inherit from `default-src`

Why: Unlike most fetch directives, `form-action` is not covered by `default-src` fallback per CSP Level 2 spec. Omitting it leaves form submission unconstrained even when `default-src 'self'` is set. Always add `form-action: ["'self'"]` explicitly to any Helmet `contentSecurityPolicy` config.
Belongs in (guess): rules/code-style-backend.md (CSP/Helmet section)

## 2026-06-29 — testing: Helmet `contentSecurityPolicy` middleware is testable against raw `node:http` — no Express or NestJS needed

Why: `helmet` exports `contentSecurityPolicy` as a standalone middleware typed as `(req: IncomingMessage, res: ServerResponse, next) => void`. Using a raw `http.createServer` with `server.listen(0)` (ephemeral port) avoids both the pnpm Express hoisting issue (Express not at workspace root) and the esbuild `emitDecoratorMetadata` limitation for NestJS decorators in Vitest. Pattern: `beforeAll` starts the server, `afterAll` closes it, `res.resume()` drains the response before reading headers.
Belongs in (guess): rules/testing.md (NestJS integration test patterns)

## 2026-06-29 — security: Angular apps require `style-src 'unsafe-inline'`; removal requires per-request nonces wired into Angular templates

Why: Angular's default `ViewEncapsulation.Emulated` inserts `<style>` blocks at runtime (e.g., Angular Material, component styles in SSR, and some lazy-loaded chunks). Removing `'unsafe-inline'` from `style-src` breaks these at runtime. Proper replacement is `'nonce-{generated-nonce}'` — requires Helmet's `nonce` option and the Angular build pipeline to inject the nonce into every generated `<style>` tag. This is non-trivial scope; track as a separate task rather than bundling into a CSP hardening task.
Belongs in (guess): PROJECT_CONTEXT (security roadmap note)

## 2026-06-29 — pino: pino logger API uses `(obj, msg)` order — opposite of NestJS Logger `(msg, context)`

Why: `pino.Logger.warn/error` signatures put the structured-context object first and the human-readable message string second: `logger.warn({ statusCode }, '[CODE] message')`. NestJS built-in `Logger.warn` is the reverse: `logger.warn('message', context)`. Migrating from `new Logger()` to injected pino requires swapping call-site argument order at every `warn`/`error` call — TypeScript surfaces this as TS2769 overload mismatch, so it's caught at compile time.
Belongs in (guess): rules/code-style-backend.md (logging section)

## 2026-06-29 — angular: CSP nonce DI token is `CSP_NONCE`, not `NgCspNonce`

Why: `NgCspNonce` is Angular's internal directive class, not a public export. `@angular/core` exports `CSP_NONCE` as the injection token for providing the per-request nonce to the bootstrap injector. Using `NgCspNonce` in an import causes TS2724. Always import `CSP_NONCE` from `@angular/core`; `NgCspNonce` only appears in Angular's internal source and Angular docs sometimes conflate the two names.
Belongs in (guess): rules/code-style-angular.md (CSP nonce / bootstrap providers section)

## 2026-06-29 — security: do not expose CSP nonce in a custom response header

Why: Emitting the per-request nonce as `X-CSP-Nonce: <value>` on API JSON responses violates OWASP CSP nonce confidentiality. Same-origin JavaScript can read this header from any `fetch()` response. If the nonce ever protects `script-src`, an attacker with any XSS entry point can extract it and self-inject a whitelisted script. Deliver the nonce exclusively via server-side HTML template injection (`<meta name="csp-nonce">`), never via a custom header.
Belongs in (guess): rules/code-style-backend.md (CSP/Helmet section)

## 2026-06-29 — security: per-request CSP style-nonce delivery is serving-topology-dependent

Why: A static `index.html` has a fixed `<meta name="csp-nonce" content="">`. In an architecture where a separate file server (Nx dev server or nginx static) serves the HTML, NestJS middleware can generate nonces but they never reach the `<meta>` tag — Angular bootstraps with `CSP_NONCE = ""`. The full nonce pipeline requires exactly one service to: (1) generate the nonce, (2) set the `Content-Security-Policy` header on the HTML response, and (3) inject the nonce into `<meta name="csp-nonce" content="…">` — all in the same request. Options are topology-dependent: nginx static → `sub_filter`; NestJS serves HTML → `ServeStaticModule` intercept. Decide the option only once the compose topology is locked (Task 18). Until then, `'unsafe-inline'` in `style-src` is the intentional, documented skeleton-phase tradeoff.
Belongs in (guess): PROJECT_CONTEXT (security roadmap) | DECISIONS.md (CSP nonce ADR, Task 19.2)

## 2026-06-29 — roadmap: bones-before-muscles ordering — don't harden an undecided seam

Why: Depth-first security hardening (per-request CSP nonces) on a skeleton whose serving topology is undecided produced a half-wired feature that was worse than both states: it removed `'unsafe-inline'` but Angular never received the nonce, so styles would break in a non-trivial app. Rule: if an implementation option depends on an upstream architectural decision (who serves the HTML, which DB, which transport), defer the implementation until that decision is concrete. The CSP nonce task is the canonical case — reverting it was cheaper than implementing Option A (NestJS-serves HTML) speculatively, which Task 18 might invalidate. Parked-task convention encodes this: record the option analysis in the task file, park it with `Depends on` Task 18, pick the option after topology is locked.
Belongs in: rules/workflow.md (roadmap rule section, Task 2026-06-29-05) | PROJECT_CONTEXT

## 2026-06-29 — nginx: add_header in child location blocks replaces parent server-block headers entirely

Why: Nginx's `add_header` inheritance is replacement, not merging. Any `location` block with even one `add_header` directive silently discards ALL `add_header` directives from the parent `server {}` block. In practice, security headers set at the `server` level (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) are absent from every response served by location blocks that set cache headers. The only fix with standard nginx-alpine is to repeat every security header inside each `location` block that uses `add_header`. The `headers_more` module (`more_set_headers`) would allow true merging but requires a non-standard nginx build.
Belongs in (guess): rules/docker-commands.md (nginx patterns section)

## 2026-06-29 — docker: pnpm production install in Dockerfile requires --ignore-scripts --no-optional

Why: `pnpm install --prod --frozen-lockfile` in a Docker layer fails because husky's `prepare` postinstall hook requires a `.git` directory, which is excluded by `.dockerignore`. Adding `--ignore-scripts` skips all lifecycle scripts (including husky) and `--no-optional` drops platform-optional deps, keeping the prod layer lean. Without these flags the build step errors at "script not found: prepare".
Belongs in (guess): rules/docker-commands.md | PROJECT_CONTEXT (Dockerfile conventions)

## 2026-06-29 — angular: Angular 17+ build output lives at dist/apps/web/browser, not dist/apps/web

Why: Angular 17 introduced a nested `browser/` subdirectory inside the app dist folder (for future SSR/SSG parity). Nginx Dockerfiles that `COPY` from `dist/apps/web` instead of `dist/apps/web/browser` serve an empty or broken site — the HTML/JS/CSS files are one level deeper than expected. Always verify the Angular output path via `npx nx build web --skip-nx-cache` before writing the Dockerfile `COPY` step.
Belongs in (guess): rules/architecture-angular.md | Dockerfile conventions

## 2026-06-29 — topology: serving topology locked — Nginx/web serves HTML at :80, NestJS/api serves at :3000

Why: Task 18 (docker-compose.yml) fixed the prod serving topology: `web` (Nginx) serves static Angular SPA at port 80 and reverse-proxies `/api/` → `api:3000`; `api` (NestJS) never serves HTML. This resolves the CSP nonce delivery option: the nonce pipeline must use `nginx sub_filter` to inject the nonce into the static `index.html` — NestJS middleware cannot intercept the Nginx HTML response. The previously-parked Task 19.2 (CSP nonce) should now adopt the `sub_filter` path.
Belongs in (guess): PROJECT_CONTEXT (serving topology section) | DECISIONS.md (topology ADR)

## 2026-06-28 — cli: slim CliConfig pattern for apps that share IdentityModule but don't need JWT/Telegram vars

Why: CLI apps that call `ApproveUserService`/`RejectUserService` only need `MONGO_URI` and `MONGO_DB_NAME`. Creating a separate `loadCliConfig()` that validates only those vars (while using the same `API_CONFIG` symbol token) lets the CLI reuse `CliIdentityModule` without requiring unrelated secrets. Each NestJS app has its own DI container so symbol identity is per-app, not global.
Belongs in (guess): PROJECT_CONTEXT (cli app architecture notes)

## 2026-06-29 — nginx: proxy_pass to named upstream vs. bare host:port

Why: In `nginx.conf`, `proxy_pass http://api;` resolves through the `upstream api { server api:3000; }` block — not directly to `api:3000`. The distinction matters when documenting or extending the config: developers looking for the backend port should look in the upstream block, not the `proxy_pass` directive. Diagrams that show `proxy_pass http://api:3000` are technically equivalent but will confuse readers opening the real config.
Belongs in (guess): rules/architecture.md (nginx topology notes)

## 2026-06-29 — Angular production build minifies content="" → content (breaks nginx sub_filter)

Why: Angular's esbuild production bundler applies HTML5 boolean-attribute minification: `<meta name="csp-nonce" content="">` becomes `<meta name="csp-nonce" content>` in the dist output. nginx `sub_filter` does byte-level matching, so a pattern targeting `content=""` silently never fires — the CSP header carries a nonce but the meta tag stays empty, Angular bootstraps with `null` nonce, and all component styles are blocked by CSP with no error message. Fix: match the minified form `name="csp-nonce" content>` and restore the closing `>` in the replacement: `sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">';`. This applies to any nginx sub_filter targeting an empty HTML attribute value.
Belongs in (guess): rules/architecture.md (nginx/CSP section) or PROJECT_CONTEXT

## 2026-06-29 — CSP nonce injection pattern (Option B): nginx sub_filter + $request_id

Why: When nginx serves `index.html` (not NestJS), the only way to deliver a per-request nonce to Angular is via nginx `sub_filter`: set `$nonce $request_id;`, replace the empty `content=""` attribute in `<meta name="csp-nonce">`, and emit `Content-Security-Policy` header with `'nonce-$nonce'` in `style-src`. Standard nginx (no OpenResty) supports this via the `ngx_http_sub_module` (included in the official Docker image). Critical gotcha: `sub_filter` requires `gzip off` (or `gzip_static on` with pre-compressed files) in the same location block — dynamic gzip compresses the body before the sub_filter can match, silently producing no substitution with no error.
Belongs in (guess): rules/architecture.md (CSP/nginx section) or PROJECT_CONTEXT

## 2026-06-29 — Nx web app test target is vite:test not test

Why: The `@nx/vitest` plugin in `nx.json` registers the test target as `"testTargetName": "vite:test"`. Running `npx nx test web` exits with "Cannot find configuration for task web:test". The correct command is `npx nx vite:test web`. This affects every agent that tests frontend code.
Belongs in (guess): rules/workflow.md (Command Execution Policy table — add `web` row with `vite:test`)

## 2026-06-29 — docker: tslib must be in dependencies (not devDependencies) when importHelpers: true

Why: `tsconfig.base.json` sets `importHelpers: true`, which makes the compiled bundle emit `require('tslib')` calls at runtime. The multi-stage Dockerfile installs prod-only deps (`pnpm install --prod`) in the deps stage and copies those into the runtime image — so any package in `devDependencies` is absent. Moving `tslib` to `dependencies` is the fix; do NOT change the Dockerfile to copy `node_modules` from the build stage (that drags in all dev tools, bloating the image).
Belongs in (guess): rules/docker-commands.md (prod image section)

## 2026-06-29 — mcp: docker-based MCP servers need --name to avoid random container names

Why: When Claude Code runs an MCP server via `docker run` without `--name`, Docker generates a random adjective+scientist name (e.g., `strange_goldstine`). Add `"--name", "github-mcp-server"` to the args array in `.mcp.json`. Note: `--name` prevents two simultaneous instances of the same MCP server, which is fine since Claude Code starts one per session.
Belongs in (guess): PROJECT_CONTEXT (dev environment conventions)

## 2026-06-30 — security: `'unsafe-hashes'` in `style-src` extends hash matching to `style=""` attributes

Why: Without `'unsafe-hashes'`, SHA hashes in `style-src` only match inline `<style>` block content. Adding `'unsafe-hashes'` extends them to `style=""` element attributes — including a hash of the empty string (`sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`), which is trivially reachable by any injected element. Pattern: never add `'unsafe-hashes'` to `style-src` without auditing whether the nonce pipeline can cover the same cases instead.
Belongs in (guess): rules/code-style-backend.md (CSP section)

## 2026-06-30 — angular: gitignored environment files require README setup instructions and a build-time guard

Why: Angular `project.json` `fileReplacements` creates a hard dependency on `environment.ts` and `environment.development.ts`. When both are gitignored (correct for secrets), a fresh `git clone` + `nx serve` fails immediately because the file-replacement source/target are missing. The fix is two-part: (1) document the copy step from `environment.example.ts` in `README.md`; (2) optionally add a `postinstall` check that prints a human-readable error when the files are absent.
Belongs in (guess): README.md (already a Fix Now item) | rules/dependencies.md (onboarding checklist note)

## 2026-06-30 — security: Telegram `data-auth-url` redirect mode exposes HMAC hash in nginx access logs

Why: The redirect-mode widget appends all Telegram params (`id`, `auth_date`, `hash`, etc.) as URL query parameters. Nginx logs the full URL by default, so the HMAC `hash` appears in access logs. An attacker with log read access can replay the payload within the 24-hour `auth_date` window. Mitigation options: (a) switch to callback mode (`data-onauth` with CSP `'unsafe-eval'` exemption, or postMessage), (b) configure nginx `log_format` to strip the `hash` param, (c) accept the risk given the 24-hour window and the fact that the widget already exposes the URL in browser history.
Belongs in (guess): PROJECT_CONTEXT (security roadmap) | task: tasks/2026-06-30-telegram-hash-in-nginx-logs.md

## 2026-06-30 — docker: compose api healthcheck needs Node.js HTTP + full path with global prefix

Why: In `docker-compose.yml`, the api service healthcheck must use Node.js inline HTTP (not `wget` — not available in `node:22-alpine`) AND must hit the correct path. When `app.setGlobalPrefix('api')` is set in `main.ts`, the health endpoint is `/api/health`, not `/health`. Using the wrong path causes the healthcheck to always return non-200, `api` never reaches `healthy`, and any service with `depends_on: api: condition: service_healthy` cannot start.
Correct form: `node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"`
Belongs in (guess): rules/docker-commands.md (compose healthcheck section)

## 2026-06-30 — identity: User.props is private — use public getters to construct mutated copies

Why: When building a status-overridden User in dev commands (bypassing `transitionTo()`), `new User({ ...user.props, status: targetStatus })` fails at compile time — `props` is `private readonly`. The correct pattern is `new User({ id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, ... , status: targetStatus, updatedAt: new Date() })` using all public getters. If this spread-with-override pattern recurs, consider adding a `toProps(): UserProps` accessor or `User.withStatus(status): User` factory to the entity.
Belongs in (guess): PROJECT_CONTEXT (identity domain patterns)

## 2026-06-30 — nx: `nx build cli` false-green on broken spec fakes

Why: The CLI build target uses webpack and does NOT type-check `.spec.ts` files. When `findByUsername` was added to `IUserRepository`, existing `FakeUserRepository` mocks became TS2420 errors — but `nx build cli` exited 0 with no warning. Type errors in test files are only caught by `nx test cli` (vitest, which runs tsc over specs). Rule: always run `nx test <project>` (not just `nx build`) in the quality gate — build green alone is not a type-safety guarantee for test code.
Belongs in (guess): rules/workflow.md (Command Execution Policy / handoff checklist)

## 2026-06-30 — Angular CSP_NONCE provider: useFactory not useValue

Why: `CSP_NONCE` must be provided via `useFactory` (not `useValue`) in `bootstrapApplication`. `useValue` is evaluated eagerly at module definition time, before the DOM is guaranteed to be ready in any non-browser rendering path. `useFactory` is lazy — evaluated during DI resolution — so `document.querySelector('meta[name="csp-nonce"]')` is always called after DOM parsing completes.
Belongs in (guess): rules/code-style-angular.md

## 2026-07-01 — cts-contribute: `.claude/settings.json` can reference hook scripts that were never added to `cts-payload.txt`

Why: `.claude/settings.json` (a payload file) referenced `.claude/hooks/knowledge-capture-nudge.sh` via a Stop hook command, but `.claude/hooks/` was never listed in `cts-payload.txt` — so a fresh `/cts-setup` or `/cts-update` in any consumer would sync a `settings.json` pointing at a script that doesn't exist locally. The gap only surfaced during a `/cts-contribute` session while diffing payload files against CTS; `cts-sync.sh` has no validation step that cross-checks `settings.json` hook commands against the payload manifest. General rule: whenever a payload file is extended to reference a new script/asset path, immediately add that path to `cts-payload.txt` in the same change — don't rely on noticing the gap later.
Belongs in (guess): claude-ts-upstream (rules/workflow.md or a cts-rule-auditor check: "every hook `command` path in .claude/settings.json must resolve to a path listed in cts-payload.txt")

## 2026-07-07 — cts-sync.sh: self-overwrite of .claude/scripts/cts-sync.sh mid-run produces a spurious syntax-error exit code

Why: `cts-sync.sh` copies `.claude/scripts/` last in the payload order specifically so it overwrites itself only after everything else is synced (see comment above `sync_path()`). But bash does not fully buffer a script's source before executing straight-through code — when `copy_one` overwrites the running script file on disk, bash's subsequent reads for the remainder of the script land on bytes from the _new_ file at the _old_ file's byte offset, which don't align to any coherent statement. Observed result: the run completes all real work (payload copied/merged, `.cts-version` written, "Done. Review with: git diff" printed) but then bash throws a parse error and the process exits non-zero. Verified via `.cts-version` matching the new upstream SHA and `git diff --stat` matching the printed merge/conflict list — the non-zero exit does not mean the sync failed, contradicting the assumption in `.claude/skills/cts-update/SKILL.md` step 2 that non-zero exit means "did not run." Re-verified 2026-07-07 in an isolated sandbox after this exact sync pulled a new `cts-sync.sh` revision (commit `c512bd8`, which only reworked `merge_one`'s temp-file cleanup and left the self-copy ordering/comment untouched): reproduced the same class of failure with a synthetic mid-file upstream diff to `cts-sync.sh` (exit 127, `line: command not found` — a _different_ garbled error than the original run's `exit 2, syntax error near unexpected token '&&'`, confirming the error text/code is arbitrary noise from misaligned byte offsets, not a stable signal) — so the bug is still present in the version currently installed at `.claude/scripts/cts-sync.sh`. Root cause is structural (self-modifying script under `bash script.sh` invocation) and needs a fix in the sync engine itself, e.g. re-exec via `exec bash "$0" "$@"` right before the self-copy, or defer the self-copy to a `trap ... EXIT` that runs after the interpreter has already finished reading the file, or simply copy `.claude/scripts/cts-sync.sh` to a temp path and `cp` it into place as the very last statement with no code after it.
Belongs in (guess): claude-ts-upstream (cts-sync.sh script) — also `.claude/skills/cts-update/SKILL.md` step 2 wording should note this known false-negative on exit code

## 2026-07-01 — cts-update: mass "locally modified, not overwritten" is expected after a prior /cts-contribute

Why: Running `/cts-update` after this project previously ran `/cts-contribute` produced ~55 "locally modified, not overwritten" notices in one run. This is not drift — the upstream commit was titled "ported from Penny," meaning this project's own past customizations were merged into claude-ts and are now being synced back down. The engine compares against the old baseline commit, not upstream intent, so any file this project contributed content for shows as diverged even though local and upstream agree. When triaging `/cts-update` output, check the upstream commit message for "from <this-project>" before assuming a large diverged-file list needs manual merging — it may just need a quick confirm-and-skip.
Belongs in (guess): .claude/skills/cts-update/SKILL.md (step 3/5 triage guidance)

## 2026-07-07 — workflow: review-driven backlogs miss omission-type DoD gaps — audit plan-vs-reality before closing a milestone

Why: All 11 post-skeleton todo tasks were emitted by quality-gate agents reacting to diffs, yet none covered the four unmet Definition-of-Done items (coverage thresholds, e2e in CI, explicit @Injectable fuse, compose health) — a scanner cannot flag a _missing_ config because there is no diff to react to. The 2026-07-07 skeleton review found these only by checking DECISION-RECORD §4/§5 line-by-line against the codebase. Rule: before declaring a milestone/result done, run one dedicated plan-vs-reality audit session (DoD checklist × codebase evidence); review exhaust alone systematically under-covers omissions.
Belongs in (guess): rules/workflow.md (milestone close / DoD audit step) | rules/task-authoring.md

## 2026-07-07 — security: truncated unsalted SHA-256 of a small-integer ID is enumerable, not anonymization

Why: A proposed PII mitigation hashed `telegramId` with SHA-256 and kept the first 12 hex chars as a "non-PII correlation token". Telegram IDs are ~10-digit integers — the entire input space is brute-forceable in seconds-to-minutes on commodity hardware, so the token is trivially reversible and remains PII under GDPR. If genuine de-identification is required, use `HMAC-SHA256(id, secret_pepper)` with a config-injected pepper, or omit the identifier and rely on a request-correlation id. Plain truncated hashes of low-entropy inputs must never be labeled anonymization in reviews or task files.
Belongs in (guess): rules/code-style-backend.md (logging/PII section) | security-scanner agent checklist

## 2026-07-07 — identity/testing: real Telegram widget auth cannot run on localhost — mocked-API e2e is the accepted CI pattern

Why: The Telegram Login Widget only renders/authenticates for a domain registered with the bot (`/setdomain`); bare localhost is rejected, so no CI runner can execute the live flow. The owner verified the real end-to-end auth manually via VS Code port forwarding with the temporary forwarded domain registered on the bot (2026-07-07). Consequently `apps/web-e2e/auth-flow.spec.ts` mocking `/auth/me` + `/api/hello` is a deliberate, accepted design — reviewers must not flag the mocks as a coverage gap; the live-auth check is a documented manual pre-release step (and the `dev-token` CLI exists for token-level backend testing without the widget).
Belongs in (guess): rules/testing.md (e2e strategy note) | PROJECT_CONTEXT (identity/auth testing constraints)

## 2026-07-08 — testing: identity Mongo integration specs need MONGO_TEST_URI env var; nx test target for identity-infrastructure is vite:test, not test

Why: `mongo-user-repository.spec.ts` / `mongo-connection.spec.ts` hard-coded an unauthenticated `mongodb://localhost:27017`, but `docker-compose.yml`'s mongo service has auth enabled, so every non-ping op failed with `MongoServerError: … requires authentication`. Fixed by reading `process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017'` (URI documented in `.env.example` using the same `${MONGO_USER}`/`${MONGO_PASSWORD}` expansion already used for `MONGO_URI`; Nx's built-in dotenv loading supports this expansion natively, no extra dep needed). Separately, this reconfirms the `vite:test` target-name gotcha (see 2026-06-29 entry above) for a second project: the correct command is `npx nx run identity-infrastructure:vite:test --skip-nx-cache`, not `npx nx test identity` as a task file assumed — project is `identity-infrastructure`, target is `vite:test`. Also: literal `mongodb://localhost:27017` strings in `apps/api/src/config/api-config.spec.ts` and `apps/cli/src/commands/*.spec.ts` are mock/stub config values, never opened as real connections — don't flag them as the same hygiene issue without checking for actual `mongoose.connect`/`MongoConnection` usage first.
Belongs in (guess): rules/testing.md (Command Execution Policy table — generalize the vite:test gotcha beyond `web`) | libs/identity/infrastructure/README.md (already updated)

## 2026-07-08 — CI/e2e: raw `http-server` has no SPA fallback; prefer the project's `@nx/web:file-server` serve-static target for Angular e2e

Why: The first CI e2e implementation served the built Angular app via `npx http-server dist/apps/web/browser -p 4200`. `http-server` returns a plain 404 for any client-side route that isn't a real file on disk (e.g. `page.goto('/greeting')` in a Playwright spec), so every e2e test that navigates directly to a route timed out waiting for the app to bootstrap — the CI job would have failed on every run. Fixed by pointing Playwright's CI `webServer.command` at the repo's existing Nx target instead (`pnpm exec nx run web:serve-static`, `@nx/web:file-server` executor, `"spa": true` in `apps/web/project.json`), which correctly falls back to `index.html` for unknown routes. No new dependency needed — the executor ships with `@nx/web`, already a transitive dep. Rule: never reach for a raw `npx http-server`/`serve` invocation to serve an Angular (or any SPA) build in CI or e2e config; check for an existing `serve-static`/file-server Nx target first.
Belongs in (guess): rules/testing.md (Playwright CI webServer config guidance) | apps/web-e2e/playwright.config.mts (already has an inline comment)

## 2026-07-08 — CI: `nx affected -t <target> --exclude <project>` doesn't stop at the excluded project — multiple projects can share the same target name

Why: `pnpm nx affected -t e2e --exclude smoke-e2e` was meant to scope the new CI e2e job to `web-e2e` only, but `apps/api-e2e` also has its own `e2e` target (Jest, needs live Mongo + `api:serve`) — it isn't excluded by naming only `smoke-e2e`, so any PR touching `apps/api` would additionally trigger api-e2e's Jest suite in a job that provisions no API/Mongo infra, failing for unrelated reasons. Fixed by scoping explicitly with `-p web-e2e -t e2e` instead of affected+exclude-list. Rule: before using `--exclude` to scope an `nx affected -t <target>` invocation, enumerate every project that exposes that target name (`nx show projects` or grep `project.json` files) — an exclude-list only covering the one project you thought of is not the same as an inclusive scope, and is silently wrong the moment another project gains the same target.
Belongs in (guess): rules/workflow.md (Command Execution Policy — nx affected scoping caveat) | .github/workflows/ci.yml (already has an inline comment on the fix)

## 2026-07-08 — testing: CORRECTION to the 2026-06-30 "run `nx test`/`vite:test`, not just `build`" rule — vitest does NOT type-check specs either

Why: The 2026-06-30 "`nx build cli` false-green on broken spec fakes" entry (above) claimed `nx test <project>` "runs tsc over specs" and is therefore sufficient to catch `.spec.ts` type errors that `build` misses. This is false for the `vite:test` executor used across this repo: Vitest transpiles specs via esbuild (strip-types-only), so a `FakeUserRepository implements IUserRepository` missing two interface members (`findByUsername`, `updateProfile`) sat broken in `libs/identity/application/src/lib/set-user-status.service.spec.ts` and `login-with-telegram.service.spec.ts` on the `skeleton` branch baseline (confirmed via `git stash` — pre-existing, not introduced by any single task), and both `pnpm nx build identity-application` (excludes specs via `tsconfig.lib.json`) and `pnpm nx vite:test identity-application` (esbuild, no type-check) passed green throughout. Only `npx tsc -b libs/identity/application/tsconfig.spec.json --noEmit` surfaced the TS2420/TS2739 errors. No `nx` target in this repo currently type-checks spec files for any project. Fixed the two broken fakes directly (added the missing methods). Rule: the "run test, not just build" guidance needs a real fix, not just repetition — either add a dedicated `typecheck` Nx target (e.g. `@nx/js:tsc` or plain `tsc -b` over each project's full `tsconfig.json` including `tsconfig.spec.json`) to the quality gate, or configure `vite:test` with `typecheck: true` (Vitest's built-in type-checking mode, slower but real). Until then, `Fix Now`/`Emit as Task` findings that only ran `build`+`vite:test` cannot claim spec-file type-safety.
Belongs in (guess): rules/workflow.md (Command Execution Policy — add typecheck target) | rules/testing.md (spec type-safety is not guaranteed by vite:test)

## 2026-07-09 — testing: `ThrottlerGuard`'s per-request storage key is derived from class+handler+tracker, not `ExecutionContext` identity — shared guard/storage instances leak hit counts across `it()` blocks

Why: While implementing rate limiting on `POST /api/auth/telegram` (`@nestjs/throttler`), a spec that reused one `ThrottlerGuard` + fake `ThrottlerStorage` instance across multiple `it()` blocks saw an unrelated test fail with a 429/`ThrottlerException` — the guard keys its storage record off `context.getClass().name` + `context.getHandler().name` + the IP tracker, not object identity, so hits accumulate across tests that hit the same handler/class/tracker tuple. Fix: instantiate a fresh guard and fake storage per test (`beforeEach`, not `beforeAll`) whenever specs exercise the real `ThrottlerGuard.canActivate` against the same handler.
Belongs in (guess): rules/testing.md (NestJS guard/throttler test patterns)

## 2026-07-09 — nestjs: `@nestjs/throttler`'s public types omit `ThrottlerStorageRecord`; `GUARDS_METADATA` only resolves from the `@nestjs/common/constants` subpath

Why: `@nestjs/throttler`'s `index.d.ts` does not re-export `ThrottlerStorageRecord` (used internally by `ThrottlerStorage`/`ThrottlerGuard`) — a test implementing a fake `ThrottlerStorage` must declare its own local return-type interface rather than importing it. Separately, `GUARDS_METADATA` (needed to assert a controller method has `@UseGuards(ThrottlerGuard)` applied) is not re-exported from `@nestjs/common`'s root — only from the `@nestjs/common/constants` subpath, which resolves fine since the package has no `exports` map restriction blocking it.
Belongs in (guess): rules/testing.md (NestJS decorator-metadata assertion patterns)

## 2026-07-09 — testing: framework-level `apps/api/src/main.ts` config (trust proxy, CORS, Helmet directives) is cheap to runtime-verify without booting business modules

Why: Verifying `app.set('trust proxy', 1)` actually makes `req.ip` reflect `X-Forwarded-For` looked like it needed an integration test blocked by `IdentityModule`'s eager Mongo-connection factory (the same trap noted in the DI-wiring gap for `AuthModule`/`ThrottlerModule`). It doesn't — trust-proxy/CORS/Helmet are pure Express/Nest framework behavior with zero business-module dependency. Pattern: build a throwaway `NestFactory.create<NestExpressApplication>` with a minimal probe controller, `app.listen(0)` (ephemeral port), and Node's built-in `node:http` client to make the request — no `supertest` dependency needed, no Mongo/IdentityModule involvement. Include a negative-control test (config disabled) alongside the positive one, so the assertion can't be a false positive from Express trusting the header regardless of config. See `apps/api/src/trust-proxy.spec.ts`.
Belongs in (guess): rules/testing.md (NestJS integration test patterns — main.ts framework config section)

## 2026-07-08 — git: `docs/rebuild/` is excluded via local `.git/info/exclude`, not a committed `.gitignore` — `git status`/`git mv` silently no-op or fail

Why: `docs/rebuild/tasks/{todo,done,parked}/**` never appears in `git status`/`git diff` output — not because there are no changes, but because the path is excluded via `.git/info/exclude:9` (`docs/rebuild/`), a machine-local file, not a tracked `.gitignore`. This makes the exclusion invisible to anyone reading only the checked-in repo. `git mv`/`git add` fail with "not under version control" on these paths. Confirmed via `git check-ignore -v <path>`, which reports the excluding rule and line. Rule: task files under `docs/rebuild/tasks/**` (moving between `todo/`/`done/`/`parked/`, creating new ones) must use plain `mv`/filesystem writes, never `git mv`/`git add`. If a git operation on any path unexpectedly fails, or a directory shows suspiciously empty `git status` output despite known edits, run `git check-ignore -v <path>` before concluding there's nothing to do.
Belongs in (guess): docs/rebuild/tasks/README.md (note the exclude) | rules/workflow.md (task-file lifecycle note)

## 2026-07-09 — workflow: quality-gate fix-retry cycles should resume the same agent instance, not spawn a fresh one

Why: `rules/workflow.md`'s Quality Gate section documents the stage order and restart-from-tester rule but not _how_ a restart should be dispatched. A fresh agent on each restart re-derives all context cold (re-reads the task, re-explores the diff) even though the prior instance already built that understanding in cycle 1. Confirmed as the preferred approach on the `rate-limit-telegram-login` task (2026-07-09): on a `## Fix Now` restart, resume the same `tester`/`reviewer`/`security-scanner` _and_ the implementing agent (e.g. `backend-developer`) via `SendMessage` to their existing agent IDs, so the re-run only evaluates the delta. Applies to same-role re-runs within one task's cycles, not to swapping which role runs next.
Belongs in (guess): rules/workflow.md (Quality Gate section, restart-cycle dispatch mechanics)

## 2026-07-09 — workflow: quality-gate stages must wait for the prior stage's Agent call to fully return, not just look complete inline

Why: Dispatching `reviewer` while `tester`'s Agent call was still running background follow-up work (e.g. `nx run-many`) violated the tester → reviewer → security-scanner sequential contract even though the visible inline result looked finished. Rule: after dispatching each quality-gate agent as a foreground `Agent` call, wait for the tool result to actually appear before making the next `Agent` call — do not infer completion from partial/streamed output.
Belongs in (guess): rules/workflow.md (Quality Gate section — sequential dispatch note)

## 2026-07-08 — workflow: never `git stash`/`git stash pop` mid-session to check pre-existing-vs-new state

Why: Even a reversible stash/pop mid-session mutates the working tree the user (or another agent) is actively tracking via `git diff` across turns, disrupting the visible diff for no benefit. To check whether an issue predates the current session's changes, use non-mutating alternatives instead: `git show HEAD:<path>` / `git diff HEAD -- <path>` for a single file, `git worktree add` for a genuinely separate checkout, or reason from `git log`/`git blame`.
Belongs in (guess): rules/workflow.md or rules/git-operations.md (session-safety note for any AI agent working in this repo)

## 2026-07-01 — workflow: only commit `/cts-update` output when the CTS source was actually pushed to the real GitHub remote

Why: `/cts-update --source ../claude-ts` (or any local/uncommitted CTS checkout) run to verify a contribution round-trips cleanly is a dry run, not a release — its diff must stay uncommitted/discarded in this consumer repo. Committing it would make this repo's history claim a template sync that never happened upstream. Rule: before committing any `/cts-update` output, confirm the CTS source pointed at the GitHub remote (or a local checkout whose HEAD is already pushed there) — not an unpushed local-only state. If in doubt, ask.
Belongs in (guess): rules/workflow.md (cts-update / template-sync section) or a note near the `/cts-update` skill itself

## 2026-06-29 — workflow: `reviewer`/`security-scanner` should read a scoped depth (durable map + seam-touched files), not full-repo-scan, once topology docs exist

Why: Agreed during the 2026-06-29 cyclic-development grill as a root-cause fix (alongside the foresight gate and 4-tier quality floor already in `rules/workflow.md`). Pre-flight should read the durable map (`ARCHITECTURE.md`/`DECISIONS.md`/`PROJECT_CONTEXT.md`); when the changeset touches a seam (shared contract/registry/cross-layer field), read the full touched files plus their bidirectional consumers/dependencies, not the whole repo. `security-scanner` additionally reads the trust-boundary section of the decision docs. This depends on topology docs existing first — was gated behind a docs task at the time and may already be actionable now that `docs/PROJECT_CONTEXT.md` exists.
Belongs in (guess): rules/workflow.md (Quality Gate section, reviewer/security-scanner pre-flight scope)
