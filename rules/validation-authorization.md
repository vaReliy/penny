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
5. If new user → status = `pending`; issue JWT cookie.

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

The JWT signature proves authenticity; the DB re-check enforces current status:

```typescript
// In the auth guard (NestJS middleware)
const payload = jwt.verify(token, jwtSecret) as SessionPayload;
const user = await userRepository.findById(payload.sub); // always hits DB
if (!user || user.status !== UserStatus.ACTIVE) {
  throw new UnauthorizedException();
}
```

Re-loading on every request:

- Enables instant revocation (set `status = rejected` → next request fails).
- Enforces the admin-approval gate for `pending` users.
- No server-side token store required (stateless JWT + DB re-check).

**No tokens in localStorage** — enforced by ESLint `no-restricted-syntax` in all `platform:web` libs.

---

## Authorization (guards)

**Enforcement:** guard placement is a code pattern — enforced by code review and security-scanner gate. (soft — not an ESLint rule)

Authorization checks run in NestJS guards, before the controller. UseCases never perform auth checks.

```typescript
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    return req.user?.status === UserStatus.ACTIVE;
  }
}
```

The guard relies on the `user` object populated by the JWT middleware (the per-request DB re-check above).
