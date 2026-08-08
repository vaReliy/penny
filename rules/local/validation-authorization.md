## Overrides rules/cts/validation-authorization.md (entire file)

Penny uses LIVR exclusively (never Zod/class-validator) plus a Telegram-Login-Widget auth flow with JWT-cookie sessions and a two-guard (SessionGuard/ActiveUserGuard) authorization pattern. This file fully replaces `rules/cts/validation-authorization.md` — read this instead, not that.

## Request Validation

All input must be validated before reaching business logic. Validate at the service boundary (application layer), never inside UseCases or domain entities.

### LIVR bootstrap (required once per process)

Every process entrypoint (`main.ts`, CLI bootstrap, queue worker) **must** call `registerLivrRules()` from `shared-kernel` exactly once at startup, before any `BaseService` or `LIVR.Validator` is constructed.

```typescript
// apps/api/src/main.ts (or any other process bootstrap)
import { registerLivrRules } from 'shared-kernel';

registerLivrRules(); // must be first — before NestFactory.create() or any service init
```

Omitting this call **passes build and tsc but throws at runtime** on the first validation. See `rules/nx-generators.md` § 3 for the generator-scaffold reminder.

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

LIVR schemas live colocated with the application-layer service that uses them (e.g. `libs/identity/application/src/lib/telegram-login-payload.schema.ts`) unless reused across multiple verticals, in which case they belong in a `type:validation` lib scoped to the owning vertical. Custom rules are registered via `registerLivrRules()` (see above).

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

**Narrowing a JWT array claim's compile-time type requires a matching runtime set-membership check** — a signed token is attacker-shaped data even though it's signature-verified: a stale or forged claim (e.g. `roles: ['superadmin']` predating a role removal) will satisfy a TypeScript array type at compile time without failing any runtime check unless the type guard explicitly validates every element. Pattern (mirrors the existing `VALID_USER_STATUSES` check on `status`): build a `ReadonlySet` of the valid enum values and assert `.every(v => VALID_ROLES.has(v))` inside the claims type guard (e.g. `isTokenClaims()`), not just a `typeof === 'object'`/array-shape check.

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

### Cross-aggregate referential checks belong in `authorize`, not `execute`

`authorize(context, params)` already accepts `params` (bivariant override) and is the correct home for cross-aggregate referential checks like category existence + workspace ownership + archived-state. This is the first concrete example (2026-07-22, `RecordTransactionService`) where async, params-dependent `authorize` was actually used — prior services only checked caller/workspace state. Throw a dedicated error type (e.g. `CategoryNotEligibleError`) distinct from `ServiceValidationError`, so schema-validation failures and referential failures stay distinguishable:

```typescript
export class RecordTransactionService extends BaseService<RecordTransactionParams> {
  public async authorize(context: ServiceContext, params: RecordTransactionParams): Promise<void> {
    if (!context.caller) throw new AuthenticationError();

    // Cross-aggregate check: category exists, is owned by this workspace, and is not archived
    const category = await this.categoryRepository.findById(params.categoryId);
    if (!category || category.workspaceId !== context.caller.workspaceId || category.archivedAt !== null) {
      throw new CategoryNotEligibleError('Category not found or archived');
    }
  }
}
```

### Timing side-channels: XS-Leak vs. direct attack

A timing difference in an auth guard (e.g., missing-cookie short-circuits before JWT verify/DB lookup) is sometimes justified with "the attacker already knows whether they sent a cookie." This argument only holds for a _direct_ attacker calling the API with their own headers, **not** for the XS-Leak scenario:

In a classic XS-Leak "session oracle" attack, a cross-site attacker page forces the _victim's browser_ to send the request, and the attacker does not know/control whether the cookie was attached (the browser decides based on SameSite rules). The correct mitigating argument is that cookies are set with `sameSite: 'lax'`, which **prevents the cookie from being attached to cross-site fetch/XHR requests in the first place** — closing the practical timing-oracle vector and leaving only a much harder residual (top-level navigation + browser-isolated timing measurement).

Any future accepted-risk writeup for a cookie-gated timing/behavior difference must reason from the actual cookie/CORS/SameSite control, not from what "the attacker already knows."

### Admin authorization: `SetUserStatusService.authorize()` pattern

The `SetUserStatusService.authorize()` method in `libs/identity/application/src/lib/` is the canonical authorization check for admin-gated services. It fails closed:

```typescript
public authorize(context: ServiceContext): void {
  if (!context.caller?.roles.includes(ADMIN_ROLE)) {
    throw new ForbiddenException();
  }
}
```

The check has no `??` or default-true fallback — it rejects on `null` / empty `roles`. This is the _only_ `context.caller?.roles` check in the codebase as of now. Any future admin-gated service should reuse this exact pattern rather than re-deriving a new role-check. The `caller` is built by `SessionGuard` from JWT-verified `req.user`, ensuring the roles claim is signature-verified.

## Validation Rules

### LIVR optional fields: `null` is passed through

LIVR treats `null` input on an optional field as "not provided" (skips rule execution) but **does not strip the key** from the validated output. The result includes `{ fieldName: null }`. Filtering with `value !== undefined` misses `null` values, which can cause downstream issues:

