# syntax=docker/dockerfile:1
#
# Multi-stage production build for @bloodchain/api.
#
# Build context is the repo root (this is a pnpm workspace monorepo), e.g.:
#   docker build -f apps/api/Dockerfile -t bloodchain-api .
# docker-compose.yml at the repo root is set up to do this automatically.

FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- deps: install only what @bloodchain/api needs (itself + its workspace deps) ----
FROM base AS deps
# .npmrc pins auto-install-peers/strict-peer-dependencies to the values
# pnpm-lock.yaml was generated with. Without it pnpm falls back to its own
# defaults here, which disagree with the lockfile's recorded settings and
# --frozen-lockfile refuses to proceed (ERR_PNPM_LOCKFILE_CONFIG_MISMATCH).
COPY .npmrc .npmrc
# apps/api/tsconfig.json and every packages/*/tsconfig.json extend this file
# for target/lib/esModuleInterop/etc. Without it present at the same relative
# path, tsc silently falls back to its own defaults (ES5/no esModuleInterop/no
# downlevelIteration) instead of failing loudly, which breaks the build on
# ordinary ES2022 syntax already used throughout the codebase.
COPY tsconfig.json tsconfig.json
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile --filter=@bloodchain/api...

# ---- build: generate the Prisma client and compile Nest ----
FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY packages/validation packages/validation
COPY apps/api apps/api
RUN pnpm --filter @bloodchain/api prisma:generate
RUN pnpm --filter @bloodchain/api build

# ---- runtime: the actual production image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/prisma /repo/apps/api/prisma
COPY --from=build /repo/apps/api/package.json /repo/apps/api/package.json
COPY apps/api/docker-entrypoint.sh /repo/apps/api/docker-entrypoint.sh
RUN chmod +x /repo/apps/api/docker-entrypoint.sh \
  && addgroup --system --gid 1001 nestjs \
  && adduser --system --uid 1001 --gid 1001 nestjs \
  && chown -R nestjs:nestjs /repo/apps/api

WORKDIR /repo/apps/api
USER nestjs
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
