import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMemories, storeMemory, deleteMemory } from '@/lib/memory'
import { MemoryCategory } from '@/types'
import { parseBody, memoryStoreSchema, memoryDeleteSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const category = request.nextUrl.searchParams.get('category') as MemoryCategory | null
  const memories = await getMemories(session.user.email, category ?? undefined)
  return NextResponse.json({ memories })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = await parseBody(request, memoryStoreSchema)
  if (!parsed.ok) return parsed.response
  const { category, key, value } = parsed.data

  const result = await storeMemory(session.user.email, { category, key, value })
  return NextResponse.json({ memory: result })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsed = await parseBody(request, memoryDeleteSchema)
  if (!parsed.ok) return parsed.response

  const success = await deleteMemory(session.user.email, parsed.data.id)
  return NextResponse.json({ deleted: success })
}
