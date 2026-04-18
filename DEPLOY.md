# Deployment Guide

## Option A — Docker Compose (self-host)

Runs the full stack on any Linux VPS, bare-metal server, or local machine.

### Requirements
- Docker Engine ≥ 24 + Compose v2
- 2 GB RAM minimum (4 GB recommended)
- Ports 80 and 443 open

### Steps

```bash
git clone <repo> && cd mailmate
cp .env.example .env

# Fill in required secrets:
#   GROQ_API_KEY, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET
#   POSTGRES_PASSWORD, AGENT_SERVICE_TOKEN, NEXTAUTH_URL (your domain)

docker compose up --build -d
docker compose exec web npx prisma migrate deploy
```

### Enabling HTTPS (production)

Edit `Caddyfile` to use your domain:
```
your.domain.com {
  reverse_proxy web:3000
}
```

Remove the `auto_https off` line. Caddy will obtain a Let's Encrypt certificate automatically.

Update `NEXTAUTH_URL=https://your.domain.com` in `.env`.

### Scaling

```bash
# Scale web and agent-service horizontally (sessions stored in Postgres)
docker compose up --scale web=3 --scale agent-service=2 -d
```

LangGraph checkpoints in Postgres mean any agent-service replica can resume an interrupted run.

### Updates

```bash
git pull
docker compose build
docker compose up -d
docker compose exec web npx prisma migrate deploy
```

---

## Option B — Kubernetes

Manifests in `k8s/` (coming in Phase 8):
- `web-deployment.yaml` — Next.js, HPA (min 2, max 10, 70% CPU)
- `agent-deployment.yaml` — agent-service, HPA (min 1, max 5)
- `worker-deployment.yaml` — BullMQ worker
- `postgres-statefulset.yaml` + PVC
- `redis-statefulset.yaml` + PVC
- `ingress.yaml` — nginx-ingress or Caddy ingress

```bash
kubectl apply -f k8s/
kubectl rollout status deployment/mailmate-web
```

---

## Option C — Vercel + Managed Services

Web tier only (agent-service runs separately or is disabled):

1. Deploy `submissions/61-Avalon` to Vercel.
2. Set env vars in Vercel dashboard (see `.env.example`).
3. Use Supabase for DB (set `NEXT_PUBLIC_SUPABASE_URL` etc., leave `DATABASE_URL` blank).
4. Use Upstash Redis for rate limiting (set `REDIS_URL`).
5. For agent-service: deploy to Railway / Render / Fly.io; set `AGENT_SERVICE_URL` + `AGENT_SERVICE_TOKEN`.

Without `AGENT_SERVICE_URL` set, the web app falls back to in-process Vercel AI SDK agents.

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Yes | Random 32-char secret |
| `NEXTAUTH_URL` | Yes | Public app URL |
| `POSTGRES_PASSWORD` | Yes | Postgres password |
| `POSTGRES_DB` | No | DB name (default: `mailmate`) |
| `POSTGRES_USER` | No | DB user (default: `mailmate`) |
| `DATABASE_URL` | Yes (Docker) | Full Postgres connection string |
| `REDIS_URL` | Yes (Docker) | Redis connection URL |
| `AGENT_SERVICE_TOKEN` | Yes | HMAC shared secret for inter-service auth |
| `AGENT_SERVICE_URL` | No | Agent service URL (default: `http://agent-service:8000`) |
| `LANGSMITH_API_KEY` | No | LangSmith tracing (optional) |
| `SENTRY_DSN` | No | Sentry error reporting (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Legacy Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Legacy Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Legacy Supabase service key |

---

## Health Check

```
GET /api/health
```

Returns per-service status. Useful for load balancers and uptime monitors.

```json
{
  "status": "ok",
  "services": {
    "groq": "ok",
    "database": "ok",
    "redis": "ok",
    "agent_service": "ok",
    "google_oauth": "ok"
  },
  "timestamp": "2026-04-17T...",
  "version": "0.1.0"
}
```
