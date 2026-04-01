import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { comprehensiveAnalyze } from '@/lib/groq'
import { classifyActions } from '@/lib/automation-engine'
import { executeAutoActions } from '@/lib/automation-executor'
import { saveActions, getAutomationSettings } from '@/lib/automation-store'
import { Thread, ComprehensiveAnalysis, AutomationAction } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required for automation.' },
      { status: 401 }
    )
  }

  const userId = session.user.email
  const accessToken = session.accessToken
  const { threads, analyses } = (await request.json()) as {
    threads: Thread[]
    analyses?: Record<string, ComprehensiveAnalysis>
  }

  if (!threads || threads.length === 0) {
    return NextResponse.json({ error: 'No threads provided.' }, { status: 400 })
  }

  const settings = await getAutomationSettings(userId)
  if (!settings.enabled) {
    return NextResponse.json({
      message: 'Automation is disabled.',
      actions: [],
      summary: { totalAutoActions: 0, pendingApprovals: 0, recentActions: [] },
    })
  }

  const allActions: AutomationAction[] = []

  // Process each thread: analyze if not already analyzed, then classify
  for (const thread of threads.slice(0, 10)) {
    try {
      let analysis = analyses?.[thread.id]

      if (!analysis) {
        analysis = await comprehensiveAnalyze(thread)
      }

      const actions = classifyActions(thread, analysis, userId, settings)
      allActions.push(...actions)
    } catch (err) {
      console.error(`Automation failed for thread ${thread.id}:`, err)
    }
  }

  // Execute auto and notify tier actions
  const processed = await executeAutoActions(allActions, accessToken)

  // Persist all actions to the store
  await saveActions(userId, processed)

  const executed = processed.filter((a) => a.status === 'executed')
  const pending = processed.filter(
    (a) => a.status === 'pending' && a.riskLevel === 'confirm'
  )

  return NextResponse.json({
    actions: processed,
    summary: {
      totalAutoActions: executed.length,
      pendingApprovals: pending.length,
      recentActions: processed.slice(0, 20),
    },
  })
}
