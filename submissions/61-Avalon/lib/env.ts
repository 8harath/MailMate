/**
 * Environment variable contract — lib/env.ts
 *
 * SINGLE SOURCE OF TRUTH for all environment variables the web tier reads.
 *
 * WHY CENTRALISE ENV ACCESS?
 *   Scattering process.env reads across files makes it hard to know which
 *   vars are required, audit what the app needs to run, or catch typos.
 *   Centralising here means:
 *     - One place to document every var's purpose
 *     - validateEnv() fails fast at startup with a clear error (not a
 *       mysterious undefined at runtime)
 *     - getEnv() provides a typed accessor so callers never read
 *       process.env directly
 *
 * REQUIRED vs OPTIONAL:
 *   REQUIRED_VARS — the app cannot function without these. validateEnv()
 *     throws if any are missing. Called in layout.tsx and instrumentation.ts
 *     so the process exits immediately on misconfiguration.
 *
 *   OPTIONAL_VARS — the app degrades gracefully when these are absent:
 *     DATABASE_URL     → falls back to Supabase (or no persistence)
 *     REDIS_URL        → rate limiter falls back to in-memory Map
 *     AGENT_SERVICE_URL→ coordinator falls back to in-process Vercel AI SDK
 *     LANGSMITH_API_KEY→ no LangGraph tracing
 *     SENTRY_DSN       → no error reporting
 *
 * ADDING A NEW VARIABLE:
 *   1. Add it to REQUIRED_VARS or OPTIONAL_VARS
 *   2. Add an entry in .env.example with description
 *   3. Add the field to getEnv()'s return object
 *   4. Add it to lib/env.ts in the Env type (automatic via ReturnType)
 *   5. If required, add it to .github/workflows/ci.yml build step env block
 */

// ── Required variables ────────────────────────────────────────────────────────

const REQUIRED_VARS = [
  'GROQ_API_KEY',          // LLM provider — both web in-process and agent-service
  'GOOGLE_CLIENT_ID',      // Google OAuth — NextAuth provider
  'GOOGLE_CLIENT_SECRET',  // Google OAuth — NextAuth provider
  'NEXTAUTH_SECRET',       // JWT signing secret — generate with: openssl rand -base64 32
  'NEXTAUTH_URL',          // Public app URL — must match Google OAuth redirect URI
] as const

// ── Optional variables (with graceful fallbacks) ───────────────────────────────

const OPTIONAL_VARS = [
  // Postgres connection — when set, Prisma is used instead of Supabase
  'DATABASE_URL',
  // Redis connection — when set, rate limiter uses sliding-window Lua script
  'REDIS_URL',
  // Agent service — when set, coordinator/triage/schedule routes use LangGraph
  'AGENT_SERVICE_URL',
  // HMAC secret for signing requests to the agent-service
  'AGENT_SERVICE_TOKEN',
  // Supabase legacy vars — used when DATABASE_URL is not set
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Observability — all optional, all no-ops when absent
  'LANGSMITH_API_KEY',
  'SENTRY_DSN',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
] as const

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Throws a descriptive error listing every missing required variable.
 * Called at application startup (layout.tsx / instrumentation.ts) so the
 * process fails immediately with a useful message rather than crashing
 * later with an obscure TypeError on first request.
 */
export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
        'Copy .env.example to .env and fill in the values.'
    )
  }
}

// ── Typed accessor ────────────────────────────────────────────────────────────

/**
 * Returns all environment variables in a typed object.
 * Validates required vars first — will throw if any are missing.
 * Callers should prefer importing specific values via destructuring
 * rather than accessing process.env directly.
 */
export function getEnv() {
  validateEnv()
  return {
    // LLM
    groqApiKey: process.env.GROQ_API_KEY!,

    // Google OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,

    // NextAuth
    nextAuthSecret: process.env.NEXTAUTH_SECRET!,
    nextAuthUrl: process.env.NEXTAUTH_URL!,

    // Data layer — Postgres replaces Supabase when DATABASE_URL is set
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,

    // Agent service — enables LangGraph path in coordinator/triage/schedule
    agentServiceUrl: process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000',
    agentServiceToken: process.env.AGENT_SERVICE_TOKEN,

    // Supabase legacy — kept for Vercel / hackathon deployments without Postgres
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Convenience boolean for callers to check Supabase availability
    hasSupabase: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),

    // Observability
    langsmithApiKey: process.env.LANGSMITH_API_KEY,
    sentryDsn: process.env.SENTRY_DSN,
  }
}

export type Env = ReturnType<typeof getEnv>
export { REQUIRED_VARS, OPTIONAL_VARS }
