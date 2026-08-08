## Overrides rules/cts/nx-generators.md § top preamble — Mandatory: Always run `nx g`

Read this BEFORE creating any new app or lib — and BEFORE handing off to the quality gate, not only after (the CTS default only mandates the post-generator audit). **Always run the actual `nx g` generator for new apps and libs; never hand-author scaffolds by diffing a sibling.**

**Concrete incident (historical — resolved 2026-07-22, base target raised to es2020)**: `libs/budget/application` was hand-authored by diffing `libs/identity/application` rather than running `nx g @nx/js:lib`. The copied `tsconfig.json` (identity-application never imports the BigInt-backed `Money` value object) inherited the base `es2015` target; `budget-application` does import `Money` and failed typecheck with `TS2737: BigInt literals are not available when targeting lower than ES2020`. At the time, the fix was a per-lib `target: "es2020"` override, discoverable only by diffing against a sibling lib that already carried it — `tsconfig.base.json` now targets `es2020` directly, so this specific failure mode no longer applies. The broader lesson stands: hand-authored scaffolds can silently drop config that a generator would have set correctly, and can also drop out of `lint` targets entirely (see below).

### Nx auto-detecting a hand-written lib is NOT permission to hand-author

The Nx workspace graph does auto-detect a hand-written `project.json` + tsconfigs (so `nx affected` keeps working, as with the historical `shared-kernel`/`shared-contracts` libs), but auto-detection proves graph inclusion, not config correctness — the diffed-sibling incident above is exactly the failure mode auto-detection cannot catch.

Any implementation or quality-gate report covering a new app or lib must state the exact `nx g` command that created it. "Hand-authored" is not a reportable creation path — a report that cannot cite the generator command signals the mandate was bypassed and the scaffold must be regenerated or fully audited against a known-generated sibling.

## Historical note: TypeScript Value Objects Requiring ES2020+ (BigInt)

`tsconfig.base.json` targeted `es2015` until 2026-07-22, so any lib importing `shared-util`'s BigInt-backed `Money` value object needed a per-lib `target: "es2020"` override to avoid `TS2737`. The base target is now `es2020` workspace-wide, so no per-lib override is needed for this reason — do not add one preemptively to new libs.

## Overrides rules/cts/nx-generators.md § vitest test target name

