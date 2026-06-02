import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runSchedulingAgent } from '@/lib/agents'
import { Thread } from '@/types'
import { parseBody, agentScheduleSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Sign in with Google to use the scheduling agent.' },
      { status: 401 }
    )
  }

  const parsed = await parseBody(request, agentScheduleSchema)
  if (!parsed.ok) return parsed.response

  try {
    const result = await runSchedulingAgent(parsed.data.thread as unknown as Thread, session.accessToken)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Scheduling agent error:', error)
    return NextResponse.json(
      { error: 'Scheduling failed. Please try again.' },
      { status: 500 }
    )
  }
}
