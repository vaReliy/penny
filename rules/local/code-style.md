## Extends rules/cts/code-style.md § "Imports"

Shared conventions for TypeScript code across all platforms (backend Node.js, frontend Angular). For platform-specific guidance, see `rules/local/code-style-angular.md` and `rules/local/code-style-backend.md`.

## Overrides rules/cts/code-style.md § relative-import-extension convention (NodeNext)

Backend-only: `.js` extensions in relative imports are enforced via ESLint (resolver is `bundler`, not NodeNext):

```typescript
// Backend code — ESLint requires .js
import { logger } from './lib/logger.js';

// Frontend code — extensions optional (Angular modules resolve without them)
import { UserService } from './user.service';
```

## Extends rules/cts/code-style.md § "Imports" — import type / re-export hygiene

When an interface is moved from being declared inline in module A to being `import type`-d from module B, `export * from './module-a.js'` no longer carries that symbol — `export *` only propagates declared/exported members, not type-imported ones. Downstream consumers that imported the symbol from module A get a compile-time "has no exported member" error.

Checklist for type-lift refactors: after replacing an inline declaration with `import type`, grep every file that imported the symbol from the original module and update them to the authoritative source.

## Extends rules/cts/code-style.md — Floating-Point Arithmetic

### Averaging two floats then `.toString()` reintroduces float-precision loss in a decimal-string field

A "decimal string" field was designed to avoid float precision loss in transport, but averaging two floats then calling `.toString()` defeats that. Example: `((27.1 + 27.3) / 2).toString()` emits `"27.200000000000003"` even though both inputs are precise. (2026-07-27)

**Fix**: any derived decimal value bound for a documented precision-preserving string field must use `.toFixed(n)` before serialization — raw float arithmetic output is never safe.

**Test fixtures**: include at least one operand pair triggering binary-float rounding (e.g., `27.1 + 27.3`, `0.1 + 0.2`), not just round numbers like `41.5 + 42.1` that mask the defect.

### Re-exporting merged declarations

A bare re-export (`export { X }`) covers both value and type namespaces when the source has a declaration merge (const object + same-name type alias):

```typescript
// In module A: const + type merge
export const UserStatus = { ACTIVE: 'ACTIVE', ... } as const;
export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

// In module B re-exporting both namespaces in one statement
export { UserStatus } from './user-status.js';
```

Callers can then use both `UserStatus.ACTIVE` (value) and `status: UserStatus` (type) from the single import binding.

## Extends rules/cts/code-style.md § "Comments"

- **Never write**: history-flavored language in doc comments: `// no longer does X`, `// now does Y`, `// used to be Z`. Comments should state the present-tense rule/contract, never the change history (that belongs in commit messages/PR descriptions).

## Extends rules/cts/code-style.md — new section: ESLint Flat Config and Path Anchoring

### Root-config `files` globs and Nx project scoping

Nx runs `eslint .` per project with `cwd` set to that project's own root. Every project has a local `eslint.config.mjs` that spreads the root config array. ESLint flat config resolves every `files` glob — even on objects that originated in the spread root config — against the basePath of the config file it actually loads (the nearest one to cwd), not the repo root.

**Critical issue**: a root-config rule scoped via e.g. `files: ['libs/*/application/**/*.ts']` can never match when `cwd` IS `libs/identity/application` — that path segment is stripped from every relative path ESLint evaluates (`src/lib/foo.ts`, never `libs/identity/application/src/lib/foo.ts`). The only reliable check is `cd <project-dir> && npx eslint --print-config <file>` and confirming the rule key isn't `null`.

**Fix pattern**: export the rule object as a named export from root config, then apply it via `files: ['**/*.ts']` (no path-segment dependency) from inside each affected project's own local `eslint.config.mjs`. Same-named rule keys (e.g. two `no-restricted-syntax` blocks) do NOT merge across config objects — the last one wins silently, so any fix must merge selector arrays into the same key per project rather than adding a competing block.

### ESLint flat config REPLACES `no-restricted-syntax` wholesale

When a project-local flat config includes a `no-restricted-syntax` rule alongside a root-config one with the same key, the project-local rule fully replaces it — no merging of selector arrays. (2026-08-06) Fix any multi-rule application by merging all selectors into a single `no-restricted-syntax` block per project.
