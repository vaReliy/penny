# Backend Architecture

This rule covers NestJS/Node.js application patterns, DI boundaries, and data access. See `rules/architecture.md` for shared onion/DDD layer patterns.

## Logger Dependency Injection

All application layers should inject pino logger instances rather than instantiating them. This ensures a single configured pipeline and proper log routing.

### Pattern: LoggerModule exports a provider

Create a shared logger module that provides the pino instance:

```typescript
@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useValue: createPinoLogger(), // Created once at app startup
    },
  ],
  exports: [PINO_LOGGER],
})
export class LoggerModule {}
```

### Consuming the logger

Services, repositories, and filters inject the provided logger:

```typescript
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(PINO_LOGGER) private logger: pino.Logger,
    private userRepository: IUserRepository,
  ) {}

  execute(params: CreateUserParams) {
    this.logger.info({ params }, 'Creating user');
    // ...
  }
}
```

Repositories also inject (even though core domain would avoid it, infra adapters must):

```typescript
@Injectable()
export class MongoUserRepository implements IUserRepository {
  constructor(@Inject(PINO_LOGGER) private logger: pino.Logger) {}
}
```

### Bootstrap wiring

In `main.ts`, retrieve and wire the logger after app creation:

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
const logger = app.get<pino.Logger>(PINO_LOGGER);
app.useLogger(new PinoNestLogger(logger));
```

## Architecture Boundaries

### Pre-flight applies to application code only

`rules/architecture.md` (layer patterns, onion, boundary rules) applies **only to agents writing application code** (UseCase/Service/Repository/DTO layers). It does NOT apply to:

- `devops` — writes Docker/CI config, not UseCase/Service code
- `dba` — writes migrations and schema, not domain services
- Infrastructure-only tasks (compose files, CI YAML) — route to `devops`

Application library code mixed with infrastructure config should be split:

- `backend-developer` → application code (connection factory, config loader, domain services)
- `devops` → compose files, CI scripts, environment setup

### Mixed-task routing example

When a task says "add MongoDB connection factory to `libs/shared/infrastructure`", split it:

1. `backend-developer` writes the factory service with proper DI (injects Config, returns reusable connection)
2. `devops` writes the Docker compose service and environment config

This prevents `devops` from writing unpinned dependencies or global singleton patterns that violate Clean Architecture.

## Pipeline Re-entry After Fix

When a fix is needed after the quality gate:

1. **Trivial change** (comment, doc-only) → orchestrator handles, no downstream
2. **Source logic change** → `backend-developer` → `tester` → quality gate
3. **Test-only change** → `tester` → quality gate

After running `backend-developer` and `tester`, always re-run the quality gate (reviewer + security-scanner).

## Penny Overrides (MongoDB / Typegoose)

The following patterns apply to the Penny project's MongoDB setup.

### MongoDB health checks with mongosh

`mongo:7` image uses the `mongosh` shell, not the legacy `mongo` shell. Configure health checks accordingly:

```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo:7
    healthcheck:
      test: mongosh --eval "db.adminCommand('ping')"
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

The `start_period` allows time for Mongo to initialize.

### findOneAndUpdate + upsert race condition

MongoDB `findOneAndUpdate({ filter }, { $setOnInsert: … }, { upsert: true, new: true })` is atomic **within a single connection** but **not across concurrent connections**. Two connections can both evaluate "no document exists" before either insert commits, causing E11000 duplicate key error on the loser.

Safe pattern:

```typescript
async findOrCreate(filter: Record<string, any>, initialData: Record<string, any>) {
  try {
    return await this.model.findOneAndUpdate(
      filter,
      { $setOnInsert: initialData },
      { upsert: true, new: true },
    );
  } catch (err) {
    if (err.code === 11000) {
      // Loser of the upsert race — winner's document now exists
      const existing = await this.model.findOne(filter);
      if (existing) return existing;
    }
    throw new InfrastructureError();
  }
}
```

The retry `findOne()` is guaranteed to succeed because the winner's document is now persisted. Always wrap the retry in error handling too.

**Default reach-for pattern, confirmed a third time**: this is the recipe for any "find or create default" need, not just user onboarding — e.g. `MongoAccountRepository.findOrCreateDefault` (`findOneAndUpdate` + `$setOnInsert` + a unique `{workspaceId,name}` index) on a brand-new collection, not just a retrofit onto an existing one. Reach for this pattern by default rather than re-deriving it per feature.

### Schema defaults on legacy documents — no migration needed (if not using `.lean()`)

