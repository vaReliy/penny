# Penny

A personal family platform — budget tracking first, more household domains later. The
project is being rebuilt clean-sheet on an Nx monorepo (Angular + NestJS, shared libs).

This branch (`skeleton`) is the empty, domain-free foundation: tooling and a trivial
auth-gated "hello world" slice, nothing product-specific yet.

## Prerequisites

This repo pins **Node 22** (`.nvmrc` / `engines.node`) and **pnpm** (`packageManager` in
`package.json`). Both need to be active and on `PATH` for ordinary commands _and_ for git
hooks (husky) to work — a commit will fail with `pnpm: not found` if your shell's default
Node/pnpm don't match.

One-time local setup:

1. **Install/select Node 22** with whichever version manager you use (nvm, mise, asdf,
   fnm, …) — match the version in `.nvmrc`. Most version managers auto-pick it up from
   `.nvmrc` when you `cd` into the repo if you've enabled that integration; otherwise
   activate it manually (e.g. `nvm use`).
2. **Enable Corepack for that Node install** (one-time per Node install, not per repo):
   `corepack enable`. This is what makes the bare `pnpm` command resolve to the exact
   version pinned in `packageManager`.
3. **Reinstall dependencies whenever you change Node versions** — some deps (e.g.
   `@swc/core`, `esbuild`) ship native bindings compiled for a specific Node ABI; switching
   Node versions without reinstalling can cause cryptic native-module crashes:
   `rm -rf node_modules && pnpm install`.

If `git commit` fails with `pnpm: not found` (or a native-binding crash), it means the
shell that ran `git commit` wasn't using the Node 22 + pnpm setup above — re-check steps
1–3 for whichever terminal/IDE you committed from.

**GUI git clients (VS Code, etc.):** these often spawn commit hooks in a minimal
non-interactive shell that never sources your `.bashrc`/`.zshrc`, so your version
manager's `PATH` setup may not apply even if steps 1–3 work fine from a terminal. Husky
already supports a fix for this: create `~/.config/husky/init.sh` (lives in your home
directory, not the repo — safe to differ per machine) that puts your version manager's
shims/bin dir on `PATH`, e.g. for mise:
`export PATH="$HOME/.local/share/mise/shims:$PATH"`. Husky sources this file before
every hook run.

## Dependency policy

- **Exact pins only.** `pnpm-workspace.yaml` sets `saveExact: true`; no `^`/`~` ranges are
  allowed in any `package.json`. CI runs `node tools/check-exact-pins.mjs` to enforce this.
- **Install scripts are default-denied.** `strictDepBuilds: true` in `pnpm-workspace.yaml`
  blocks lifecycle scripts for any dependency not explicitly listed in `allowBuilds`. If a
  new dependency needs to run a build/install script, review it, then run
  `pnpm approve-builds` and commit the resulting `allowBuilds` entry.
- **Renovate** (`renovate.json`) proposes upgrades as exact-pin PRs, grouped by
  ecosystem, with a 7-day minimum release age before a new version is even proposed.
  Nothing automerges.

## Getting started

```
pnpm install
pnpm nx report
```

No apps exist yet — they're added in subsequent rebuild tasks.

## Rebuild planning

Design decisions and task breakdown live in `docs/rebuild/` (private, git-excluded).
