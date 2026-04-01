import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { executeAction } from '@/lib/automation-executor'
import { updateActionStatus, getActions } from '@/lib/automation-store'
import { AutomationAction } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    )
  }

  const userId = session.user.email
  const { actionId, decision } = (await request.json()) as {
    actionId: string
    decision: 'approve' | 'reject'
  }

  if (!actionId || !decision) {
    return NextResponse.json(
      { error: 'actionId and decision are required.' },
      { status: 400 }
    )
  }

  if (decision === 'reject') {
    await updateActionStatus(userId, actionId, 'rejected')
    return NextResponse.json({ status: 'rejected', actionId })
  }

  // Find the action to execute
  const actions = await getActions(userId, { status: 'pending' })
  const action = actions.find((a: AutomationAction) => a.id === actionId)

  if (!action) {
    return NextResponse.json(
      { error: 'Action not found or already processed.' },
      { status: 404 }
    )
  }

  // Execute the approved action
  const { success, error } = await executeAction(action, session.accessToken)

  if (success) {
    await updateActionStatus(userId, actionId, 'executed')
    return NextResponse.json({ status: 'executed', actionId })
  }

  return NextResponse.json(
    { error: error ?? 'Execution failed.', actionId },
    { status: 500 }
  )
}
