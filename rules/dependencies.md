# Dependency Management

On-demand: read when adding, updating, or removing an npm/pnpm dependency, or after any Nx generator that injects deps into `package.json`.

## Exact-pin everything

No `^` or `~` ranges, ever — in `dependencies`, `devDependencies`, or `peerDependencies`. The invariant is non-negotiable; this file describes how to enforce it.

## Audit + pin procedure

Run after every `pnpm add` and after every `nx g …` that modifies `package.json`:

1. **Audit**: `grep -E '"\^|"~' package.json` — must return empty.
2. **Get the exact version** for each offending package:
   ```bash
   node -p "require('<pkg>/package.json').version"
   ```
   Alternatively, find the resolved version in `pnpm-lock.yaml`.
3. **Replace** the range with the exact version string. Re-run the grep to confirm empty.

Example fix:

```json
// before (generator-injected)
"webpack": "^5.99.9"

// after
"webpack": "5.99.9"
```

## Why

Reproducible installs across machines and CI; no silent minor/patch drift. Nx generators are the most common source of injected caret ranges (webpack, webpack-cli, webpack-dev-server, axios, etc.), so the audit is mandatory whenever a generator touched `package.json`.

## Monorepo Library Dependencies

### Every lib that directly imports a shared lib needs its own `package.json` entry

When adding a new intra-monorepo import to a library, check that lib's `package.json`:`dependencies` to confirm the shared lib is listed. `@nx/dependency-checks` linter will catch this as a hard error, but catching it early during implementation prevents lint failures.

Example: when `shared-contracts` became the authoritative `UserStatus` source, the implementer added `"shared-contracts": "0.0.1"` to `identity-core/package.json` but missed `identity-infrastructure/package.json`, which also imports `UserStatus`. Run `npm ls` or check each affected lib's `package.json` after refactoring shared-lib imports.

### pnpm monorepo: root-only dependencies require `-w` flag

In a pnpm monorepo with `node-linker=hoisted`, adding dependencies that live at workspace root (not app subfolder) requires the `-w` flag:

```bash
# ❌ Wrong — fails because there's no package.json in the app folder
pnpm add nest-commander --save-exact

# ✓ Correct
pnpm add nest-commander --save-exact -w
```

This applies to workspace-root-only deps like build tools, CLI packages, and workspace utilities.

## Frontend Environment Files

### Angular gitignored environment files need setup instructions

Angular's `project.json` `fileReplacements` creates a hard dependency on `environment.ts` and `environment.development.ts`. When both are gitignored (correct, to avoid committing secrets), a fresh `git clone` + `nx serve` fails immediately because the file-replacement source/target are missing.

Fix: two-part approach:

1. **Document the copy step** in `README.md` — add setup instructions for new developers
2. **Optional: add a postinstall check** that prints a human-readable error when the files are absent (not a hard block in the build, just visibility)

Include a checked-in `environment.example.ts` template so developers know what to fill in.
