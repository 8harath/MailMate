import { NextRequest, NextResponse } from 'next/server'
import { comprehensiveAnalyze } from '@/lib/groq'
import { mockThreads } from '@/data/emails'

export async function POST(request: NextRequest) {
  const { threadId } = await request.json()
  const thread = mockThreads.find((t) => t.id === threadId)
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  try {
    const analysis = await comprehensiveAnalyze(thread)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed. Check your GROQ_API_KEY.' }, { status: 500 })
  }
}
