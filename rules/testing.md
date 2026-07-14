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

## NestJS-Specific Testing

### Guard decorator chains: established convention vs. coverage gap

The repo follows an established pattern where guard decorator chains (e.g., `@UseGuards(SessionGuard, ActiveUserGuard)`) are **unit-tested on each guard's `canActivate()` directly** against a hand-built fake `ExecutionContext`, not via real HTTP dispatch through the controller. Controller specs call methods directly or mock the decorator.

**Why**: This keeps specs fast, avoids DI/Mongo bootstrap overhead, and is the repo-wide convention.

**Coverage gap**: A decorator regression (wrong guard, wrong order, guard silently dropped) is **invisible to the test suite** and only reviewable by manual diff-reading. The gap is accepted given the tradeoff. To add assurance, a thin e2e-style smoke test per guarded controller (with real Nest routing) is an option but is not currently implemented.

### Exception filter testing: pino logger assertions

When testing NestJS exception filters that use pino, assert **both arguments** of the pino call — the structured object **and** the message string. pino's signature is `(obj, msg)`, opposite to winston/console `(msg, meta)`, so a single-arg assertion (`toHaveBeenCalled()`) won't catch a metadata-less call.

Also: `mockLogger` must be declared as `let` at the `describe` scope (not `const` inside `beforeEach`) so it's accessible to `it` blocks:

```typescript
describe('MyExceptionFilter', () => {
  let filter: MyExceptionFilter;
  let mockLogger: ReturnType<typeof vi.fn>; // ✓ describe scope

  beforeEach(() => {
    mockLogger = vi.fn(); // Mocked pino logger
    filter = new MyExceptionFilter(mockLogger);
  });

  it('logs structured warning with both args', () => {
    const exception = new SomeError();
    filter.catch(exception, mockExecutionContext);

    // ✓ Assert both pino args: object first, message second
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: expect.any(Number) }), expect.stringContaining('[CODE]'));
  });
});
```

### Controller mocks: `@nestjs/common` mocking requires `SetMetadata` stub

Adding a `@SkipCsrf()` decorator (which calls `SetMetadata` internally) to a controller causes the spec to crash at import time if `@nestjs/common` is mocked without `SetMetadata`. The stub must include:

```typescript
vi.mock('@nestjs/common', async () => {
  const actual = await vi.importActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: vi.fn().mockReturnValue(() => undefined),
    // ... other mocks
  };
});
```

Pattern: any NestJS spec that mocks `@nestjs/common` needs `SetMetadata` in the factory whenever any decorator in the import chain calls it at module-load time.

### Helmet CSP middleware testability (raw Node.js, no Express)

Helmet's `contentSecurityPolicy` middleware is a standalone function typed as `(req: IncomingMessage, res: ServerResponse, next) => void`. It's testable against raw `node:http` without Express or NestJS bootstrapping:

