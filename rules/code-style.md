# TypeScript Code Style

Shared conventions for TypeScript code across all platforms (backend Node.js, frontend Angular, etc.). For platform-specific guidance, see `rules/code-style-angular.md` and `rules/code-style-backend.md`.

## Strict TypeScript

- All TypeScript files must have `"strict": true` in tsconfig (covers `strictNullChecks`, `noImplicitAny`, etc.)
- Explicit return types required on all public methods and functions
- No `any` — use `unknown` for catch blocks and external data, then narrow with type guards
- Prefer discriminated unions for state modeling over boolean flags
- Use `const` assertions (`as const`) for literal type inference

## Naming Conventions

| Construct                         | Convention       | Example                                |
| --------------------------------- | ---------------- | -------------------------------------- |
| Classes, Interfaces, Types, Enums | PascalCase       | `CreatePostUseCase`, `IPostRepository` |
| Variables, functions, methods     | camelCase        | `createPost`, `postId`                 |
| Constants                         | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`                      |
| File names                        | kebab-case       | `create-post.usecase.ts`               |
| Enum values                       | UPPER_SNAKE_CASE | `PostStatus.PUBLISHED`                 |

## Class Organization

Specific order for class elements:

1. Static constants
2. Static properties
3. Instance properties
4. Constructor
5. Public methods
6. Protected methods
7. Private methods

## Import Ordering

1. Node.js built-in modules (`fs`, `path`, `crypto`)
2. External packages (`express`, `prisma`, `bullmq`)
3. Internal modules (absolute paths via tsconfig paths, e.g. `@/services/`)
4. Relative imports (`./`, `../`)

## Imports: `type` keyword for types

```typescript
// ✓ Correct — type-only imports get stripped at build
import type { User, UserRole } from './user';
import { createUser } from './user';

// Prefer named exports, avoid barrel re-exports from index.ts
export { User, UserRole };
export { createUser };
```

## Relative import extensions

Backend-only: `.js` extensions in relative imports are enforced via ESLint (resolver is `bundler`, not NodeNext):

```typescript
// Backend code — ESLint requires .js
import { logger } from './lib/logger.js';

// Frontend code — extensions optional (Angular modules resolve without them)
import { UserService } from './user.service';
```

## Import hygiene: `import type` and re-exports

When an interface is moved from being declared inline in module A to being `import type`-d from module B, `export * from './module-a.js'` no longer carries that symbol — `export *` only propagates declared/exported members, not type-imported ones. Downstream consumers that imported the symbol from module A get a compile-time "has no exported member" error.

Checklist for type-lift refactors: after replacing an inline declaration with `import type`, grep every file that imported the symbol from the original module and update them to the authoritative source.

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

## Object Destructuring

When forwarding two or more fields from the same source object into a function call or object literal with no transformation, destructure first to eliminate repeated `source.fieldName` references:

```typescript
// Prefer
const { firstName, lastName, username, photoUrl } = params;
await repo.updateProfile(id, { firstName, lastName, username, photoUrl });

// Avoid
await repo.updateProfile(id, {
  firstName: params.firstName,
  lastName: params.lastName,
  username: params.username,
  photoUrl: params.photoUrl,
});
```

Exception: when only one field is used, or when the field name on the target differs from the source, inline access is clearer.

## Shell Script Conventions

### Dual-path JSON/grep parsing: jq `//` is NOT equivalent to shell `||`

When a shell script uses two parsing paths (jq as the primary, grep/sed as a fallback), do not assume they behave identically on edge cases. jq's `// "default"` (alternative operator) applies the default only on **successful parses** with missing/null fields. On a parse failure (malformed/non-JSON stdin), jq outputs an empty string. In contrast, the grep/sed fallback's `|| echo "default"` always produces a value when the fallback is invoked.

This mismatch is subtle on correct input but creates a divergence on malformed input, especially when a script chooses between parsing paths (jq vs. grep/sed) based on tool availability. For example:

