'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock as LockIcon, Unlock, Pencil, AlertTriangle } from 'lucide-react'

export type LockResourceType = 'cycle' | 'new-task'

interface Lock {
  id: string
  resourceType: LockResourceType
  resourceId: string
  name: string
  startedAt: string
  lastBeat: string
}

interface Props {
  clientId: string
  resourceType: LockResourceType
  resourceId: string
  userName: string // セッションユーザー名（authトークンから）
  label?: string // 「PDCAサイクル」「タスク追加」など説明
  onLockedChange?: (locked: boolean) => void // 自分が編集中かどうかを親に伝える
}

// 5分自動解放 + 60秒ハートビート + 10秒ポーリング
export function EditingLock({
  clientId,
  resourceType,
  resourceId,
  userName,
  label = '編集',
  onLockedChange,
}: Props) {
  const [lock, setLock] = useState<Lock | null>(null)
  const [busy, setBusy] = useState(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isMine = lock?.name === userName
  const isLockedByOther = !!lock && !isMine

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/locks`, { cache: 'no-store' })
      const json = await res.json()
      const found = (json.locks || []).find(
        (l: Lock) => l.resourceType === resourceType && l.resourceId === resourceId
      )
      setLock(found || null)
    } catch {}
  }, [clientId, resourceType, resourceId])

  // 初回 + ポーリング（10秒）
  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refresh])

  // ハートビート（自分が編集中なら60秒毎）
  useEffect(() => {
    onLockedChange?.(!!isMine)
    if (!isMine) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      return
    }
    heartbeatRef.current = setInterval(() => {
      fetch(`/api/clients/${clientId}/locks/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, resourceId, name: userName }),
      }).catch(() => undefined)
    }, 60_000)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [isMine, clientId, resourceType, resourceId, userName, onLockedChange])

  // タブ閉じ・離脱時に解放
  useEffect(() => {
    function onUnload() {
      if (!isMine) return
      const url = `/api/clients/${clientId}/locks?resourceType=${resourceType}&resourceId=${resourceId}&name=${encodeURIComponent(userName)}`
      navigator.sendBeacon?.(url, new Blob([], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [isMine, clientId, resourceType, resourceId, userName])

  async function acquire() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, resourceId, name: userName }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setLock(json.lock)
        alert(`${json.lock.name} さんが編集中です`)
      } else if (json.lock) {
        setLock(json.lock)
      }
    } finally {
      setBusy(false)
    }
  }

  async function release(force = false) {
    if (busy) return
    setBusy(true)
    try {
      const url = `/api/clients/${clientId}/locks?resourceType=${resourceType}&resourceId=${resourceId}&name=${encodeURIComponent(userName)}${force ? '&force=1' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) setLock(null)
    } finally {
      setBusy(false)
    }
  }

  // 表示
  if (isLockedByOther) {
    const since = new Date(lock!.startedAt)
    const sinceStr = `${since.getHours()}:${String(since.getMinutes()).padStart(2, '0')}〜`
    return (
      <div className="bg-amber-50 border border-amber-300 rounded p-3 flex items-center gap-2 text-sm">
        <LockIcon size={14} className="text-amber-700 shrink-0" />
        <span className="text-amber-900 flex-1">
          <strong>{lock!.name}</strong> さんが {sinceStr} から{label}中。閲覧のみ可能
        </span>
        <button
          onClick={() => {
            if (confirm(`${lock!.name} さんのロックを強制解放しますか？\n（編集内容が失われる可能性があります）`)) {
              release(true)
            }
          }}
          className="text-xs text-red-700 hover:underline flex items-center gap-0.5"
          title="強制解放"
        >
          <AlertTriangle size={11} />
          強制解放
        </button>
      </div>
    )
  }

  if (isMine) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded p-3 flex items-center gap-2 text-sm">
        <Pencil size={14} className="text-emerald-700 shrink-0" />
        <span className="text-emerald-900 flex-1">あなたが{label}中（5分間で自動解放）</span>
        <button
          onClick={() => release()}
          disabled={busy}
          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded flex items-center gap-1"
        >
          <Unlock size={11} />
          {busy ? '解放中…' : '記入終わり'}
        </button>
      </div>
    )
  }

  // 空き
  return (
    <div className="bg-stone-50 border border-stone-200 rounded p-3 flex items-center gap-2 text-sm">
      <span className="text-stone-600 flex-1">{label}できます</span>
      <button
        onClick={acquire}
        disabled={busy}
        className="text-xs px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1"
      >
        <Pencil size={11} />
        {busy ? '取得中…' : '📝 記入する'}
      </button>
    </div>
  )
}
