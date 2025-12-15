# Multi-stage optional, here single stage with Bun runtime for simplicity
FROM oven/bun:1.1 as base

WORKDIR /app

# Install deps first (better layer cache). Skip bun.lock parsing issues by only using package.json.
COPY package.json ./
RUN bun install --production

# Copy the rest of the source (includes SQLite schema/data if provided)
COPY . .

# Env/ports for Tencent Cloud config
ENV NODE_ENV=production \
    PORT=80 \
    MONITOR_PORT=13001 \
    MONITOR_HOST=0.0.0.0

EXPOSE 80 13001

# Run the Bun server (uses src/server.ts entry via package.json "start")
CMD ["bun", "start"]
