import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserLabels, createUserLabel, deleteUserLabel } from '@/lib/supabase'
import { parseBody, labelCreateSchema, labelDeleteSchema } from '@/lib/validation'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const labels = await getUserLabels(session.userId)
    return NextResponse.json({ labels })
  } catch (error) {
    console.error('Get labels error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = await parseBody(request, labelCreateSchema)
  if (!parsed.ok) return parsed.response

  try {
    const label = await createUserLabel(session.userId, parsed.data.name)
    return NextResponse.json({ label })
  } catch (error) {
    console.error('Create label error:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = await parseBody(request, labelDeleteSchema)
  if (!parsed.ok) return parsed.response

  try {
    await deleteUserLabel(session.userId, parsed.data.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete label error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
