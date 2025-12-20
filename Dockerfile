# Multi-stage build for smaller runtime image and better cache reuse
FROM oven/bun:1.1 AS deps

WORKDIR /app

# Install production dependencies (use lockfile when available)
COPY package.json bun.lock ./
RUN bun install --production

FROM oven/bun:1.1 AS runner

WORKDIR /app

# Runtime defaults (override via docker run -e)
ENV NODE_ENV=production \
    PORT=3000 \
    MONITOR_PORT=13001 \
    MONITOR_HOST=0.0.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY monitor ./monitor
COPY index.html ./

EXPOSE 3000 13001

# Run the Bun server (uses src/server.ts entry via package.json "start")
CMD ["bun", "start"]
