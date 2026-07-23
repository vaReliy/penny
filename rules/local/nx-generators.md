## Overrides rules/cts/nx-generators.md § top preamble — Mandatory: Always run `nx g`

Read this BEFORE creating any new app or lib — and BEFORE handing off to the quality gate, not only after (the CTS default only mandates the post-generator audit). **Always run the actual `nx g` generator for new apps and libs; never hand-author scaffolds by diffing a sibling.**

**Concrete incident**: `libs/budget/application` was hand-authored by diffing `libs/identity/application` rather than running `nx g @nx/js:lib`. The copied `tsconfig.json` (identity-application never imports the BigInt-backed `Money` value object) inherited the base `es2015` target; `budget-application` does import `Money` and failed typecheck with `TS2737: BigInt literals are not available when targeting lower than ES2020`. A generator run wouldn't have regressed this — `libs/budget/core`, a sibling that does import `Money`, carries the `es2020` override as visible precedent — but diffing identity-application made that override invisible. Hand-authored scaffolds can also silently drop out of `lint` targets entirely (see below).

### Nx auto-detecting a hand-written lib is NOT permission to hand-author

The Nx workspace graph does auto-detect a hand-written `project.json` + tsconfigs (so `nx affected` keeps working, as with the historical `shared-kernel`/`shared-contracts` libs), but auto-detection proves graph inclusion, not config correctness — the diffed-sibling incident above is exactly the failure mode auto-detection cannot catch.

Any implementation or quality-gate report covering a new app or lib must state the exact `nx g` command that created it. "Hand-authored" is not a reportable creation path — a report that cannot cite the generator command signals the mandate was bypassed and the scaffold must be regenerated or fully audited against a known-generated sibling.

## New section: TypeScript Value Objects Requiring ES2020+ (BigInt)

Any lib importing `shared-util`'s `Money` value object (or any other BigInt-based utility) must override the repo's base `tsconfig.base.json`'s `target: "es2015"` in its own `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2020"
  }
}
```

**Why**: `shared-util`'s `Money` (in `libs/shared/util/src/lib/money.ts`) uses BigInt minor units and contains `0n` literals in `Money.zero`, `isZero`, `isNegative`. These literals require `target: "es2020"` per TypeScript's specification. Even if you only import `Money` via a type-only import through a barrel index (`import type { SerializedMoney } from "shared-util"`), tsc must still fully resolve the module graph behind the barrel and will recompile `money.ts` under your lib's own tsconfig settings, failing with `TS2737` if you inherit the base `es2015` target.

**Pattern**: Apply the override preemptively to any new lib that imports from `shared-util` by value or type-only, rather than discovering this at typecheck time.

## Overrides rules/cts/nx-generators.md § vitest test target name

The `@nx/vitest` plugin registers the inferred test target as `test` (the `testTargetName` option in `nx.json`, kept at Nx's conventional default) — NOT `vite:test`. Use `pnpm nx test <project> --skip-nx-cache` for unit test runs. Gotcha that motivated this note: `nx <target> <project>` for a target name the project doesn't have silently resolves to nothing — after running any generator, confirm the registered target names in `nx.json` match what CI and the rules table invoke.

## Overrides rules/cts/nx-generators.md § Angular Style Files (SCSS Only)

Repo standard is the opposite of the CTS default: all style files use plain CSS (not SCSS) — Tailwind v4 does not work with CSS preprocessors. The `@nx/angular:app` and `@nx/angular:lib` generators default to CSS, which is correct here; no post-gen renaming is needed. Do not pass `--style=scss` to generators (contra the CTS default command, which does).

## New section: Tailwind `@source` Registration for New Consuming Angular Libs

`apps/web/src/styles.css` uses Tailwind v4's CSS-first config (`@import 'tailwindcss' source('./app')`) and explicitly registers every consuming lib with its own `@source '../../../libs/<path>/src'` line, since `source('./app')` scopes automatic detection to the app's own `src/app` tree and does not reach sibling Nx libs.

**When you generate a new Angular lib that will be imported by `apps/web`** (a `feature-*` lib, `shared/*` lib, or any lib whose templates use Tailwind utility classes), add a matching `@source` line to `apps/web/src/styles.css` in the same changeset. Skipping this does not error anywhere — the lib compiles and lints clean, but any Tailwind class used only in that lib's templates silently never makes it into the compiled stylesheet, producing unstyled elements with no build failure to point at the cause.

## Extends rules/cts/nx-generators.md § hand-scaffolded lib missing lint target

Concrete incident in this repo: `libs/shared/testing` was hand-scaffolded (`project.json`/`tsconfig*.json` written by hand, `tsconfig.base.json` path alias added manually) and was missing `eslint.config.mjs`, `package.json`, and `README.md` compared to a generator-created sibling — caught only by diffing the new lib's file listing against a known-generated one.
