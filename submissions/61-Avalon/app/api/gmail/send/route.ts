import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/gmail'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = await checkRateLimit(`${session.user.email}:/api/gmail/send`, RATE_LIMITS.send)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many send requests. Please wait before sending another email.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const { to, subject, body, threadId, inReplyTo } = await request.json()

  if (!to || typeof to !== 'string' || !to.trim()) {
    return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 })
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'Missing required field: subject' }, { status: 400 })
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Missing required field: body' }, { status: 400 })
  }

  try {
    const result = await sendEmail(session.accessToken, to.trim(), subject.trim(), body, threadId, inReplyTo)
    return NextResponse.json({ success: true, messageId: result.id })
  } catch (error) {
    console.error('[gmail/send] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
