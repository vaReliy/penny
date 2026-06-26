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
`"moduleResolution": "bundler"` + `"module": "esnext"`. A generated project does
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

**Module-format contract (applies to every app and lib in this monorepo):**

- `tsconfig.base.json` sets `"moduleResolution": "bundler"` + `"module": "esnext"` for the
  whole workspace. All projects inherit this.
- A webpack-bundled **Nest app** must **not** override `module`/`moduleResolution`. Do
  **not** add `"module": "commonjs"`, `"moduleResolution": "node10"` (or `"node"`/`"node16"`),
  or `"ignoreDeprecations"`. Webpack already emits a CommonJS Node bundle at runtime — the
  TypeScript resolver setting does not change the runtime format.
- **Libs** are ESM (`"type": "module"` in `package.json`) and inherit `bundler`; they are
  consumed from source via tsconfig `paths` and bundled into apps — never published
  standalone, so `nodenext` is not needed.
- `.js` extensions on relative imports are enforced **backend-only** via ESLint (D26/D29).
  Angular/Nx paths use barrel `index.ts` exports and do not need the extension.

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
