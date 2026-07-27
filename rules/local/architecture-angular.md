# Angular Architecture

This rule covers Angular-specific architecture patterns, boundaries, and module organization. See `rules/architecture.md` for shared onion/DDD layer patterns.

## Injection Token Placement in Nx Monorepo

When an `InjectionToken` is provided at root app initialization (in `app.config.ts`), it must live in a **non-lazy library** to avoid `@nx/enforce-module-boundaries` violations.

### The problem

If a lazy-loaded `type:feature` lib defines an `InjectionToken` and the eager `app.config.ts` imports it statically:

```typescript
// In lazy lib: libs/identity/feature-login/src/lib/telegram-bot-username.token.ts
export const TELEGRAM_BOT_USERNAME = new InjectionToken<string>(...);

// In root config: apps/web/src/app.config.ts
import { TELEGRAM_BOT_USERNAME } from 'identity-feature-login';  // ❌ ESLint error
```

This violates the rule: "eager code cannot import from lazy libs" (eager → lazy is a boundary violation).

### The solution

Define the token in a `type:data` library (which is eager/non-lazy):

```typescript
// In eager data lib: libs/identity/data-access/src/lib/telegram-bot-username.token.ts
export const TELEGRAM_BOT_USERNAME = new InjectionToken<string>(...);

// In root config: apps/web/src/app.config.ts
import { TELEGRAM_BOT_USERNAME } from 'identity-data-access';  // ✓ Allowed
```

Then the lazy feature lib imports from the same `type:data` lib:

```typescript
// In lazy lib: libs/identity/feature-login/src/lib/use-telegram-login.service.ts
import { TELEGRAM_BOT_USERNAME } from 'identity-data-access'; // ✓ lazy → eager is allowed
```

This allows both the eager root config and the lazy feature component to share a single token reference.

## Feature-to-Contracts Import Pattern

`type:feature` libraries cannot import directly from `type:contracts` (shared-contracts). The ESLint boundary rule only allows `type:feature` → `type:feature`, `type:ui`, `type:data`, `type:util`.

### The problem

```typescript
// In lazy feature lib: libs/identity/feature-login/src/lib/login.component.ts
import { TelegramLoginPayload } from 'shared-contracts'; // ❌ ESLint error
```

### The solution

Re-export the needed type from the `type:data` library:

```typescript
// In eager data lib: libs/identity/data-access/src/index.ts
export type { TelegramLoginPayload } from 'shared-contracts';

// In lazy feature lib: libs/identity/feature-login/src/lib/login.component.ts
import { TelegramLoginPayload } from 'identity-data-access'; // ✓ Allowed
```

This pattern applies to any type, DTO, or enum shared between layers.

## Dev Server Proxy

The Angular dev-server (`@angular/build:dev-server`) reads proxy rules from a **separate `proxy.conf.json` file**, not from `vite.config.mts`.

Configure in `apps/web/project.json`:

```json
{
  "targets": {
    "serve": {
      "executor": "@angular/build:dev-server",
      "options": {
        "proxyConfig": "apps/web/proxy.conf.json"
      }
    }
  }
}
```

Create `apps/web/proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "pathRewrite": { "^/api": "" }
  }
}
```

This proxies all `/api/**` requests in local dev to `http://localhost:3000`. Without this, API calls from the Angular app return 404 in dev.

## Build Output Structure

### Angular 17+ nested `browser/` subdirectory

Angular 17 introduced a nested `browser/` subdirectory inside the app dist folder (for future SSR/SSG parity). The build output for `nx build web` is at `dist/apps/web/browser/`, not `dist/apps/web/`.

Nginx Dockerfiles that `COPY` from `dist/apps/web` instead of `dist/apps/web/browser` serve an empty or broken site — the HTML/JS/CSS files are one level deeper than expected. Always verify the Angular output path via `npx nx build web --skip-nx-cache` before writing the Dockerfile `COPY` step.

## Nx Module Boundaries and Dependency Constraints

### `type:data` libs cannot import `type:errors` or cross-scope `type:data` — a known, accepted tradeoff

The `eslint.config.mjs` `depConstraints` restrict any `type:data` library to depending only on `type:data`, `type:util`, and `type:contracts` within its own scope, plus `scope:shared` libs globally. Crucially, a `type:data` lib cannot import another scope's `type:data` lib, nor can it import `libs/shared/errors`' canonical `BaseError` or `ErrorCode` enum.

This forces every Angular data-access lib to re-derive error-code literals by hand (e.g., `libs/budget/data-access`'s `budget-api-error.ts` duplicates error codes rather than importing them), and any cross-domain behavior (e.g., a 401→`/login` redirect) must be a local re-implementation rather than a shared call into another scope's code (e.g., `BudgetSessionExpiryService` re-implements logout locally).

This is a known, accepted tradeoff — the boundary prevents implicit coupling between domains at the cost of duplication. Do not attempt to work around it by moving errors to `type:util`; the constraint reflects the intended architecture. Each domain owns its client-side error mapping.

### A composition-root app needs its own `scope:<app>` boundary tag

An Nx project can carry only one `scope:*` tag at a time — every import must satisfy all matching `depConstraints` rules simultaneously, so a project tagged with two exclusive domain scopes can never legally import from either scope.

When an app composes multiple domains (e.g., `apps/web` bringing together `scope:identity` and `scope:budget` features), give the app its own composition-root tag (e.g., `scope:web`) with `onlyDependOnLibsWithTags` listing the app's own tag plus every domain scope it composes:

```javascript
// In eslint.config.mjs
{ sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:identity', 'scope:budget', 'scope:shared'] }
```

This recurs for every app that composes more than one domain. For apps composing a single domain, no additional tag is needed.

### Relocate shared helpers to `type:util` when dependencies allow

When a `type:ui` lib needs a helper currently living in a `type:data` lib, do not duplicate it automatically — first check whether the helper's entire dependency graph already lives in `type:util` libs. If it does, relocate the helper to `type:util` instead of duplicating it.

Duplicate only when the helper genuinely depends on something scoped to `type:data` (e.g., a view model shape that is structurally typed through from a data-access layer). For example, a helper that transforms a UI-display format for Money should live in `type:util`, not be duplicated across scopes; but a component-specific interface mirroring a `type:data` view model's shape for structural typing can remain duplicated if the real model is intentionally hidden from that layer.
