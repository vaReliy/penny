# Using This Repo as a Starter

This document is for a developer forking this repo (or the `skeleton` branch specifically) to start a **new** backend+frontend SaaS with Telegram-based auth — an admin panel, a home-monitoring dashboard, anything with the same "small trusted user base, low-friction login, admin-approval gate" shape. It assumes no prior context beyond `README.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and `DECISIONS.md`, which you should skim first.

## a. What this skeleton is

A domain-free, production-deployable Nx fullstack chassis:

- **Angular 17+** (standalone components, signals, no NgModules) for the frontend.
- **NestJS** for the HTTP API, plus a **NestJS CLI** (`nest-commander`) sharing the same application-layer services and dependency-injection container shape as the API — admin/dev tasks run as CLI commands, not ad-hoc scripts.
- **MongoDB** via Mongoose/Typegoose, confined entirely behind repository interfaces.
- **Onion (clean) architecture**, organized as Nx libs per bounded context, with layer boundaries (`scope:` × `type:` × `platform:` tags) enforced by `@nx/enforce-module-boundaries` — a violation fails lint, not just code review. See `ARCHITECTURE.md` for the full layer diagram and `DECISIONS.md` (ADR-003) for the rationale.
- **Telegram Login Widget** authentication (ADR-001) with an admin-approval gate: a new login creates a `pending` user; an admin must approve it via CLI before the user can use the app. Sessions are `httpOnly` + `Secure` + `SameSite=Lax` cookie-based JWTs — no `localStorage` token storage anywhere (ESLint-enforced ban in `platform:web` libs).
- **LIVR** (`js-validator-livr`) validation at the application-layer service boundary — see `rules/validation-authorization.md`.
- **Exact-pinned dependencies** everywhere (ADR-004) — no `^`/`~` ranges, enforced by `tools/check-exact-pins.mjs` in CI.
- **Full CI** (`.github/workflows/ci.yml`): root-anchored lint (`lint:root`), per-project lint/test/typecheck/build via `nx affected`, Playwright e2e against the _built_ web artifact (not the dev server), and Docker image builds for all three apps.
- **Docker Compose** (`docker-compose.yml`) for a production-like local stack: nginx-served Angular SPA reverse-proxying `/api/` to the NestJS API, which talks to MongoDB — see "Serving Topology" in `ARCHITECTURE.md`.

`identity` (`libs/identity/*`) is not a toy example — it's a real, working vertical slice (Telegram login, session guards, admin approve/reject, three Angular pages) that doubles as the template for every new domain you add. Read it before writing anything.

## b. Run it locally

Do not duplicate `README.md` here — it's the source of truth for exact commands. In order:

1. Install Node 22 + enable Corepack (`README.md` § Prerequisites).
2. `pnpm install`.
3. Register a Telegram bot with [@BotFather](https://t.me/BotFather) and get its token and username. Add `TELEGRAM_BOT_TOKEN` (secret; API only) and `TELEGRAM_BOT_USERNAME` (public; served from API to frontend at runtime) to your `.env` — both are required.
4. Either:

- **Full stack via Docker:** copy `.env.example` to `.env`, fill in real values (database, JWT secret, Telegram bot token), then `docker compose up`. Serves the SPA on `http://localhost` (port 80), reverse-proxying `/api/` to the NestJS API; MongoDB runs as a third container.
- **Local dev servers:** `pnpm nx serve api` and `pnpm nx serve web` in separate terminals, with `docker compose up -d mongo` for the database (see `README.md` § Integration tests for the `MONGO_TEST_URI` env var needed by Mongo-backed specs).

5. Approve the first user as admin via the CLI, e.g. `pnpm nx build cli && node dist/apps/cli/main.js user:approve <telegramId>` (or the Docker-container equivalent). See `apps/cli/src/commands/` for the full command list (`user-approve`, `user-reject`, `admin-promote`, `dev-token`, `dev-create-user` — the last two are dev-only shortcuts, not for production use).

## c. Add a new domain vertical

This is the core value of this document. `identity` is the concrete example to copy — reference its actual files by path rather than re-deriving the shape from scratch.

**Never hand-scaffold a new lib.** Manually writing `project.json`/`tsconfig*.json` produces a project that's silently missing from `lint` (no inferred `lint` target without a generator-created `eslint.config.mjs`) — see `rules/nx-generators.md` for the full consequence list. Always run the generator, then apply the post-generator corrections that file documents (tsconfig strictness, SCSS-not-CSS for Angular, `vite.config.mts` cleanup, etc.).

### 1. Scaffold the backend libs

For a new domain `<domain>` (e.g. `budget`), create the onion stack mirroring `libs/identity/{core,application,infrastructure}`:

```bash
pnpm nx g @nx/js:lib <domain>/core --directory=libs/<domain>/core --unitTestRunner=vitest
pnpm nx g @nx/js:lib <domain>/application --directory=libs/<domain>/application --unitTestRunner=vitest
pnpm nx g @nx/js:lib <domain>/infrastructure --directory=libs/<domain>/infrastructure --unitTestRunner=vitest
```

After each, set `tags` in `project.json` to match `libs/identity/core/project.json` / `identity/application/project.json` / `identity/infrastructure/project.json`'s shape but with your scope, e.g. `["scope:<domain>", "type:core", "platform:server"]`. Add a `typecheck` target (`nx:run-commands` running `tsc --noEmit -p tsconfig.spec.json`) — copy the block verbatim from `libs/identity/core/project.json`; it is not generator-inferred for `@nx/vitest`-based projects (see `rules/nx-generators.md` for why).

### 2. Scaffold the frontend libs

Mirror `libs/identity/{feature-login,feature-access-status,feature-greeting,data-access}`:

```bash
pnpm nx g @nx/angular:lib --name=<domain>-feature-<x> --directory=libs/<domain>/feature-<x> \
  --tags="scope:<domain>,type:feature,platform:web" --style=scss --standalone --no-interactive
```

`--name` and `--directory` must both be explicit (the generator silently drops the domain prefix from a positional argument without `--directory`) — see `rules/nx-generators.md`. Run the Angular-generator post-fixes from that same file (remove `@nx/vite/plugins/…` imports from `vite.config.mts`, rename `.css` → `.scss`, audit the stub spec's component-class import name).

### 3. Per-lib `package.json` dependencies

Every intra-monorepo import (e.g. `<domain>-core` importing `shared-kernel`) must be listed in that lib's `package.json`:`dependencies` — `@nx/dependency-checks` (wired via each lib's `eslint.config.mjs`, see `libs/identity/core/eslint.config.mjs`) fails lint otherwise. Copy the `eslint.config.mjs` pattern from an existing lib; it isn't generator-created for `@nx/js:lib`.

### 4. Barrel exports

Every lib's public surface goes through `src/index.ts` — see `libs/identity/core/src/index.ts` and siblings. Internal files are never imported by path from outside the lib.

### 5. DI wiring in `apps/api` / `apps/cli`

Both apps use the same pattern: a per-app `<domain>.module.ts` (see `apps/api/src/identity/identity.module.ts` and `apps/cli/src/identity/cli-identity.module.ts`) with Symbol-token factory providers (`TOKENS.<Thing>`, defined in a sibling `tokens.ts`) — never `@Injectable()` on application/core-layer classes (that's an ESLint hard fuse; DI wiring is a transport-layer-only concern, ADR-003). Each app constructs its own MongoDB connection, repository implementation, and application services via `useFactory`, then registers the module in `app.module.ts`'s `imports` array. The `api` and `cli` DI containers are independent — CLI-only apps only need the config/services they actually use (see `apps/cli/src/config/cli-config.ts` for the narrower `loadCliConfig()` pattern vs. `apps/api`'s full config).

### 6. Route registration in `apps/web`

Add lazy routes in `apps/web/src/app/app.routes.ts` following the existing entries — each `loadComponent` dynamically imports a `feature-*` lib's barrel export, optionally behind a `canActivate` guard exported from the domain's `data-access` lib (see `identity-data-access`'s `statusGuard`/`loginGuard` for the pattern of redirecting based on session/domain state).

### 7. Tests

Write unit tests alongside implementation (Vitest, `describe`/`it`/`expect`) — see any `libs/identity/**/*.spec.ts` for conventions. Coverage is a per-lib opt-in: most libs only generate reports (v8 provider, `reportsDirectory` set per `vitest.config.mts`), but a lib can set `coverage.enabled: true` plus a `thresholds` block to gate every `test` invocation (including CI's `nx affected -t test`) on a minimum percentage — `libs/identity/core` and `libs/identity/application` do this today (`statements`/`branches`/`functions`/`lines` at 76/95/73/76 and 92/85/95/92 respectively, each set a few points below a measured baseline so it ratchets against regressions rather than being an aspirational target). Copy this pattern for your new vertical's `core`/`application` libs rather than leaving coverage unenforced by default. If your domain has Mongo-backed integration specs, follow the `MONGO_TEST_URI` pattern in `libs/identity/infrastructure` (real Mongo connection, no mocking, no skip guard — they fail hard without a reachable database).

### 8. Verify the boundary is actually enforced

Prove a same-scope-different-platform or cross-scope import genuinely fails before considering the vertical done: temporarily add an illegal import (e.g. your new `type:core` lib importing directly from `libs/identity/core`, or a `platform:web` lib importing a `platform:server` one), run `pnpm nx lint <affected-project>`, confirm it errors, then revert the import. This is the same probe the "hard fuses" in `rules/nx-generators.md`/CI rely on — an inferred target or lint rule that silently doesn't run is a documented recurring failure mode in this repo, not a hypothetical.

## d. Rename/strip checklist

Everything Penny-specific a fork needs to change:

- **Project identity:** `package.json` `name`, any repo-name strings in `README.md`/`CLAUDE.md`/ `AGENTS.md` headers.
- **Docker Compose:** `docker-compose.yml`'s `container_name` values (`penny-mongo`, `penny-api`, `penny-web`) and network name (`penny_net`); `.env.example`'s `MONGO_DB_NAME` default (`penny`).
- **Telegram bot registration:** the Login Widget requires a bot registered with BotFather and bound to a real HTTPS domain for production use (ADR-001's "Consequences" — the widget has documented limitations testing against bare `localhost`). Plan your bot registration and domain before deploying past local dev.
- **Decide what's chassis vs. example:** `libs/shared/*`, the Nx/ESLint/CI tooling, the Docker setup, and the onion-layer pattern itself are the reusable chassis. `libs/identity/*` **is** your product's auth — keep it (Telegram login + admin-approval is likely still what you want), but everything else under `libs/<domain>/` for a _different_ product domain (in the original Penny repo: `budget`, `car`) should be deleted, not kept as unused scaffolding.
- **CI/repo references:** `.github/workflows/ci.yml`'s branch filters (`on.branches`) and `main-branch-name` input to `nrwl/nx-set-shas` assume `main`/`skeleton` branch names — update if your fork uses different branch naming. No badges or other repo-URL references exist elsewhere in the tracked files as of this writing; grep for the old repo name before considering this done.

## e. Receiving skeleton updates

This branch (`skeleton`) is meant to stay a maintained, domain-free chassis over time — generic fixes (a resurrected dead ESLint fuse, a corrected CI gotcha, a hardened hook) belong here, not buried in a product-specific fork. The intended flow:

- Forks/downstream branches cherry-pick **generic** fixes from `skeleton` (tooling, CI, the onion-architecture pattern itself, `identity`-as-auth-slice improvements) as they land.
- Project-specific code (a new domain vertical's business logic, product-specific config) never flows back into `skeleton` — it stays in the fork.
- If you find a genuine chassis-level bug or gap while building your fork (not specific to your domain), consider whether it's worth upstreaming to `skeleton` rather than only fixing it locally — that's the mechanism that keeps this document and the underlying tooling from rotting for the next fork.
