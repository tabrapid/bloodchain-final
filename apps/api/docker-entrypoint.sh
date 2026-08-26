#!/bin/sh
set -e

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

exec node dist/src/main.js