The `@nx/vitest` plugin registers the inferred test target as `test` (the `testTargetName` option in `nx.json`, kept at Nx's conventional default) — NOT `vite:test`. Use `pnpm nx test <project> --skip-nx-cache` for unit test runs. Gotcha that motivated this note: `nx <target> <project>` for a target name the project doesn't have silently resolves to nothing — after running any generator, confirm the registered target names in `nx.json` match what CI and the rules table invoke.

## Overrides rules/cts/nx-generators.md § Angular Style Files (CSS Only, not SCSS)

Repo standard is the opposite of the CTS default: all style files use plain CSS (not SCSS) — Tailwind v4 does not work with CSS preprocessors. The `@nx/angular:app` and `@nx/angular:lib` generators default to CSS, which is correct here; no post-gen renaming is needed. Do not pass `--style=scss` to generators (contra the CTS default command, which does). The CTS SCSS-only post-gen step is superseded for this repo's Angular libs. (2026-07-28)

## New section: Tailwind `@source` Registration for New Consuming Angular Libs

`apps/web/src/styles.css` uses Tailwind v4's CSS-first config (`@import 'tailwindcss' source('./app')`) and explicitly registers every consuming lib with its own `@source '../../../libs/<path>/src'` line, since `source('./app')` scopes automatic detection to the app's own `src/app` tree and does not reach sibling Nx libs.

**When you generate a new Angular lib that will be imported by `apps/web`** (a `feature-*` lib, `shared/*` lib, or any lib whose templates use Tailwind utility classes), add a matching `@source` line to `apps/web/src/styles.css` in the same changeset. Skipping this does not error anywhere — the lib compiles and lints clean, but any Tailwind class used only in that lib's templates silently never makes it into the compiled stylesheet, producing unstyled elements with no build failure to point at the cause.

## Post-Generation Vitest Config Fixes

### `nx g @nx/angular:lib` scaffolds `vite.config.mts` with deprecated plugin imports

The generator creates a config file with outdated plugin references that fail lint immediately, requiring manual fixup before first commit. (2026-07-29) After `nx g`, run `nx lint <lib>` and update plugin imports to current version before committing.

## New section: Dead Demo Component Cleanup After Adding Real Features

When you add a real feature component to a generator-scaffolded Angular lib, the generator's default demo component (e.g. `<lib-name>.ts/.html/.spec.ts` containing the raw "...works!" boilerplate) remains in the filesystem and is not automatically deleted. If you rename or shadow this default component with the real implementation, the dead component becomes unrouted and unexported from `src/index.ts` — but lint, typecheck, and tests all pass silently since nothing forces its removal.

**Pattern**: After adding a real feature component (e.g. `access-status-page.ts`), delete the generator-default component file (`<lib-name>.ts`, `<lib-name>.html`, `<lib-name>.spec.ts`). Grep the entire workspace for any references to the old component name before deleting:

```bash
grep -r "<old-component-name>" libs/ apps/
```

Zero results indicate it is safe to delete; typecheck and tests should remain green.

**Concrete incident**: `libs/identity/feature-access-status` and `libs/identity/feature-greeting` each carried their generator-default components (`identity-feature-access-status.ts/.html/.spec.ts` and similar for greeting) alongside real page components (`access-status-page.ts`, `greeting-page.ts`) that replaced them. The default components were unrouted, unexported from `src/index.ts`, and invisible to CI — confirmed zero references anywhere in libs or apps before deleting; lint/typecheck/test all remained green after cleanup.

## New section: Replace Generator-Provided README.md Boilerplate Before First Feature Commit

After `nx g` scaffolds a new lib, the generated `README.md` contains Nx-template boilerplate text: `This library was generated with @nx/angular...` (or equivalent for other frameworks). Replace this with a one-line convention matching your repo's existing libs:

```markdown
# <library-name>

**Tags:** scope:… · type:… · platform:…
```

The tags line must match the actual tags declared in the lib's `project.json` (the `tags: ["scope:...", "type:...", "platform:..."]` array). Verify by comparing against a known-good sibling lib's `README.md` — e.g., `libs/budget/core/README.md`.

**When**: Replace the boilerplate README in the same commit that adds your first feature to the lib, not before and not later. This is a single-pass step, not a separate task.

**Why**: Generator-provided boilerplate README.md content is invisible to every automated gate — no lint rule, test, or build check catches it. Without this step, the readme drifts silently across implementation tasks and appears unfinished to future contributors. A static guard test now also enforces this conformance across the workspace (`apps/web/src/readme-boilerplate.guard.spec.ts` parses all lib READMEs and confirms no boilerplate survives), so an incomplete README will surface in CI.

**Concrete incident**: 5 of 11 `libs/budget/*` libraries (`feature-account`, `feature-records`, `feature-history`, `feature-planner`, `ui`) shipped with the template boilerplate README past their feature work, invisible to review and lint, until an explicit governance-docs surface sweep caught them manually.

## New section: Nx Module Boundaries — depConstraints Coverage Gotchas

### `eslint.config.mjs`'s two `depConstraints` blocks must be checked independently

Building a guard spec to catch `scope:*`/`type:*` tags with no matching `sourceTag` entry in `depConstraints`, the first implementation regex-scanned the whole file into one merged `Set<string>` of source tags. This missed a real, live gap: `libs/identity/testing`'s `type:testing` tag had a `sourceTag` entry in the `**/*.spec.ts` override block only, not in the main block — so the merged-set guard read it as "covered" while the main `@nx/enforce-module-boundaries` rule left every non-spec `.ts` file in that lib completely unfenced.

Root cause: ESLint flat-config rule keys replace rather than merge across matching config objects, so this repo's two blocks are independent coverage domains by design (confirmed via the file's own comment) — any tag-coverage tooling must extract and check `depConstraints` per block (e.g. via a bounded per-block regex, or dynamic `import()` of the config module and iterating each flat-config array item's own `rules['@nx/enforce-module-boundaries'][1].depConstraints`), never as one flattened union. The fix (`apps/web/src/dep-constraints-tag-coverage.guard.spec.ts`) now does the latter.

### `@nx/dependency-checks` can mask `@nx/enforce-module-boundaries` when probing a banned-import rule

To verify a newly added `bannedExternalImports` entry actually fires, a probe planted `import { ObjectId } from 'bson'` in a `type:core` lib. Lint failed non-zero as expected, but the reported error was `@nx/dependency-checks` ("missing from dependencies"), not `@nx/enforce-module-boundaries` — a false positive for the thing under test, since a lib that already declared the package as a dependency would never hit this rule at all. Root cause: `@nx/dependency-checks` validates that every package actually imported by a project is declared in that project's own `package.json`, and runs independently of (and apparently before, in reported output) the module-boundary rule.

Fix for probing: temporarily add the package at its already-resolved lockfile version (exact-pinned — check `pnpm-lock.yaml`/a sibling project's `package.json` for the resolved version rather than guessing) to the target project's `package.json`, re-run, confirm the boundary error specifically, then revert. Generalises to any future banned-import probe against a package the workspace doesn't already depend on directly.

### `apps/api` and `apps/cli` carry Nx tags with no `sourceTag` entry in `depConstraints`

While auditing whether a contracts lib's cross-consumer reuse was genuinely enforced, `eslint.config.mjs`'s `depConstraints` blocks were checked line by line: `apps/api/project.json` and `apps/cli/project.json` tags have no matching `sourceTag` entry in either `depConstraints` array. The tag-coverage guard spec only sweeps `libs/*/*/project.json` by its glob, so app-level tag coverage sits entirely outside that guard's reach — not by an explicit allowlist decision, just by the glob's shape. Consequence: "apps/api imports X" is never by itself evidence that a boundary is enforced — only lib-to-lib `depConstraints` entries are. Closing this gap may be a deliberate scope choice for apps (leaf nodes, not shared libs) rather than an oversight.

### A lib tagged `platform:shared` can still be practically unreachable if its `type:*` tag is absent from every frontend-side allowlist

`platform:*` and `type:*` are two independent axes that must both permit a dependency — auditing "is this lib really shared" requires checking the `type:*` tag's reachability from frontend sourceTags, not just reading the `platform:shared` label at face value. A lib tagged `platform:shared` whose `type:*` tag appears in only one consumer type's allowlist (not in every frontend-side `type:*` allowlist) is unreachable from the excluded consumers despite the `platform:shared` label, which can produce silent duplication: constants independently restated in each excluded consumer instead of imported, sometimes with a source comment explicitly justifying the restatement as a workaround for the unreachable tag.

Detectable by cross-referencing a lib's `type:` tag against `eslint.config.mjs`'s frontend-side allowlists, and by grepping for JSDoc comments that explain why a constant is restated instead of imported — a reliable smell for this exact misplacement. (The specific lib that originally surfaced this — `libs/budget/validation` — was since dissolved, its schemas and constants colocated/hoisted elsewhere; the reachability principle and detection method above are the durable part.)

## Extends rules/cts/nx-generators.md § hand-scaffolded lib missing lint target

Concrete incident in this repo: `libs/shared/testing` was hand-scaffolded (`project.json`/`tsconfig*.json` written by hand, `tsconfig.base.json` path alias added manually) and was missing `eslint.config.mjs`, `package.json`, and `README.md` compared to a generator-created sibling — caught only by diffing the new lib's file listing against a known-generated one.
