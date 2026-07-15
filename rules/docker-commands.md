# Docker Environment Commands

**All commands MUST run inside the Docker container.**

## ORM / Prisma

```bash
docker compose exec app npx prisma migrate dev --name create_posts_table
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
docker compose exec app npx prisma studio
docker compose exec app npx prisma migrate reset
```

## TypeORM (alternative)

```bash
docker compose exec app npx typeorm migration:generate src/migrations/CreatePostsTable
docker compose exec app npx typeorm migration:run
docker compose exec app npx typeorm migration:revert
```

## Code Quality

Use nx targets (see `rules/workflow.md` → Command Execution Policy). Run them locally — they do not need a Docker context:

```bash
nx lint api                        # ESLint via nx
nx lint api --fix                  # auto-fix
nx build api --skip-nx-cache       # type-check + build
nx run-many --target=lint          # lint all projects
```

Prettier is workspace-wide and has no nx target — run directly from the workspace root:

```bash
npx prettier --check .
npx prettier --write .
```

## Testing

Use nx targets locally (see `rules/workflow.md` → Command Execution Policy):

```bash
nx test api                         # vitest via nx
nx test api --skip-nx-cache         # bypass cache
nx run-many --target=test           # all projects
```

Stryker mutation testing has no nx plugin — run inside Docker:

```bash
docker compose exec app npx stryker run
```

## Build & Dev Server

```bash
nx build api                        # production build
nx serve api                        # dev server with watch
```

## Package Management

```bash
# ALWAYS use npm ci — never npm install
docker compose exec app npm ci
docker compose exec app npm ci --production
```

> **NEVER run commands outside Docker** — all dependencies exist only in the container. **NEVER put business logic in route handlers** — use UseCases/Services.

## Docker Compose Healthchecks

### Container healthchecks: `curl` not `wget` for IPv4/IPv6 compatibility

Alpine Linux containers default to IPv6-first DNS resolution. The BusyBox `wget --spider http://localhost:PORT/...` does NOT implement happy-eyeballs fallback — if the service binds to IPv4 only (`0.0.0.0:8080`), the probe gets connection-refused and the container stays unhealthy.

**Fix**: use `curl -sf` instead, which correctly handles IPv4/IPv6 fallback:

```yaml
# docker-compose.yml
services:
  web:
    image: nginx:1.27-alpine
    healthcheck:
      test: ['CMD', 'curl', '-sf', 'http://127.0.0.1:8080/health']
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

Both `curl` and `wget` ship by default in Alpine nginx/node images; `curl` is the safer choice.

### API healthcheck: must include global prefix and use Node.js HTTP

When `app.setGlobalPrefix('api')` is set in `main.ts`, the health endpoint is `/api/health`, not `/health`. A healthcheck hitting the wrong path causes the container to never reach `healthy` state.

Also, the `node:22-alpine` image does not include `wget` or `curl` by default. Use Node.js inline HTTP:

```yaml
services:
  api:
    image: node:22-alpine
    healthcheck:
      # Node.js HTTP client; full path with global prefix
      test: ['CMD', 'node', '-e', "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### GitHub Actions service-container health-cmd needs single-token quoting

GitHub Actions `services.<name>.options` is passed straight to `docker create`, which parses `--health-cmd` as taking exactly one token — the docker-compose array healthcheck form (`test: ['CMD', 'mongosh', '--eval', "..."]`) does not translate to this syntax. A multi-word health command must be wrapped as one single quoted string:

```yaml
options: --health-cmd "mongosh --eval \"db.adminCommand('ping')\""
```

An unquoted `--health-cmd mongosh --eval "db.adminCommand('ping')"` fails with `unknown flag: --eval` (exit 125) at container-creation time, before any CI step runs — a silent trap because the YAML itself has no lint error. Always dry-run the equivalent `docker create --health-cmd ... <image>` locally before trusting `services.*.options` health-cmd quoting in CI.

### Continuous healthcheck-cadence logs are not a bug

A container logging continuously with nothing else running is usually its own compose `healthcheck` pinging itself, not a crash-loop — match the log cadence against the healthcheck's `interval` before treating it as a bug. In this repo: `penny-mongo` emitted recurring ~10s bursts (`Connection accepted` → `Connection not authenticating` → `Connection ended`) matching its `healthcheck`'s `interval: 10s`; `"Connection not authenticating"` is informational since credential-less pings don't authenticate, not an auth failure.

## Dockerfile Production Image

### Nginx location block inheritance: `add_header` replacement, not merging

Nginx's `add_header` inheritance is replacement, not merging. Any `location` block with even one `add_header` directive silently discards **ALL** `add_header` directives from the parent `server {}` block.

Security headers set at the server level (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) are absent from every response served by location blocks that set cache headers. The only fix with standard nginx-alpine is to **repeat every security header inside each `location` block** that uses `add_header`:

```nginx
server {
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;

  location /api/ {
    add_header Cache-Control "public, max-age=3600" always;
    # Must repeat server-level headers here or they disappear:
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
  }
}
```

The `headers_more` module (`more_set_headers`) would allow true merging but requires a non-standard nginx build.

### pnpm production install: ignore lifecycle scripts and optional deps

When building a Docker image with multi-stage layers, the prod layer runs `pnpm install --prod --frozen-lockfile`. This fails because husky's `prepare` postinstall hook requires a `.git` directory (excluded by `.dockerignore`). Add flags to skip lifecycle scripts and optional deps:

```dockerfile
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --no-optional
```

Without these flags, the build step errors at "script not found: prepare" or similar lifecycle-hook failures.

### `tslib` runtime dependency for `importHelpers: true`

When `tsconfig.base.json` sets `importHelpers: true`, the compiled bundle emits `require('tslib')` calls at runtime. The multi-stage Dockerfile installs prod-only deps in the deps layer and copies those into the runtime image:

```dockerfile
FROM node:22-alpine AS deps
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine
COPY --from=deps /app/node_modules ./node_modules
```

Any package in `devDependencies` (including dev tooling and tslib if miscategorized) is absent. **Move `tslib` to `dependencies`**, NOT to the Dockerfile step. Never copy `node_modules` from the build stage — that drags in all dev tools and balloons the image.

## Nginx Configuration

### Sub-filter matching: Angular minifies empty attribute values

Angular's esbuild production bundler applies HTML5 boolean-attribute minification: `<meta name="csp-nonce" content="">` becomes `<meta name="csp-nonce" content>` in the dist output.

nginx `sub_filter` does byte-level matching — a pattern targeting `content=""` silently never fires. The CSP header carries a nonce but the meta tag stays empty, Angular bootstraps with a `null` nonce, and all component styles are blocked by CSP with no error.

**Fix**: match the minified form and restore the closing `>`:

```nginx
sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">';
```

Also note: `sub_filter` requires `gzip off` (or `gzip_static on` with pre-compressed files) in the same location block — dynamic gzip compresses the body before sub_filter can match, silently producing no substitution with no error.
