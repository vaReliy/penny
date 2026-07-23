## Extends rules/cts/dependencies.md § "Metadata-Only Manifests"

Concrete instantiation in this repo: `apps/api` and `apps/cli` carry metadata-only `package.json` files, deliberately excluded from `pnpm-workspace.yaml`'s globs so they never become pnpm importers (a first attempt that left the globs in place forked the install into 3 importers and put per-app `node_modules` on disk for no benefit).

The one legitimate use of `ignoredDependencies` in this repo is `vitest` on lib projects (spec-only import; app webpack builds use `default` cache inputs so specs count as project files, but libs' `production` inputs exclude them) — do not extend this exception to any other dependency.

## New section: Frontend Environment Files

### Angular environment config — runtime API fetch, not build-time injection

The Telegram bot username (non-secret, rendered in the DOM as `data-telegram-login` by the login widget) is not committed in a frontend `environment.ts` file. Instead, it is served by the API at `GET /api/config` and fetched at SPA bootstrap via `provideAppInitializer` (Angular 17+), making the web Docker image environment-agnostic and deployable to any bot without rebuilding.

The bot **token** remains secret and backend-only, living in `.env` / API config exclusively. The bot **username** is public config, living as an environment variable passed to the `api` service (via `docker-compose.yml`'s `services.api.environment:`) with no value embedded in the frontend bundle at all.

**Why:** A frontend environment file cannot contain a secret, because everything in a browser bundle is public by construction. Treating a non-secret value as if it were secret produces a gitignored generated file, which means every context compiling the app (the CI job, the e2e job, the Dockerfile, and any fresh clone) must regenerate it independently before any build target will compile — converting correctness from a property of the repository into a property of every execution context. Committing the file was rejected because it's domain-specific (Penny's username). Moving the value to the API (read at runtime, not baked into the build) splits the responsibilities correctly: the bot token is API config (secret, backend-only); the username is API config too, but public, and is fetched by the frontend when it needs it.
