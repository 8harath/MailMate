# MailMate Architecture

This document describes how MailMate is put together: the request flow, the agent
and automation design, the API surface, and the persistence model. For the
feature list see [FEATURES.md](./FEATURES.md); for setup see the [README](../README.md).

## Overview

MailMate is a single Next.js 15 (App Router) application. The browser renders
React components; all integrations with external services (Gmail, Google
Calendar, Groq) run **server-side** through API routes so that no API keys reach
the client. The user's Google OAuth token is held in an encrypted NextAuth
session cookie and passed to Gmail/Calendar calls on the server.

```
USER'S BROWSER                      SERVER (Next.js API routes)              EXTERNAL
┌────────────────┐                  ┌───────────────────────────┐           ┌──────────────────┐
│ React UI       │  HTTP + session  │ /api/analyze /chat /rewrite│  HTTPS    │ Groq             │
│ app/inbox      │ ───────────────▶ │ /api/agent/* (coordinator) │ ────────▶ │ llama-3.3-70b    │
│ app/page       │ ◀─────────────── │ /api/automate/*            │ ◀──────── │                  │
│                │   JSON           │                            │           └──────────────────┘
│                │                  │ /api/gmail/*               │  OAuth    ┌──────────────────┐
│                │ ───────────────▶ │ /api/calendar/*            │ ────────▶ │ Gmail + Calendar │
│                │ ◀─────────────── │ /api/auth/[...nextauth]    │ ◀──────── │ (Google APIs)    │
│ localStorage   │                  │ /api/db/* /api/agent/memory│           └──────────────────┘
│ (cache/prefs)  │                  │            │               │  service  ┌──────────────────┐
└────────────────┘                  └────────────┼───────────────┘  key      │ Supabase         │
                                                  └──────────────────────────▶│ (optional)       │
                                                                              └──────────────────┘
```

**Security note:** the Groq API key and the Supabase service-role key are
server-only. Only `NEXT_PUBLIC_*` variables are exposed to the browser.

## Directory layout

| Path | Responsibility |
|------|----------------|
| `app/` | App Router pages (`page.tsx` landing, `inbox/`, `auth/signin/`) and API routes under `app/api/` |
| `components/landing/` | Marketing landing page sections |
| `components/inbox/`, `components/*.tsx` | Inbox UI: thread detail, lists, chat panel, approval queue, automation status |
| `components/ui/` | Vendored shadcn/ui primitives |
| `lib/` | All server logic (see below) |
| `types/` | Shared TypeScript types (`Thread`, `ComprehensiveAnalysis`, `AutomationAction`, …) |
| `data/emails.ts` | Mock threads powering demo mode |
| `hooks/` | Client hooks (inbox storage, responsive, toast) |
| `tests/` | Vitest unit tests |

## Core libraries (`lib/`)

| Module | Role |
|--------|------|
| `auth.ts` | NextAuth config: Google OAuth, scopes, JWT with token refresh |
| `api-guard.ts` | `guardRoute()` — auth + per-user rate-limit gate, returns a typed session or a ready error response |
| `rate-limit.ts` | In-memory, per-key sliding-window rate limiter and `RATE_LIMITS` presets |
| `validation.ts` | `parseBody(request, schema)` + Zod request schemas for every body-parsing route |
| `logger.ts` | `createLogger(scope)` — single logging entry point |
| `groq.ts` | Groq calls: `comprehensiveAnalyze`, `composeDraft`, `rewriteText`, `chatAboutThread` |
| `gmail.ts` | Gmail API wrapper: list/get threads, send, modify (read/star/trash/archive) |
| `google-calendar.ts` | Calendar API: list upcoming events, create events |
| `agents.ts` | Specialized agents: email assistant, triage, scheduling (tool-calling via the AI SDK) |
| `agent-tools.ts` | Tools exposed to agents (search inbox, read thread, draft, send, modify, calendar) |
| `coordinator.ts` | Coordinator agent that delegates to sub-agents and injects memory |
| `coordinator-tools.ts` | Coordinator's delegation, memory, and automation tools |
| `automation-engine.ts` | Classifies actions into `safe` / `confirm` risk tiers; `DEFAULT_SETTINGS` |
| `automation-executor.ts` | Executes classified actions (apply label, archive, create event, …) |
| `automation-store.ts` | Supabase persistence for the action queue and settings |
| `memory.ts` | Agent memory CRUD and prompt-context formatting |
| `supabase.ts` | Supabase client init and table helpers |
| `env.ts` | Required/optional env var lists and validation helpers |

