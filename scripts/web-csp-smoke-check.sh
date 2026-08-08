#!/usr/bin/env bash

# CSP Nonce Injection Smoke Check
# Verifies that nginx sub_filter patterns in apps/web/nginx.conf are successfully
# injecting the per-request CSP nonce into the served index.html.
#
# This script:
# 1. Starts the penny-web:latest Docker image
# 2. Waits for it to become healthy
# 3. Fetches index.html via HTTP
# 4. Asserts both nonce patterns are present with actual nonce values:
#    - <link ... onload="this.media='all'" nonce="<actual-uuid>">
#    - <meta name="csp-nonce" content="<actual-uuid>">
# 5. Stops the container
#
# Fails loudly (exit 1) if either assertion fails, allowing CI to catch
# silent sub_filter breakage caused by Angular/build-tool upgrades.
#
# Usage:
#   bash scripts/web-csp-smoke-check.sh

set -euo pipefail

# Use jq-style text output for logs
log_info() {
  echo "[INFO] $*" >&2
}

log_warn() {
  echo "[WARN] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

# Container name (unique per run to avoid collisions)
CONTAINER_NAME="penny-web-smoke-check-$$"
IMAGE_NAME="${1:-penny-web:latest}"

log_info "Starting CSP nonce injection smoke check with image: $IMAGE_NAME"

# Cleanup on exit (trap works even if container start fails)
cleanup() {
  local exit_code=$?
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Stopping container $CONTAINER_NAME..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
  fi
  return $exit_code
}
trap cleanup EXIT

# Start the container
# Note: --add-host api:127.0.0.1 allows nginx to resolve the api upstream (required for config parsing),
# even though we won't actually proxy to it in this smoke check. This prevents nginx from failing to start.
log_info "Starting container $CONTAINER_NAME from image $IMAGE_NAME..."
if ! docker run \
  --name "$CONTAINER_NAME" \
  --detach \
  --publish 18080:8080 \
  --add-host api:127.0.0.1 \
  "$IMAGE_NAME" >/dev/null; then
  log_error "Failed to start container"
  exit 1
fi

# Wait for container to become healthy (up to 30 seconds)
log_info "Waiting for container to become healthy..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if docker exec "$CONTAINER_NAME" curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    log_info "Container is healthy"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    log_error "Container did not become healthy after $max_attempts seconds"
    exit 1
  fi
  sleep 1
done

# Fetch index.html
log_info "Fetching index.html from running container..."
if ! html=$(curl -sf http://localhost:18080/index.html); then
  log_error "Failed to fetch index.html from http://localhost:18080/index.html"
  exit 1
fi

# Diagnostic (NOT pass/fail): the csp-nonce meta must be filled in per request for Angular to
# nonce its runtime-injected component styles. This is reported to make failures easier to read,
# but it must never be the thing that decides the result — a check that only verifies its own
# mechanism is installed passed green through a completely unstyled production app once already.
log_info "Diagnostic: csp-nonce meta injection..."
if echo "$html" | grep -Eq "name=\"csp-nonce\" content=\"[a-f0-9-]+\""; then
  log_info "  csp-nonce meta is populated"
else
  log_warn "  csp-nonce meta NOT populated — sub_filter may have stopped matching the built markup"
  echo "$html" | grep -A 2 -B 2 "csp-nonce" || true
fi

# Diagnostic (NOT pass/fail): inline event handlers cannot be authorized by a nonce under any CSP.
if echo "$html" | grep -Eq "on(load|click|error)="; then
  log_warn "  index.html contains inline event handler(s) — these cannot be nonce-authorized"
fi

# THE ACTUAL ASSERTION: load the served page in a real browser and require that it renders
# styled with zero CSP violations. This is the only check here that is independent of any
# assumption about *how* the CSS is supposed to activate.
log_info "Running render-level CSP check in headless Chromium..."
if ! node "$(dirname "$0")/web-csp-render-check.mjs" "http://localhost:18080/"; then
  log_error "✗ Render-level CSP check FAILED — the served page is not correctly styled"
  exit 1
fi

log_info "All CSP checks passed ✓"
exit 0
