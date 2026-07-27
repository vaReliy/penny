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

## Test Doubles & Fixtures

### Unused fake-repo params should be dropped, not underscore-prefixed

In test doubles, implement fewer parameters than the real interface method (e.g. a 0-arg `archive()` against a 2-arg interface) rather than declaring-and-ignoring extra params. This repo's ESLint has no `argsIgnorePattern`, so `_foo`-prefixed unused params still warn. Drop unused fake-repo params entirely instead.

### Hand-built `ApiConfig` fixtures in unrelated specs break on field additions

Adding a field to `ApiConfig` (e.g. `telegramBotUsername: string`) forces edits to every unrelated spec that hand-constructs a full `ApiConfig` object as a test fixture, because TypeScript's excess/missing-property checking (TS2741) fails at every such call site whenever the interface grows. No behavior changes, just mechanical fixture updates across multiple files.

**Solution:** create a shared `makeTestApiConfig(overrides?: Partial<ApiConfig>)` builder helper in a test-utils location, so the next `ApiConfig` field addition touches one file instead of N unrelated ones.

## Shared/Base Helper Test Coverage

### Shared/base state-helper classes get only transitive test coverage from consumer specs

When a shared/base helper class exists without its own dedicated spec file, its critical branches may only be incidentally covered via consumer specs, hiding real gaps. Example: `BudgetRequestState.run()`'s redirect-on-AUTHENTICATION-only branch was never directly tested — each consumer spec (e.g. `category.store.spec.ts`) asserted only its own unrelated behavior and happened to never exercise that branch, so the gap was invisible.

**Pattern:** whenever a shared/base helper class exists without its own spec, check whether its critical branches are actually exercised anywhere, not just assumed-covered via consumers. Add dedicated tests if needed.

## Month Boundaries & Timezone

### Kyiv-DST month-boundary test fixtures must use UTC instants that differ locally from UTC

When testing Kyiv-DST attribution, pick a UTC instant like `2026-06-30T22:00:00.000Z` (= `2026-07-01 01:00` EEST), not a UTC-aligned midnight. This ensures a test can distinguish "correctly attributed via local time" from "accidentally correct because the boundary aligned in UTC too."

Example: `new Date('2026-06-30T22:00:00.000Z')` is unambiguously `2026-07-01` in Kyiv local time, proving the code correctly resolved the month via local time, not UTC.

## Angular HTTP Testing

### `provideAppInitializer` is unit-testable via `TestBed.inject(ApplicationInitStatus).donePromise`

`provideAppInitializer` (Angular 17+, successor to the deprecated `APP_INITIALIZER` multi-provider) has no obvious seam for testing async bootstrap-time work — the initializer callback isn't separately exported. Working pattern: configure `TestBed` with `provideHttpClientTesting()`, flush the expected `HttpTestingController` request, then `await TestBed.inject(ApplicationInitStatus).donePromise` (or `await expect(donePromise).rejects...` for failure-path assertions) to observe DI state after the initializer settles. No need to extract the callback into a standalone function for testability.

### Use `match(url)` instead of `expectOne(url)` for concurrent same-URL requests

When two concurrent in-flight calls hit an identical URL (no differentiating param), `HttpTestingController.expectOne(url)` throws "matches more than one request" — making race/ordering behavior untestable through the usual API.

**Solution:** use `match(url)`, which returns both `TestRequest`s, then `flush()` them individually in a deliberately chosen order to assert last-write-wins vs first-write-wins behavior:

```typescript
it('last write wins on concurrent refresh', () => {
  service.load();
  service.refresh(); // concurrent call to same URL

  const requests = controller.match(url);
  expect(requests).toHaveLength(2);

  requests[0].flush({
    /* initial data */
  });
  requests[1].flush({
    /* refreshed data */
  }); // This response is final

  expect(component.data()).toEqual({
    /* refreshed */
  });
});
```

## Nx & Playwright E2E

### Nx atomized Playwright targets are named `e2e-ci--src/<file>.spec.ts` — discover them, never guess

Running a single e2e spec through Nx requires the exact atomized target string `e2e-ci--src/<filename>.spec.ts`, discoverable via `nx show project <e2e-app> --json` under `metadata.targetGroups`. Guessing the target name produces "target not found," and worse — `nx affected -t <name>` silently skips projects lacking the named target with no error or warning.

**Related linting gotchas:** `playwright/no-conditional-in-test` and `no-non-null-assertion` both fire on the natural `boundingBox()` null-check idiom. Use `evaluate()` with `getBoundingClientRect()` instead once visibility has already been asserted — this sidesteps both rules while testing the same condition.

## Angular + Playwright Test-Writing Gotchas

### Four confirmed gotchas during web-shell restyle

1. **`[routerLink]` does not persist as a DOM attribute at runtime** — `querySelectorAll('a[routerLink]')` always returns 0 matches. Use a structural/positional selector (`nav > a`, or a container-scoped plain `a`) instead when asserting on router-link elements in component specs.

2. **`RouterTestingHarness.navigateByUrl(url, ComponentType)` returns the component instance, not a ComponentFixture** — `whenStable()`/`detectChanges()` live on `harness.fixture`, not on the returned value. This is easy to typo into `TypeError: fixture.whenStable is not a function`.

3. **Playwright's `devices['...']` presets set `defaultBrowserType` and cannot be applied via `test.use()` inside a `describe` block** — "forces a new worker" error results. Apply presets only at top-level test-file scope or in the config's `projects` array. For a mobile-viewport-only smoke test layered onto existing chromium/firefox/webkit projects, use `test.use({ viewport: {...}, hasTouch: true })` instead.

4. **An e2e logout-flow test that mocks `/auth/me` unconditionally will deadlock** — `loginGuard` on `/login` re-checks `/auth/me` and bounces an apparently-still-active user straight back, so `page.waitForURL('**/login')` times out. The mock must flip to 401 once the logout endpoint is actually hit, simulating real session invalidation.

## Browser-Driving & Network Timing

### Role query can race Tailwind breakpoint reflow right after navigation

`page.getByRole('navigation', ...)` can intermittently return 0 or 2 matches when queried immediately after `waitForURL`, racing Tailwind's `hidden`/`lg:flex` breakpoint-driven reflow before Angular's zone stabilizes.

**Solution:** add `page.waitForLoadState('networkidle')` (or equivalent) after navigation before querying nav roles in the same test step.

## QA Tooling Constraints

### QA browser-driving scripts must run from inside the repo tree

When a QA session has no Playwright MCP tools exposed (only Read/Edit/Write/Bash/SendMessage), it falls back to driving `@playwright/test` directly via a scratch Node ESM script. `node script.mjs` only resolves workspace-installed packages (e.g. `@playwright/test`) if the script file itself lives inside the workspace tree — Node's resolution walks up from the script's own file path, not from `cwd`.

A script placed under a scratchpad directory outside the repo fails module resolution even with `cwd` set correctly. **Workaround:** place/copy the script inside the repo tree, run it, then delete it afterward. Confirmed working across multiple quality-gate runs, not a one-off.
