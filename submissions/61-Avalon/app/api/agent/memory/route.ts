import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMemories, storeMemory, deleteMemory } from '@/lib/memory'
import { MemoryCategory } from '@/types'

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

  const { category, key, value } = await request.json()
  if (!category || !key || !value) {
    return NextResponse.json({ error: 'category, key, and value are required' }, { status: 400 })
  }

  const result = await storeMemory(session.user.email, { category, key, value })
  return NextResponse.json({ memory: result })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: 'Memory id is required' }, { status: 400 })
  }

  const success = await deleteMemory(session.user.email, id)
  return NextResponse.json({ deleted: success })
}
