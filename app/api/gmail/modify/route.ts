import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markAsRead, markAsUnread, starThread, unstarThread, trashThread, archiveThread } from '@/lib/gmail'
import { parseBody, gmailModifySchema } from '@/lib/validation'

type Action = 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'archive'

const actions: Record<Action, (token: string, threadId: string) => Promise<void>> = {
  read: markAsRead,
  unread: markAsUnread,
  star: starThread,
  unstar: unstarThread,
  trash: trashThread,
  archive: archiveThread,
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const parsed = await parseBody(request, gmailModifySchema)
  if (!parsed.ok) return parsed.response
  const { threadId, action } = parsed.data

  try {
    await actions[action](session.accessToken, threadId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gmail modify error:', error)
    return NextResponse.json({ error: 'Failed to modify thread' }, { status: 500 })
  }
}
