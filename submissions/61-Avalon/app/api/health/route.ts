import { NextResponse } from 'next/server'

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  services: {
    groq: 'ok' | 'missing_key' | 'unknown'
    supabase: 'ok' | 'not_configured' | 'unknown'
    google_oauth: 'ok' | 'missing_keys' | 'unknown'
  }
  version: string
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const groqStatus = process.env.GROQ_API_KEY ? 'ok' : 'missing_key'
  const supabaseStatus =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? 'ok'
      : 'not_configured'
  const googleStatus =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? 'ok'
      : 'missing_keys'

  const allOk = groqStatus === 'ok' && googleStatus === 'ok'
  const overallStatus: HealthCheck['status'] = allOk
    ? 'ok'
    : groqStatus === 'missing_key' || googleStatus === 'missing_keys'
    ? 'error'
    : 'degraded'

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        groq: groqStatus,
        supabase: supabaseStatus,
        google_oauth: googleStatus,
      },
      version: process.env.npm_package_version ?? '0.1.0',
    },
    { status: overallStatus === 'error' ? 503 : 200 }
  )
}
