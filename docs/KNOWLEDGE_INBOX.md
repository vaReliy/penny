# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## 2026-06-29 — nestjs: APP_FILTER selection is specificity-based, not registration-order-based

Why: When multiple `APP_FILTER` providers are registered, NestJS matches the thrown exception type against each filter's `@Catch()` decorator arguments and invokes the most specific match — not the last-declared one. Registration order only matters when two filters have equal specificity (e.g., two `@Catch()` catch-alls). A specific `@Catch(BaseError)` filter always wins over a `@Catch()` catch-all regardless of which appears first in the providers array. This is counterintuitive to developers who assume reverse-order stack semantics (like middleware or pipes).
Belongs in (guess): rules/code-style-backend.md

## 2026-06-29 — testing: assert pino (obj, msg) both args in exception filter specs; hoist mockLogger to describe scope

Why: When testing NestJS exception filters that use pino, assert both arguments of the pino call — `logger.warn({ statusCode }, '[CODE] message')` — not just that the logger was called. pino's structured-first signature `(obj, msg)` is opposite to winston/console `(msg, meta)`, so a single-arg assertion (`toHaveBeenCalled()`) won't catch a metadata-less call. Also: `mockLogger` must be declared as `let` at the `describe` scope; a `const` inside `beforeEach` is inaccessible to `it` blocks.
Belongs in (guess): rules/testing.md

## 2026-06-28 — angular: CanActivateFn with zero explicit parameters avoids unused-variable lint noise

Why: `@typescript-eslint/no-unused-vars` is configured with `args: "after-used"` (Nx default). In a `CanActivateFn`, when neither `route` nor `state` is needed, declaring underscore-prefixed params (`_route`, `_state`) still triggers warnings. TypeScript structural typing allows a narrower signature — declaring `(): Observable<boolean | UrlTree> => { ... }` with no parameters satisfies `CanActivateFn` because the router call site passes the arguments at runtime regardless. Only add `state` (or `route`) to the signature when actually consumed; omit both when not needed.
Belongs in (guess): rules/code-style-angular.md

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

## 2026-06-25 — code review: flag history-flavored words in doc comments

Why: a comment that says "no longer does X" / "now does Y" / "used to be Z" describes the diff that produced the current code, not the current invariant — it reads fine right after the change but rots the moment the next change lands, since nobody remembers to revisit prose. Comments should state the present-tense rule/contract ("does not do X; callers must do Y"), never the change history (that belongs in the commit message/PR description).
Belongs in (guess): rule (rules/code-style.md, as a review checklist item) or reviewer agent instructions

## 2026-06-25 — identity: telegramId unique index required on MongoUserRepository

Why: `LoginWithTelegramService.execute` does `findByTelegramId` then conditionally creates — concurrent first-logins race to insert. `MongoUserRepository.save` handles duplicate-key (code 11000) by throwing `DomainError.conflict`, not a silent overwrite. But this is only safe if a unique index on `telegramId` actually exists in the Mongo schema. Verify `@prop({ unique: true })` or equivalent is on the `telegramId` field.
Belongs in (guess): PROJECT_CONTEXT | dba review

## 2026-06-26 — identity: LIVR optional `['string']` rule passes null through; `!== undefined` filter does not catch it

Why: LIVR treats `null` input on an optional field as "not provided" (skips rule execution) but does not strip the key from the validated output — `validParams` still carries `{ username: null }`. Filtering with `value !== undefined` misses it. In `buildDataCheckString` this produces `username=null` in the HMAC string; Telegram's server omits the key entirely → HMAC mismatch → `AuthenticationError`. Fails closed (no bypass), but misleading error. Telegram's widget never sends `null` for absent fields so the practical risk is negligible today. If a stricter guard is wanted: `value !== undefined && value !== null`, or add a `not_empty` LIVR rule to the optional field slots.
Belongs in (guess): rules/validation-authorization.md or PROJECT_CONTEXT

## 2026-06-26 — workflow: pipeline re-entry point after a fix determines which agents to run

Why: When a fix is needed after the quality gate, the orchestrator must re-enter the pipeline at the right stage — not just patch inline and skip downstream steps. Rule: (1) trivial change (comment, doc-only) → orchestrator handles directly, no downstream needed; (2) source logic change → re-enter at `backend-developer` → `tester` → `reviewer` + `security-scanner` → user review; (3) test-only change → re-enter at `tester` → `reviewer` + `security-scanner` → user review. Writing tests directly and then running reviewer/security-scanner is half-right — the gate ran but `tester` was bypassed as the authoring agent, which undermines independent authorship and review separation.
Belongs in (guess): rules/workflow.md (quality gate / fix-retry section)

## 2026-06-28 — identity: narrowing a JWT array claim type requires a parallel runtime ReadonlySet guard

Why: `isTokenClaims()` already validates `status` against `VALID_USER_STATUSES: ReadonlySet`. When `TokenClaims.roles` was narrowed from `string[]` to `readonly RoleType[]`, the same pattern was initially omitted — a validly-signed token with `roles: ['superadmin']` passed the guard. Fix: `VALID_ROLES: ReadonlySet<string> = new Set(Object.values(Role))` + `.every(v => VALID_ROLES.has(v))` in the predicate. Rule: every compile-time array-enum claim narrowing must have a matching runtime set-membership check in the type guard.
Belongs in (guess): rules/validation-authorization.md (JWT claim validation section)

