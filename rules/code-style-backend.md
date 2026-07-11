# Backend Code Style

This rule covers Node.js / NestJS / Express application code, structured logging, and authentication patterns. See `rules/code-style.md` for shared TypeScript conventions that apply to both backend and frontend.

## Configuration & Environment

### CLI-only secret validation: inline reads need full entropy check

When CLI commands read secrets directly from `process.env` (bypassing the NestJS Config service), a falsy-only check (`if (!secret)`) is insufficient. Single-character values produce structurally valid but cryptographically weak tokens. Pattern: after the presence check, assert minimum length (32 chars for HMAC-SHA256 secrets) before constructing any cryptographic primitive. The production-mode guard limits blast radius but does not substitute for entropy validation since the same secret may be shared with the API server.

```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET required');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
```

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

### pino logger signature: (obj, msg) not (msg, context)

pino's structured-first signature puts the metadata object **first** and the message string **second**: `logger.warn({ statusCode }, '[CODE] message')`. This is opposite to NestJS built-in `Logger.warn(msg, context)`. Migrating from NestJS `Logger` to injected pino requires swapping call-site argument order at every `warn`/`error` call — TypeScript surfaces this as TS2769 overload mismatch, so it's caught at compile time.

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

### Cookie-pair invariant: every setter must have a matching clearer

When two cookies are always issued together (httpOnly + readable token pair), audit every `clearCookie()` call site (logout handler, session guard error branches, token refresh expiry) to confirm **both** are cleared. A stale readable cookie (1+ hour lived) after logout/expiry is a CSRF/cross-site state leak. Add as a checklist item whenever a second cookie joins an existing auth pair:

```typescript
// ✓ Correct — both cookies cleared together
response.clearCookie('AUTH_COOKIE_NAME', { httpOnly: true });
response.clearCookie('XSRF_COOKIE_NAME');

// ❌ Incomplete — stale XSRF token remains
response.clearCookie('AUTH_COOKIE_NAME');
```

## Security: Cryptographic & Timing

### `timingSafeEqual` length pre-check

`string.length` counts Unicode code points; `Buffer.from(str).length` counts UTF-8 bytes. A crafted header with 32 two-byte chars has `.length === 32` matching a 64-char hex cookie token, but `Buffer.from(...).length === 64` — `timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` (→ 500) instead of returning `false` (→ 403).

Pattern: always create both Buffers first, then compare `.byteLength` before calling `timingSafeEqual`:

```typescript
const expected = Buffer.from(token);
const provided = Buffer.from(headerValue);
if (expected.byteLength !== provided.byteLength) return false; // Length mismatch first
if (!timingSafeEqual(expected, provided)) return false;
```

### Truncated hashes of low-entropy data: never anonymization

A truncated SHA-256 hash of a small-integer ID (e.g. Telegram ID, ~10 digits) is brute-forceable in seconds-to-minutes and remains PII under GDPR. Such truncated hashes must never be labeled "anonymization" or "de-identification" in reviews or task files. If genuine de-identification is needed, use HMAC-SHA256 with a config-injected pepper, or omit the identifier entirely and rely on request-correlation IDs.

## Content Security Policy

### CSP `form-action` does not inherit from `default-src`

Unlike most fetch directives, `form-action` is not covered by `default-src` fallback per CSP Level 2 spec. Omitting it leaves form submission unconstrained even when `default-src 'self'` is set. Always add `form-action: ["'self'"]` explicitly to any Helmet `contentSecurityPolicy` config:

```typescript
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Angular requirement
      formAction: ["'self'"], // Must be explicit, not inherited
    },
  }),
);
```

### Never expose CSP nonce in response headers

Emitting the per-request nonce as a custom header (e.g., `X-CSP-Nonce: <value>`) on API JSON responses violates OWASP CSP nonce confidentiality. Same-origin JavaScript can read this header from any `fetch()` response. If the nonce ever protects `script-src`, an attacker with any XSS entry point can extract it and self-inject a whitelisted script. Deliver the nonce exclusively via server-side HTML template injection (`<meta name="csp-nonce">`), never via a custom header.

### `'unsafe-hashes'` in `style-src` enables attribute matching

Without `'unsafe-hashes'`, SHA hashes in `style-src` only match inline `<style>` block content. Adding `'unsafe-hashes'` extends them to `style=""` element attributes — including a hash of the empty string (`sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`), which is trivially reachable by any injected element. Pattern: never add `'unsafe-hashes'` to `style-src` without auditing whether the nonce pipeline can cover the same cases instead.

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

## NestJS Exception Filters

### APP_FILTER selection: specificity wins over registration order

When multiple `APP_FILTER` providers are registered, NestJS matches the thrown exception type against each filter's `@Catch()` decorator arguments and invokes the **most specific match** — not the last-declared one. Registration order only matters when two filters have equal specificity (e.g., two `@Catch()` catch-alls).

Example: a specific `@Catch(BaseError)` filter always wins over a `@Catch()` catch-all regardless of which appears first in the providers array. This differs from middleware/pipe stack semantics (reverse-order execution) and can be counterintuitive.
