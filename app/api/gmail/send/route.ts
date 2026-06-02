import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/gmail'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { parseBody, gmailSendSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${session.user.email}:/api/gmail/send`, RATE_LIMITS.send)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many send requests. Please wait before sending another email.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const parsed = await parseBody(request, gmailSendSchema)
  if (!parsed.ok) return parsed.response
  const { to, subject, body, threadId, inReplyTo } = parsed.data

  try {
    const result = await sendEmail(session.accessToken, to.trim(), subject.trim(), body, threadId, inReplyTo)
    return NextResponse.json({ success: true, messageId: result.id })
  } catch (error) {
    console.error('[gmail/send] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
