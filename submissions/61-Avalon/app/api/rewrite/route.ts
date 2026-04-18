import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rewriteText } from '@/lib/groq'
import { RewriteAction } from '@/types'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const validActions: RewriteAction[] = ['formalize', 'shorten', 'elaborate', 'fix-grammar']

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const rateLimitKey = session?.user?.email
    ? `${session.user.email}:/api/rewrite`
    : `anon:/api/rewrite`
  const rl = await checkRateLimit(rateLimitKey, RATE_LIMITS.rewrite)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many rewrite requests. Please wait a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const { text, action, senderName, recipientName } = await request.json()

  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const MAX_TEXT_LENGTH = 8000
  const truncatedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text

  try {
    const result = await rewriteText(
      truncatedText,
      action,
      typeof senderName === 'string' ? senderName : undefined,
      typeof recipientName === 'string' ? recipientName : undefined
    )
    return NextResponse.json({ text: result })
  } catch (error) {
    console.error('[rewrite] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 })
  }
}
