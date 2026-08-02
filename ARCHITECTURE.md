# Penny Architecture

## Overview

Penny is an Nx monorepo containing an Angular 17+ frontend (`apps/web`), a NestJS API (`apps/api`), and a NestJS CLI (`apps/cli`), all sharing a framework-agnostic domain core through `libs/`.

The architecture follows the **onion (Clean Architecture)** pattern: dependencies always point inward — infrastructure depends on application, application depends on domain core, core depends on nothing but shared kernel utilities. This keeps business logic framework-free and independently testable.

---

## Monorepo Layout

```
penny/
  apps/
    web/          Angular shell — composes feature libs; no business logic
    api/          NestJS HTTP — controllers, guards, exception filters, DI wiring
    cli/          NestJS (nest-commander) — same DI container & services as api
    web-e2e/      Playwright e2e for apps/web
    api-e2e/      API-level contract tests
    smoke-e2e/    Smoke tests

  libs/
    shared/       scope:shared · platform:shared — isomorphic & cross-cutting code
      contracts/  DTOs, request/response types (shared by web + api)
      validation/ LIVR schemas — backend (application-layer) only
      errors/     BaseError hierarchy
      util/       Pure helpers, Money value object
      kernel/     Base onion abstractions: BaseService, base repo interfaces, ServiceContext
      infrastructure/  MongoDB connection factory (platform:server)

    identity/     scope:identity — first vertical slice (auth & users), full stack
      core/             User entity, IUserRepository interface, UserStatus (platform:server)
      application/      Use-case services: LoginWithTelegram, ApproveUser, RejectUser (platform:server)
      infrastructure/   Mongoose schema, mapper, Typegoose repo impl, Telegram client, JWT (platform:server)
      feature-login/    Angular login page with Telegram Widget (platform:web)
      feature-access-status/  Angular access-status page (pending/rejected) (platform:web)
      feature-greeting/ Angular authed greeting page (platform:web)
      data-access/      Angular API client services (platform:web)

    budget/       scope:budget — second vertical slice (income, expenses, balance, monthly budgets), full stack
      core/             Account, Category, Transaction, MonthlyBudget entities; repository interfaces (platform:server)
      application/      Use-case services: RecordTransaction, CreateCategory, ArchiveCategory, GetBalance, GetHistorySummary, GetPlannerSummary, GetExchangeRates (platform:server)
      infrastructure/   Mongoose schemas, mappers, repo implementations; Monobank FX client (platform:server)
      contracts/        Budget DTOs, TransactionType enum (platform:shared)
      validation/       Budget-scoped LIVR schemas (platform:shared)
      feature-account/  Angular account summary screen (platform:web)
      feature-records/  Angular transaction-recording screen (platform:web)
      feature-history/  Angular transaction-history screen with charts (platform:web)
      feature-planner/  Angular monthly-budgets screen (platform:web)
      data-access/      Angular API client services, state stores (platform:web)
      ui/               Dumb presentational components: BalanceCard, RatesCard, CategoryTile, ProgressBar (platform:web)

  rules/          Agent-readable governance docs
  .claude/        AI agent configuration (claude-ts)
```

Each vertical slice replicates this shape: `libs/<domain>/{core,application,infrastructure,feature-*,data-access,ui}` (frontend-bearing domains add `feature-*` and `ui`; backend/shared layers align per ADR-003).

**Import alias:** `libs/shared/contracts` is imported as the bare `shared-contracts` — not `@penny/shared-contracts`. The `@penny/` prefix is not a real tsconfig path alias and will fail at build time with a module-not-found error.

---

## Onion Architecture (Backend)

```
┌─────────────────────────────────────────┐
│  apps/api · apps/cli  (Transport layer) │  NestJS: controllers, guards, DI wiring
│                                         │  May import anything
├─────────────────────────────────────────┤
│  type:infrastructure                    │  Mongoose/Typegoose repos, mappers,
│                                         │  external clients (Telegram), JWT
├─────────────────────────────────────────┤
│  type:application                       │  Use-case services; plain TypeScript;
│                                         │  NO @Injectable(); validate → authorize → execute
├─────────────────────────────────────────┤
│  type:core                              │  Entities, value objects, IRepository interfaces;
│                                         │  zero framework / ORM imports
├─────────────────────────────────────────┤
│  type:kernel · type:contracts           │  Base abstractions, DTOs, error hierarchy, utils
│  type:errors  · type:util               │  (framework-free, importable by all layers)
└─────────────────────────────────────────┘
```

Dependency direction: inward only. No layer may import from a layer above it.

**Key invariants (hard fuses — enforced by ESLint + Nx boundaries):**

- `type:core` and `type:application` ban `@nestjs/*`, `@angular/*`, `mongoose`, `mongodb`, `@typegoose/*`.
- `type:application` never contains `@Injectable()`.
- `type:infrastructure` maps to `type:core` entities via explicit mapper functions; Mongoose types never leak upward.
- Frontend (`platform:web`) and backend (`platform:server`) cannot import each other's libs.

---

## Frontend Architecture (Angular)

See also: `docs/guides/frontend-feature.md` for the step-by-step pattern of building a feature (contract → data layer → UI → feature page → route), with worked examples from the four shipped budget screens and executable-contract validation.

```
apps/web
  └─ routes → feature libs (identity/feature-login, identity/feature-greeting, …)
                └─ ui libs (presentational, dumb components)
                └─ data-access libs (API client services, state)
                └─ shared/contracts (DTOs)
```

