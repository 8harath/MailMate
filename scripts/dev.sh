#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "⚠  No .env found — copying .env.example"
  cp .env.example .env
  echo "✏  Edit .env and fill in secrets, then re-run this script."
  exit 1
fi

echo "🐳  Starting MailMate stack..."
docker compose pull --quiet postgres redis caddy 2>/dev/null || true
docker compose up --build -d

echo "⏳  Waiting for services to be healthy..."
docker compose wait postgres redis 2>/dev/null || \
  docker compose ps

echo ""
echo "✅  MailMate is running at http://localhost"
echo "   Logs: docker compose logs -f"
echo "   Stop: docker compose down"
