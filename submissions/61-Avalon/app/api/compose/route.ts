import { NextRequest, NextResponse } from 'next/server'
import { composeDraft } from '@/lib/groq'

export async function POST(request: NextRequest) {
  const { subject, context } = await request.json()

  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  }

  try {
    const body = await composeDraft(subject.trim(), typeof context === 'string' ? context : undefined)
    return NextResponse.json({ body })
  } catch (error) {
    console.error('Compose error:', error)
    return NextResponse.json({ error: 'Failed to compose draft' }, { status: 500 })
  }
}
