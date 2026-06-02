import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getThreadMetas, saveThreadMeta } from '@/lib/supabase'
import { parseBody, threadMetaSchema } from '@/lib/validation'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const metas = await getThreadMetas(session.userId)
    return NextResponse.json({ metas })
  } catch (error) {
    console.error('Get metas error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = await parseBody(request, threadMetaSchema)
  if (!parsed.ok) return parsed.response
  const { threadId, ...meta } = parsed.data

  try {
    await saveThreadMeta(session.userId, threadId, meta)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save meta error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
