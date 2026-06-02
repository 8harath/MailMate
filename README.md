# MailMate

**An AI-powered email workspace.** MailMate connects to Gmail and Google Calendar, analyzes your threads with Groq (LLaMA 3.3 70B), drafts and rewrites replies, and runs an **approval-gated** multi-agent assistant — all in a single Next.js app.

It also ships with a **demo mode**: open it without signing in and explore every feature against realistic sample data.

> Built with Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Groq · NextAuth · Supabase (optional)

---

## Highlights

- **Gmail integration** — read, send, label, star, archive, and trash real threads
- **AI thread analysis** — summary, priority, category, tasks, deadlines, meetings, key info, and smart replies in one click
- **AI writing tools** — fix grammar, formalize, shorten, or elaborate any draft
- **Multi-agent coordinator** — delegates to triage, scheduling, and email-assistant agents
- **Approval-gated automation** — low-risk actions auto-apply; anything that leaves your account waits for your confirmation
- **Google Calendar** — browse events and create them from detected meetings
- **Optional persistence** — bring Supabase for stored analyses, labels, agent memory, and automation history; without it, the app degrades gracefully to local storage

See [`docs/FEATURES.md`](./docs/FEATURES.md) for the full feature reference and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for how it works internally.

## Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS 4, Radix UI / shadcn-style components |
| AI | Groq (`llama-3.3-70b-versatile`) via the Vercel AI SDK |
| Auth | NextAuth.js with Google OAuth |
| Integrations | Gmail API, Google Calendar API |
| Persistence | Supabase (optional) |
| Validation | Zod |
| Testing | Vitest |

## Quick start

**Prerequisites:** Node.js 20+ (see [`.nvmrc`](./.nvmrc)) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in the values (see below)

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. The landing page links to a **demo inbox** (no sign-in needed) and a **Connect Google** flow.

> AI features need a `GROQ_API_KEY`. Gmail/Calendar features need Google OAuth credentials. Without them, the UI still loads in demo mode.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local`. **Never commit `.env.local`.**

### Required

| Variable | Description |
| --- | --- |
| `GROQ_API_KEY` | Powers all AI features. Get one at <https://console.groq.com/keys> |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Session encryption secret (≥32 chars). Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL (`http://localhost:3000` locally) |

### Optional (Supabase persistence)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only) |

Without Supabase, persistence-heavy features fall back to local storage.

## Google OAuth setup

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create or select a project.
2. Enable the **Gmail API** and **Google Calendar API**.
3. Create an **OAuth 2.0 Client ID** (Web application).
4. Add the redirect URI `http://localhost:3000/api/auth/callback/google` (and your production callback URL when you deploy).
5. Copy the Client ID and Secret into `.env.local`.

## Supabase setup (optional)

1. Create a project at <https://supabase.com>.
2. In the SQL editor, run both migrations from [`scripts/`](./scripts):
   - `migration-agent-memory.sql`
   - `migration-automation.sql`
3. Copy the URL and keys from **Project Settings → API** into `.env.local`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint (Next config) |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage |

## Testing

```bash
npm run test
```

Unit tests live in [`tests/`](./tests) and cover the rate limiter, automation
engine, and inbox storage helpers. Please add tests alongside new `lib/` logic.

## Deployment

### Vercel (recommended)

Import the repo into Vercel, add the environment variables under **Settings →
Environment Variables**, and update the Google OAuth redirect URI to your
production URL. The included [`vercel.json`](./vercel.json) sets the build
command and API security headers.

### Docker / self-host

The app builds to a standalone server. Build and run the container, passing your
environment at runtime:

```bash
docker build -t mailmate .
docker run -p 3000:3000 --env-file .env.local mailmate
```

## Project structure

```text
app/         Next.js routes, pages, and API handlers
components/  Landing, inbox, and shared UI components
lib/         Gmail, Calendar, Groq, agents, automation, auth, persistence
types/       Shared TypeScript types
data/        Demo email data
hooks/       Client hooks
scripts/     Supabase migrations
tests/       Vitest unit tests
docs/        Architecture and feature documentation
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full breakdown.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Please
review the [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) and report security
issues per [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE)
