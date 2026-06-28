# Knowledge Inbox

## 2026-06-28 — identity: IUserRepository has intentionally separate write paths for status vs profile

Why: `save()` (via `updateById`) writes all fields including `status` — it is only safe to call from `SetUserStatusService` (approve/reject). `updateProfile()` writes only profile fields (`firstName`, `lastName`, `username`, `photoUrl`) and structurally cannot touch `status` or `telegramId`. The split exists to prevent the login path from reverting an approved user's status back to `pending` in a concurrent-write race. Do not consolidate these back to a single `save()` for the returning-user path in `LoginWithTelegramService`.
Belongs in: PROJECT_CONTEXT (identity layer architecture section)

## 2026-06-28 — angular: InjectionToken must live in a non-lazy lib when provided in root app config

Why: When a lazy-loaded feature lib defines an `InjectionToken` and the root `app.config.ts` provides a value for it, the `@nx/enforce-module-boundaries` ESLint rule flags the static import in `app.config.ts` as a boundary violation (eager → lazy). The correct placement: define the token in the `type:data` lib (non-lazy) so both the lazy feature component and the eager app config share the same token reference. Pattern: `TELEGRAM_BOT_USERNAME` token lives in `libs/identity/data-access`, not in `libs/identity/feature-login`.
Belongs in: rules/architecture.md (Angular injection token placement section)

## 2026-06-28 — nx: `nx vite:test` is the correct target name for Vitest in this repo (not `nx test`)

Why: The Nx plugin registers the test target as `vite:test` (configured via `testTargetName: "vite:test"` in `nx.json`). Running `pnpm nx test <project>` silently resolves to nothing. Always use `pnpm nx vite:test <project> --skip-nx-cache` for unit test runs in this repo.
Belongs in: rules/nx-generators.md (test target section) — supersedes the 2026-06-28 entry about `@nx/vitest:vitest` executor

## 2026-06-28 — angular: all style files must use SCSS (not CSS)

Why: Repo standard. `@nx/angular:app` and `@nx/angular:lib` generators default to CSS; the generated files must be renamed `.css` → `.scss` and all `styleUrl`/`styles` references updated. Also update `apps/*/project.json` `"styles"` array. Pass `--style=scss` to generators to reduce post-gen work.
Belongs in: rules/nx-generators.md (post-generator corrections section)

## 2026-06-28 — angular: `toSignal({ requireSync: true })` requires `startWith` on cold observables

Why: `requireSync: true` throws `NG0601` at component construction if the source observable does not emit synchronously. HTTP observables and `NEVER` are cold — they never emit synchronously. Always add `startWith(initialValue)` **before** `catchError` in the pipe to guarantee a synchronous first emission. Order matters: `map → startWith → catchError`. If `startWith` comes after `catchError`, an error thrown before any emission would still violate the sync requirement.
Belongs in: rules/code-style.md (Angular signal patterns section)

## 2026-06-28 — angular: use `@let` in templates to call a signal once and enable type narrowing

Why: Calling a signal function multiple times in a template (e.g. `@if (s().kind === 'success') { {{ s().message }} }`) calls it twice per CD cycle and, crucially, TypeScript cannot narrow the discriminated union type across separate calls. Use `@let state = mySignal()` to bind once; `state` is then narrowable inside `@if`/`@else if` branches. Available since Angular 17.3.
Belongs in: rules/code-style.md (Angular template patterns section)

## 2026-06-28 — nx: `@nx/angular:app` generator requires `--name` flag for the project name, not a positional arg

Why: `pnpm nx g @nx/angular:app web --directory=apps/web …` fails with "Schema does not support positional arguments". Correct invocation: `pnpm nx g @nx/angular:app --name=web --directory=apps/web …`. Same applies to `@nx/angular:lib`.
Belongs in: rules/nx-generators.md

## 2026-06-28 — nx: generated Angular vite.config.mts imports deprecated @nx/vite plugins — must replace with resolve.tsconfigPaths

Why: `@nx/angular:app` and `@nx/angular:lib` generators inject `nxViteTsPaths()` and `nxCopyAssetsPlugin()` from `@nx/vite/plugins/…` which are banned by the repo's ESLint `no-restricted-imports` rule (removed in Nx v24). Replace with `resolve: { tsconfigPaths: true }` in the vite config and drop the `nxCopyAssetsPlugin` call. This is a mandatory post-generator fix.
Belongs in: rules/nx-generators.md

