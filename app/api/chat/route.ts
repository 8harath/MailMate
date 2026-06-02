import { NextRequest, NextResponse } from 'next/server'
import { chatAboutThread } from '@/lib/groq'
import { mockThreads } from '@/data/emails'
import { Thread } from '@/types'
import { parseBody, chatSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, chatSchema)
  if (!parsed.ok) return parsed.response
  const { message, threadId, thread: inlineThread } = parsed.data

  let thread: Thread | null = null
  if (inlineThread) {
    thread = inlineThread as unknown as Thread
  } else if (threadId) {
    thread = mockThreads.find((t) => t.id === threadId) ?? null
  }

  try {
    const reply = await chatAboutThread(message, thread)
    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ reply: 'Sorry, something went wrong. Please try again.' })
  }
}
