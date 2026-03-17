# Blobverse Game Server — Production Dockerfile
# Multi-stage build for Node.js monorepo

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# Build shared library first, then server
RUN pnpm --filter @blobverse/shared build
RUN pnpm --filter @blobverse/server build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:22-alpine AS runner

# Install pnpm for workspace resolution
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 blobverse
USER blobverse

# Copy built artifacts
COPY --from=builder --chown=blobverse:nodejs /app/package.json ./
COPY --from=builder --chown=blobverse:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=blobverse:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=blobverse:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=blobverse:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=blobverse:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=blobverse:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=builder --chown=blobverse:nodejs /app/packages/server/package.json ./packages/server/

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
WORKDIR /app/packages/server
CMD ["node", "dist/main.js"]
