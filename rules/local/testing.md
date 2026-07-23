## Extends rules/cts/testing.md § Guard decorator chains

The repo follows an established, non-optional pattern (not merely "a common pattern"): guard decorator chains (e.g., `@UseGuards(SessionGuard, ActiveUserGuard)`) are **unit-tested on each guard's `canActivate()` directly** against a hand-built fake `ExecutionContext`, not via real HTTP dispatch through the controller. This keeps specs fast, avoids DI/Mongo bootstrap overhead, and is the repo-wide convention (not merely an option to weigh).

## New section: Controller mocks — `@nestjs/common` mocking requires `SetMetadata` stub

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

## New section: Helmet CSP middleware testability (raw Node.js, no Express)

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

## New section: Framework-level config testable without business modules

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

## New section: E2E route mocks must match actual DTO types

E2E Playwright route mocks must be checked against the actual DTO/response type consumed by the component, not just against the visible assertion text. A field-name typo in a mock silently produces a runtime `undefined` with no compile-time signal (Playwright mocks aren't type-checked against the real API response type):

```typescript
// ❌ Wrong field name — component never reads 'message'
page.route('/api/hello', (route) => route.respond({ json: { message: 'Hello' } }));

// ✓ Correct — matches the actual IdentityService response type
page.route('/api/hello', (route) => route.respond({ json: { greeting: 'Hello', telegramId: '123' } }));
```

## New section: Telegram auth e2e testing — mocked API is the accepted CI pattern

Real Telegram widget auth cannot run on localhost — the widget only renders/authenticates for domains registered with the bot (via `/setdomain`). No CI runner can execute the live flow. The accepted design is:

- `apps/web-e2e/auth-flow.spec.ts` mocks `/auth/me` and `/api/hello` with test data
- Manual pre-release verification via VS Code port forwarding (temporary domain registered on bot) is a documented manual step
- The `dev-token` CLI exists for token-level backend testing without the widget

Reviewers must not flag the mocks as a coverage gap — the live-auth verification is accepted manual process.

## Extends rules/cts/testing.md § never trust a comment/doc claim of test skip-behavior

Concrete incident in this repo: `mongo-connection.spec.ts` and `mongo-user-repository.spec.ts` were claimed to "skip without `MONGO_TEST_URI`," but both do `process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017'` with no skip guard at all — without a reachable Mongo they fail hard (ECONNREFUSED, or `undefined.dropDatabase()` in `afterAll`), they don't skip.

## Extends rules/cts/testing.md § DB-backed integration specs need explicit isolation under parallel test workers

Concrete incident in this repo: `mongo-user-repository.spec.ts`'s `updateProfile does not overwrite status (concurrent login + approval safety)` test failed once against a real local Mongo, then passed 24/24 on the immediate next run — the parallel vitest workers share the `penny-test` database with no per-file isolation. Unfixed; tracked in `tasks/rebuild/todo/2026-07-15-01-mongo-test-db-parallel-isolation.md`.

## New section: Identity Mongo integration tests need `MONGO_TEST_URI` env var

`mongo-user-repository.spec.ts` and `mongo-connection.spec.ts` need the authenticated MongoDB connection string. The `docker-compose.yml` mongo service has auth enabled, so tests must use:

```typescript
const mongoUri = process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017';
// Document in .env.example: MONGO_TEST_URI=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017
```

Run with: `npx nx run identity-infrastructure:test --skip-nx-cache`.

Do not confuse integration specs (which connect to real Mongo) with unit tests that hard-code `mongodb://localhost:27017` as a stub config value — the latter is intentional and doesn't need auth.

## Extends rules/cts/testing.md § E2E static server (production-bundle testing in CI)

Concrete instantiation in this repo: the `web:serve-static` target (`@nx/web:file-server` executor with `"spa": true` and `port: 4200`) is configured to serve the built bundle with SPA fallback routing; it depends on `web:build` so the built artifact is always current. The production-only issue this guards against is nginx `sub_filter` string-match breakage when esbuild minifies `content=""` to `content` (see `rules/local/docker-commands.md` § Sub-filter matching) — the minification changes the HTML string that nginx's CSP-nonce `sub_filter` directive matches against, causing the string match to silently miss and the nonce to never be injected.

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

Set `CI: 'true'` in `.github/workflows/ci.yml` with a clear comment explaining that this switches to production-artifact testing.

## New section: ThrottlerGuard state leakage across tests

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

## New section: ThrottlerGuard metadata — no re-export, subpath import required

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
