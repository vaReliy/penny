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
