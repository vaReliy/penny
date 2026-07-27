## Overrides rules/cts/architecture.md (entire file)

Penny uses an Nx-enforced onion architecture (scope/type/platform tags) instead of the generic Clean Architecture layer stack in the CTS default. This file fully replaces `rules/cts/architecture.md` — read this instead, not that.

## Business Logic & Clean Architecture

- **Core principle**: business logic belongs in domain services, UseCase/Handler classes, and entities — NOT in routes, controllers, or repository implementations
- **Service Layer** — pure domain logic services (no I/O), injected into UseCases
- **Repository Pattern** — data access abstraction via interfaces; implementations delegate to ORM
- **No business logic in route handlers** — they validate input and delegate to a UseCase
- **Entity owns domain methods** — status transitions, validation rules, state changes happen on the entity, never in the repository

## Layer Dependencies

For backend (see `rules/local/architecture-backend.md` for NestJS specifics):

```
Route Handler / Controller → UseCase → Service + Repository Interface
Service → pure domain logic (no I/O, framework-agnostic)
Repository Interface → ORM Implementation
```

Each layer depends only on the layers below it. No skipping layers; no upward dependencies.

For frontend (see `rules/local/architecture-angular.md` for Angular specifics):

```
Feature Component → Data/UI services → API adapters + Local state
```

## Framework-Agnostic Domain (Core & Application Layers)

Core domain and application layers contain **no framework imports**:

- ❌ No `@nestjs/*` or `@angular/*` imports
- ❌ No ORM decorators (Prisma, TypeORM, Mongoose) in domain
- ❌ No `@Injectable()`, `@Component()`, etc.

Why: Domain logic becomes testable without framework dependencies and reusable across implementations.

**Exception**: Infrastructure and application layers _may_ import framework code to adapt domain interfaces.

### CAS-via-optional-param: canonical pattern for closing TOCTOU races on scoped updates

When a stale-read-modify-write race is possible on an entity field (a caller reads a value, computes a new value, then writes it back — racing another writer doing the same), the established fix shape is compare-and-swap via an _optional_ parameter, not a new required API: the repository method gains an optional `expectedCurrentValue` param that, when present, adds an equality filter clause on that field to the underlying conditional-update primitive (`findOneAndUpdate`, `UPDATE ... WHERE`, etc.). The update returns no match on a filter mismatch, which the caller must surface as an explicit, observable conflict — never a silent retry: `409` on the HTTP path, a logged error + non-zero exit on the CLI path. The optional param keeps old callers byte-identical (no breaking change), so the pattern rolls out incrementally. This generalizes across any store with a conditional-update primitive, not just document stores.

## Nx Monorepo: Tags & Boundaries

Every Nx library must carry exactly one tag per dimension in its `project.json`.

### Tag Dimensions

| Dimension   | Values                                                                                                                                             | Meaning                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `scope:`    | `shared`, `identity` (extensible: `budget`, `car`, etc.)                                                                                           | Domain isolation. `shared` is the only domain allowed as a cross-domain dependency. |
| `type:`     | Backend: `infrastructure`, `application`, `core`, `kernel`, `contracts`, `util` / Frontend: `feature`, `ui`, `data`, `kernel`, `contracts`, `util` | Onion/hexagonal layer. Defines inbound dependency direction.                        |
| `platform:` | `server`, `web`, `shared`                                                                                                                          | Runtime target. Enforces platform separation.                                       |

Example: `libs/identity/core/` carries tags `["scope:identity", "type:core", "platform:server"]`.

### Directory Convention

```
libs/<scope>/<name>/
```

The folder `<name>` reflects the layer (`core`, `application`, `infrastructure`, `feature`, `ui`, `data`). **Platform is enforced via tags, not paths.**

### Scope Rules

- `scope:shared` → may only depend on `scope:shared`
- All other scopes → may depend on same scope + `scope:shared`

Result: cross-domain code flows only through `scope:shared` contracts.

**New domain ⇒ new depConstraint, or the fuse is open**: `@nx/enforce-module-boundaries`'s `depConstraints` in `eslint.config.mjs` only fence a `scope:*` tag that has a matching `onlyDependOnLibsWithTags` rule. A source tag with no matching rule is NOT fenced by default — it can import anything. So standing up a new `libs/<domain>/*` scope has a hard prerequisite: add `{ sourceTag: 'scope:<domain>', onlyDependOnLibsWithTags: ['scope:<domain>','scope:shared'] }` to `eslint.config.mjs` BEFORE the first lib in that scope lands, else the onion/scope fuse silently doesn't apply to it. This is an executable-config edit (never trivial-tier). Separately: `type:validation` libs may depend ONLY on `type:util` (not `type:contracts`) — LIVR schemas are self-contained runtime rule objects and must not import DTO/contract TS types.

### Platform Rules

- `platform:web` → may only depend on `platform:web`, `platform:shared`
- `platform:server` → may only depend on `platform:server`, `platform:shared`
- `platform:shared` → may only depend on `platform:shared`

Result: no Node.js code in browser bundles; no browser APIs in backend.

### Onion Rules (Backend)

