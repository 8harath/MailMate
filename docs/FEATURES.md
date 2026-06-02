# MailMate — Feature Overview

A detailed reference of what MailMate does. For the high-level pitch and setup, see the [README](../README.md). For system internals, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Core Features

### 1. Gmail Integration (OAuth 2.0)
- Sign in with a Google account via NextAuth.js
- Requests Gmail and Calendar API scopes
- Fetches real email threads from the user's inbox
- Sends real emails through Gmail on behalf of the user
- Falls back to mock data when not signed in (demo mode)

### 2. AI Email Analysis
One-click analysis of any email thread using Groq (LLaMA 3.3 70B, `llama-3.3-70b-versatile`). Extracts:
- **Executive Summary** — 3-bullet condensed overview of the thread
- **Priority Classification** — Urgent, Important, Normal, or Low
- **Category Detection** — Work, Personal, Finance, Updates, or Spam
- **Smart Replies** — one-click reply options across tones
- **Full Draft Reply** — professional reply generated from thread context
- **Meeting Detection** — dates, times, and attendees extracted from the thread
- **Task Extraction** — action items with deadlines and priority levels
- **Deadline Detection** — time-sensitive dates flagged as urgent if within 3 days
- **Key Information** — dates, links, contacts, and monetary amounts pulled out
- **Follow-up Detection** — flags threads that need a response, with suggestions
- **Sender Importance** — classifies a sender as VIP, Regular, or Unknown

### 3. AI Writing Tools
Four rewrite actions available in both reply and compose panels:
- **Fix Grammar** — corrects spelling, punctuation, and grammar
- **Formalize** — converts casual text into a professional tone
- **Shorten** — condenses the message while keeping meaning
- **Elaborate** — expands the message with more detail

### 4. AI Chat Assistant
- Context-aware sidebar chat panel
- When an email is selected, the assistant has full thread context
- Ask natural-language questions about any email
- Powered by Groq with conversation history

### 5. Multi-Agent Coordinator
- A coordinator agent that can delegate work to specialized sub-agents:
  - **Triage agent** — classifies and prioritizes threads
  - **Scheduling agent** — proposes and creates calendar events
  - **Email-assistant agent** — drafts and refines replies
- Tool-calling architecture (`lib/agent-tools.ts`, `lib/coordinator-tools.ts`) lets agents read threads, search the inbox, modify labels, and draft messages
- Learned user preferences are injected as context when persistence is enabled

### 6. Inbox Automation (Approval-Gated)
- Classifies low-risk actions (label, mark read, snooze, archive, task extraction, calendar creation) as **safe** to auto-apply
- Routes higher-risk actions (sending replies, external calendar invitations) into an **approval queue** — nothing leaves your account without confirmation
- Tracks recent automation actions and their approval status

### 7. Google Calendar Integration
- Calendar workspace view with a date picker
- Shows synced events from Google Calendar
- One-click "Add to Calendar" for meetings detected by the AI
- Event cards show attendees, time, and a direct link to Google Calendar

### 8. Email Composition
- **Reply panel** — inline reply composer with AI writing tools and word count
- **New email modal** — full compose dialog with To, Subject, and Body fields
- Sends via the Gmail API when authenticated
- Draft auto-save to local storage

### 9. Inbox Management
- **Folders** — Inbox, Starred, Snoozed, Sent, Drafts, Calendar, Trash, All Mail
- **Star / Unstar**, **Snooze**, **Archive / Trash**, **Mark Read / Unread**
- **Custom labels** — create and apply user-defined labels to threads
- Star, archive, trash, and read-status changes sync back to Gmail

### 10. Search and Filtering
- Full-text search across subjects, bodies, sender names, emails, and labels
- Filter by read status (All, Unread, Read)
- Filter by priority (Urgent, Important, Normal, Low)
- Filter by category (Work, Personal, Finance, Updates, Spam)
- Category quick-filters from the sidebar

### 11. Persistent Memory (Optional, Supabase)
- When Supabase is configured, MailMate persists analysis caches, thread metadata, custom labels, agent memory (learned preferences), and automation history
- Without Supabase, the app runs in a graceful degraded mode using local storage only

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15 (App Router) | SSR, API routes, file-based routing |
| Language | TypeScript + React 19 | Type safety, modern React with hooks |
| Styling | Tailwind CSS 4 | Utility-first responsive design |
| UI Components | Radix UI (shadcn/ui) | Accessible, composable headless components |
| AI Engine | Groq SDK + Vercel AI SDK | Fast inference with `llama-3.3-70b-versatile` |
| Authentication | NextAuth.js | Google OAuth 2.0 with token refresh |
| Email API | Gmail API v1 | Read threads, send emails, modify labels |
| Calendar API | Google Calendar API v3 | Read and create events |
| Persistence | Supabase (optional) + localStorage | Server-side store with local fallback |
| Icons | Lucide React | Consistent icon library |

For request flow, the agent/coordinator design, the full API-route map, and the persistence model, see [ARCHITECTURE.md](./ARCHITECTURE.md).
