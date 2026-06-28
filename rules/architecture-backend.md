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
