# Build context: catbuddy/ (monorepo root)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json .npmrc ./
COPY packages/shared ./packages/shared
COPY gateway ./gateway

RUN pnpm install --frozen-lockfile
RUN pnpm gateway:build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable pnpm

ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared ./packages/shared
COPY gateway ./gateway
COPY --from=build /app/gateway/packages/gateway/dist ./gateway/packages/gateway/dist

RUN pnpm install --frozen-lockfile --prod --filter @catbuddy/gateway...

EXPOSE 18765

WORKDIR /app/gateway/packages/gateway
CMD ["node", "dist/index.js"]
