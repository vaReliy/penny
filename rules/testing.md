# Testing Rules

## Entities/Models Testing Policy

**DO NOT** create unit tests for basic ORM entity CRUD or simple relationships.

Rationale: ORM libraries (Prisma, TypeORM, Drizzle) are extensively tested by their maintainers. Testing basic CRUD provides no value.

What NOT to test:

- Basic ORM relations
- Simple CRUD via repository
- Standard ORM casting/transformations
- Factory/seed creation without custom logic

What TO test:

- Custom business logic in UseCases/Services
- Complex validators with business rules
- Guards and authorization logic
- Event handlers and side effects
- Custom repository methods with complex queries

## Framework & Tools

- **Vitest** (preferred) or Jest with ts-jest — BDD-style syntax: `describe()` + `it()` + `expect()`
- **Mutation Testing** with Stryker Mutator — `npx stryker run`
- **E2E Testing** — Playwright (handled exclusively by `qa` agent)

## Test Structure

```
test/
├── unit/         # Unit tests (UseCases, Services, validators, guards)
├── integration/  # Integration tests (HTTP endpoints, DB queries)
```

E2E tests live in `e2e/` and are owned by the `qa` agent.

## Running Tests

Use nx targets — never invoke vitest/jest directly (see `rules/workflow.md` → Command Execution Policy).

```bash
nx test api                             # run unit + integration tests for the api project
nx test api --skip-nx-cache             # bypass cache (use when verifying correctness)
nx test identity                        # run tests for the identity lib
nx run-many --target=test               # run tests for all projects
```

For a single file, pass the vitest `--testFile` option through nx:

```bash
nx test api -- --reporter=verbose --testFile=test/unit/create-post.spec.ts
```

Mutation testing (no nx plugin — run directly):

```bash
docker compose exec app npx stryker run
```

## Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePostUseCase } from '@/use-cases/create-post/create-post.usecase';

describe('CreatePostUseCase', () => {
  let useCase: CreatePostUseCase;
  let mockRepository: {
    save: ReturnType<typeof vi.fn>;
    existsBySlug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      existsBySlug: vi.fn().mockResolvedValue(false),
    };
    useCase = new CreatePostUseCase(mockRepository as any);
  });

  it('creates a post with valid data', async () => {
    const result = await useCase.execute({ title: 'Test', body: 'Content' });
    expect(result.title).toBe('Test');
    expect(mockRepository.save).toHaveBeenCalledOnce();
  });

  it('throws ConflictError if slug exists', async () => {
    mockRepository.existsBySlug.mockResolvedValue(true);
    await expect(useCase.execute({ title: 'Test', body: 'Content' })).rejects.toThrow(ConflictError);
  });
});
```

## Testing HTTP Endpoints (Integration)

```typescript
import supertest from 'supertest';

it('POST /posts returns 201', async () => {
  const response = await supertest(app).post('/posts').set('Authorization', `Bearer ${testToken}`).send({ title: 'Test Post', body: 'Content' });

  expect(response.status).toBe(201);
  expect(response.body.title).toBe('Test Post');
});
```

## Test Configuration

- **Database**: use test containers or transaction rollback for isolation — never share DB state between tests
- **Environment**: `vitest.config.ts` with test-specific settings
- **Coverage**: c8/istanbul, reports in `coverage/` directory

## Environment Variable Stubbing

When testing production env readers (e.g., config functions that read `process.env`), use `vi.stubEnv()` for correct restoration behavior:

**❌ DO NOT do this:**

```typescript
delete process.env.PORT; // vi.stubEnv does not track direct deletion
// test code
vi.unstubAllEnvs(); // PORT is already gone — not restored
```

**✅ DO this instead:**

```typescript
vi.stubEnv('PORT', ''); // Empty string simulates absence
// In the env reader: portRaw ? parseInt(portRaw, 10) : DEFAULT_PORT
vi.unstubAllEnvs(); // Correctly restored
```

Rationale: `vi.stubEnv` saves and restores env vars via `vi.unstubAllEnvs()`. Direct `delete process.env[KEY]` operates outside that tracking and leaves the var permanently deleted — breaking subsequent tests or production code that reads the same var. Treat empty string as "absent" in your env readers instead.

## Mutation Testing

Minimum mutation score: **80%** for covered code.

```bash
docker compose exec app npx stryker run
```

Fix surviving mutants by improving test assertions to test behavior, not implementation.

> Stryker has no nx plugin in this repo — invoke it directly inside Docker only.