## 2026-06-26 — workflow: knowledge capture requires a Stop hook, not just spec wording

Why: Three root causes made agents consistently write learnings to private auto-memory instead of docs/KNOWLEDGE_INBOX.md: (1) rules/workflow.md routed "config gotchas" to auto-memory and had an escape hatch "Claude-session-specific gotchas still go to auto-memory" that rationalized almost any learning; (2) Phase 6 was framed as "after every pipeline" so direct/trivial edits never triggered it; (3) none of the 16 agent definitions mentioned the inbox. Instructions are probabilistic — the harness system prompt pulls strongly toward private memory. Only a Stop hook (which the harness enforces) creates a deterministic checkpoint. Fix applied: `.claude/hooks/knowledge-capture-nudge.sh` blocks once per session per unmet obligation (inbox / CLAUDE_TS_CHANGELOG); rules/workflow.md escape hatch removed; litmus test added; CLAUDE.md write-limit carve-out added; all 12 implementation agents now include a `## Learnings` handoff bullet in their Report Format.
Belongs in: rules/workflow.md (already applied) + CLAUDE_TS_CHANGELOG (pending-port entry below)

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

## 2026-06-29 — workflow: cyclic-development root causes and mitigations (grill session)

Why: A grill session diagnosed why task A's review systematically emits task B, B emits C, etc. beyond foreseeable scope. Three root causes, each with a distinct cure:

1. **Foreseeable blast-radius leaks out late** — when a task introduces a shared seam (new enum, new field consumed across layers), the full blast-radius wasn't mapped up front. Fix: **targeted foresight gate** (trigger = "introduces/changes a shared contract/seam" → blast-radius map before implementation, task re-authored at full scope).
2. **No quality floor on emission** — pre-existing polish got the same task-file ceremony as security holes. Fix: **4-tier severity floor** (Correctness/Security → always emit/fix; Comprehension → emit; Consistency-with-operational-impact → emit; Polish/preference → DROP, record one line in sub-floor ledger in KNOWLEDGE_INBOX.md for theme detection). Floor test: "misleads a reader or behaves wrong" vs. "merely not preferred style."
3. **Emitted tasks pulled depth-first ahead of original backlog** — premature hardening (per-request CSP nonces) on an undecided seam (serving topology). Fix: **roadmap-prioritization rule** (emitted tasks prioritized against backlog; blocked/premature tasks parked with blocking dep named).
   Also identified: `## Emit as Task` escape valve is working as designed — the issue is scope of the originating task, not the valve. "Infinite refactoring" instinct is real: the floor provides a fixed stopping point ("understandable and works"), avoiding the shifting "ideal ideal" target.
   Belongs in: rules/workflow.md (foresight gate + severity floor + roadmap rule — Task 2026-06-29-05)

## 2026-06-29 — workflow: "project-scoped reviewer" = durable map + scoped depth, not full repo scan

Why: Agents are stateless — their "project memory" is only what they read pre-flight. A reviewer that reads only the diff classifies "introduced vs. pre-existing" correctly but cannot detect half-wired seams (e.g., nonce header added, but the HTML server that needs it is elsewhere). Fix: (1) project-map pre-flight (reviewer + security-scanner read ARCHITECTURE.md/DECISIONS.md/CONTEXT.md before every review); (2) seam-aware depth (when the change touches a shared contract, read full files + consumers + dependencies — bidirectional); (3) security-scanner also reads trust-boundary/threat-model from DECISIONS.md. Critically: this upgrade depends on the docs existing first — pointing agents at ARCHITECTURE.md before Task 19 writes it creates silent gaps. Sequence: Task 19 → Task 18 → Task 19.2 (topology docs) → Task 2026-06-29-06 (agent upgrade). "Project-scoped" = stateful map externalized into a durable doc, not stateless full-scan each review.
Belongs in: .claude/agents/reviewer.md + .claude/agents/security-scanner.md (Task 2026-06-29-06, Depends on Task 19.2)

## 2026-06-29 — roadmap: bones-before-muscles ordering — don't harden an undecided seam

Why: Depth-first security hardening (per-request CSP nonces) on a skeleton whose serving topology is undecided produced a half-wired feature that was worse than both states: it removed `'unsafe-inline'` but Angular never received the nonce, so styles would break in a non-trivial app. Rule: if an implementation option depends on an upstream architectural decision (who serves the HTML, which DB, which transport), defer the implementation until that decision is concrete. The CSP nonce task is the canonical case — reverting it was cheaper than implementing Option A (NestJS-serves HTML) speculatively, which Task 18 might invalidate. Parked-task convention encodes this: record the option analysis in the task file, park it with `Depends on` Task 18, pick the option after topology is locked.
Belongs in: rules/workflow.md (roadmap rule section, Task 2026-06-29-05) | PROJECT_CONTEXT

## 2026-06-28 — cli: slim CliConfig pattern for apps that share IdentityModule but don't need JWT/Telegram vars

Why: CLI apps that call `ApproveUserService`/`RejectUserService` only need `MONGO_URI` and `MONGO_DB_NAME`. Creating a separate `loadCliConfig()` that validates only those vars (while using the same `API_CONFIG` symbol token) lets the CLI reuse `CliIdentityModule` without requiring unrelated secrets. Each NestJS app has its own DI container so symbol identity is per-app, not global.
Belongs in (guess): PROJECT_CONTEXT (cli app architecture notes)
