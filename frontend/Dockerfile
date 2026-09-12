# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.19.0

FROM node:${NODE_VERSION}-slim AS dependencies

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund


FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /workspace/frontend

COPY --from=dependencies /workspace/frontend/node_modules ./node_modules
COPY frontend/ ./
COPY backend/schema.yaml /workspace/backend/schema.yaml

RUN mkdir -p public
RUN npm run api:generate
RUN --mount=type=cache,target=/workspace/frontend/.next/cache \
    npm run build


FROM node:${NODE_VERSION}-slim AS runtime

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
