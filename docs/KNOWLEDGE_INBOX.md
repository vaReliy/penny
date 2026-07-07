# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

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
