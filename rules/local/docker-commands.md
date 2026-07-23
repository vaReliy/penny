## Extends rules/cts/docker-commands.md § API healthcheck

Concrete instantiation in this repo: `main.ts` sets `app.setGlobalPrefix('api')`, so the health endpoint is `/api/health`, not `/health`:

```yaml
healthcheck:
  # Node.js HTTP client; full path with global prefix
  test: ['CMD', 'node', '-e', "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
```

## Extends rules/cts/docker-commands.md § crash-loop vs healthcheck-noise

Concrete instantiation in this repo: `penny-mongo` emits recurring ~10s bursts (`Connection accepted` → `Connection not authenticating` → `Connection ended`) matching its `healthcheck`'s `interval: 10s`; `"Connection not authenticating"` is informational since credential-less pings don't authenticate, not an auth failure.

## New section: Dockerfile Production Image

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

## New section: Nginx Configuration

### Sub-filter matching: Angular minifies empty attribute values

Angular's esbuild production bundler applies HTML5 boolean-attribute minification: `<meta name="csp-nonce" content="">` becomes `<meta name="csp-nonce" content>` in the dist output.

nginx `sub_filter` does byte-level matching — a pattern targeting `content=""` silently never fires. The CSP header carries a nonce but the meta tag stays empty, Angular bootstraps with a `null` nonce, and all component styles are blocked by CSP with no error.

**Fix**: match the minified form and restore the closing `>`:

```nginx
sub_filter 'name="csp-nonce" content>' 'name="csp-nonce" content="$request_id">';
```

Also note: `sub_filter` requires `gzip off` (or `gzip_static on` with pre-compressed files) in the same location block — dynamic gzip compresses the body before sub_filter can match, silently producing no substitution with no error.
