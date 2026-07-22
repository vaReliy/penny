# Multi-stage Dockerfile for penny web (Angular 21 SPA)
# Build context: repository root (needed for Nx monorepo builds)

# Stage 1: Build the Angular application
FROM node:22-alpine AS build

WORKDIR /build

# Copy pnpm configuration and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy Nx and workspace configuration
COPY nx.json ./

# Install corepack and enable pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile --prefer-offline --ignore-scripts

# Copy all source code and configuration
COPY . .

# Build the Angular application in production mode
RUN NODE_ENV=production pnpm nx build web

# Stage 2: Runtime (production - serve static files with Nginx)
FROM nginx:1.27-alpine

# Configure nginx to run as non-root user
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Copy custom nginx configuration for SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from build stage
# Angular 21 build output location: dist/apps/web/browser
COPY --from=build /build/dist/apps/web/browser /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html

# Switch to non-root user
USER nginx

# Expose non-root port (8080 instead of 80)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:8080/health || exit 1

# Default command (nginx runs in foreground)
CMD ["nginx", "-g", "daemon off;"]
