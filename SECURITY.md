# Security Policy

## Supported versions

MailMate is pre-1.0 and under active development. Security fixes are applied to the `main` branch and the latest release only.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through GitHub Security Advisories:

> https://github.com/8harath/MailMate/security/advisories/new

Include:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected version / commit

We aim to acknowledge reports within a few days and will keep you updated on remediation.

## Handling secrets

MailMate is configured entirely through environment variables — there are no secrets in the codebase.

- **Never commit `.env.local`** or any real credentials. `.gitignore` excludes `.env` and `.env*.local`; only `.env.example` (placeholder values) is tracked.
- Rotate `NEXTAUTH_SECRET`, Google OAuth credentials, the Groq API key, and Supabase keys if they are ever exposed.
- The Groq API key and Supabase service-role key are **server-only** and must never be exposed to the client. Only `NEXT_PUBLIC_*` variables are sent to the browser.

## Data handling

- Gmail and Calendar access uses the signed-in user's OAuth token; MailMate requests only Gmail read/send and Calendar scopes.
- AI analysis sends thread content to the Groq API you configure. Persistence (when Supabase is configured) stores data in your own database. MailMate operates no central servers.
