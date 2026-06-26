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

## 2026-06-26 — api: monorepo has a latent ESM/CJS split that blocks moduleResolution migration

Why: `tsconfig.base.json` emits `"module": "esnext"` (ESM) for all shared libs; `apps/api` overrides to `"module": "commonjs"` (CJS). Migrating `apps/api` to `moduleResolution: "node16"` exposed 10+ TS1479 errors — CJS cannot `require()` ESM modules. `"ignoreDeprecations": "5.0"` was added as a deferral; it breaks at TS 6.0. Real fix: either move `apps/api` to ESM (`"type": "module"` + NestJS ESM mode) or rebuild shared libs as CJS.
Belongs in: rules/architecture.md (module format section) or PROJECT_CONTEXT

## 2026-06-26 — api: `ignoreDeprecations` value "5.0" vs "6.0" depends on installed TypeScript

Why: TypeScript 5.9.3 (project) accepts only `"5.0"` for `ignoreDeprecations`; the VS Code bundled language server (newer) suggests `"6.0"`. Using `"6.0"` in tsconfig causes TS5103 in the CLI build. Resolve IDE/CLI mismatch via "TypeScript: Select TypeScript Version → Use Workspace Version" in VS Code.
Belongs in: rules/code-style.md or AGENTS.md setup note

## 2026-06-26 — testing: `delete process.env[KEY]` bypasses vi.stubEnv restoration

Why: `vi.stubEnv` saves and restores env vars on `vi.unstubAllEnvs()`; `delete process.env[KEY]` operates outside that tracking. Pattern found in `apps/api/src/config/api-config.spec.ts`. Fix: treat empty string as absent in production env readers (`portRaw ? … : default` instead of `portRaw !== undefined ? … : default`), then use `vi.stubEnv(KEY, '')` to simulate absence without deletion.
Belongs in: rules/testing.md

## 2026-06-25 — identity: no central roles registry — 'admin' is a plain string constant

Why: `ApproveUserService`/`RejectUserService` check `context.caller.roles.includes(ADMIN_ROLE)` where `ADMIN_ROLE = 'admin'`. No existing roles enum or registry was found. Future role additions should either establish one central `Roles` constant in `shared-kernel` or accept this convention. Currently works but risks drift.
Belongs in (guess): PROJECT_CONTEXT | rule (authorization)
