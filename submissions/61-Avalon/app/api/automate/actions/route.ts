import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPendingApprovals, getRecentActions } from '@/lib/automation-store'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    )
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'all'

  if (type === 'pending') {
    const pending = await getPendingApprovals(session.user.email)
    return NextResponse.json({ actions: pending })
  }

  if (type === 'recent') {
    const recent = await getRecentActions(session.user.email)
    return NextResponse.json({ actions: recent })
  }

  // Default: return both
  const [pending, recent] = await Promise.all([
    getPendingApprovals(session.user.email),
    getRecentActions(session.user.email),
  ])

  return NextResponse.json({ pending, recent })
}
