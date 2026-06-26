# Nx Generator Hygiene

Read this AFTER running any `nx g …` generator (apps, libs, configs) and BEFORE handing
off to the quality gate. Generators produce working-but-unpolished output; every item
below has shipped as a real defect.

## 1. Audit injected dependencies

Generators write caret ranges (`^`) into `package.json` (webpack, webpack-cli, axios, …).
Run the audit + exact-pin procedure in `rules/dependencies.md` before handoff. Short form:
`grep -E '"\^|"~' package.json` must return empty.

## 2. Fix the generated tsconfig

The repo base (`tsconfig.base.json`) is intentionally minimal: no `strict` block,
`"moduleResolution": "bundler"` (tuned for Vite/Angular libs). A generated project does
**NOT** inherit strictness — declare it explicitly in the project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

For a **Nest app** (CommonJS via webpack), the resolution differs from a lib — do **not**
copy a lib's `"bundler"` value:

- `"module": "commonjs"`
- `"moduleResolution": "node10"` (non-deprecated rename of `"node"`), **OR** keep `"node"`
  and add `"ignoreDeprecations": "5.0"` to silence `TS5110`.

Never leave the bare deprecated `"moduleResolution": "node"` — it warns on every `tsc` run.

## 3. Wire process bootstrap (LIVR)

A new process entrypoint (`main.ts`, CLI, queue worker) must call `registerLivrRules()`
from `shared-kernel` **exactly once** at startup, before any `BaseService` or
`LIVR.Validator` runs. `BaseService` does not self-register rules.

**Omitting it passes build and tsc but throws at the first validation call at runtime.**

See `rules/validation-authorization.md` → _LIVR bootstrap_ section for the call site.

## 4. Audit companion projects

Generators scaffold sibling projects (e.g. `apps/<name>-e2e`). Audit them too:

- Remove or narrow any blanket `/* eslint-disable */` the generator added — fix the
  underlying lint issue (e.g. `no-var → const/let`) instead of suppressing the whole file.
- Delete a companion project you don't intend to use rather than leaving it lint-disabled.

## 5. A green build does not close the task

`nx build` exiting 0 proves compilation, not correctness. The quality gate
(`tester` + `reviewer`, see `rules/workflow.md`) still runs. Advance to Phase 4 — do
not declare the task done.