Adding a new field with a `default:` value to an existing Typegoose schema applies that default to any document hydrated via a normal query (`find`, `findOne`, etc.) whose BSON is missing that path — **but only when the query does NOT use `.lean()`**.

Example: adding `roles: string[] = []` to the User schema without a migration script still works safely because:

```typescript
// ✓ Schema default applied to legacy docs (no `.lean()`)
const user = await userCollection.findOne({ id: '123' });
// user.roles === [] even if the BSON doc predates the field

// ❌ Schema default NOT applied when using `.lean()`
const userLean = await userCollection.findOne({ id: '123' }).lean();
// userLean.roles === undefined — raw BSON, no schema defaults
```

**General rule**: adding a new field with a `default:` to an existing Typegoose/Mongoose collection is migration-free only if every read path for that model avoids `.lean()`; if any repository method uses `.lean()`, that path needs either a migration or an explicit `?? []`-style fallback in the mapper.

### Unique index on required fields

Use a **non-sparse** unique index for application-required fields:

```typescript
@prop({ required: true, unique: true })
telegramId!: string;
```

Why: `sparse: true` excludes documents missing the field from the unique index, allowing multiple null documents to bypass the E11000 check. For required fields, the sparse flag weakens the DB invariant.

### `$setOnInsert` operator

In upsert operations, use `$setOnInsert` to write fields **only on insert**, leaving concurrent losers' documents unchanged:

```typescript
// Insert new user with initial fields
// Update existing user touches only _id, not initialData
await this.model.findOneAndUpdate({ telegramId }, { $setOnInsert: { status: 'PENDING', createdAt: new Date() } }, { upsert: true, new: true });
```

Concurrent losers retrieve the winner's document unchanged — no accidental status overwrites.

### CAS-via-optional-param: canonical pattern for closing TOCTOU races on scoped updates

When a stale-read-modify-write race is possible on a Mongo entity field (a caller reads a value, computes a new value, then writes it back — racing another writer doing the same), the established fix shape is compare-and-swap via an _optional_ parameter, not a new required API: the repository method gains an optional `expectedCurrentValue` param that, when present, adds `{ field: expectedValue }` to the `findOneAndUpdate` filter (array fields use `{ field: { $eq: expectedArray } }` — equivalent to the bare shorthand, `$eq` just self-documents the intent). `findOneAndUpdate` returns `null` on a filter mismatch, which the caller must surface as an explicit, observable conflict — never a silent retry: `409 DomainError.conflict()` on the HTTP path, `logger.error` + `process.exit(1)` on the CLI path. The optional param keeps old callers byte-identical (no breaking change), so the pattern rolls out incrementally.

In this repo, `mongo-user-repository.ts`'s `updateStatus()` (used by `SetUserStatusService`) and `updateRoles()` (used by `admin-promote.command.ts`) are the two established instances — use this shape for any future TOCTOU finding on a Mongo entity field rather than re-deriving it.

**Checklist for state-transition repo methods**: This pattern is not limited to literal "status" fields. Whenever authoring any new soft-delete/soft-archive/state-transition repository method, grep for this CAS-via-optional-filter shape and apply it if the field represents state that could be modified concurrently — e.g., `archive()` should add `archivedAt: { $exists: false }` to the filter so a second concurrent archive call becomes a no-op instead of a silent timestamp re-write.

### Repository pattern: domain methods, not repository methods

`IUserRepository` has **no `updateStatus()` method**. Status transitions are domain methods on the User entity:

```typescript
// ✓ Correct: domain method owns the transition rule
const user = await repository.findById(userId);
user.approve(); // Entity method validates & changes status
await repository.save(user);

// ❌ Wrong: repository owns the transition
await userRepository.updateStatus(userId, 'ACTIVE');
```

Why: The transition rule (can only approve from PENDING, can only reject from PENDING) lives in the entity. Repository is just data access. This separation prevents concurrent-write races like login overwriting an approved status with PENDING.

### Separate write paths for status vs profile

The `IUserRepository` intentionally has separate write paths:

- `updateProfile({ firstName, lastName, username, photoUrl })` — updates profile only
- `save()` (via `updateById`) — writes all fields including status

The split exists to prevent the login path from reverting an approved user's status back to PENDING in a concurrent-write race:

```typescript
// ✓ Login path cannot touch status
await userRepository.updateProfile(userId, { firstName, lastName });

// ✓ Only SetUserStatusService can change status
user.approve();
await userRepository.save(user);
```

Do not consolidate these into a single `save()` for the returning-user path.

