import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rewriteText } from '@/lib/groq'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { parseBody, rewriteSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const rateLimitKey = session?.user?.email
    ? `${session.user.email}:/api/rewrite`
    : `anon:/api/rewrite`
  const rl = checkRateLimit(rateLimitKey, RATE_LIMITS.rewrite)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many rewrite requests. Please wait a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const parsed = await parseBody(request, rewriteSchema)
  if (!parsed.ok) return parsed.response
  const { text, action, senderName, recipientName } = parsed.data

  const MAX_TEXT_LENGTH = 8000
  const truncatedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text

  try {
    const result = await rewriteText(truncatedText, action, senderName, recipientName)
    return NextResponse.json({ text: result })
  } catch (error) {
    console.error('[rewrite] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 })
  }
}