## 2026-06-28 — architecture: type:feature libs cannot import type:contracts directly — must route through type:data

Why: The ESLint module-boundary rule for `type:feature` only allows `type:feature`, `type:ui`, `type:data`, `type:util`. Importing from `shared-contracts` (type:contracts) in a feature lib violates this rule. Correct pattern: re-export the needed type from the `type:data` lib (`export type { TelegramLoginPayload } from 'shared-contracts'`) and import from the data lib in the feature lib.
Belongs in: rules/architecture.md (frontend onion boundary section)

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## 2026-06-27 — workflow: quality gate fix-retry cycles cause "infinite loops" when developer lacks pre-flight context

Why: Review cycles compound when (1) technical agents don't read KNOWLEDGE_INBOX / rules before coding, and (2) reviewer treats all findings as "fix now" regardless of origin. Root cause confirmed via task `2026-06-14-15-04-user-status-drift` spawning 5 subtasks — valid pre-existing discoveries, not regressions. Each inline fix adds new review surface, so the loop is structurally guaranteed.
Decisions made (grill session 2026-06-27):

- All agents must read `docs/KNOWLEDGE_INBOX.md` before acting (knowledge of discovered issues).
- Technical agents (backend-developer, angular-developer, qa, devops, tester) also read `rules/architecture.md` + `rules/code-style.md` as mandatory pre-flight.
- Reviewer and security-scanner output two explicit sections: `## Fix Now` / `## Emit as Task`.
- Classification criterion: origin only — introduced by this changeset → Fix Now; pre-existing → Emit as Task.
- Severity/priority handled at task ordering level (task-authoring.md), not at gate classification.
- "Cheap in current session" override allowed only if: ≤1 file, no new tests, no new deps, purely mechanical change — orchestrator decides, not the reviewer.
- 2-cycle limit applies only to `## Fix Now` items. After 2 cycles with open Fix Now items → hard stop + escalate to user.
  Belongs in: rules/workflow.md (quality gate section) + agent definitions for reviewer, security-scanner, all technical agents.

## 2026-06-28 — agents: rules/architecture.md scope is app-layer Clean Architecture only — not applicable to devops

Why: When adding pre-flight reads to all technical agents, devops was given `rules/architecture.md` alongside `rules/code-style.md`. The reviewer correctly flagged this: `rules/architecture.md` covers UseCases, Services, Repositories, DTOs — Clean Architecture application concerns. Devops writes Dockerfiles, CI YAML, env config, shell scripts — none of which reference those layers. The read is inert but wastes tokens (haiku model). Rule: `rules/architecture.md` pre-flight applies only to agents that write application code; agents whose output is purely infrastructure config should skip it.
Belongs in (guess): rules/workflow.md (pre-flight obligation note) | agent definitions (devops pre-flight)

## 2026-06-27 — task-authoring: Dependencies row must use full slugged filename, never bare numbers

Why: `Depends on | 12, 13` and `Depends on | 6, 8` appeared in tasks because the rule allowed "roadmap-index number if the task lives in a numbered roadmap." Bare numbers become unresolvable once the roadmap doc is archived. Fix applied: rules/task-authoring.md now requires full filename without extension (e.g. `2026-06-14-13-approve-user-service`); roadmap-index escape hatch removed.
Belongs in: rules/task-authoring.md (already applied).

## 2026-06-25 — code review: flag history-flavored words in doc comments

Why: a comment that says "no longer does X" / "now does Y" / "used to be Z" describes the diff that produced the current code, not the current invariant — it reads fine right after the change but rots the moment the next change lands, since nobody remembers to revisit prose. Comments should state the present-tense rule/contract ("does not do X; callers must do Y"), never the change history (that belongs in the commit message/PR description).
Belongs in (guess): rule (rules/code-style.md, as a review checklist item) or reviewer agent instructions

## 2026-06-25 — identity: UserStatus type drift between shared-contracts and identity-core (RESOLVED 2026-06-27)

Why: `shared-contracts/src/lib/user-status.ts` defined `UserStatus = 'active' | 'pending' | 'banned'` (stale, from earlier design); `identity-core/src/lib/user-status.ts` had the live enum (`pending | active | rejected`). Fixed: `shared-contracts` is now the single authoritative `as const` definition (PENDING/ACTIVE/REJECTED); `identity/core` re-exports from there; all consumers redirected.