### InfrastructureError carries no dynamic content

Never include MongoDB error messages, entity IDs, or dynamic strings in `InfrastructureError`:

```typescript
// ❌ Wrong — PII/schema details leak
throw new InfrastructureError(`Failed to save user ${userId}: ${err.message}`);

// ✓ Correct — log context internally
this.logger.error({ err, userId }, 'Failed to save user to MongoDB');
throw new InfrastructureError(); // Uses default generic message
```

`BaseErrorFilter` serializes the error message into the HTTP response. Inject the logger into every repository and call `logger.error()` before throwing.

### Mongoose `autoIndex` builds indexes asynchronously; nothing awaits it by default

**Concrete incident**: `createMongoConnection` + `await connection.asPromise()` proves socket readiness only, not index-build completion — Mongoose's default `autoIndex: true` builds indexes as a fire-and-forget background op. Unique-index enforcement (duplicate-`{workspaceId,name}`-insert rejection) becomes racy: two writes can both evaluate "no document exists" before either unique index finishes building and catches the duplicate.

**Why**: MongoDB indexes are background tasks by design. An application relying on a unique index for correctness must not issue any inserts until the index is built.

**Fix**: `createMongoConnection` must await `Model.init()` for every model (`Promise.all()`) before returning the connection — the model-factory functions themselves stay synchronous (so existing `vi.mock`-based unit tests of the sync `getXModel()` shape keep working), and the await lives in the connection-setup seam. Any future repo relying on a unique index for correctness must go through this connection helper, not construct its own.

### MongoDB `partialFilterExpression` rejects `$exists: false` at index-build time, and Typegoose swallows the failure silently

**Concrete incident**: A soft-archive partial unique index was first written as `partialFilterExpression: { archivedAt: { $exists: false } }`, which MongoDB rejects (`Expression not supported in partial index: $not`). Because Typegoose/Mongoose builds indexes in the background, this index-creation failure was never surfaced: the app booted fine, duplicate-insert tests silently passed because the unique constraint had simply never been created.

**Why**: `$exists` is only valid as `true` in a partial index's `partialFilterExpression` — `$exists: false` is not supported by MongoDB at index-definition time. Query filters elsewhere correctly use `{ archivedAt: { $exists: false } }` (a _query_, not an index definition) — the two are not interchangeable syntax.

**Fix**: Use equality-to-null instead — `partialFilterExpression: { archivedAt: null }` — which MongoDB documents as matching "field is null or absent" and is fully supported. This is the standard soft-delete/archive partial-unique-index recipe.

### Mongoose aggregation pipelines bypass schema-level BigInt casting entirely

**Concrete incident**: Implementing a Mongo transaction repository's balance/chart aggregations found that `$sum`/`$group` output is plain JavaScript objects Mongoose never casts through the schema's BigInt SchemaType — the result field can surface as `bigint`, a BSON `Long`-like object, or `number` depending on driver/shape, not reliably the schema's declared type.

**Why**: Mongoose does not cast values in aggregation pipelines (per Context7 docs) — only in normal queries.

**Fix**: An explicit `toBigIntAmount` normalizer on any aggregation result touching a BigInt-backed field, unit-tested against a forced non-numeric shape (a `{toString()}`-only stub), since the real local driver only reliably produces one shape and can't force the others in an integration test.

### Typegoose silently downgrades a `@prop` to `Mixed` when `enum` lacks an explicit `type`

**Concrete incident**: A Typegoose model field declared only `enum: [...]` with no `type: () => String`, and Typegoose accepted it but emitted a `[W001]` console warning at runtime and lost schema-level type enforcement (degrading to `Mixed`), without failing typecheck or any test.

**Why**: Typegoose requires both the enum values _and_ their type to be explicit — `enum` alone is insufficient and triggers a fallback to `Mixed`.

**Fix**: Always pair `enum` with an explicit `type: () => String`/`Number`. This is easy to miss since nothing red flags it besides stderr noise during test runs.

## NestJS Guards and Dependency Injection

### Global guards that use `Reflector`: must use `APP_GUARD`, not `app.useGlobalGuards()`

Calling `app.useGlobalGuards(new CsrfGuard())` instantiates the guard **outside** the NestJS DI container. If the guard needs to inject `Reflector` (to read `@SetMetadata` / `@SkipCsrf()` decorator metadata via `getAllAndOverride()`), the injection fails because DI is bypassed.

**Correct pattern**: register via `APP_GUARD` provider in a module's `providers` array — this resolves the guard through DI so `Reflector` is injected normally:

