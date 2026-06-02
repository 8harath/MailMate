import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCalendarEvent } from '@/lib/google-calendar'
import { parseBody, calendarCreateSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const parsed = await parseBody(request, calendarCreateSchema)
  if (!parsed.ok) return parsed.response
  const { title, date, time, duration, description, attendees } = parsed.data

  try {
    const event = await createCalendarEvent(session.accessToken, {
      title, date, time, duration, description, attendees,
    })
    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('Calendar create error:', error)
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}
