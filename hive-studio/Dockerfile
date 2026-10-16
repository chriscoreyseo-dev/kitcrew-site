# Hive Studio: one image for both deployments (D-055, D-059).
# STUDIO_MODE and every key are runtime env, set by the operator on the host
# (Coolify / any Docker host). Nothing secret is baked into the image.
#   docker build -t hive-studio .
#   docker compose -f docker-compose.dev3.yml up   (studio + MongoDB, local media)

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build with a clean environment. Hosts like Coolify pass every runtime
# variable as a build arg; none of them may reach `next build` (a malformed
# value breaks prerendering, and a secret could end up in the bundle). The
# deployment's mode and keys are read at runtime only.
RUN env -i PATH="$PATH" HOME=/root NEXT_TELEMETRY_DISABLED=1     COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    LOCAL_STORAGE_DIR=/data/media
RUN groupadd --system --gid 1001 studio \
 && useradd --system --uid 1001 --gid studio studio \
 && mkdir -p /data/media \
 && chown studio:studio /data/media
COPY --from=build --chown=studio:studio /app/.next/standalone ./
COPY --from=build --chown=studio:studio /app/.next/static ./.next/static
COPY --from=build --chown=studio:studio /app/public ./public
USER studio
EXPOSE 3000
VOLUME ["/data/media"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.service==='hive-studio'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
