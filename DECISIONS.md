# Penny — Architecture Decision Records

ADR-style records for load-bearing, hard-to-reverse choices. Each record documents the decision, the rationale, and the alternatives considered. Soft rules reference these records.

---

## ADR-001 — Authentication: Telegram Login Widget

**Status:** Accepted

**Decision:** Use the Telegram Login Widget for user authentication. No passwords, no email/password flow.

**Context:** The platform needs an auth mechanism that works for a small family group, avoids password storage, and is low-friction for the target users (who are already Telegram users).

**Rationale:**

- Zero password storage eliminates the most common credential leak vector.
- Telegram manages identity; Penny manages only the `telegramId` as the durable key.
- The HMAC-based payload verification is straightforward to implement and well-documented.
- Not a Mini App or bot deep-link — the Login Widget is the simplest integration point.

**Alternatives rejected:**

- Email/password: requires password hashing, reset flows, and exposes credentials at rest.
- OAuth (Google, GitHub): more moving parts; doesn't match the target user base.
- Passkeys: good long-term but more complex to implement and less familiar to target users.

**Consequences:**

- The backend must verify the Telegram HMAC on every login (see `rules/validation-authorization.md`).
- `auth_date` freshness check (reject > 24 h) is mandatory to prevent replay attacks.
- The Login Widget requires a real HTTPS domain for production; localhost has limitations.

---

## ADR-002 — Database: MongoDB + Mongoose/Typegoose

**Status:** Accepted

**Decision:** Use MongoDB as the primary database, accessed via Mongoose with Typegoose decorators, confined entirely to the `type:infrastructure` layer behind repository interfaces.

**Context:** The platform will grow to cover heterogeneous verticals (budget, car, family services) with different data shapes.

**Rationale:**

- Schema flexibility across dissimilar verticals without upfront migrations for every shape change.
- MongoDB aggregation pipeline for analytics-style queries (budget history, charts).
- The onion architecture isolates the DB choice behind repository interfaces, making it low-regret.

**Alternatives rejected:**

- Prisma + PostgreSQL: Prisma's Mongo driver lacks the aggregation pipeline support and has no native migration system for Mongo — removes the main benefit of choosing Mongo.
- MikroORM: managed entities conflict with the framework-free `type:core` requirement (entities must remain plain TypeScript classes).
- TypeORM: mature but mixing ORM concerns into domain entities violates the clean architecture goal.

**Consequences:**

- Money values must be stored as integer minor units or `Decimal128` — never IEEE 754 float.
- Cross-collection invariants require multi-document transactions.
- Typegoose schema + mapper functions are strictly in `type:infrastructure`; domain entities in `type:core` are plain TypeScript classes with no ORM decorators.

---

## ADR-003 — Architecture: Onion / Clean Architecture + Vertical Slices

**Status:** Accepted

**Decision:** Organize the codebase as domain-first vertical slices (`libs/<domain>/`) each containing the full onion stack (core → application → infrastructure → transport), with `libs/shared/` for cross-cutting code.

**Context:** The platform will be AI-orchestrated, with multiple agents generating code in parallel. Architectural boundaries must be machine-enforceable, not just documented.

**Rationale:**

- Framework-agnostic core and application layers are independently testable without starting NestJS.
- Vertical slices prevent domain concepts leaking across bounded contexts.
- Nx tag boundaries (`scope:` × `type:` × `platform:`) are machine-enforced by ESLint — an "architecture as an executable contract" that survives AI-generated code at scale.
- The transport-agnostic service pattern means the same application service runs in the HTTP API and the CLI without modification.

**Alternatives rejected:**

- Feature-folder (everything for a feature in one place, mixed layers): easier to start but collapses layer boundaries over time; harder to enforce with tools.
- Microservices: no operational-maturity pressure, no team; distribute only if forced later.

**Consequences:**

- Application services (`type:application`) must never contain `@Injectable()` or any framework import.
- NestJS DI wiring lives only in `apps/api` / `apps/cli` (the transport layer).
- Every new vertical copies the `libs/identity/` shape: `{core,application,infrastructure,feature-*,data-access}`.

---

## ADR-004 — Dependency Management: Exact Pins, No Ranges

**Status:** Accepted

**Decision:** All `package.json` dependencies (direct, dev, peer) are pinned to exact versions — no `^` or `~` ranges. Renovate handles upgrades via grouped PRs with CI gate and manual review.

**Context:** Supply-chain attacks via npm dependency confusion and malicious version bumps are a real and growing risk.

**Rationale:**

