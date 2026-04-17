const REQUIRED_VARS = [
  'GROQ_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const

const OPTIONAL_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
        'Copy .env.example to .env.local and fill in the values.'
    )
  }
}

export function getEnv() {
  validateEnv()
  return {
    groqApiKey: process.env.GROQ_API_KEY!,
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    nextAuthSecret: process.env.NEXTAUTH_SECRET!,
    nextAuthUrl: process.env.NEXTAUTH_URL!,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSupabase: !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  }
}

export type Env = ReturnType<typeof getEnv>

export { REQUIRED_VARS, OPTIONAL_VARS }
