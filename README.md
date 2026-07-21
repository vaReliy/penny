# Penny

A personal family platform — budget tracking first, more household domains later. The project is being rebuilt clean-sheet on an Nx monorepo (Angular + NestJS, shared libs).

This branch (`main`) is the empty, domain-free foundation: tooling and a trivial auth-gated "hello world" slice, nothing product-specific yet.

## Branch Strategy

This repo uses a multi-branch model combining GitFlow and a reusable template pattern:

| Branch     | Status                 | Purpose                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`   | DEPRECATED (read-only) | Legacy codebase — kept only for reference and rollback during migration. No new PRs should open against it.                                                                                                                                                                                                                                                           |
| `main`     | ACTIVE (stable)        | Primary development branch; the modern Nx monorepo created from `skeleton`. This is the long-term repository main.                                                                                                                                                                                                                                                    |
| `develop`  | ACTIVE (integration)   | GitFlow-style long-term integration branch for ongoing migration work. Accepts PRs from feature branches; periodically syncs into `main` once validated. Used to migrate the old `master` codebase to the modern pattern (Angular 17+ standalone components, NestJS services, Telegram auth, Docker). Will remain permanent for future feature integration workflows. |
| `skeleton` | STABLE (template)      | Permanent reusable bootstrap/template branch — the clean Nx scaffolding used to seed `main` (and available for re-seeding/reference). Not a one-time throwaway; can be used to initialize new projects or reset a reference checkpoint.                                                                                                                               |

The `develop ← skeleton ← main` flow: `skeleton` is the immutable baseline; `main` diverges for the modern architecture; `develop` branches from `skeleton` to integrate the migration work (old screens on new stack) before promotion to `main`.

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

Three apps exist: `apps/api` (NestJS HTTP API), `apps/web` (Angular SPA), and `apps/cli` (NestJS CLI for admin/dev commands, run via `nest-commander`). Start them locally with `pnpm nx serve api`, `pnpm nx serve web`, and `pnpm nx build cli && node dist/apps/cli/main.js <command>` respectively, or bring up the full stack with `docker compose up` (see below).

**Using this repo as a starter for a new project?** See `docs/SKELETON.md` for what's the reusable chassis versus the `identity`-specific example, and for the checklist to add a new domain vertical.

### Environment configuration

The web app (`apps/web`) requires local environment files before running `nx serve web`. The template is committed; make two copies and fill in your Telegram bot details:

1. Copy `apps/web/src/environments/environment.example.ts` to `apps/web/src/environments/environment.ts` (used by Docker production builds)
2. Copy it again to `apps/web/src/environments/environment.development.ts` (used by `nx serve web` local development)
3. In both files, replace `PLACEHOLDER_BOT` with your Telegram bot username (the name from BotFather ending in `bot`, without the `@` prefix — e.g., `mypennybot`)

Once set up, both files are git-ignored — they won't be committed, so each developer can keep their own local values.

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
