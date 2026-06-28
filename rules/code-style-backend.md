# Backend Code Style

This rule covers Node.js / NestJS / Express application code, structured logging, and authentication patterns. See `rules/code-style.md` for shared TypeScript conventions that apply to both backend and frontend.

## Configuration & Environment

### No raw `process.env` reads in services

Never read `process.env` directly in UseCase/Service/Repository code. Instead, inject a typed Config service:

```typescript
// ❌ Avoid
export class SendEmailService {
  private readonly apiKey = process.env.SENDGRID_API_KEY;
}

// ✅ Correct
export class SendEmailService {
  constructor(@Inject('CONFIG') private config: AppConfig) {}

  execute() {
    const apiKey = this.config.sendgrid.apiKey;
  }
}
```

All environment reads are confined to a single config service (e.g., `loadApiConfig()` for apps). This enables testability and prevents scattered env dependencies.

## Validation

### LIVR validation at app boundary

Validate incoming requests with LIVR (or Zod) **before** any repository call:

```typescript
export class CreateUserRoute {
  handle(req: CreateUserRequest) {
    const validated = this.livr.validate(req.body);
    if (!validated.isValid) {
      throw new ValidationError(validated.errors);
    }

    return this.createUserUseCase.execute(validated.data);
  }
}
```

Validation rules are registered once at bootstrap via `registerLivrRules()` from a shared kernel library.

## Logging

### pino-pretty in devDependencies only

`pino-pretty` is a human-readable log formatter used only in development. It must stay in `devDependencies`, never `dependencies`.

Why: If it lands in `dependencies`, it ships in the production Docker image and is silently available. Its _absence_ in production is the correct failure mode — the logger will crash immediately and visibly if the package is missing in development, which is preferable to silent log-format degradation.

### NestJS LoggerService + pino integration

NestJS `new Logger(name)` automatically delegates to the globally registered `LoggerService`. Use this pattern:

```typescript
// In core domain — no @Injectable() here
export class ApproveUserService {
  // Inject a pino instance (prefer over Logger class)
  constructor(@Inject(PINO_LOGGER) private logger: pino.Logger) {}

  execute(userId: string) {
    this.logger.info({ userId }, 'Approving user');
  }
}

// In infrastructure adapters — instantiate manually with DI logger
@Injectable()
export class MongoUserRepository implements IUserRepository {
  constructor(@Inject(PINO_LOGGER) private logger: pino.Logger) {}

  async save(user: User): Promise<void> {
    this.logger.debug({ user }, 'Saving user');
  }
}
```

### pino logger in DI, not bootstrap

Create the pino logger _after_ NestJS DI is initialized:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Queue bootstrap logs until logger is ready
  });

  // Retrieve from DI (created by LoggerModule)
  const logger = app.get<pino.Logger>(PINO_LOGGER);

  // Flush queued logs through the real logger
  app.useLogger(new PinoNestLogger(logger));

  await app.listen(3000);
}
```

`bufferLogs: true` without `app.useLogger()` is a dead config — two incompatible log streams result (Nest default formatter + pino JSON output).

### NestJS LogLevel → pino threshold

NestJS's `setLogLevels(levels: LogLevel[])` is an allowlist (e.g., `['error', 'warn']`), but pino's `logger.level` is a threshold. Translate by mapping each NestJS level to a pino level, then selecting the **minimum** pino level from the array:

```typescript
const PINO_LEVEL_VALUE: Record<pino.Level, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

function nestLogLevelsToPino(levels: LogLevel[]): pino.Level {
  if (levels.length === 0) return 'silent'; // No-op
  const minLevel = Math.min(...levels.map((l) => PINO_LEVEL_VALUE[l]));
  return Object.entries(PINO_LEVEL_VALUE).find(([, v]) => v === minLevel)?.[0] as pino.Level;
}
```

Example: `setLogLevels(['error', 'warn'])` → minimum of (50, 40) = 40 → pino level `'warn'`.

## Authentication & Cookies

### NestJS guard cookie-clear pattern

Clear cookies **before** throwing an exception in a guard to ensure the Set-Cookie header is included in the error response:

```typescript
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const sessionToken = this.parseSessionToken(request);
    if (!sessionToken || this.sessionStore.isExpired(sessionToken)) {
      // Clear cookie BEFORE throwing — ensures Set-Cookie header in response
      response.clearCookie('session');
      throw new AuthenticationError('Session expired');
    }

    return true;
  }
}
```

The exception propagates to `@Catch()` filter; the cookie-clear header is preserved.

### No `cookie-parser` dependency needed

`res.cookie()` (setting cookies) is built into Express and works without `cookie-parser`. Reading cookies server-side can be done by parsing `req.headers['cookie']` manually:

```typescript
function parseSessionCookie(req: Request): string | null {
  const cookies = req.headers.cookie?.split(';') || [];
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'session') return value;
  }
  return null;
}
```

`cookie-parser` is only needed if you want `req.cookies` populated globally across all routes.

### `secure` cookie flag from runtime mode

Derive the `secure` flag from the runtime mode, not hardcoded:

```typescript
export class ApiConfig {
  readonly mode: 'development' | 'production' = (process.env.NODE_ENV || 'development') as any;
}

// In session service
res.cookie('session', token, {
  httpOnly: true,
  secure: config.mode === 'production', // ✓ runtime-derived
  sameSite: 'strict',
});
```

Why: `secure: true` on plain HTTP is silently dropped by browsers — in local dev this means session cookies are never set. Using `config.mode` ensures correct behavior in all environments.

## Error Handling

### InfrastructureError carries no dynamic content

`BaseErrorFilter` serializes `InfrastructureError.message` directly into the HTTP response body. Do not include MongoDB driver messages, entity IDs, or PII in the error:

```typescript
// ❌ Avoid — PII/schema details leak to client
throw new InfrastructureError(`Failed to find user: ${userId}`);
throw new InfrastructureError(`MongoDB error: ${err.message}`);

// ✅ Correct — log internally, throw generic
this.logger.error({ err, userId }, 'Failed to save user');
throw new InfrastructureError(); // Generic default message
```

Pattern: inject `pino.Logger` into every repository and infrastructure adapter; call `logger.error({ err, context })` before throwing `InfrastructureError()`.
