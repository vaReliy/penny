# Penny

A personal family platform — budget tracking first, more household domains later. The project is being rebuilt clean-sheet on an Nx monorepo (Angular + NestJS, shared libs).

This branch (`main`) is the empty, domain-free foundation: tooling and a trivial auth-gated "hello world" slice, nothing product-specific yet.

## Branch Strategy

This repo uses a multi-branch model combining GitFlow and a reusable template pattern:

| Branch     | Status               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`   | ARCHIVED (read-only) | Legacy codebase — kept as a historical reference and rollback pointer. Zero unique commits versus `develop`; fully contained in `develop`'s history. Protected against force-push and deletion. No new PRs should open against it.                                                                                                                                                                                                       |
| `main`     | ACTIVE (release)     | Release branch; fast-forwarded from `develop` at release time to keep stable versions published. CI runs on push/pull_request/workflow_dispatch. Branch protection enforced.                                                                                                                                                                                                                                                             |
| `develop`  | ACTIVE (integration) | GitFlow-style long-term integration branch. Accepts PRs from feature branches. CI deliberately skipped on push (prevents day-to-day breakage from blocking releases); use `workflow_dispatch` to run CI on-demand before a release cut. Used to migrate the old `master` codebase to the modern pattern (Angular 17+ standalone components, NestJS services, Telegram auth, Docker). Permanent for future feature integration workflows. |
| `skeleton` | STABLE (template)    | Permanent reusable bootstrap/template branch — the clean Nx scaffolding used to seed `main` (and available for re-seeding/reference). CI explicitly enabled (deliberate decision, not accidental). Can be used to initialize new projects or reset a reference checkpoint.                                                                                                                                                               |

`main` is kept in sync with `develop` via fast-forward at release time. `skeleton` is the immutable baseline; `main` branches from it and periodically syncs releases back from `develop`. CI triggers only on `main` and `skeleton` pushes (all events: push, pull_request, workflow_dispatch); `develop` runs CI on-demand via `workflow_dispatch` only, allowing day-to-day commits without blocking on CI, deferring validation to the release process.

## Prerequisites

This repo pins **Node 22** (`.nvmrc` / `engines.node`) and **pnpm** (`packageManager` in `package.json`). Both need to be active and on `PATH` for ordinary commands _and_ for git hooks (husky) to work — a commit will fail with `pnpm: not found` if your shell's default Node/pnpm don't match.

One-time local setup:

1. **Install/select Node 22** with whichever version manager you use (nvm, mise, asdf, fnm, …) — match the version in `.nvmrc`. Most version managers auto-pick it up from `.nvmrc` when you `cd` into the repo if you've enabled that integration; otherwise activate it manually (e.g. `nvm use`).
2. **Enable Corepack for that Node install** (one-time per Node install, not per repo): `corepack enable`. This is what makes the bare `pnpm` command resolve to the exact version pinned in `packageManager`.
3. **Reinstall dependencies whenever you change Node versions** — some deps (e.g. `@swc/core`, `esbuild`) ship native bindings compiled for a specific Node ABI; switching Node versions without reinstalling can cause cryptic native-module crashes: `rm -rf node_modules && pnpm install`.

If `git commit` fails with `pnpm: not found` (or a native-binding crash), it means the shell that ran `git commit` wasn't using the Node 22 + pnpm setup above — re-check steps 1–3 for whichever terminal/IDE you committed from.

**GUI git clients (VS Code, etc.):** these often spawn commit hooks in a minimal non-interactive shell that never sources your `.bashrc`/`.zshrc`, so your version manager's `PATH` setup may not apply even if steps 1–3 work fine from a terminal. Husky already supports a fix for this: create `~/.config/husky/init.sh` (lives in your home directory, not the repo — safe to differ per machine) that puts your version manager's shims/bin dir on `PATH`, e.g. for mise: `export PATH="$HOME/.local/share/mise/shims:$PATH"`. Husky sources this file before every hook run.

## Dependency policy

- **Exact pins only.** `pnpm-workspace.yaml` sets `saveExact: true`; no `^`/`~` ranges are allowed in any `package.json`. CI runs `node tools/check-exact-pins.mjs` to enforce this.
- **Install scripts are default-denied.** `strictDepBuilds: true` in `pnpm-workspace.yaml` blocks lifecycle scripts for any dependency not explicitly listed in `allowBuilds`. If a new dependency needs to run a build/install script, review it, then run `pnpm approve-builds` and commit the resulting `allowBuilds` entry.
- **Renovate** (`renovate.json`) proposes upgrades as exact-pin PRs, grouped by ecosystem, with a 7-day minimum release age before a new version is even proposed. Nothing automerges.

## Getting started

```
pnpm install
pnpm nx report
```

Three apps exist: `apps/api` (NestJS HTTP API), `apps/web` (Angular SPA), and `apps/cli` (NestJS CLI for admin/dev commands, run via `nest-commander`). Start them locally with `pnpm nx serve api`, `pnpm nx serve web`, and `set -a && source .env && set +a && pnpm nx build cli && node dist/apps/cli/main.js <command>` respectively, or bring up the full stack with `docker compose up` (see below).

**Using this repo as a starter for a new project?** See `docs/SKELETON.md` for what's the reusable chassis versus the `identity`-specific example, and for the checklist to add a new domain vertical.

### CLI environment setup

The `apps/cli` app does not include a dotenv loader (see `apps/cli/src/config/cli-config.ts`). All CLI commands must be prefixed with `set -a && source .env && set +a` to make `MONGO_URI`, `MONGO_DB_NAME`, and other environment variables available to the process — alternatively, run in Docker (see below) to inject env vars into the container. Without env-sourcing, CLI commands fail silently on missing database connection info.

### Environment configuration

The Telegram bot username is served at runtime by the API (`GET /api/config`), fetched and provided to the frontend at bootstrap via `provideAppInitializer` (Angular 17+). The bot username is not secret (it's rendered in the DOM as `data-telegram-login` by the login widget) and is environment-agnostic at the frontend layer. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_USERNAME` (used by the API service); the frontend fetches it dynamically and needs no manual setup.