```typescript
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: CsrfGuard, // ✓ Instantiated by DI, Reflector available
    },
  ],
})
export class SecurityModule {}
```

This applies to any global guard that reads decorator metadata. Stateless middleware-style guards (no Reflector dependency) can use either pattern.

### Per-controller `@UseGuards(X)`: `X`'s dependencies must be resolvable in the _host_ module, not the module that declares `X`

`@UseGuards(SessionGuard, ActiveUserGuard)` on a controller instantiates the guard in the injector of the **module that hosts the controller**, not the module that exports the guard. If the hosting module doesn't import the module providing the guard's own dependencies, Nest throws `UnknownDependenciesException` at boot — a silent trap because nothing at the `@UseGuards` call site hints at the missing import.

```typescript
// apps/api/src/budget/budget.module.ts
@Module({
  imports: [LoggerModule, AuthModule], // ✓ AuthModule exports SessionGuard + its ITokenIssuer/IUserRepository deps
  controllers: [CategoriesController /* @UseGuards(SessionGuard, ActiveUserGuard) */],
})
export class BudgetModule {}
```

Every new feature module whose controllers use `SessionGuard`/`ActiveUserGuard` (or any other DI-dependent guard) must import `AuthModule` directly — importing it once in `AppModule` does not make its exports reachable from a sibling feature module's own injector.

**Test coverage**: unit specs that hand-construct guards against a fake `ExecutionContext` (see `rules/cts/testing.md` § "Guard decorator chains") never exercise the real module graph and cannot catch this — the module compiles and passes every such spec, then crashes the whole app at startup. Add a module-compile smoke test per feature module instead:

```typescript
Test.createTestingModule({ imports: [TheFeatureModule] }).compile(); // throws if any provider/guard dep is unresolvable
```

Override only the I/O-boundary providers so it needs no live DB/network:

- A local `@Global()` stub module supplying `API_CONFIG` (bypasses `loadApiConfig()`'s `process.env` reads) — use a real ≥32-char value for `jwtSecret`; `JwtTokenIssuer` validates length at construction and a short stub fails compile with an unrelated-looking error.
- `mongoose.createConnection()` called with **no URI**, overriding `TOKENS.MongoConnection` — registers Typegoose models via `getXModel(connection)` without opening a socket.

Verify the spec actually catches the regression it targets by temporarily reverting the fix locally and confirming the test fails with the real `UnknownDependenciesException` — a passing-by-coincidence smoke test is worse than none.

_(Pending upstream: this recipe belongs in `rules/cts/testing.md` § "Guard decorator chains" too — see `docs/KNOWLEDGE_INBOX.md` 2026-07-27 entry, route via `/cts-contribute`.)_

## NestJS Controller Route Prefixes

### Route prefix is controller-decorator-driven, not directory-inferred

NestJS route prefixes come from the `@Controller('prefix')` decorator on the controller class, not from the controller's file location or module placement. A controller at `apps/api/src/budget/rates.controller.ts` wired via `BudgetModule` with `@Controller('rates')` produces routes at `/api/rates`, **not** `/api/budget/rates`.

**Why**: The decorator is the single source of truth. Directory structure and module nesting have no semantic meaning for routing.

**Gotcha**: When implementing a client that must consume an endpoint from this repo, do not infer the route path from file structure — read the controller source and check the decorator value instead.

## CSRF and Authentication Guards

### `CsrfGuard` already safe-lists GET/HEAD/OPTIONS globally — no guard/decorator needed for a new unauthenticated GET endpoint

`apps/api/src/auth/csrf.guard.ts` is registered as the only global `APP_GUARD` in `AppModule` and unconditionally safe-lists GET/HEAD/OPTIONS before any CSRF check runs. `SessionGuard` and `ActiveUserGuard` are opt-in per-route via `@UseGuards(...)`, never global. So any new unauthenticated GET handler needs zero guard changes or bypass decorators — simply omitting `@UseGuards(SessionGuard, ActiveUserGuard)` is the entire exemption, exactly as `HealthController` and `HelloController` already do.

## Configuration Layering

### Config values should live at the layer that consumes them

A configuration value that only one layer ever reads should live at that layer, not be threaded through every intermediate hop (e.g., env → compose build-arg → Dockerfile ARG → generated file). Each hop is a place it can silently break, and gitignored generated files force every execution context to independently regenerate them before anything can build.

**Concrete example**: A config value needed only by the web frontend should be a frontend config value (`environment.ts` or similar), not a backend env variable threaded through the container build.
