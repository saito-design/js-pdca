// 編集ロック（「ペンを回す」方式）の Drive ベース実装
// locks.json を各クライアントフォルダに置き、リソース単位に1人だけ編集権を持つ。
import { loadJsonFromFolder, saveJsonToFolder } from '@/lib/drive'

const LOCK_FILE = 'locks.json'
export const LOCK_TTL_MS = 5 * 60 * 1000 // 5分自動解放

export type LockResourceType = 'cycle' | 'new-task'

export interface Lock {
  id: string
  resourceType: LockResourceType
  resourceId: string // cycle id or entity id（タスク新規追加用）
  name: string // 編集者名
  startedAt: string // ISO
  lastBeat: string // ISO
}

interface LocksFile {
  locks: Lock[]
}

function key(type: LockResourceType, resourceId: string) {
  return `${type}::${resourceId}`
}

async function loadLocks(clientFolderId: string): Promise<Lock[]> {
  const f = await loadJsonFromFolder<LocksFile>(LOCK_FILE, clientFolderId)
  const data = f?.data
  if (!data || !Array.isArray(data.locks)) return []
  return data.locks
}

async function saveLocks(clientFolderId: string, locks: Lock[]): Promise<void> {
  await saveJsonToFolder<LocksFile>({ locks }, LOCK_FILE, clientFolderId)
}

// 期限切れ自動解放
function pruneExpired(locks: Lock[]): Lock[] {
  const now = Date.now()
  return locks.filter((l) => now - Date.parse(l.lastBeat) < LOCK_TTL_MS)
}

export async function listLocks(clientFolderId: string): Promise<Lock[]> {
  const raw = await loadLocks(clientFolderId)
  const live = pruneExpired(raw)
  if (live.length !== raw.length) await saveLocks(clientFolderId, live)
  return live
}

export async function acquireLock(
  clientFolderId: string,
  resourceType: LockResourceType,
  resourceId: string,
  name: string
): Promise<{ ok: true; lock: Lock } | { ok: false; lock: Lock }> {
  const live = pruneExpired(await loadLocks(clientFolderId))
  const k = key(resourceType, resourceId)
  const existing = live.find((l) => key(l.resourceType, l.resourceId) === k)
  if (existing && existing.name !== name) {
    return { ok: false, lock: existing }
  }
  const now = new Date().toISOString()
  const lock: Lock = existing
    ? { ...existing, lastBeat: now }
    : {
        id: `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        resourceType,
        resourceId,
        name,
        startedAt: now,
        lastBeat: now,
      }
  const next = live.filter((l) => key(l.resourceType, l.resourceId) !== k).concat(lock)
  await saveLocks(clientFolderId, next)
  return { ok: true, lock }
}

export async function heartbeat(
  clientFolderId: string,
  resourceType: LockResourceType,
  resourceId: string,
  name: string
): Promise<Lock | null> {
  const live = pruneExpired(await loadLocks(clientFolderId))
  const k = key(resourceType, resourceId)
  const target = live.find(
    (l) => key(l.resourceType, l.resourceId) === k && l.name === name
  )
  if (!target) return null
  target.lastBeat = new Date().toISOString()
  await saveLocks(clientFolderId, live)
  return target
}

export async function releaseLock(
  clientFolderId: string,
  resourceType: LockResourceType,
  resourceId: string,
  name: string,
  force = false
): Promise<boolean> {
  const live = pruneExpired(await loadLocks(clientFolderId))
  const k = key(resourceType, resourceId)
  const target = live.find((l) => key(l.resourceType, l.resourceId) === k)
  if (!target) return true // 既に空き
  if (!force && target.name !== name) return false
  const next = live.filter((l) => key(l.resourceType, l.resourceId) !== k)
  await saveLocks(clientFolderId, next)
  return true
}
