# Architecture Patterns

## Business Logic & Clean Architecture

- **Core principle**: business logic belongs in domain services, UseCase/Handler classes, and entities — NOT in routes, controllers, or repository implementations
- **Service Layer** — pure domain logic services (no I/O), injected into UseCases
- **Repository Pattern** — data access abstraction via interfaces; implementations delegate to ORM
- **No business logic in route handlers** — they validate input and delegate to a UseCase
- **Entity owns domain methods** — status transitions, validation rules, state changes happen on the entity, never in the repository

## Layer Dependencies

For backend (see `rules/architecture-backend.md` for NestJS specifics):

```
Route Handler / Controller → UseCase → Service + Repository Interface
Service → pure domain logic (no I/O, framework-agnostic)
Repository Interface → ORM Implementation
```

Each layer depends only on the layers below it. No skipping layers; no upward dependencies.

For frontend (see `rules/architecture-angular.md` for Angular specifics):

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
