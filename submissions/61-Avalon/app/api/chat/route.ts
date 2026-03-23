import { NextRequest, NextResponse } from 'next/server'
import { chatAboutThread } from '@/lib/groq'
import { mockThreads } from '@/data/emails'

export async function POST(request: NextRequest) {
  const { message, threadId } = await request.json()
  const thread = threadId ? mockThreads.find((t) => t.id === threadId) ?? null : null
  try {
    const response = await chatAboutThread(message, thread)
    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ response: 'Sorry, something went wrong. Please try again.' })
  }
}
