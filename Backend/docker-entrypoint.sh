#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding robot and admin..."
node scripts/seed.js

exec node src/index.js