```typescript
// ❌ Misses null
const filtered = Object.entries(data).filter(([, v]) => v !== undefined);
// Output: { username: null }  ← null slips through

// ✓ Correct
const filtered = Object.entries(data).filter(([, v]) => v !== undefined && v !== null);
// Output: {} ← null excluded
```

In Telegram auth payloads, `null` in optional fields causes HMAC mismatches if they're included in the data-check-string. Telegram's widget never sends `null` for absent fields (the key is simply omitted), so this is a _practical_ risk for custom validators or non-Telegram payloads. If stricter handling is needed, add a `not_empty` LIVR rule to optional field slots.

### LIVR strips undeclared fields — declare merged path params in the schema

`Validator.validate()` builds its output by iterating the _schema's own_ declared field names (`for (const fieldName in this.validators)` in `Validator.js`), never copying arbitrary keys from the input object. Fields absent from the schema are **silently dropped**, not passed through — no opt-in "strict mode" needed (verified in LIVR v2.10.2 source and by `base-service.spec.ts`'s "strips fields not declared" test).

Practical consequence: when a path param (`id`, `categoryId`, …) is merged into a service's params object, it must be declared in that service's **own** schema — e.g. spread the param rule over an imported base schema. An undeclared param does not "pass through by default"; it vanishes from `validData` with no error.

### LIVR is unknown-key-safe and operator-injection-safe by construction

Two properties verified directly in LIVR v2.10.2 source (`node_modules/.pnpm/livr@2.10.2/lib/rules/**`, `Validator.js`) — future security audits should not re-derive them:

1. Every built-in rule (`string`, `like`, `one_of`, `positive_integer`, `max_number`, `iso_date`, …) gates on `util.isPrimitiveValue(value)` first (`typeof value === 'string'|'number'|'boolean'`). Any object or array — e.g. a Mongo-operator-injection payload like `{ $gt: '' }` — fails this gate with `FORMAT_ERROR` before the rule's own logic runs.
2. Unknown keys are dropped per the stripping behavior above — arbitrary input fields never reach downstream code.

Both properties hold for every LIVR schema in this repo without per-field enforcement. **Not yet verified**: array-typed filter fields (none exist yet) — an array of operator-objects needs its own array-of-scalar rule verification when the first such field is added.

### `{ like: ID_PATTERN }` is the actual NoSQL-injection fuse for id-shaped fields

LIVR's `{ like: ID_PATTERN }` rule rejects non-primitive input before regex matching, which is what actually closes Mongo-operator-injection (`{$gt:''}`-style) on `categoryId`, `accountId`, `id` fields and similar. This holds for all id-shaped string fields where the schema declares `{ like: ID_PATTERN }` — the LIVR rule gates on `util.isPrimitiveValue()` before any regex, so operator objects never reach the regex matcher. Currently only documented in code comments — add to a visible rule.

**Enforcement note:** prose-only claims that a request shape is "period-scoped" or "bounded" aren't enforced at the schema level. When a task/ADR claims a request shape is bounded/scoped/filtered, verify the LIVR validation schema **or** the `authorize()` method actually enforces it, not just the prose. Example: a filter schema that left every filter optional despite "period-scoped queries" prose allowed an empty-params call to return unbounded data — fixed by adding an explicit period-scope guard in `authorize()` (month required OR both from+to required).

### [CRITICAL] `@Query()` passed straight into a LIVR-validated service silently defeats validation

**Express null-prototype object fails LIVR's `isObject` check**: Express builds `req.query` via `Object.create(null)`. LIVR's `isObject(obj)` is `obj?.constructor === Object`, which is `false` for null-prototype, so validation returns the string `'FORMAT_ERROR'` instead of a validated object or boolean. If `base-service` only checks `if (validParams === false)`, the string passes through as "valid," reaches `authorize()`, and throws a `TypeError` on first property access — surfacing as a raw 500 instead of a 4xx.

**Concrete incident** (2026-07-28): `GET /api/budget/transactions?month=2026-07` hitting a null-prototype query object. This is a systemic footgun, not a one-off.

**Fix**: Controllers must spread `{ ...query }` before passing to the service, converting null-prototype → plain object. Also update `base-service.ts` to check `if (!validParams)` so any non-object/non-array LIVR return maps to `ServiceValidationError` (4xx).

**Checklist**: Wherever a NestJS `@Query()`/`@Body()` object is handed to a LIVR-validated service, verify it has been spread into a plain object first.

### Asymmetric id-validation is easy to miss when sibling id params get different treatment

When one id-shaped param in a params object gets an existence/ownership check, verify every sibling id-shaped param in the same object needs the same treatment. Both can pass identical LIVR shape-only validation while only one gets the real referential check, which isn't visible from the schema and is easy to miss in review.

**Concrete incident** (2026-07-27): `RecordTransactionService` checked `categoryId` for existence/workspace-ownership but never checked `accountId` the same way — both pass identical LIVR shape-only validation, so the asymmetry is invisible from the schema.

**Checklist**: whenever one id-shaped param in a params object gets an `authorize()`-level existence/ownership check, audit every other id-shaped param in the same object to confirm it receives the same treatment.