```bash
# Two alternative branches selected by tool availability — this is where the mismatch bites:
if command -v jq &>/dev/null; then
  SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"')
else
  SESSION_ID=$(printf '%s' "$INPUT" \
    | grep -oP '"session_id"\s*:\s*"\K[^"]+' 2>/dev/null | head -1 \
    || echo "unknown")
fi

# Branch-independent normalization: on malformed input the jq branch yields "" (its
# // default applies only to successful parses), while the grep branch's || echo
# already yielded a value. One empty-check after both branches aligns them.
[ -z "$SESSION_ID" ] && SESSION_ID="unknown"
```

The mismatch arises when a script has a jq branch and a grep/sed fallback branch chosen by `command -v jq`; never assume the two branches handle malformed input identically. Normalize once, branch-independently, after both branches execute — that single empty-check ensures consistent behavior regardless of which path was taken.

## Error Handling

Use typed custom error classes — never throw untyped errors:

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {
  constructor(public readonly errors: Record<string, string>) {
    super('Validation failed', 'VALIDATION_ERROR', 422);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}
```

## Comments

Comments are the exception, not the default. Well-named code is the primary documentation (Clean Code principle). Write a comment only when the WHY cannot be expressed through renaming or restructuring.

### Acceptable comments

- **Hidden constraint / invariant / algorithm rationale**: a timing requirement, library bug workaround, security invariant, or algorithm choice that would surprise a reader — "why this and not the simpler thing." General algorithm tutorials belong as a link (RFC, spec URL), not inline.
- **`// TODO: <self-contained description>`** — deferred work; remove when done.
- **`// FIXME: <self-contained description>`** — known issue; remove when fixed.
- **Symbol cross-reference**: `// see SomeClass for detail` — class/function name alone, no task reference.
- Legal/license headers.

### Never write

- Comments that restate what the code does (`// iterate over users`).
- Task IDs, decision IDs, or task file references in any form: `D9`, `D10`, `task 11`, `task 12`, `added for task X`, `per decision D14`.
- Caller/usage annotations: `// used by AuthController`, `// called from login flow`.
- Closing-brace labels: `// end if`, `// end for`.
- Anything that requires the task backlog to make sense.
- History-flavored language in doc comments: `// no longer does X`, `// now does Y`, `// used to be Z`. Comments should state the present-tense rule/contract, never the change history (that belongs in commit messages/PR descriptions).

### TODO / FIXME hygiene

Describe the work, not the task number. After completing deferred work, delete the `TODO`/`FIXME` comment — stale markers are noise.

| ✓ Acceptable                                               | ✗ Never                                      |
| ---------------------------------------------------------- | -------------------------------------------- |
| `// TODO: add rate limiting once Redis is wired up`        | `// TODO: see task 14`                       |
| `// see VerifyTelegramLoginService for the HMAC detail`    | `// see VerifyTelegramLoginService, task 11` |
| `// timingSafeEqual: prevents timing oracle on HMAC check` | `// added per D9 decision`                   |

## ESLint Flat Config and Path Anchoring

### Root-config `files` globs and Nx project scoping

Nx runs `eslint .` per project with `cwd` set to that project's own root. Every project has a local `eslint.config.mjs` that spreads the root config array. ESLint flat config resolves every `files` glob — even on objects that originated in the spread root config — against the basePath of the config file it actually loads (the nearest one to cwd), not the repo root.

**Critical issue**: a root-config rule scoped via e.g. `files: ['libs/*/application/**/*.ts']` can never match when `cwd` IS `libs/identity/application` — that path segment is stripped from every relative path ESLint evaluates (`src/lib/foo.ts`, never `libs/identity/application/src/lib/foo.ts`). The only reliable check is `cd <project-dir> && npx eslint --print-config <file>` and confirming the rule key isn't `null`.

**Fix pattern**: export the rule object as a named export from root config, then apply it via `files: ['**/*.ts']` (no path-segment dependency) from inside each affected project's own local `eslint.config.mjs`. Same-named rule keys (e.g. two `no-restricted-syntax` blocks) do NOT merge across config objects — the last one wins silently, so any fix must merge selector arrays into the same key per project rather than adding a competing block.