## 2026-06-25 — identity: telegramId unique index required on MongoUserRepository

Why: `LoginWithTelegramService.execute` does `findByTelegramId` then conditionally creates — concurrent first-logins race to insert. `MongoUserRepository.save` handles duplicate-key (code 11000) by throwing `DomainError.conflict`, not a silent overwrite. But this is only safe if a unique index on `telegramId` actually exists in the Mongo schema. Verify `@prop({ unique: true })` or equivalent is on the `telegramId` field.
Belongs in (guess): PROJECT_CONTEXT | dba review

## 2026-06-26 — api: `moduleResolution: "bundler"` is correct for a Webpack-bundled NestJS app (RESOLVED)

Why: The earlier diagnosis ("latent ESM/CJS split blocks migration") was wrong about the runtime. `apps/api` is built by `NxAppWebpackPlugin`, which bundles all lib imports into a single CJS Node bundle regardless of the TypeScript `module` setting. TS1479 ("CJS cannot require() ESM") only fires under `moduleResolution: "node16"` because that mode checks `package.json#type` at resolution time; `"bundler"` skips that check and is the correct, non-deprecated choice for any Webpack-bundled output. Fixed: removed `module: "commonjs"`, `moduleResolution: "node10"`, and `ignoreDeprecations: "5.0"` from `apps/api/tsconfig.json`; app now inherits `moduleResolution: "bundler"` + `module: "esnext"` from the base.
Belongs in: rules/architecture.md (module format section)

## 2026-06-26 — testing: `delete process.env[KEY]` bypasses vi.stubEnv restoration

Why: `vi.stubEnv` saves and restores env vars on `vi.unstubAllEnvs()`; `delete process.env[KEY]` operates outside that tracking. Pattern found in `apps/api/src/config/api-config.spec.ts`. Fix: treat empty string as absent in production env readers (`portRaw ? … : default` instead of `portRaw !== undefined ? … : default`), then use `vi.stubEnv(KEY, '')` to simulate absence without deletion.
Belongs in: rules/testing.md

## 2026-06-26 — api: no cookie-parser dep needed for httpOnly session cookies

Why: `res.cookie()` (setting) is built into Express and works without `cookie-parser`. Reading the cookie server-side in a NestJS guard can be done by parsing `req.headers['cookie']` manually (`split(';')` → find `name=value`), avoiding an extra dependency. `cookie-parser` is only needed if you want `req.cookies` populated everywhere. Pattern landed in `apps/api/src/auth/session.guard.ts`.
Belongs in (guess): rules/architecture.md (auth section) or PROJECT_CONTEXT

## 2026-06-26 — api: NestJS guard can clear cookies before throwing by accessing response via ExecutionContext

Why: `canActivate` receives `ExecutionContext`, which exposes `context.switchToHttp().getResponse<Response>()`. Calling `res.clearCookie(...)` before `throw new AuthenticationError(...)` ensures the Set-Cookie header is included in the 401 response — the exception propagates to the global filter which finalises the response, so the cookie-clear header is preserved. Pattern landed in `apps/api/src/auth/session.guard.ts`.
Belongs in (guess): rules/architecture.md (auth/guards section)

## 2026-06-26 — identity: LIVR optional `['string']` rule passes null through; `!== undefined` filter does not catch it

Why: LIVR treats `null` input on an optional field as "not provided" (skips rule execution) but does not strip the key from the validated output — `validParams` still carries `{ username: null }`. Filtering with `value !== undefined` misses it. In `buildDataCheckString` this produces `username=null` in the HMAC string; Telegram's server omits the key entirely → HMAC mismatch → `AuthenticationError`. Fails closed (no bypass), but misleading error. Telegram's widget never sends `null` for absent fields so the practical risk is negligible today. If a stricter guard is wanted: `value !== undefined && value !== null`, or add a `not_empty` LIVR rule to the optional field slots.
Belongs in (guess): rules/validation-authorization.md or PROJECT_CONTEXT

## 2026-06-26 — workflow: pipeline re-entry point after a fix determines which agents to run

