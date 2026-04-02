# MailMate

MailMate is an AI-powered email workspace built by Team 61 (`Avalon`) for NH26. It combines Gmail, Google Calendar, drafting tools, inbox triage, and a multi-agent assistant into a single Next.js application.

The active app for this repository lives in `submissions/61-Avalon`.

## What MailMate Does

- Connects to Gmail with Google OAuth and works with real inbox data
- Falls back to demo data when Google is not connected, so the UI is still explorable locally
- Analyzes email threads with Groq-powered AI to produce summaries, priorities, categories, tasks, deadlines, meetings, and reply suggestions
- Provides a coordinator-style assistant that can chat over the current thread, use learned preferences, and delegate work to specialized agents
- Automates safe inbox actions such as labeling, marking read, snoozing, archiving, task extraction, and calendar creation, while sending higher-risk actions into an approval queue
- Syncs calendar events and supports creating events from detected meeting details
- Lets users compose, rewrite, and send email replies from inside the app

## Current Product Scope

MailMate is more than a landing page plus inbox mockup. The current codebase includes:

- Gmail thread fetch, send, and modify routes
- Google Calendar read and create routes
- AI thread analysis, rewrite, chat, and regeneration endpoints
- An orchestrator route with memory-backed multi-agent delegation
- Automation run and approval APIs
- Supabase-backed persistence for labels, thread metadata, memories, automation settings, and action history

## Tech Stack

| Area | Stack |
| --- | --- |
| App framework | Next.js 15 App Router |
| Language | TypeScript, React 19 |
| Styling | Tailwind CSS 4 |
| UI primitives | Radix UI / shadcn-style components |
| AI | Groq via Vercel AI SDK |
| Auth | NextAuth.js with Google OAuth |
| Integrations | Gmail API, Google Calendar API |
| Persistence | Supabase |

## Repository Layout

```text
.
|-- LICENSE
|-- README.md
`-- submissions/
    `-- 61-Avalon/
        |-- app/                # Next.js routes, pages, and API handlers
        |-- components/         # Inbox, landing page, automation, and UI components
        |-- data/               # Demo email data
        |-- hooks/              # Client hooks
        |-- lib/                # Gmail, calendar, AI, automation, auth, and memory logic
        |-- public/             # Static assets
        |-- scripts/            # Project helper scripts
        |-- types/              # Shared application types
        |-- .env.example
        `-- package.json
```

## Local Setup

### 1. Install dependencies

```bash
cd submissions/61-Avalon
npm install
```

### 2. Create local environment config

Copy `submissions/61-Avalon/.env.example` to `.env.local` and fill in the values.

### 3. Required environment variables

These are needed for the full product experience:

```env
GROQ_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### 4. Recommended Supabase variables

MailMate can still boot without Supabase, but persistence-heavy features degrade to no-op behavior. Configure these if you want stored memories, labels, thread metadata, automation history, and settings:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 5. Run the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Google OAuth Setup

In Google Cloud Console:

1. Enable the Gmail API and Google Calendar API.
2. Create OAuth credentials for a web app.
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI for local development.
4. If you deploy the app, add your production callback URL too.

## Feature Walkthrough

### Inbox and composition

- Browse inbox folders, thread previews, labels, and filters
- Read threads, reply inline, and create new messages
- Use AI rewriting tools to fix grammar, formalize, shorten, or elaborate draft text

### AI analysis

- Generate structured thread summaries
- Detect follow-ups, tasks, deadlines, and meetings
- Get smart replies and a longer draft reply from the selected conversation

### Coordinator and agents

- Chat with the current thread in context
- Use a coordinator that can route work to triage, scheduling, and email-assistant flows
- Persist user preferences as memory when Supabase is configured

### Automation

- Classify safe auto-actions for low-risk email handling
- Queue confirm-tier actions like replies or external calendar invitations for approval
- Track recent automation actions and approval status

## Demo Mode vs Connected Mode

- Demo mode: the app loads with mock email data and works without Google authentication
- Connected mode: Gmail and Calendar routes use the signed-in user's Google account, and agent/automation features can act on live mailbox data

## Important Paths

- App: `submissions/61-Avalon`
- App README: `submissions/61-Avalon/README.md`
- Feature overview: `submissions/61-Avalon/FEATURES.md`
- Team guide: `submissions/61-Avalon/TEAM_GUIDE.md`

## Team

- Team number: 61
- Team name: Avalon
- Project: MailMate

## License

MIT
