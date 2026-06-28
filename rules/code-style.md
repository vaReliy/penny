# TypeScript Code Style

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

## Code Quality Tools

| Tool                        | Purpose                  | Config                                |
| --------------------------- | ------------------------ | ------------------------------------- |
| ESLint + @typescript-eslint | Linting and code quality | `.eslintrc` with strict ruleset       |
| Prettier                    | Code formatting          | `.prettierrc`                         |
| tsc                         | Type checking            | `tsconfig.json` with `"strict": true` |

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

### TODO / FIXME hygiene

Describe the work, not the task number. After completing deferred work, delete the `TODO`/`FIXME` comment — stale markers are noise.

| ✓ Acceptable | ✗ Never |
|---|---|
| `// TODO: add rate limiting once Redis is wired up` | `// TODO: see task 14` |
| `// see VerifyTelegramLoginService for the HMAC detail` | `// see VerifyTelegramLoginService, task 11` |
| `// timingSafeEqual: prevents timing oracle on HMAC check` | `// added per D9 decision` |
```
