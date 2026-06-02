import { NextRequest, NextResponse } from 'next/server'
import { composeDraft } from '@/lib/groq'
import { parseBody, composeSchema } from '@/lib/validation'
import { createLogger } from '@/lib/logger'

const log = createLogger('compose')

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, composeSchema)
  if (!parsed.ok) return parsed.response
  const { subject, context } = parsed.data

  try {
    const body = await composeDraft(subject.trim(), context)
    return NextResponse.json({ body })
  } catch (error) {
    log.error('failed to compose draft', error)
    return NextResponse.json({ error: 'Failed to compose draft' }, { status: 500 })
  }
}