- Exact pins + committed `pnpm-lock.yaml` + `pnpm install --frozen-lockfile` in CI mean every transitive dependency is content-hashed and auditable.
- Renovate `minimumReleaseAge` (≥ 7 d) adds a cooldown before picking up new releases, avoiding zero-day-poisoned packages.
- `pnpm` default-denies install scripts (the dominant supply-chain vector); explicit allowlist required.

**Alternatives rejected:**

- Semver ranges: convenient but mean "whatever was on npm when I installed" — not reproducible.
- Dependabot: no `rangeStrategy: pin` equivalent; generates noisier PRs with less grouping control.

**Consequences:**

- `npm ci` / `pnpm install` always produce the exact lockfile-pinned tree.
- CI script greps `package.json` for `^` / `~` and fails the build if found.
- After every `pnpm add` or generator run, run `pnpm dedupe` and audit the lockfile diff.

---

## ADR-005 — Module Resolution: `bundler` + `.js` Backend Extensions

**Status:** Accepted

**Decision:** Use `moduleResolution: "bundler"` uniformly across the monorepo. Enforce `.js` extensions on relative imports in backend code only (via ESLint), leaving Angular imports extension-free.

**Context:** The monorepo targets two different bundlers: webpack (NestJS API/CLI) and esbuild (Angular). TypeScript's `nodenext` resolution requires `.js` extensions everywhere but conflicts with NestJS-ESM and Angular's bundler resolver.

**Rationale:**

- `bundler` resolver avoids the NestJS-ESM/SWC TS1479 conflict.
- `.js` extension enforcement on backend code (`apps/api/**`, `apps/cli/**`, `libs/**/core/**`, etc.) means a later switch to `nodenext` for standalone lib publishing is low-friction.
- Angular's module resolution is handled by the Angular compiler and esbuild — no extensions needed.

**Enforcement:**

- ESLint `no-restricted-syntax` rule in `eslint.config.mjs` applies the `.js` extension check only to backend file globs (`apps/api/**`, `apps/cli/**`, backend `libs/**`). This is a **hard fuse**.

**Alternatives rejected:**

- `nodenext` everywhere: reopens TS1479 (NestJS-ESM/SWC conflict).
- `node16`: deprecated alias for `nodenext`; same conflict.
- ESM + SWC end-to-end: no actual runtime conflict (apps are webpack-bundled), but adds config complexity with no benefit at the current scale.

---

## ADR-006 — CSP Nonce Delivery

**Status:** Accepted and implemented.

**Context:** Angular's runtime `<style>` injection requires either `style-src 'unsafe-inline'` or a per-request CSP nonce embedded in `index.html`. Nonce delivery requires the process that serves `index.html` to generate and inject the nonce value on every request — which process does that depends on the serving topology.

The serving topology settled on **nginx serves `index.html`** (`apps/web` container), not NestJS. The API container has no host port and never touches the HTML.

**Decision — Option B (nginx serves HTML):** Per-request nonce injection is implemented at the nginx layer (`apps/web/nginx.conf`):

- nginx generates a per-request nonce from its built-in `$request_id` variable (a 128-bit CSPRNG value, rendered as 32 hex characters) — no custom nonce-generation module needed.
- The Angular build embeds a placeholder (`<meta name="csp-nonce" content="">` in `index.html`, wired to Angular's `CSP_NONCE` DI token in `apps/web/src/app/app.config.ts`) that `sub_filter` replaces with the live nonce value at request time.
- nginx sets the `Content-Security-Policy` response header with `style-src 'self' 'nonce-$request_id'` (plus a `sha256-` hash for Angular's own emulated-encapsulation style block).
- `gzip off` is set on the same location block, since a compressed response would otherwise bypass `sub_filter` silently.
- `apps/api/src/middleware/csp-policy.ts` (NestJS Helmet CSP for JSON API responses) emits `style-src 'self'` with no `'unsafe-inline'` — the API never serves HTML, so it needs no nonce.

**Alternatives rejected:**

- Option A (NestJS serves HTML via `ServeStaticModule`): would place static-file serving and HMAC auth logic in the same process, complicating health checks and adding latency for all static asset requests. Rejected once the nginx serving topology was chosen.
- `'unsafe-inline'` permanently: permits injected stylesheets from XSS — rejected as a permanent posture; only used as a time-bounded interim tradeoff before the nonce pipeline shipped.

**Consequences:**

- Any new Angular build must keep emitting the `csp-nonce` meta placeholder in `index.html`, or `sub_filter` has nothing to replace and the nonce falls back to the un-replaced placeholder value.
- The nginx container image must have `ngx_http_sub_module` compiled in (present in the official `nginx:*-alpine` images).
- The hardcoded `sha256-...` hash in `apps/web/nginx.conf` for Angular's own style block must be regenerated (from the browser's CSP violation console, or by extracting the built stylesheet) whenever `nx build web`'s output for that block changes.
