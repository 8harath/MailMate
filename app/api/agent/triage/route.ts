import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runTriageAgent } from '@/lib/agents'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: 'Sign in with Google to use inbox triage.' },
      { status: 401 }
    )
  }

  try {
    const result = await runTriageAgent(session.accessToken)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Triage agent error:', error)
    return NextResponse.json(
      { error: 'Triage failed. Please try again.' },
      { status: 500 }
    )
  }
}