## API surface

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/analyze` | optional (demo) | Comprehensive thread analysis |
| `POST /api/chat` | optional (demo) | Ask about a thread |
| `POST /api/rewrite` | rate-limited | Grammar/formalize/shorten/elaborate |
| `POST /api/compose` | — | Draft a new email from a subject + context |
| `POST /api/agent/orchestrate` | optional (demo) | Coordinator (auth) or email assistant (demo) |
| `POST /api/agent/chat` | optional | Email-assistant agent |
| `POST /api/agent/triage` | required | Triage the unread inbox |
| `POST /api/agent/schedule` | required | Scheduling agent for a thread |
| `GET/POST/DELETE /api/agent/memory` | required | Agent memory CRUD |
| `POST /api/automate/run` | required | Classify + execute automation for threads |
| `POST /api/automate/approve` | required | Approve/reject a queued action |
| `GET /api/automate/actions` | required | Recent actions / pending approvals |
| `GET/POST /api/gmail/threads`, `POST /api/gmail/send`, `POST /api/gmail/modify` | required | Gmail operations |
| `GET /api/calendar/events`, `POST /api/calendar/create` | required | Calendar operations |
| `GET/POST/DELETE /api/db/labels`, `GET/POST /api/db/meta` | required | Supabase-backed labels & thread metadata |
| `/api/auth/[...nextauth]` | — | NextAuth handlers |
| `GET /api/health` | — | Liveness probe for uptime monitoring |

Every route that parses a request body validates it with a Zod schema via
`parseBody`, which also guards against malformed JSON (returns `400`, not a
crash). Authenticated/rate-limited routes use `guardRoute` or the inline
rate-limit helpers.

## Agent and coordinator design

When a user is signed in, `/api/agent/orchestrate` runs the **coordinator**
(`lib/coordinator.ts`). The coordinator:

1. Loads the user's learned preferences from agent memory and injects them into
   its system prompt.
2. Decides whether to answer directly or delegate to a sub-agent
   (`delegateToEmailAssistant`, triage, scheduling) via tool calls.
3. May queue automation actions, all surfaced back as `delegations` and
   `memoriesUsed` in the response.

In **demo mode** (no Google token) the route skips delegation and memory and runs
the email-assistant agent directly against mock data.

## Automation pipeline

1. `classifyActions` (`automation-engine.ts`) turns a thread + its analysis into
   `AutomationAction`s, each tagged `safe` (auto-apply) or `confirm` (needs
   approval).
2. `executeAutoActions` (`automation-executor.ts`) runs the `safe` tier
   immediately; `confirm` actions are persisted as `pending`.
3. The UI's approval queue calls `/api/automate/approve`; on approval the action
   is executed and its status updated. **No outbound action (reply, external
   invite) happens without explicit approval.**

## Persistence model

- **Without Supabase** (default): analyses, thread metadata, labels, and sidebar
  state live in the browser's `localStorage`. Persistence helpers in `lib/` are
  no-ops that report success, so the app degrades gracefully.
- **With Supabase**: the same data plus agent memory and automation history are
  stored in your own Supabase project. Apply the migrations in `scripts/`
  (`migration-agent-memory.sql`, `migration-automation.sql`) before use.

## Demo vs connected mode

| | Demo mode | Connected mode |
|---|---|---|
| Sign-in | none | Google OAuth |
| Data | `data/emails.ts` mock threads | live Gmail threads |
| AI features | work (need `GROQ_API_KEY`) | work on real mail |
| Sending / calendar writes | disabled | enabled |
| Agents | email assistant only | full coordinator + delegation |

## Edge cases

| Edge case | Handling |
|-----------|----------|
| No Google account connected | Falls back to mock threads so the UI is fully explorable |
| Gmail/Calendar API failure | Error surfaced to the UI; cached data remains; user can retry |
| AI returns malformed JSON | Markdown fences stripped, parsed in try/catch, safe defaults for every field |
| OAuth token expires | NextAuth refreshes it from the stored refresh token |
| Empty/blank chat or rewrite input | Rejected by Zod validation server-side and disabled client-side |
| Rapid duplicate requests | Per-user rate limiting (`rate-limit.ts`) returns `429` with `Retry-After` |
| Supabase unconfigured | Persistence helpers no-op and report success; no crash |
| Supabase write fails when configured | Helper returns `false`; the approve route surfaces it instead of silently dropping |

## Known limitations

- The rate limiter is in-memory and per-process; a multi-instance deployment
  needs a shared store (e.g. Redis/Upstash) for accurate limits.
- `app/inbox/page.tsx` is a large single component and is a natural target for
  future decomposition.
- There is no centralized error-reporting integration yet (logging goes through
  `lib/logger.ts`, which can be pointed at a drain).
