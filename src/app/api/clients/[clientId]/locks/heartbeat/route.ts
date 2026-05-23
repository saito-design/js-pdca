import { NextRequest, NextResponse } from 'next/server'
import { getClientFolderId } from '@/lib/entity-helpers'
import { heartbeat, type LockResourceType } from '@/lib/lock'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const folderId = await getClientFolderId(clientId)
  if (!folderId) return NextResponse.json({ error: 'client not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const { resourceType, resourceId, name } = body as {
    resourceType: LockResourceType
    resourceId: string
    name: string
  }
  const lock = await heartbeat(folderId, resourceType, resourceId, name)
  if (!lock) return NextResponse.json({ ok: false }, { status: 410 })
  return NextResponse.json({ ok: true, lock })
}
