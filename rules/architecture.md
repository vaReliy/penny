# Architecture Patterns

## Business Logic

- **Clean Architecture** — all business logic in UseCase/Handler classes
- **Service Layer** — pure domain logic services (no I/O), injected into UseCases
- **Repository Pattern** — data access abstraction via interfaces; implementations swap ORM
- No business logic in route handlers or controllers — they are thin entry points

## Layer Stack

```
Route Handler / Controller
  ↓  validates input (js-validator-livr / Zod / class-validator)
  ↓  calls UseCase
UseCase / Handler
  ↓  orchestrates business logic
  ↓  calls Services + Repositories
Service
  ↓  pure domain logic, no I/O
Repository Interface → ORM Implementation (Prisma / TypeORM / Drizzle)
```

Each layer depends only on the layer below it. No skipping layers.

## Frontend

- **Vue, React, or Angular** — separate agents handle each framework (vue-developer, react-developer, angular-developer)
- Communicates with backend via REST or GraphQL API
- Domain organization: features organized by domain (auth, posts, users, etc.)

## Database

- Every schema change → new migration file (never modify existing migrations in production)
- Prefer repository pattern: `IPostRepository` interface + `PrismaPostRepository` implementation
- Eager loading via ORM includes/relations to prevent N+1 queries
- Prefer ORM abstractions over raw SQL; use raw queries only for complex aggregations
- Update seeders and factories when data changes

## Performance

- **Node.js** with PM2 cluster mode or native clustering
- **Redis** — caching, sessions, queue management
- **PostgreSQL** with proper indexing
- Structured logging with pino (JSON output, configurable log levels)

## Development Tools

- **Bull Board** — queue monitoring UI at `/admin/queues`
- **Prisma Studio** — database inspector (if using Prisma)
- **Node.js debugger** — attach via `--inspect` flag
- **pino-pretty** — human-readable logs in development

## Executable architecture contract (Nx tags & boundaries)

### Tag dimensions

Every Nx lib carries exactly one tag per dimension in its `project.json` `tags` array:

| Dimension   | Values                                                                                                                                             | Meaning                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `scope:`    | `shared`, `identity` (extensible: `budget`, `car`, etc.)                                                                                           | Domain isolation. `shared` is the only domain allowed as a cross-domain dependency.       |
| `type:`     | Backend: `infrastructure`, `application`, `core`, `kernel`, `contracts`, `util` / Frontend: `feature`, `ui`, `data`, `kernel`, `contracts`, `util` | Onion/hexagonal layer. Defines inbound dependency direction.                              |
| `platform:` | `server`, `web`, `shared`                                                                                                                          | Runtime target (backend NestJS, frontend Angular, or both). Enforces platform separation. |

Example: `libs/identity/core` carries tags `["scope:identity", "type:core", "platform:server"]`.

### Directory convention

```
libs/<scope>/<name>/
```

The folder `<name>` reflects the onion layer (e.g., `core`, `application`, `infrastructure`, `feature`, `ui`, `data`). **Platform is enforced via the `platform:` tag, not the path.**

Examples:

- `libs/identity/core/` → tags `scope:identity, type:core, platform:server`
- `libs/identity/feature-login/` → tags `scope:identity, type:feature, platform:web`
- `libs/shared/contracts/` → tags `scope:shared, type:contracts, platform:shared`

Platform enforcement is tag-based; the `localStorage` ban anchors on frontend-layer folders (`feature`, `ui`, `data`), which are the web-only libs.

### Dependency rules (direction summary)

**Scope isolation:**

- `scope:shared` → may only depend on `scope:shared`
- All other scopes → may depend on same scope + `scope:shared`
- Consequence: cross-domain communication only through `scope:shared` (e.g., shared contracts, events, utilities)

**Platform separation:**

- `platform:web` → may only depend on `platform:web`, `platform:shared`
- `platform:server` → may only depend on `platform:server`, `platform:shared`
- `platform:shared` → may only depend on `platform:shared`
- Consequence: Node.js/NestJS code never leaks into web bundles; no accidental browser APIs in backend

**Backend onion (dependency → means "may depend on"):**

```
infrastructure → application → core → kernel/contracts/util
```

- `type:infrastructure` — transports (HTTP, messaging), ORM, external service clients; may depend on all layers
- `type:application` — use-cases, handlers, orchestration; may depend on core and below
- `type:core` — pure domain logic, entities, value objects; may depend on kernel and below
- `type:kernel` — stable domain abstractions; may depend only on util
- `type:contracts` — API schemas, shared enums; may depend only on util
- `type:util` — helpers, guards, formatters; may depend only on util (leaf layer)

**Frontend onion (dependency →):**

```
feature → ui/data/util
ui → ui/util
data → util/contracts
```

- `type:feature` — page/module components, feature orchestration; may depend on ui, data, util
- `type:ui` — presentational components, directives, pipes; may depend only on ui and util
- `type:data` — services, state management, API adapters; may depend on util and contracts
- `type:kernel` — runtime core (DI, lifecycle); may depend only on util
- `type:contracts` — shared DTOs, types; may depend only on util
- `type:util` — pipes, guards, formatters; may depend only on util (leaf layer)

### Import and usage bans

**In `type:core` and `type:application` (backend domain layers):**

- Ban external imports: `@nestjs/*`, `@angular/*`, `mongoose`, `mongodb`, `@typegoose/*`
- Rationale: framework code must stay in `type:infrastructure`; domain layers remain framework-agnostic
- Side effect: `@Injectable` decorator cannot be used in core/application — forces dependency injection into infrastructure layer

**In frontend-layer libs (`type:feature`, `type:ui`, `type:data`):**

- Ban direct access to `localStorage` and `window.localStorage`
- Rationale: auth tokens must use secure, in-memory token store (or sessionStorage with HTTPS-only), not persistent localStorage which is vulnerable to XSS
- Mechanism: `no-restricted-syntax` rule with AST selector matching `localStorage` member expressions, anchored on frontend-layer folder names (`feature`, `ui`, `data`)

### Enforcement

These rules are enforced by:

- **`@nx/enforce-module-boundaries`** — runs in `nx lint` target, flags dependency violations in CI via `pnpm nx affected -t lint`
- **`no-restricted-syntax`** — ESLint rule, same target
- Both execute automatically in GitHub Actions CI workflow (`pnpm nx affected -t lint,test,build`)

Violations fail the lint check and block merges until resolved.
