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

## Tailwind and CSS

### `@source` globs are per-lib opt-in

Tailwind v4 `@source` globs in `apps/web/src/styles.css` control which directories are scanned for utility-class usage. A new Nx lib with `.html` templates renders unstyled without an error until its path is added to the `@source` list — no build failure, no lint error, classes simply don't generate CSS. A static regression guard exists (`apps/web/src/tailwind-source-globs.guard.spec.ts`) that parses the `@source` globs and flags any `libs/*/*/src` directory containing `.html` templates but not covered by the globs. When scaffolding a new lib with templates, verify it's added to the `@source` configuration.

## Build Output Structure

### Angular 17+ nested `browser/` subdirectory

Angular 17 introduced a nested `browser/` subdirectory inside the app dist folder (for future SSR/SSG parity). The build output for `nx build web` is at `dist/apps/web/browser/`, not `dist/apps/web/`.

Nginx Dockerfiles that `COPY` from `dist/apps/web` instead of `dist/apps/web/browser` serve an empty or broken site — the HTML/JS/CSS files are one level deeper than expected. Always verify the Angular output path via `npx nx build web --skip-nx-cache` before writing the Dockerfile `COPY` step.

## Nx Module Boundaries and Dependency Constraints

### `type:data` libs cannot import `type:errors` or cross-scope `type:data` — a known, accepted tradeoff

The `eslint.config.mjs` `depConstraints` restrict any `type:data` library to depending only on `type:data`, `type:util`, and `type:contracts` within its own scope, plus `scope:shared` libs globally. A `type:data` lib cannot import `libs/shared/errors`' canonical `BaseError` or `ErrorCode` enum, nor any other scope's `type:data`.

