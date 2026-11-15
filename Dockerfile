# One image per release, for every Brand. Nothing Brand-specific is read at build time:
# BRAND_ID, the Shop API URL and the Channel token are supplied when the container starts.
FROM node:22.16-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/storefront/package.json apps/storefront/
COPY packages/core/package.json packages/core/
COPY packages/design/package.json packages/design/
COPY packages/testing/package.json packages/testing/
COPY brands/package.json brands/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22.16-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S storefront && adduser -S storefront -G storefront
COPY --from=build --chown=storefront:storefront /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=storefront:storefront /repo/apps/storefront/.next/static ./apps/storefront/.next/static
USER storefront
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/storefront/server.js"]
