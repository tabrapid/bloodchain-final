#!/bin/sh
set -e

# Refuse an invalid production configuration before touching its database.
node -e "require('./dist/src/config/production-config').assertProductionConfig(process.env)"

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

echo "Applying idempotent production reference data..."
node dist/prisma/seed-reference.js

exec node dist/src/main.js
