FROM node:20-slim

WORKDIR /app

# Build tools for bcrypt's native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install production dependencies from the lockfile (reproducible builds).
# .dockerignore keeps the host's node_modules out, so bcrypt is always
# compiled for Linux even when the image is built on Windows/macOS.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

# Apply the (idempotent) schema, then start the API. If the migration
# fails, the container stops instead of serving a broken database.
CMD ["sh", "-c", "node scripts/migrate.js && node src/server.js"]