```typescript
import * as http from 'node:http';
import { contentSecurityPolicy } from 'helmet';

it('sets CSP header', async () => {
  const helmet = contentSecurityPolicy({ directives: { defaultSrc: ["'self'"] } });

  const server = http.createServer((req, res) => {
    helmet(req, res, () => {
      res.writeHead(200);
      res.end('OK');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const { port } = server.address() as AddressInfo;

  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(`http://localhost:${port}/`, resolve);
  });

  expect(res.headers['content-security-policy']).toBeDefined();
  server.close();
});
```

This avoids the pnpm Express hoisting issue and esbuild `emitDecoratorMetadata` limitations for NestJS decorators in Vitest. Drain the response with `res.resume()` before reading headers.

### Framework-level config testable without business modules

Framework-level config in `main.ts` (trust proxy, CORS, Helmet directives) is cheap to runtime-verify without booting business modules. Pattern: build a throwaway `NestFactory.create<NestExpressApplication>` with a minimal probe controller, `app.listen(0)` (ephemeral port), and Node's built-in `node:http` client:

```typescript
it('sets trust proxy = 1 for X-Forwarded-For', async () => {
  const app = await NestFactory.create<NestExpressApplication>(
    // Minimal probe module with one test controller
    class ProbeModule {},
  );
  app.set('trust proxy', 1);

  const server = await app.listen(0);
  const { port } = server.address() as AddressInfo;

  const res = await new Promise<http.IncomingMessage>((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/probe`, { headers: { 'x-forwarded-for': '192.0.2.1' } }, resolve);
    req.on('error', () => {}); // Ignore 404
  });

  // Trust proxy makes req.ip reflect X-Forwarded-For
  expect(res.statusCode).toBe(404); // Just checking the config loaded
  server.close();
});
```

Include a negative-control test (config disabled) alongside the positive one so the assertion can't be a false positive from the framework ignoring the setting.

### E2E route mocks must match actual DTO types

E2E Playwright route mocks must be checked against the actual DTO/response type consumed by the component, not just against the visible assertion text. A field-name typo in a mock silently produces a runtime `undefined` with no compile-time signal (Playwright mocks aren't type-checked against the real API response type):

```typescript
// ❌ Wrong field name — component never reads 'message'
page.route('/api/hello', (route) => route.respond({ json: { message: 'Hello' } }));

// ✓ Correct — matches the actual IdentityService response type
page.route('/api/hello', (route) => route.respond({ json: { greeting: 'Hello', telegramId: '123' } }));
```

### Telegram auth e2e testing: mocked API is the accepted CI pattern

Real Telegram widget auth cannot run on localhost — the widget only renders/authenticates for domains registered with the bot (via `/setdomain`). No CI runner can execute the live flow. The accepted design is:

- `apps/web-e2e/auth-flow.spec.ts` mocks `/auth/me` and `/api/hello` with test data
- Manual pre-release verification via VS Code port forwarding (temporary domain registered on bot) is a documented manual step
- The `dev-token` CLI exists for token-level backend testing without the widget

Reviewers must not flag the mocks as a coverage gap — the live-auth verification is accepted manual process.

### Identity Mongo integration tests: need `MONGO_TEST_URI` env var

`mongo-user-repository.spec.ts` and `mongo-connection.spec.ts` need the authenticated MongoDB connection string. The `docker-compose.yml` mongo service has auth enabled, so tests must use:

```typescript
const mongoUri = process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017';
// Document in .env.example: MONGO_TEST_URI=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017
```

Run with: `npx nx run identity-infrastructure:vite:test --skip-nx-cache` (note: target is `vite:test`, not `test`).

Do not confuse integration specs (which connect to real Mongo) with unit tests that hard-code `mongodb://localhost:27017` as a stub config value — the latter is intentional and doesn't need auth.

### E2E static server: `@nx/web:file-server` not raw `http-server`

Raw `http-server` has no SPA fallback — `page.goto('/greeting')` in a Playwright spec gets a 404 for client-side routes. Use the project's existing Nx target instead. In CI, serve the built artifact (`web:serve-static`) to test the production bundle (esbuild minification differences, etc.); locally, use the dev server (`web:serve`) for faster iteration:

```typescript
// playwright.config.mts
export default defineConfig({
  webServer: {
    command: process.env['CI'] ? 'pnpm exec nx run web:serve-static' : 'pnpm exec nx run web:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
  },
});
```

The `@nx/web:file-server` executor (already in `apps/web/project.json` with `"spa": true`) correctly falls back to `index.html` for unknown routes. No new dependency needed.

### ThrottlerGuard state leakage across tests

`@nestjs/throttler`'s `ThrottlerGuard` keys its storage record off `context.getClass().name` + `context.getHandler().name` + the IP tracker, **not object identity**. A reused guard + storage instance across multiple `it()` blocks in one spec causes hit counts to accumulate and leak across tests:

```typescript
describe('ThrottlerGuard', () => {
  let guard: ThrottlerGuard;
  let storage: FakeThrottlerStorage;

  beforeEach(() => {
    // ✓ Fresh instance per test — prevents leakage
    guard = new ThrottlerGuard(injector);
    storage = new FakeThrottlerStorage();
  });

  it('resets on second test', async () => {
    // Each test sees a fresh guard+storage pair
  });
});
```

**Never** create guard/storage in `beforeAll` when specs exercise real `canActivate` logic.

### ThrottlerGuard metadata: no re-export, subpath import required

`@nestjs/throttler`'s public `index.d.ts` does not re-export `ThrottlerStorageRecord` (used internally by `ThrottlerStorage`/`ThrottlerGuard`). A test implementing a fake `ThrottlerStorage` must declare its own local return-type interface. Separately, `GUARDS_METADATA` (needed to assert a controller method has `@UseGuards(ThrottlerGuard)` applied) is not exported from `@nestjs/common` root — only from `@nestjs/common/constants` subpath:

```typescript
import { GUARDS_METADATA } from '@nestjs/common/constants';

interface ThrottlerStorageRecord {
  totalHits: number;
  isBlocked: boolean;
}

class FakeThrottlerStorage {
  storage = new Map<string, ThrottlerStorageRecord>();
  // ...
}
```

The subpath import resolves fine since the package has no `exports` map restriction.