### Local dev auth

The Telegram Login Widget requires a registered domain with BotFather, which is impractical for local development. To log in locally without HTTPS/ngrok, use two CLI commands:

1. **Create a dev user** (once per username):

   ```
   set -a && source .env && set +a && pnpm nx build cli && node dist/apps/cli/main.js dev:create-user --telegram-username mydevuser --name "My Dev User"
   ```

   This creates a user with a deterministic fake `telegramId` (safe for dev — cannot collide with real Telegram user IDs).

2. **Issue a dev token** (before each session):
   ```
   set -a && source .env && set +a && pnpm nx build cli && node dist/apps/cli/main.js dev:token --telegram-username mydevuser
   ```
   This issues a 7-day JWT and outputs two cookie values:
   ```
   Set these cookies in DevTools (Application → Cookies):
   token=<JWT>
   XSRF-TOKEN=<random>
   ```

Paste both values into your browser's DevTools (Developer Tools → Application → Cookies, select your localhost origin), and refresh the page. You'll be logged in.

The `--status` flag on `dev:token` is optional (defaults to `active`); use it only if you need to test a specific user status (e.g. `--status pending`).

Both commands are guarded to refuse running in production mode.

### Integration tests (MongoDB)

Some tests (e.g. `libs/identity/infrastructure`) connect to a real MongoDB instance instead of mocking it. `docker-compose.yml`'s `mongo` service has auth enabled (`MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`, sourced from `MONGO_USER`/`MONGO_PASSWORD` in `.env`), so these tests read their connection string from the `MONGO_TEST_URI` env var rather than hard-coding an unauthenticated URI.

1. Copy `.env.example` to `.env` and set `MONGO_USER`/`MONGO_PASSWORD` (and the rest of the required vars).
2. Add `MONGO_TEST_URI` to `.env`, reusing the same credentials, e.g.:
   ```
   MONGO_TEST_URI=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/penny-test?authSource=admin
   ```
3. Start Mongo: `docker compose up -d mongo`.
4. Run the integration tests, e.g. `npx nx test identity --skip-nx-cache`.

If `MONGO_TEST_URI` is unset, the tests fall back to the unauthenticated `mongodb://localhost:27017`, which only works against a local Mongo instance with auth disabled.

## Rebuild planning

Design decisions and task breakdown live in `tasks/rebuild/` (private, git-ignored). Other feature areas get their own sibling folder under `tasks/` (e.g. `tasks/workspace/`) — see `rules/task-authoring.md`.
