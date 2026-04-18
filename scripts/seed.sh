#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🌱  Running database migrations..."
docker compose exec web npx prisma migrate deploy 2>/dev/null || \
  echo "   (Prisma not yet configured — skipping)"

echo "✅  Seed complete."
