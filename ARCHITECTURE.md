# Penny Architecture

## Overview

Penny is an Nx monorepo containing an Angular 17+ frontend (`apps/web`), a NestJS API (`apps/api`),
and a NestJS CLI (`apps/cli`), all sharing a framework-agnostic domain core through `libs/`.

The architecture follows the **onion (Clean Architecture)** pattern: dependencies always point
inward — infrastructure depends on application, application depends on domain core, core depends
on nothing but shared kernel utilities. This keeps business logic framework-free and independently testable.

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

  rules/          Agent-readable governance docs
  .claude/        AI agent configuration (claude-ts)
```

Each future vertical (`budget`, `car`, …) replicates the `identity/` shape:
`libs/<domain>/{core,application,infrastructure,feature-*,data-access}`.

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

## Nx Tag Contract

Every lib carries exactly one tag per dimension in its `project.json`:

| Dimension   | Values                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope:`    | `shared` (cross-domain), `identity` (extensible: `budget`, `car`, …)                                                                                |
| `type:`     | Backend: `core`, `application`, `infrastructure`, `kernel`, `contracts`, `errors`, `util`, `validation` / Frontend: `feature`, `ui`, `data`, `util` |
| `platform:` | `server`, `web`, `shared`                                                                                                                           |

Boundary rules are enforced by `@nx/enforce-module-boundaries` in `eslint.config.mjs` — violations
fail CI and local lint.

---

## Validation

All external input is validated with **LIVR** (`js-validator-livr`) at the application-layer service
boundary, before any business logic runs. Shared LIVR schemas live in `libs/shared/validation/`.

See `rules/validation-authorization.md` for the full bootstrap requirement and Telegram HMAC flow.

---

## Serving Topology

<!-- Serving topology: to be documented once the Docker compose production setup is finalised -->