Why: When a fix is needed after the quality gate, the orchestrator must re-enter the pipeline at the right stage — not just patch inline and skip downstream steps. Rule: (1) trivial change (comment, doc-only) → orchestrator handles directly, no downstream needed; (2) source logic change → re-enter at `backend-developer` → `tester` → `reviewer` + `security-scanner` → user review; (3) test-only change → re-enter at `tester` → `reviewer` + `security-scanner` → user review. Writing tests directly and then running reviewer/security-scanner is half-right — the gate ran but `tester` was bypassed as the authoring agent, which undermines independent authorship and review separation.
Belongs in (guess): rules/workflow.md (quality gate / fix-retry section)

## 2026-06-25 — identity: no central roles registry — 'admin' is a plain string constant (RESOLVED 2026-06-28)

Why: `ApproveUserService`/`RejectUserService` check `context.caller.roles.includes(ADMIN_ROLE)` where `ADMIN_ROLE = 'admin'`. Fixed: `Role` const object added to `shared-contracts`; `TokenClaims.roles` typed `readonly RoleType[]`; all callers updated.

## 2026-06-28 — identity: narrowing a JWT array claim type requires a parallel runtime ReadonlySet guard

Why: `isTokenClaims()` already validates `status` against `VALID_USER_STATUSES: ReadonlySet`. When `TokenClaims.roles` was narrowed from `string[]` to `readonly RoleType[]`, the same pattern was initially omitted — a validly-signed token with `roles: ['superadmin']` passed the guard. Fix: `VALID_ROLES: ReadonlySet<string> = new Set(Object.values(Role))` + `.every(v => VALID_ROLES.has(v))` in the predicate. Rule: every compile-time array-enum claim narrowing must have a matching runtime set-membership check in the type guard.
Belongs in (guess): rules/validation-authorization.md (JWT claim validation section)

## 2026-06-27 — api: bufferLogs:true without app.useLogger() is dead config — two unconnected log streams