```
infrastructure → application → core → kernel/contracts/errors/util
```

- `type:infrastructure` — transports, ORM, external clients; may depend on all
- `type:application` — use-cases, handlers; may depend on core and below
- `type:core` — pure domain logic, entities, value objects; may depend on kernel and below
- `type:kernel` — domain abstractions (`IRepository`, error base classes); may depend on util, errors, and contracts (e.g. `CallerIdentity.roles: RoleType[]` importing the `RoleType` union — see Type-Contracts Boundary below)
- `type:contracts` — shared types, enums; may depend only on util
- `type:errors` — error hierarchy; may depend only on util; used by all layers
- `type:util` — helpers, guards; may depend only on util (leaf)

### Onion Rules (Frontend)

```
feature → ui/data/util
ui → ui/util
data → util
```

- `type:feature` — components, orchestration; may depend on ui, data, util
- `type:ui` — presentational; may depend only on ui, util
- `type:data` — services, state, API adapters; may depend on util, contracts
- `type:kernel`, `type:contracts`, `type:util` — same as backend

### Type-Contracts Boundary

When a `type:contracts` lib becomes the authoritative source for domain primitives (e.g., `UserStatus` enum), explicitly add it to the `type:core` and `type:infrastructure` dependency allowlist in `eslint.config.mjs`:

```javascript
// eslint.config.mjs
{
  files: ['...'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        'type:core': ['scope', 'type:contracts'],  // ← added
      },
    ],
  },
}
```

### Import Bans

**In `type:core` and `type:application`:**

- Ban framework imports: `@nestjs/*`, `@angular/*`, `mongoose`, `@typegoose/*`
- Rationale: domain stays framework-agnostic; adapters (infrastructure) bridge frameworks

**In frontend layers (`type:feature`, `type:ui`, `type:data`):**

- Ban `localStorage` and `window.localStorage`
- Rationale: auth tokens use in-memory or secure session storage, never persistent localStorage

### Enforcement

- **`@nx/enforce-module-boundaries`** — lint gate, runs in CI
- **`no-restricted-syntax`** — ESLint rule for localStorage ban
- Both fail merge automatically if violated

**Violations can span multiple tag dimensions at once** (this repo: `scope:*`, `type:*`, `platform:*`) — ESLint reports one violation at a time, so fixing the first-reported dimension can just surface the next. Before choosing a fix, check `depConstraints` in the root `eslint.config.mjs` for ALL dimensions the flagged pair differs on, not just the one in the current error message. In this repo: `libs/shared/testing` (tagged `scope:shared`, `platform:shared`) imported from `identity-core` (`scope:identity`, `platform:server`) — retagging only `scope` to `scope:identity` would have left `platform:shared` importing `platform:server`, re-triggering the same class of error on the next lint run. The fix retagged both dimensions at once (`libs/identity/testing`, tagged `["scope:identity", "type:testing", "platform:server"]`).

## Nginx & Static Serving

### Feature-to-contracts re-export pattern

`type:feature` libraries cannot import directly from `type:contracts` (shared-contracts). The ESLint boundary rule only allows `type:feature` → `type:feature`, `type:ui`, `type:data`, `type:util`. Fix: re-export needed types from the domain's `type:data` lib:

```typescript
// In eager data lib: libs/identity/data-access/src/index.ts
export type { TelegramLoginPayload, UserStatus } from 'shared-contracts';

// In lazy feature lib: libs/identity/feature-login/src/lib/login.component.ts
import { TelegramLoginPayload } from 'identity-data-access'; // ✓ Allowed
```

This pattern applies to any type, DTO, or enum shared between layers.

### nginx upstream and proxy_pass

In `nginx.conf`, prefer a named `upstream` block over bare host:port in `proxy_pass`:

```nginx
upstream api {
  server api:3000;
}

server {
  location /api/ {
    proxy_pass http://api;  # ✓ Uses upstream block
  }
}
```

NOT:

```nginx
proxy_pass http://api:3000;  # Confuses readers
```

The distinction matters for documentation — developers opening the config should find the backend port in the upstream block, not inline.

### CSP nonce injection: nginx `sub_filter` with `gzip off`

When nginx serves the static Angular SPA (separate from NestJS), per-request nonce delivery uses nginx `sub_filter`:

1. Set `$nonce` to a per-request value (e.g., `$request_id`)
2. Replace the empty `content=""` attribute in `<meta name="csp-nonce">` with the nonce value
3. Emit `Content-Security-Policy` header with `'nonce-$nonce'` in `style-src`

**Critical gotcha**: `sub_filter` requires `gzip off` (or `gzip_static on` with pre-compressed files) in the same location block — dynamic gzip compresses the body before the sub_filter can match, silently producing no substitution with no error.

```nginx
server {
  location / {
    gzip off;  # Must disable or use pre-compressed files
    add_header Content-Security-Policy "style-src 'nonce-$request_id'" always;
    sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">';
  }
}
```

Also note: Angular production build minifies `content=""` → `content`, so match the minified form in the sub_filter pattern (see `rules/docker-commands.md` for details).
