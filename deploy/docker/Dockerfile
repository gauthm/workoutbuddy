# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && node --input-type=module -e "import Database from 'better-sqlite3'; const db=new Database(':memory:'); db.close()" \
    && npm cache clean --force
# .dockerignore is an allowlist; no database, local dependencies or credentials enter here.
COPY . .
RUN node scripts/download-vendors.js \
    && node scripts/download-exercise-images.js \
    && node scripts/download-exercise-images.js --check

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/workoutbuddy.db
WORKDIR /app
COPY --from=build /app/ ./
# A private checkout (umask 077) must still produce code readable by the runtime user.
RUN chmod -R a+rX /app \
    && mkdir -p /app/data && chown node:node /app/data && chmod 0700 /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "deploy/docker/healthcheck.mjs"]
CMD ["node", "server.js"]
