# Knowledge Inbox

Append-only queue for durable, project-relevant learnings whose final home isn't clear yet. Distilled into PROJECT_CONTEXT.md / CLAUDE.md / a rule / a skill, then deleted from here — this file should trend toward empty.

## 2026-06-25 — code review: flag history-flavored words in doc comments

Why: a comment that says "no longer does X" / "now does Y" / "used to be Z" describes the diff that produced the current code, not the current invariant — it reads fine right after the change but rots the moment the next change lands, since nobody remembers to revisit prose. Comments should state the present-tense rule/contract ("does not do X; callers must do Y"), never the change history (that belongs in the commit message/PR description).
Belongs in (guess): rule (rules/code-style.md, as a review checklist item) or reviewer agent instructions

## 2026-06-25 — identity: UserStatus type drift between shared-contracts and identity-core

Why: `shared-contracts/src/lib/user-status.ts` defines `UserStatus = 'active' | 'pending' | 'banned'` (stale, from earlier design); `identity-core/src/lib/user-status.ts` has the live enum (`pending | active | rejected`). The identity application layer correctly uses `identity-core`'s version — but callers referencing `shared-contracts` will get a wrong type. Needs cleanup: `shared-contracts` should re-export or replace with `identity-core`'s version.
Belongs in (guess): PROJECT_CONTEXT | rule (architecture)

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

## 2026-06-25 — identity: no central roles registry — 'admin' is a plain string constant

Why: `ApproveUserService`/`RejectUserService` check `context.caller.roles.includes(ADMIN_ROLE)` where `ADMIN_ROLE = 'admin'`. No existing roles enum or registry was found. Future role additions should either establish one central `Roles` constant in `shared-kernel` or accept this convention. Currently works but risks drift.
Belongs in (guess): PROJECT_CONTEXT | rule (authorization)

## 2026-06-26 — workflow: knowledge capture requires a Stop hook, not just spec wording

Why: Three root causes made agents consistently write learnings to private auto-memory instead of docs/KNOWLEDGE_INBOX.md: (1) rules/workflow.md routed "config gotchas" to auto-memory and had an escape hatch "Claude-session-specific gotchas still go to auto-memory" that rationalized almost any learning; (2) Phase 6 was framed as "after every pipeline" so direct/trivial edits never triggered it; (3) none of the 16 agent definitions mentioned the inbox. Instructions are probabilistic — the harness system prompt pulls strongly toward private memory. Only a Stop hook (which the harness enforces) creates a deterministic checkpoint. Fix applied: `.claude/hooks/knowledge-capture-nudge.sh` blocks once per session per unmet obligation (inbox / CLAUDE_TS_CHANGELOG); rules/workflow.md escape hatch removed; litmus test added; CLAUDE.md write-limit carve-out added; all 12 implementation agents now include a `## Learnings` handoff bullet in their Report Format.
Belongs in: rules/workflow.md (already applied) + CLAUDE_TS_CHANGELOG (pending-port entry below)