This forces every Angular data-access lib to re-derive error-code literals by hand (e.g., `libs/budget/data-access`'s `budget-api-error.ts` duplicates error codes), and any cross-domain behavior (e.g., 401→`/login` redirect) must be a local re-implementation (e.g., `BudgetSessionExpiryService`). This is a known, accepted tradeoff — the boundary prevents implicit coupling between domains at the cost of duplication. Do not attempt to work around it; the constraint reflects the intended architecture.

### A composition-root app needs its own `scope:<app>` boundary tag

An Nx project can carry only one `scope:*` tag at a time. A project tagged with two exclusive domain scopes (e.g., `scope:identity` and `scope:budget` simultaneously) can never legally import from either scope, since every import must satisfy all matching `depConstraints` rules simultaneously.

When an app composes multiple domains, give it its own composition-root tag (e.g., `scope:web`) with `onlyDependOnLibsWithTags` listing both the app's own tag and every domain scope it composes. This allows the app to import from all its composed domains while preserving boundaries between the domains themselves. For apps composing a single domain, the domain's `scope:*` tag alone is sufficient.

### Type re-export boundaries: `type:feature` → `type:contracts` and `type:validation`

`type:feature` libraries cannot import directly from `type:contracts` (shared-contracts library). Re-export needed types from the corresponding `type:data` library instead. This adds a single re-export line but preserves the layer boundary.

`type:validation` constants (validation schemas, field-length limits) are NOT re-exportable through `type:data` — they must be duplicated locally in any `type:feature` lib that needs them. This is a stricter boundary than `type:contracts` due to structural import restrictions, so treat validation duplication as expected, not a code smell.

### Relocate shared helpers to `type:util` when dependencies allow

When a `type:ui` lib needs a helper currently living in a `type:data` lib, do not duplicate it automatically — first check whether the helper's entire dependency graph already lives in `type:util` libs. If it does, relocate the helper to `type:util` instead of duplicating it.

Duplicate only when the helper genuinely depends on something scoped to `type:data` (e.g., a view model shape that is structurally typed through from a data-access layer). For example, a helper that transforms a UI-display format for Money should live in `type:util`, not be duplicated across scopes; but a component-specific interface mirroring a `type:data` view model's shape for structural typing can remain duplicated if the real model is intentionally hidden from that layer.

## Responsive/Dual-Rendered Components

### Prefer one shared template or signal over independently authored breakpoint branches

`transaction-list.html` renders two independent markup trees over the same data — a mobile card list (`md:hidden`) and a desktop table (`hidden md:block`) — and `setSort()` was wired only to the desktop `<th>` buttons. Below 768px, sorting was entirely unreachable, yet `grep setSort` found it correctly wired and the existing unit tests passed, because both checks confirm the handler exists and works, not which breakpoint branch calls it.

The fix pattern that generalizes: a single shared signal driven by both branches (no duplicated state), plus a test pinned to a specific viewport width (390px here) that asserts the affordance is actually present and functional in the DOM at that width — existence/wiring checks alone cannot catch this class of bug. A follow-up audit of other dual-rendered components in this codebase (`history-filter-panel`, shell nav) found both already safe: `history-filter-panel` mounts one shared template twice rather than duplicating markup, and the shell nav's two branches iterate the same `navItems` array with identical bindings. Prefer one shared template mounted twice, or a single shared state signal, over independently authored breakpoint branches.

## Content Security Policy

### A CSP audit needs at least one real-browser, production-build check per release

Production CSP blocked Angular's async-CSS-load `onload` handler, leaving every JS-enabled real user with unstyled HTML. The stylesheet itself served fine (`curl` → 200 + valid CSS); only its activation was blocked, so the page rendered completely unstyled. Found by accident during a real `docker compose up --build` + real-Chromium check — the first time this project's production build was exercised with a JS-enabled real browser rather than source-read or `ng serve`. No CI job and no prior review had caught it, because verification up to that point was source-read-only or ran against dev-server builds that carry no CSP.

The durable principle: a CSP audit — or any header-level security control — needs at least one real-browser, production-build check per release. Grepping the CSP config for the right directives is not sufficient, because the interaction between the policy and the built artifact's actual markup is invisible to static review. It took three attempts and three real-browser sessions to close this defect; every intermediate diagnosis made without a browser was wrong. (The `onload=` handler itself cannot be fixed by adding a CSP nonce — see `rules/local/code-style-angular.md` § Content Security Policy for why.)

### nginx-layer behavior exists only in the built image — CI green carries near-zero information about it

`scripts/web-csp-smoke-check.sh` greps the served HTML for the expected nonce patterns and passed in CI while the production page was, in fact, completely unstyled (see `rules/local/testing.md` § "A guard that asserts its own mechanism is installed" for the mechanism-vs-outcome principle this incident produced). The check now drives headless Chromium (`scripts/web-csp-render-check.mjs`) and the greps survive only as diagnostics. Because nginx-layer substitution and CSP-header interaction with the built artifact only exist in the built image, a green CI run that never exercises that image in a real browser carries near-zero information about whether the production page actually renders.

### Turning off `inlineCritical` changes how `index.html` serializes attributes, silently breaking any nginx `sub_filter` pinned to the old markup

Disabling `optimization.styles.inlineCritical` to remove the CSP-blocked inline `onload` handler also changed the csp-nonce meta from `<meta name="csp-nonce" content>` to `<meta name="csp-nonce" content=""/>`. The critical-CSS inliner (beasties) re-serializes the whole document as a side effect of its rewrite, so the bare-attribute form only exists while it is enabled. The existing `sub_filter 'name="csp-nonce" content>'` matched the old form exactly and would have silently stopped injecting the nonce — no error, no failed build, just Angular's runtime-injected component styles losing their nonce. Caught only because the built `index.html` was read byte-for-byte after the config change rather than assumed unchanged.

General principle: any nginx `sub_filter`, `sed`, or grep pinned to build-tool-generated markup is coupled to that tool's serializer, not just to its semantic output — changing an unrelated-looking build flag can move the markup underneath it. Pair every such pattern with a check that fails when it stops matching.

## Display Value Clamping and Visual Meaning

When clamping a derived display value (percent, color tier, width percentage) to a bounded range, check the unclamped source value for edge cases that become indistinguishable once clamped. For example, clamping budget-overspend percent to `Math.min(100, ...)` makes 100% and 300% spend render pixel-identical — the user cannot see how severely overspent a category is. A divide-by-zero guard may correctly return 0%, but 0% for an unbudgeted-but-overspent category reads as "on track" instead of "overspent with no budget."

The numeric value can satisfy its contract (no crash, no overflow) while still failing to communicate the right meaning visually. Always view rendered edge-case data before considering the value correct.
