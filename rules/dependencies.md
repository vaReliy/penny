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

## Pinning CI Actions to a Commit SHA

When resolving a tag to a commit SHA for pinning, always dereference via `refs/tags/<tag>^{}` (or use `gh api repos/<owner>/<repo>/commits/<tag>`, which returns the commit directly) — never trust the bare `refs/tags/<tag>` SHA without checking whether the tag is annotated. `git ls-remote refs/tags/<tag>` on an **annotated** tag returns the tag _object_ SHA, not the commit it points at; both are 40 hex characters, so "is this 40 hex chars" does not catch the mistake. In this repo: `pnpm/action-setup@v4` resolved via the bare ref to `f40ffcd9...` (a real-looking SHA, but a tag object) instead of the actual commit `b906affc...`; six other actions pinned in the same pass happened to use lightweight tags (where the bare ref already equals the commit SHA) and weren't affected — only independently re-resolving and diffing every pin would have caught this.

## Metadata-Only Manifests (`@nx/dependency-checks` file-scoping)

`@nx/dependency-checks` only fires on files whose path ends in `/package.json` — the rule silently no-ops (returns `{}`) on any project with no manifest at all, with no error or warning. A project's `package.json` for this purpose does **not** need to be a pnpm workspace member (ESLint and the Nx graph don't consult pnpm) — this repo's pattern is a **metadata-only manifest**: every project (including `apps/api`, `apps/cli`) carries a `package.json` purely for the Nx graph and dependency-checks, deliberately excluded from `pnpm-workspace.yaml`'s globs so it never becomes a pnpm importer (a first attempt that left the globs in place forked the install into 3 importers and put per-app `node_modules` on disk for no benefit).

Declare every workspace-lib import as a real `"<lib>": "0.0.1"` dependency in the importing project's `package.json` (`nx lint <project> --fix` writes these automatically) — never blanket `ignoredDependencies`, which mutes exactly the drift the rule exists to catch. The one legitimate use of `ignoredDependencies` in this repo is `vitest` on lib projects (spec-only import; app webpack builds use `default` cache inputs so specs count as project files, but libs' `production` inputs exclude them).

**Verification is not a claim** — see `rules/workflow.md`'s quality-gate scratch-violation-proof rule: confirm a dependency-checks fix actually fires by removing an imported dep, running `nx lint <project>`, and watching it fail, before trusting "it will fire" from an agent's report.

**Lockfile-diff false alarm**: a large `pnpm-lock.yaml` diff (e.g. +3k/−8.4k lines) after `pnpm install` can be pure re-serialization by a newer pnpm version (e.g. 11.9.0 inlines `resolution:` objects that an older format spread over multiple lines) rather than an actual dependency change. Verify by diffing the sorted package-key sets before suspecting dependency drift — if they're byte-identical, it's reserialization noise.

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
