# ===================================================
# SAFAR Backend Dockerfile - Production Multi-Stage
# ===================================================
FROM node:20-bullseye-slim AS base
WORKDIR /usr/src/app

# Install native dependencies required for build tools if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dependency stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-bullseye-slim AS production
WORKDIR /usr/src/app

# Create non-root user for security
RUN groupadd -r safar && useradd -r -g safar safar

COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY . .

# Ensure correct permissions
RUN mkdir -p logs && chown -R safar:safar /usr/src/app

USER safar

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "index.js"]
