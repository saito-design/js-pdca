import { NextRequest, NextResponse } from 'next/server'
import { getClientFolderId } from '@/lib/entity-helpers'
import { acquireLock, listLocks, releaseLock, type LockResourceType } from '@/lib/lock'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const folderId = await getClientFolderId(clientId)
  if (!folderId) return NextResponse.json({ error: 'client not found' }, { status: 404 })
  const locks = await listLocks(folderId)
  return NextResponse.json({ locks })
}

// 取得（同じ人なら更新、他人ならconflict）
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
  if (!resourceType || !resourceId || !name) {
    return NextResponse.json({ error: 'resourceType/resourceId/name required' }, { status: 400 })
  }
  const r = await acquireLock(folderId, resourceType, resourceId, name)
  if (!r.ok) return NextResponse.json({ ok: false, lock: r.lock }, { status: 409 })
  return NextResponse.json({ ok: true, lock: r.lock })
}

// 解放
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const folderId = await getClientFolderId(clientId)
  if (!folderId) return NextResponse.json({ error: 'client not found' }, { status: 404 })
  const sp = req.nextUrl.searchParams
  const resourceType = sp.get('resourceType') as LockResourceType | null
  const resourceId = sp.get('resourceId')
  const name = sp.get('name') || ''
  const force = sp.get('force') === '1'
  if (!resourceType || !resourceId) {
    return NextResponse.json({ error: 'resourceType/resourceId required' }, { status: 400 })
  }
  const ok = await releaseLock(folderId, resourceType, resourceId, name, force)
  if (!ok) return NextResponse.json({ ok: false }, { status: 403 })
  return NextResponse.json({ ok: true })
}
