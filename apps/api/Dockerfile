# Multi-stage Dockerfile for penny API (NestJS)
# Build context: repository root (needed for Nx monorepo builds)

# Stage 1: Install production dependencies only
FROM node:22-alpine AS deps

WORKDIR /build

# Copy pnpm configuration and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy Nx and workspace configuration
COPY nx.json ./

# Install corepack and enable pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Install production dependencies only (no dev deps)
# --no-optional and --ignore-scripts skip postinstall hooks that may not be available
RUN pnpm install --frozen-lockfile --prod --prefer-offline --no-optional --ignore-scripts

# Stage 2: Build the application
FROM node:22-alpine AS build

WORKDIR /build

# Copy pnpm configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY nx.json ./

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile --prefer-offline

# Copy all source code and configuration
COPY . .

# Build the API application
RUN NODE_ENV=production pnpm nx build api

# Stage 3: Runtime (production)
FROM node:22-alpine AS runtime

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Note: node:22-alpine already has a 'node' user, so no need to create it

# Copy production node_modules from deps stage
COPY --from=deps --chown=node:node /build/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=node:node /build/dist/apps/api ./

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run the application with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "main.js"]
