# Validation & Authorization

## Request Validation

All input must be validated before reaching business logic. Validate at the service boundary (application layer), never inside UseCases or domain entities.

### LIVR bootstrap (required once per process)

Every process entrypoint (`main.ts`, CLI bootstrap, queue worker) **must** call `registerLivrRules()` from
`shared-kernel` exactly once at startup, before any `BaseService` or `LIVR.Validator` is constructed.

```typescript
// apps/api/src/main.ts (or any other process bootstrap)
import { registerLivrRules } from 'shared-kernel';

registerLivrRules(); // must be first — before NestFactory.create() or any service init
```

Omitting this call **passes build and tsc but throws at runtime** on the first validation.
See `rules/nx-generators.md` § 3 for the generator-scaffold reminder.

---

### LIVR — Primary Validation (js-validator-livr)

LIVR is the **only** validation library used in Penny. Zod and class-validator are not used.

```typescript
import LIVR from 'livr';

const validator = new LIVR.Validator({
  telegramId: ['required', 'positive_integer'],
  firstName: ['required', { max_length: 64 }],
  username: [{ max_length: 32 }],
  authDate: ['required', 'positive_integer'],
  hash: ['required', { length_equal: 64 }],
});

const validData = validator.validate(input);
if (!validData) {
  throw new ValidationError(validator.getErrors());
}
```

Shared LIVR schemas live in `libs/shared/validation/` and are imported by backend (application-layer) code only — frontend libs may not import this lib per the Nx boundary contract. Custom rules are registered via `registerLivrRules()` (see above).

## Validation Error Flow

Validation failure → HTTP 422 with structured field errors:

```json
{
  "error": "Validation failed",
  "fields": {
    "telegramId": "required",
    "hash": "max_length"
  }
}
```

Frontend consumes the `fields` object and maps errors to form inputs.

---

## Authentication — Telegram Login Widget

### Verification flow

**Enforcement:** dedicated service + mandatory unit tests + security-scanner gate on every auth change. (hard fuse)

1. Client embeds `telegram-widget.js`; user approves in Telegram.
2. Widget posts `{ id, first_name, last_name?, username?, photo_url?, auth_date, hash }` to the API.
3. Backend **verifies the payload** before touching the DB:
   - Derive `secret = SHA256(botToken)` (raw bytes, not hex).
   - Build `data-check-string` = all fields except `hash`, sorted alphabetically, joined by `\n`, formatted as `key=value`.
   - Compute `HMAC-SHA256(secret, data-check-string)` and compare to `hash` with `timingSafeEqual`.
   - Reject if `auth_date` is older than 24 h (replay protection).
4. Find-or-create user by `telegramId` (durable identity key).
5. Issue JWT cookie for all verified users — both new (`pending`) and existing users. `pending` users need the cookie to reach `GET /auth/me` and read their approval status; data routes are gated by `ActiveUserGuard` (see below).

```typescript
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

function verifyTelegramHash(params: TelegramAuthParams, botToken: string): boolean {
  const { hash, ...rest } = params;
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHash('sha256').update(botToken).digest();
  const computed = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}
```

**`timingSafeEqual` is non-negotiable** — prevents a timing oracle on the HMAC comparison.

---

## Session — JWT Cookie

**Enforcement:** `httpOnly`, `Secure`, `SameSite=Lax` cookie flags are code patterns — enforced by code review and security-scanner gate. (soft — not an ESLint rule)

### Issuance

After successful Telegram verification + find-or-create:

```typescript
const token = jwt.sign({ sub: user.id, telegramId: user.telegramId }, jwtSecret, {
  algorithm: 'HS256',
  expiresIn: '7d',
});

res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
});
```

### Per-request status re-check (hard enforcement)

The JWT signature proves authenticity; the DB re-check enforces current status. Guards are split into two roles:

**SessionGuard** — authentication only, verifies JWT signature + loads user from DB, **no status check**. Apply to endpoints all authenticated users can reach:

```typescript
// SessionGuard — authentication only
// Apply to: GET /auth/me and any endpoint all authenticated users may reach
const payload = jwt.verify(token, jwtSecret) as SessionPayload;
const user = await userRepository.findById(payload.sub); // always hits DB
if (!user) {
  throw new UnauthorizedException();
}
req.user = {
  id: user.id,
  telegramId: user.telegramId,
  displayName: user.firstName ?? user.username ?? user.telegramId,
  status: user.status, // loaded from DB, but not checked here
};
```

**ActiveUserGuard** — authorization, checks `status === active`. Apply to all data endpoints:

```typescript
// ActiveUserGuard — authorization, enforces active status
// Apply to: GET /hello, POST /budget, and every route serving real data
if (req.user?.status !== UserStatus.ACTIVE) {
  throw new ForbiddenException();
}
```

Re-loading the user on every request:

- Enables instant revocation (set `status = rejected` → next request fails).
- `pending` users pass SessionGuard (can reach `/auth/me` to view approval status) but fail ActiveUserGuard (blocked from data routes).
- `rejected` users are blocked from both once their JWT expires.
- No server-side token store required (stateless JWT + per-request DB re-check).

**UserStatus values**: `PENDING` (registered, awaiting admin approval), `ACTIVE` (approved, full platform access), `REJECTED` (denied, terminal state).

**No tokens in localStorage** — enforced by ESLint `no-restricted-syntax` in all `platform:web` libs.

---

## Authorization (guards)

**Enforcement:** guard placement is a code pattern — enforced by code review and security-scanner gate. (soft — not an ESLint rule)

Authorization checks run in NestJS guards, before the controller. UseCases never perform auth checks. The two-guard pattern ensures that:

1. **SessionGuard must run first** — it loads the user from the DB and populates `req.user`.
2. **ActiveUserGuard runs after** — it checks `req.user.status`, throwing `ForbiddenException` (403) if not `ACTIVE`.

**Clarification**: SessionGuard throws `UnauthorizedException` (401 — authentication failure); ActiveUserGuard throws `ForbiddenException` (403 — authenticated but not authorized).

Example implementation:

```typescript
@Injectable()
export class ActiveUserGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!req.user || req.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException();
    }
    return true;
  }
}
```

Usage in a controller:

```typescript
@Controller('hello')
export class HelloController {
  @Get()
  @UseGuards(SessionGuard, ActiveUserGuard) // SessionGuard first, then ActiveUserGuard
  public greet(@CurrentUser() user: SessionUser): { message: string } {
    return { message: `Hello, ${user.displayName}!` };
  }
}
```

The guard sequence ensures that `pending` users can call `GET /auth/me` (protected by SessionGuard alone) to check their approval status, but cannot access data endpoints (protected by both guards).