Angular layers follow the same Nx tag contract:

```
type:feature → type:ui / type:data / type:util
type:ui      → type:ui / type:util
type:data    → type:util / type:contracts
```

**Key invariants:**

- No `localStorage` for tokens anywhere in `platform:web` libs (ESLint rule enforced).
- Session managed exclusively via `httpOnly` cookie set by `apps/api`.

---

## Budget Domain

The `scope:budget` vertical implements the core Penny domain: income/expense tracking, monthly budgets, balance derivation, and foreign currency conversion.

### Derived-Balance Read Model

**Balance is never stored; it is computed from transactions.** The balance for an account is always `Σ(income) − Σ(expense)` across all workspace transactions. This design eliminates lost-update races, compare-and-swap complexity, and multi-document transaction requirements.

- `ITransactionRepository.sumAmountsByType(workspaceId, filters)` returns `{ income: bigint, expense: bigint }` aggregated from the authoritative transaction ledger.
- Application layer constructs `Money(currency)` from the `bigint` minor units returned.
- For high-transaction-volume accounts, a materialized `AccountBalanceSnapshot` collection can be added later as a read-model optimization behind the same repository interface — no caller changes needed.
- Three compound indexes ensure efficient aggregations and queries: `{workspaceId:1, date:-1}` (unscoped period queries), `{workspaceId:1, categoryId:1, date:-1}` (category-narrowed listing and expense rollups), and `{workspaceId:1, accountId:1, date:-1}` (derived-balance aggregation and account-narrowed queries).

### Foreign Exchange Integration Topology

Foreign exchange rates are fetched server-side only. The browser never makes direct calls to external APIs.

```
Browser ─→ apps/web (nginx) ─→ apps/api (NestJS)
                                    │
                                    └─→ Monobank /bank/currency
```

- **Client call:** Angular requests `GET /api/rates` (internal API).
- **Server-side client:** `libs/budget/infrastructure` contains `MonobankCurrencyClient`, a typed HTTP wrapper for `GET https://api.monobank.ua/bank/currency`.
- **Caching:** In-memory TTL cache (≥ 5 min) respects Monobank's public rate limit (~1 req/5 min). Cache misses hit the upstream; cache hits or failures serve stale rates with a `fetchedAt` staleness indicator.
- **Payload validation:** Upstream response is validated for shape and positivity (`rateBuy`, `rateSell`, `rateCross` strictly > 0) before mapping to the contract DTO.
- **CSP:** `connect-src` policy remains tight — no browser-direct Monobank calls allowed.

The upstream URL is a fixed constant in the codebase (not configurable per-request), closing the SSRF surface.

---

## Nx Tag Contract

Every lib carries exactly one tag per dimension in its `project.json`:

| Dimension   | Values                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope:`    | `shared` (cross-domain), `identity`, `budget`, (future: `car`, …); also `web` for app composition roots                                             |
| `type:`     | Backend: `core`, `application`, `infrastructure`, `kernel`, `contracts`, `errors`, `util`, `validation` / Frontend: `feature`, `ui`, `data`, `util` |
| `platform:` | `server`, `web`, `shared`                                                                                                                           |

Boundary rules are enforced by `@nx/enforce-module-boundaries` in `eslint.config.mjs` — violations fail CI and local lint.

---

## Validation

All external input is validated with **LIVR** (`js-validator-livr`) at the application-layer service boundary, before any business logic runs. Shared LIVR schemas live in `libs/shared/validation/`.

See `rules/validation-authorization.md` for the full bootstrap requirement and Telegram HMAC flow.

---

## Serving Topology

Production requests flow through two containers exposed on the Docker bridge network (`penny_net`). Only the `web` container has a host port binding; `api` is internal.

```
Browser
  │
  │ :80
  ▼
┌─────────────────────────────────────────────────────┐
│  web (nginx:1.27-alpine)  ·  penny-web              │
│  Listens :8080 → mapped to host :80                 │
│                                                     │
│  location /          → serve /usr/share/nginx/html  │  index.html + hashed JS/CSS bundles
│                         try_files → /index.html     │  (Angular SPA, client-side routing)
│                                                     │
│  location /api/      → proxy_pass http://api        │  reverse-proxied; no host exposure
│                         (upstream api { api:3000 }) │
└─────────────────────────────────────────────────────┘
               │ upstream api → api:3000
               ▼
┌─────────────────────────────────────────────────────┐
│  api (NestJS)  ·  penny-api                         │
│  Listens :3000 (internal only — no host port)       │
│  Connects to mongo:27017 on penny_net               │
└─────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  mongo (mongo:7)  ·  penny-mongo                    │
│  Listens :27017 (internal only)                     │
└─────────────────────────────────────────────────────┘
```

**Key facts:**

- `index.html` is served by **nginx**, not NestJS. NestJS never touches the HTML file.
- `/api/` requests are proxied by nginx; the API container is not reachable from the host directly.
- CSP nonce injection (when implemented) must happen at the nginx layer via `sub_filter` — see ADR-006 in `DECISIONS.md`.
- Static JS/CSS bundles use content-hashed filenames and are cached for 1 year (`immutable`). `index.html` itself is served with `no-cache` so the latest bundle references are always fetched.
- The `web` container health check hits nginx's `/health` stub location; the `api` container health check hits `/api/health` via `wget`.
