import { NextResponse } from 'next/server'

type ServiceStatus = 'ok' | 'degraded' | 'error' | 'not_configured' | 'missing_key' | 'missing_keys' | 'unknown'

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  services: {
    groq: ServiceStatus
    database: ServiceStatus
    redis: ServiceStatus
    agent_service: ServiceStatus
    google_oauth: ServiceStatus
  }
  version: string
}

async function probeUrl(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return res.ok
  } catch {
    return false
  }
}

async function probeDatabase(): Promise<ServiceStatus> {
  if (!process.env.DATABASE_URL) return 'not_configured'
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.$queryRaw`SELECT 1`
    return 'ok'
  } catch {
    return 'error'
  }
}

async function probeRedis(): Promise<ServiceStatus> {
  if (!process.env.REDIS_URL) return 'not_configured'
  try {
    const Redis = (await import('ioredis')).default
    const r = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000 })
    await r.ping()
    await r.quit()
    return 'ok'
  } catch {
    return 'error'
  }
}

async function probeAgentService(): Promise<ServiceStatus> {
  const url = process.env.AGENT_SERVICE_URL
  if (!url) return 'not_configured'
  const ok = await probeUrl(`${url}/healthz`)
  return ok ? 'ok' : 'error'
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const [database, redis, agentService] = await Promise.all([
    probeDatabase(),
    probeRedis(),
    probeAgentService(),
  ])

  const groq: ServiceStatus = process.env.GROQ_API_KEY ? 'ok' : 'missing_key'
  const google_oauth: ServiceStatus =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'ok' : 'missing_keys'

  const critical = [groq, google_oauth, database]
  const overallStatus: HealthCheck['status'] =
    critical.some((s) => s === 'error' || s === 'missing_key' || s === 'missing_keys')
      ? 'error'
      : [redis, agentService].some((s) => s === 'error')
      ? 'degraded'
      : 'ok'

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: { groq, database, redis, agent_service: agentService, google_oauth },
      version: process.env.npm_package_version ?? '0.1.0',
    },
    { status: overallStatus === 'error' ? 503 : 200 }
  )
}