Why: `main.ts` sets `bufferLogs: true` (which holds Nest's bootstrap logs for a custom logger) but never calls `app.useLogger(customLogger)`. Result: bootstrap/lifecycle/filter logs go to Nest's default text formatter, request logs go to pino-http's JSON stream — two incompatible formats in one stdout. The critical path (`UnknownErrorFilter` for 500s) is in the _wrong_ stream. In dev this is invisible (both render fine in terminal); it breaks log aggregation the moment Docker is introduced. Fix: create a `PinoNestLogger implements LoggerService`, call `app.useLogger(new PinoNestLogger(pinoRoot))`, and pass the same pino root to `pino-http` so all logs share one configured pipeline.
Belongs in: rules/architecture.md (logging section) | PROJECT_CONTEXT

## 2026-06-26 — workflow: knowledge capture requires a Stop hook, not just spec wording

Why: Three root causes made agents consistently write learnings to private auto-memory instead of docs/KNOWLEDGE_INBOX.md: (1) rules/workflow.md routed "config gotchas" to auto-memory and had an escape hatch "Claude-session-specific gotchas still go to auto-memory" that rationalized almost any learning; (2) Phase 6 was framed as "after every pipeline" so direct/trivial edits never triggered it; (3) none of the 16 agent definitions mentioned the inbox. Instructions are probabilistic — the harness system prompt pulls strongly toward private memory. Only a Stop hook (which the harness enforces) creates a deterministic checkpoint. Fix applied: `.claude/hooks/knowledge-capture-nudge.sh` blocks once per session per unmet obligation (inbox / CLAUDE_TS_CHANGELOG); rules/workflow.md escape hatch removed; litmus test added; CLAUDE.md write-limit carve-out added; all 12 implementation agents now include a `## Learnings` handoff bullet in their Report Format.
Belongs in: rules/workflow.md (already applied) + CLAUDE_TS_CHANGELOG (pending-port entry below)

## 2026-06-27 — api: NestJS `new Logger(name)` auto-delegates to the globally registered LoggerService

Why: `createParamDecorator` factories and manually-instantiated filters (`BaseErrorFilter`, `UnknownErrorFilter` constructed with `new` in `main.ts`) cannot receive DI-injected loggers. However, NestJS `Logger` instances created via `new Logger(name)` internally forward every call to whichever `LoggerService` is registered with `app.useLogger()` — so they automatically route through pino once the adapter is wired. Converting them to `@Inject(LoggerService)` is not needed for log-unification goals; it is only beneficial for full DI testability.
Belongs in (guess): rules/architecture.md (logging section)

## 2026-06-27 — identity: MongoDB findOneAndUpdate+upsert is not fully atomic across concurrent connections

Why: `findOneAndUpdate({ filter }, { $setOnInsert: … }, { upsert: true, new: true })` is atomic within a single MongoDB primary (no interleaved writes), but two distinct driver connections can both evaluate "no document" before either insert commits, causing E11000 on the loser. The safe find-or-create pattern is: attempt upsert → on E11000 retry with `findOne` (the winner's document now exists). The retry `findOne` itself must also be wrapped in error handling, or a secondary failure during the retry escapes raw. Node.js `Promise.all` on a single connection does NOT reproduce this race (event loop serializes both calls before they hit MongoDB); true concurrent safety requires real multi-connection load or mock-based unit tests. `$setOnInsert` is the right operator: it only writes fields on insert, so concurrent losers get the winner's document unchanged.
Belongs in: rules/testing.md (integration test limits) | PROJECT_CONTEXT

## 2026-06-27 — identity: sparse:true on a unique index is wrong for required fields

Why: `sparse: true` excludes documents missing the indexed field from the unique index, allowing multiple null-field documents. For an application-required field (`@prop({ required: true })`), this weakens the DB-level invariant: raw driver inserts that bypass Mongoose validation can create multiple null-value documents without triggering E11000. Unless the field is genuinely optional, always use a non-sparse unique index.
Belongs in: rules/architecture.md (MongoDB patterns)

## 2026-06-27 — identity: InfrastructureError must carry no dynamic content — log internally, throw generic

Why: `BaseErrorFilter` serializes `InfrastructureError.message` directly into the HTTP response body. Any `new InfrastructureError(dynamicString)` where `dynamicString` contains MongoDB driver messages, entity IDs, or Telegram IDs therefore reaches clients — violating the `SerializedError` contract and leaking PII/schema details. Pattern: call `this.logger.error({ err: error, ...context }, 'descriptive message')` before throwing `new InfrastructureError()` (no-arg generic default). The pino `err` key triggers automatic `err.message`/`err.stack` serialization. Applies to every infrastructure adapter, not just `MongoUserRepository`. Fix: inject `pino.Logger` into the repository constructor; strip all dynamic strings from `InfrastructureError` constructor calls.
Belongs in: rules/architecture.md (error handling section) | rules/validation-authorization.md

## 2026-06-27 — api: pino logger must live in DI, not bootstrap — use app.get() after NestFactory.create()

Why: creating `pinoLogger` in `bootstrap()` before `NestFactory.create()` means no other module can inject it via DI, leading to multiple independent pino instances. The correct pattern: call `NestFactory.create(AppModule, { bufferLogs: true })` first, then `app.get<pino.Logger>(PINO_LOGGER)` to retrieve the singleton from DI; `bufferLogs: true` queues bootstrap logs until `app.useLogger()` is called, at which point they flush through the real logger. `LoggerModule` owns the provider and exports `PINO_LOGGER`; all consumers import `LoggerModule`.
Belongs in: rules/architecture.md (logging section)

## 2026-06-27 — api: `secure` cookie flag must derive from runtime mode, not be hardcoded

Why: `secure: true` on a cookie is silently dropped by browsers over plain HTTP. In local dev (HTTP), this means session cookies are never set. Fix: `secure: config.mode === 'production'`. The `mode` field belongs in `ApiConfig` and is derived from `NODE_ENV` in `loadApiConfig()` — the one place all env reads are confined.
Belongs in: rules/architecture.md (auth/cookies section)

## 2026-06-27 — identity: telegramId unique index race condition resolved (RESOLVED)

Why: Previous inbox entry from 2026-06-25 flagged the race. Now fixed: `MongoUserRepository.save()` uses atomic `findOneAndUpdate+upsert` with E11000 retry; non-sparse unique index; unit tests cover the retry path with mocked Mongoose model.

## 2026-06-27 — nx: every lib that directly imports a shared lib needs its own package.json entry

Why: When `shared-contracts` became the authoritative `UserStatus` source, the implementer added `"shared-contracts": "0.0.1"` to `identity-core/package.json` but missed `identity-infrastructure/package.json`, which also has direct imports (`user.model.ts`, `user.mapper.ts`). `@nx/dependency-checks` catches this as a hard lint error. Rule: after adding a new intra-monorepo import path alias to any lib, check that lib's `package.json#dependencies` — not just the most obvious consumer.
Belongs in (guess): rules/dependencies.md | AGENTS.md checklist

## 2026-06-27 — nx: `type:core → type:contracts` boundary rule must be explicitly allowed when contracts is the shared kernel

Why: The default NX `onlyDependOnLibsWithTags` for `type:core` did not include `type:contracts`. Promoting `shared-contracts` to the authoritative domain-primitive source required adding `'type:contracts'` to the `type:core` allowlist in `eslint.config.mjs`. Same applies to `type:infrastructure` (was already allowed). Whenever making a `type:contracts` lib a dependency of a higher-purity layer, update the boundary rule or the lint gate will block the build.
Belongs in (guess): rules/architecture.md (NX boundary section) | PROJECT_CONTEXT

## 2026-06-27 — typescript: bare `export { X }` re-exports both value and type when X is a declaration merge

Why: In `identity-core/src/lib/user-status.ts`, `export { UserStatus } from 'shared-contracts'` covers both the const object (value namespace) and the `UserStatus` type alias (type namespace) in a single statement — no `export type { UserStatus }` needed alongside it. This works because the source file has a declaration merge (const + same-name type alias). Callers can use both `UserStatus.ACTIVE` (value) and `status: UserStatus` (type) from one import binding.
Belongs in (guess): rules/code-style.md (re-exports section)

## 2026-06-27 — api: NestJS LogLevel allowlist → pino threshold translation uses minimum-level reduction

Why: NestJS's `setLogLevels(levels: LogLevel[])` takes an explicit allowlist (e.g. `['warn', 'error']`), but pino's `logger.level` is a threshold (all levels at or above it are emitted). The correct translation is to map each NestJS level to a pino level, then pick the minimum pino level from the array — that threshold allows the widest set of events that satisfies the NestJS allowlist. Implemented via a `PINO_LEVEL_VALUE: Record<pino.Level, number>` numeric lookup and `Array.reduce` to find the minimum. An empty array should be a no-op (guard with early return).
Belongs in (guess): rules/architecture.md (logging section) | skill (pino integration recipe)

## 2026-06-28 — nx: `@nx/vitest:vitest` executor does not exist in @nx/vitest@23.0.1

Why: The correct executor name is `@nx/vite:test` (not `@nx/vitest:vitest`). For explicit `test` targets in app `project.json`, use `nx:run-commands` with `vitest run --config vitest.config.mts` scoped to the app's `cwd`. Inferred targets (via Nx plugin) work correctly but explicit targets must use the right executor or they silently fail to register.
Belongs in (guess): rules/nx-generators.md (test target section)

## 2026-06-28 — pnpm monorepo: nest-commander (and workspace-root-only deps) require `-w` flag

Why: In a pnpm monorepo with `node-linker=hoisted`, `pnpm add <pkg> --save-exact` without `-w` is rejected because there is no `package.json` in the app subfolder — all deps live at the workspace root. Always use `pnpm add <pkg> --save-exact -w` when adding shared or app deps in this repo.
Belongs in (guess): rules/dependencies.md

## 2026-06-28 — nx: @nx/angular:component stub spec imports class without "Component" suffix — always fix before running

Why: The generated stub spec (`greeting-page.spec.ts`) imports `GreetingPage` instead of `GreetingPageComponent`. The actual exported class always has the `Component` suffix. The stub silently fails at import (TypeScript error) rather than producing a useful test failure — it looks like a test gap rather than a bad import. Always verify the import name against the barrel `index.ts` before writing test logic.
Belongs in (guess): rules/nx-generators.md (post-generator corrections section)

## 2026-06-28 — angular: ngOnInit for data fetching now; toSignal() is the target pattern

Why: Task 17 shipped components using `ngOnInit` + manual property assignment for Observable-based data fetching. This is correct and testable, but not the idiomatic Angular 17+ direction. The target pattern is `toSignal(observable.pipe(startWith({kind:'loading'}), catchError(…)), { requireSync: true })` at field declaration level — no lifecycle hook, no subscription management, no AsyncPipe. `requireSync: true` ensures the initial value is never `undefined` (required when `startWith` or `catchError` guarantees an emission). Task `2026-06-28-01-angular-toSignal-refactor` tracks the migration. Until that task lands, `ngOnInit` is acceptable; do NOT mix both patterns in the same component.
Belongs in (guess): rules/code-style.md (Angular component data-fetch pattern) | skill (angular-expert)

## 2026-06-28 — angular: dev-server proxy config goes in proxy.conf.json, not vite.config.mts

Why: `apps/web/vite.config.mts` is vitest-only in this repo (no `server.proxy` key). The Angular dev-server (`@angular/build:dev-server`) reads proxy rules from a separate `proxy.conf.json` file, referenced via `"proxyConfig": "apps/web/proxy.conf.json"` in the `serve` target options of `apps/web/project.json`. Without this, `/api/**` calls from the Angular app return 404 in local dev because there is no server to handle them.
Belongs in (guess): rules/nx-generators.md (post-generator proxy section) | PROJECT_CONTEXT

## 2026-06-28 — angular: strict templates do not narrow discriminated-union signal values inside @if blocks

Why: `@if (state().kind === 'success') { {{ state().message }} }` fails strict template type-checking even though the `@if` condition narrows the discriminant at runtime — the Angular template compiler does not propagate that narrowing into the interpolation. Workaround: expose a typed `computed()` signal on the component (`readonly greetingMessage = computed(() => this.state().kind === 'success' ? this.state().message : null)`) and bind to that in the template. Avoids `$any()` casts and preserves strict mode.
Belongs in (guess): rules/code-style.md (Angular template patterns) | skill (angular-expert)

## 2026-06-28 — nx: @nx/angular:component uses --path, not --project in Nx v23

Why: `nx g @nx/angular:component --project=<name>` was silently ignored or errored in Nx v23. The correct flag is `--path=libs/<lib>/src/lib/<component-folder>/<component-name>` (path to the component file without extension). This changed from v21/v22 where `--project` was the primary flag.
Belongs in (guess): rules/nx-generators.md

## 2026-06-28 — nx: @nx/angular:lib generator silently ignores positional arg when --directory is absent

Why: Running `nx g @nx/angular:lib identity/feature-access-status` (positional) strips the `libs/` prefix and places the lib in the wrong location. Always pair `--name=<project-name>` with `--directory=libs/<path>` explicitly. The generator confirms the resolved root in its output — verify it matches the intended path before proceeding.
Belongs in (guess): rules/nx-generators.md

## 2026-06-28 — nx: new Angular libs must be scaffolded via nx g, never created manually

Why: Manual lib creation (project.json, tsconfig files, eslint.config.mjs, vite.config.mts written by hand) does not register the project in the NX workspace graph, omits the tsconfig inheritance chain, and produces targets whose executors may not match the rest of the repo. The result builds locally but never appears in `nx affected` and may silently misconfigure lint/test runners. Always use `nx g @nx/angular:lib <path> --tags=… --style=scss --standalone --no-interactive`, then audit for caret/tilde ranges and verify the strict TS block per rules/nx-generators.md.
Belongs in (guess): rules/nx-generators.md | CLAUDE.md (orchestrator guidance for angular-developer dispatch)

## 2026-06-28 — nx: manually created JS libs (non-Angular) are auto-detected via project.json — no registry update needed

Why: When `nx g @nx/js:lib` was skipped in favour of hand-crafting `project.json` + tsconfigs (e.g., for `shared-infrastructure`), the NX workspace graph still auto-detects the project. Unlike Angular libs (which must use `nx g @nx/angular:lib`), plain TypeScript libs that follow the existing `shared-kernel`/`shared-contracts` structure can be safely created manually without breaking `nx affected` or graph inference. However, Angular libs must always use the generator (see earlier inbox entry).
Belongs in (guess): rules/nx-generators.md (manual lib creation note for JS/TS-only libs)

## 2026-06-28 — cli: slim CliConfig pattern for apps that share IdentityModule but don't need JWT/Telegram vars

Why: CLI apps that call `ApproveUserService`/`RejectUserService` only need `MONGO_URI` and `MONGO_DB_NAME`. Creating a separate `loadCliConfig()` that validates only those vars (while using the same `API_CONFIG` symbol token) lets the CLI reuse `CliIdentityModule` without requiring unrelated secrets. Each NestJS app has its own DI container so symbol identity is per-app, not global.
Belongs in (guess): PROJECT_CONTEXT (cli app architecture notes)
