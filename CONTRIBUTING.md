# Contributing to MailMate

Thanks for your interest in improving MailMate! This guide covers how to get set up and the conventions we follow.

## Getting started

1. **Fork and clone** the repository.
2. **Install dependencies** (Node 20+ — see [`.nvmrc`](./.nvmrc)):
   ```bash
   npm install
   ```
3. **Configure environment**: copy `.env.example` to `.env.local` and fill in the values. See the [README](./README.md#environment-variables) for what each variable does. The app boots in demo mode without Google sign-in, so you can develop most of the UI without real keys.
4. **Run the app**:
   ```bash
   npm run dev
   ```

## Project layout

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full map. In short:

- `app/` — Next.js App Router pages and API routes
- `components/` — UI (landing, inbox, shared `ui/` primitives)
- `lib/` — Gmail, Calendar, Groq, agents, automation, auth, persistence
- `types/` — shared TypeScript types
- `tests/` — Vitest unit tests

## Development workflow

1. Create a branch off `main`: `git checkout -b feat/short-description`.
2. Make your change with tests where it makes sense.
3. Run the full local gate before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
4. Open a pull request against `main` and fill in the template. CI runs the same gate.

## Conventions

- **Language**: TypeScript everywhere; avoid `any`. Validate external input with the Zod schemas in `lib/validation.ts`.
- **API routes**: authenticate/rate-limit via `lib/api-guard.ts` (`guardRoute`) where applicable, and validate the body with `parseBody(request, schema)`.
- **Logging**: use `createLogger(scope)` from `lib/logger.ts` rather than bare `console.*` in new code.
- **Persistence**: Supabase access lives in `lib/supabase.ts`, `lib/memory.ts`, and `lib/automation-store.ts`. Keep the "no-op when Supabase is unconfigured" behavior intact.
- **Commits**: short, imperative subject lines; Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) are encouraged.

## Reporting issues

Use the bug report or feature request templates under **Issues**. For security problems, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.
