# MailMate — Enterprise Edition

MailMate is an enterprise-grade, AI-powered email workspace.  
One command launches the full stack: Gmail integration, multi-agent AI (LangGraph + Groq), automation with human-in-the-loop approval, Postgres, Redis, and a Caddy reverse proxy — all in Docker.

```
git clone <repo>
cp .env.example .env   # fill in secrets
bash scripts/dev.sh    # docker compose up --build
# → http://localhost
```

---

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  Caddy (80)  │──▶ │  Next.js (web)   │──▶ │ agent-service (py) │
│  reverse px  │    │  App Router BFF  │    │ FastAPI + LangGraph│
└──────────────┘    └──────┬───────────┘    └─────────┬──────────┘
                           │                          │
                  ┌────────▼──────┐           ┌───────▼────────┐
                  │   Postgres    │◀──────────│    Redis       │
                  │ (app tables + │           │ rate-limit +   │
                  │  LG checkpts) │           │ BullMQ queue)  │
                  └───────────────┘           └────────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| Caddy | 80 / 443 | Reverse proxy, TLS termination |
| web | 3000 (internal) | Next.js 15 App Router |
| agent-service | 8000 (internal) | Python FastAPI + LangGraph graphs |
| postgres | 5432 (internal) | Prisma schema + LangGraph checkpoints |
| redis | 6379 (internal) | Rate limiting + BullMQ automation queue |
| worker | — | BullMQ automation job consumer |

---

## Tech Stack

| Area | Stack |
|------|-------|
| Web framework | Next.js 15 App Router, TypeScript, React 19 |
| Styling | Tailwind CSS 4, Radix UI / shadcn |
| AI agents | LangGraph (Python), langchain-groq, Groq `llama-3.3-70b-versatile` |
| Web AI SDK | Vercel AI SDK v6 + @ai-sdk/groq |
| Auth | NextAuth.js v4 (Google OAuth) |
| Database | Postgres 16 via Prisma 5 |
| Cache / Queue | Redis 7, BullMQ, ioredis |
| Agent orchestration | LangGraph StateGraphs, Postgres checkpoints, HITL interrupts |
| Logging | pino (web), structlog (agent-service) |
| Reverse proxy | Caddy 2 |

---

## Features

- **Gmail + Calendar** — OAuth-connected inbox, send, archive, label, calendar read/create
- **AI thread analysis** — summary, tasks, deadlines, meetings, smart replies (Groq)
- **Multi-agent coordinator** — LangGraph StateGraph routes intent to triage / scheduling / email-assistant sub-graphs
- **Human-in-the-loop** — risky automation actions and calendar event creation pause for user approval via LangGraph `interrupt()`
- **Automation engine** — safe actions run automatically (label, archive, snooze); risky ones queue for approval
- **Per-user memory** — preferences persisted in Postgres, surfaced in every LLM prompt
- **Durable runs** — LangGraph checkpoints in Postgres; runs resume across restarts/replicas
- **Async queue** — BullMQ workers process automation jobs without blocking requests

---

## Quickstart

### Prerequisites
- Docker Desktop (or Docker + Compose v2)
- Google Cloud project with Gmail API + Google Calendar API enabled
- Groq API key (free tier works)

### Steps

```bash
# 1. Clone
git clone <repo> && cd mailmate

# 2. Configure
cp .env.example .env
# Edit .env — fill in GROQ_API_KEY, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET,
# POSTGRES_PASSWORD, AGENT_SERVICE_TOKEN

# 3. Launch
bash scripts/dev.sh

# 4. (First run only) run migrations
bash scripts/seed.sh
```

Open **http://localhost**. Sign in with Google to connect Gmail.

### Google OAuth callback URL
Add to your Google Cloud OAuth client:
```
http://localhost/api/auth/callback/google
```

---

## Development (without Docker)

```bash
# Start Postgres + Redis only
docker compose up postgres redis -d

# Web
cd submissions/61-Avalon
cp ../../.env.example .env.local   # adjust DATABASE_URL / REDIS_URL to localhost
npm install
npm run dev                         # http://localhost:3000

# Agent service
cd ../../agent-service
pip install uv && uv pip install --system -e ".[prod]"
uvicorn app.main:app --reload      # http://localhost:8000
```

---

## Environment Variables

See `.env.example` for all variables with descriptions. Required at minimum:

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public URL (e.g. `http://localhost`) |
| `POSTGRES_PASSWORD` | Postgres password |
| `AGENT_SERVICE_TOKEN` | Shared secret for inter-service auth (`openssl rand -hex 32`) |

---

## Project Layout

```
.
├── .github/workflows/     # CI (ci.yml), security.yml, release.yml
├── .env.example           # All env vars documented
├── Caddyfile              # Reverse proxy config
├── docker-compose.yml     # Full stack definition
├── scripts/
│   ├── dev.sh             # One-command bootstrap
│   └── seed.sh            # DB migrations
├── agent-service/         # Python FastAPI + LangGraph
│   ├── app/
│   │   ├── graphs/        # coordinator, triage, scheduling StateGraphs
│   │   ├── tools/         # gmail, memory tools (HTTP callbacks to web)
│   │   ├── main.py        # FastAPI routes
│   │   ├── auth.py        # HMAC service token middleware
│   │   └── checkpointer.py# Postgres LangGraph checkpointer
│   └── tests/
└── submissions/61-Avalon/ # Next.js web app
    ├── app/               # App Router pages + API routes
    ├── components/        # UI components
    ├── lib/               # Core logic (db, queue, memory, agents, rate-limit...)
    ├── prisma/            # Schema + migrations
    └── tests/             # Vitest unit tests
```

---

## Deployment

See [DEPLOY.md](DEPLOY.md) for:
- Docker Compose self-host guide (VPS / bare metal)
- Kubernetes manifests (`k8s/`)
- Vercel + managed services (Supabase + Upstash) option
- Environment variable reference

---

## CI

Every push to `main` / `enterprise` runs:
1. ESLint + TypeScript check + Vitest (web)
2. ruff + pytest (agent-service)
3. `docker build` both images + `docker compose config` validation
4. Weekly security scan (npm audit, pip-audit, CodeQL)

---

## License

MIT
