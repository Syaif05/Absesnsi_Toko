# Portable Node runtime; no database, credentials or photos are baked into this image.
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@12.14.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN node -e "require('sharp');require('@node-rs/argon2')"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]

# Separate short-lived admin image; never expose this as an HTTP service.
FROM postgres:17-bookworm AS ops
WORKDIR /app
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
COPY src/server ./src/server
COPY src/lib ./src/lib
COPY drizzle ./drizzle
RUN node --version && pg_dump --version
USER postgres
ENTRYPOINT ["node","--import","tsx"]
CMD ["scripts/release-check.mts"]
