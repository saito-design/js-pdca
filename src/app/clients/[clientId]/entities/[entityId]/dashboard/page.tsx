'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, LogOut, Save, Settings2, X } from 'lucide-react'
import type { SessionData, Client, Entity, PdcaCycle, Task, PdcaStatus } from '@/lib/types'
import type { FieldLabels } from '@/lib/types'
import { DEFAULT_FIELD_LABELS } from '@/lib/types'
import { PdcaEditor } from '@/components/pdca-editor'
import { MeetingHistory } from '@/components/meeting-history'
import { ReportExportButton } from '@/components/report-export-button'
import { TaskManager } from '@/components/task-manager'

type PageProps = {
  params: Promise<{ clientId: string; entityId: string }>
}

export default function DashboardPage({ params }: PageProps) {
  const { clientId, entityId } = use(params)
  const router = useRouter()

  const [user, setUser] = useState<SessionData | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [entity, setEntity] = useState<Entity | null>(null)
  const [cycles, setCycles] = useState<PdcaCycle[]>([])
  const [cyclesLoading, setCyclesLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [pendingTaskChanges, setPendingTaskChanges] = useState<Map<string, PdcaStatus>>(new Map())
  const [savingTasks, setSavingTasks] = useState(false)
  const [loading, setLoading] = useState(true)

  // ラベル編集
  const [fieldLabels, setFieldLabels] = useState<FieldLabels>(DEFAULT_FIELD_LABELS)
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [editingLabels, setEditingLabels] = useState<FieldLabels>(DEFAULT_FIELD_LABELS)
  const [savingLabels, setSavingLabels] = useState(false)

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // セッション確認
        const meRes = await fetch('/api/auth/me')
        const meData = await meRes.json()
        if (!meData.success || !meData.data?.isLoggedIn) {
          router.push('/')
          return
        }
        setUser(meData.data)

        // 企業情報
        const clientsRes = await fetch('/api/clients')
        const clientsData = await clientsRes.json()
        if (clientsData.success) {
          setClient(clientsData.data.find((c: Client) => c.id === clientId) || null)
        }

        // 部署/店舗情報
        const entitiesRes = await fetch(`/api/clients/${clientId}/entities`)
        const entitiesData = await entitiesRes.json()
        if (entitiesData.success) {
          setEntity(entitiesData.data.find((e: Entity) => e.id === entityId) || null)
        }

        // ラベル設定を取得
        try {
          const settingsRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/settings`)
          const settingsData = await settingsRes.json()
          if (settingsData.success && settingsData.data?.fieldLabels) {
            setFieldLabels(settingsData.data.fieldLabels)
            setEditingLabels(settingsData.data.fieldLabels)
          }
        } catch {
          // 設定がなければデフォルトを使用
        }

        // サイクル履歴を取得（entity_idでフィルタ）
        setCyclesLoading(true)
        try {
          const cyclesRes = await fetch(
            `/api/clients/${clientId}/entities/${entityId}/cycles`
          )
          const cyclesData = await cyclesRes.json()
          if (cyclesData.success) {
            setCycles(cyclesData.data)
          }
        } catch {
          // デモモードではエラーを無視
        } finally {
          setCyclesLoading(false)
        }

        // タスク一覧を取得（部署別）
        setTasksLoading(true)
        try {
          const tasksRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/tasks`)
          const tasksData = await tasksRes.json()
          if (tasksData.success) {
            setTasks(tasksData.data)
          }
        } catch {
          // エラーを無視
        } finally {
          setTasksLoading(false)
        }
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, clientId, entityId])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const handleBack = () => {
    router.push(`/clients/${clientId}`)
  }

  const handleSavePdca = async (data: { situation: string; issue: string; action: string; target: string }) => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/entities/${entityId}/pdca/tasks/task-1/cycles`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cycle_date: new Date().toISOString().split('T')[0],
            situation: data.situation,
            issue: data.issue,
            action: data.action,
            target: data.target,
            status: 'open',
          }),
        }
      )
      const result = await res.json()
      if (result.success) {
        // 保存成功 - サイクル一覧を再取得
        const cyclesRes = await fetch(
          `/api/clients/${clientId}/entities/${entityId}/cycles`
        )
        const cyclesData = await cyclesRes.json()
        if (cyclesData.success) {
          setCycles(cyclesData.data)
        }
        // タスク一覧も再取得（API側で【】からタスクが自動追加されるため）
        const tasksRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/tasks`)
        const tasksData = await tasksRes.json()
        if (tasksData.success) {
          setTasks(tasksData.data)
        }
        alert('保存しました')
      } else {
        alert('保存に失敗しました: ' + result.error)
      }
    } catch (error) {
      console.error('Save PDCA error:', error)
      alert('保存に失敗しました')
    }
  }

  // サイクル更新（過去の履歴を編集）
  const handleUpdateCycle = async (cycle: PdcaCycle) => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/entities/${entityId}/pdca/tasks/task-1/cycles`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: cycle.id,
            situation: cycle.situation,
            issue: cycle.issue,
            action: cycle.action,
            target: cycle.target,
            status: cycle.status,
          }),
        }
      )
      const result = await res.json()
      if (result.success) {
        setCycles(prev => prev.map(c => c.id === cycle.id ? result.data : c))
        // タスク一覧も再取得（API側で【】からタスクが自動追加されるため）
        const tasksRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/tasks`)
        const tasksData = await tasksRes.json()
        if (tasksData.success) {
          setTasks(tasksData.data)
        }
      } else {
        alert('更新に失敗しました: ' + result.error)
      }
    } catch (error) {
      console.error('Update cycle error:', error)
      alert('更新に失敗しました')
    }
  }

  // サイクル削除
  const handleDeleteCycle = async (cycleId: string) => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/entities/${entityId}/cycles`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cycleId }),
        }
      )
      const result = await res.json()
      if (result.success) {
        setCycles(prev => prev.filter(c => c.id !== cycleId))
      } else {
        alert('削除に失敗しました: ' + result.error)
      }
    } catch (error) {
      console.error('Delete cycle error:', error)
      alert('削除に失敗しました')
    }
  }

  // タスクステータス変更（ローカルのみ、保存ボタンで反映）
  const handleTaskStatusChange = useCallback((taskId: string, newStatus: PdcaStatus) => {
    setPendingTaskChanges(prev => {
      const next = new Map(prev)
      next.set(taskId, newStatus)
      return next
    })
    // UIに即座に反映（ただしまだ保存されていない）
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }, [])

  // タスク変更を保存
  const handleSaveTaskChanges = async () => {
    if (pendingTaskChanges.size === 0) return

    setSavingTasks(true)
    try {
      const promises = Array.from(pendingTaskChanges.entries()).map(([taskId, newStatus]) =>
        fetch(`/api/clients/${clientId}/entities/${entityId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }).then(res => res.json())
      )

      const results = await Promise.all(promises)
      const allSuccess = results.every(r => r.success)

      if (allSuccess) {
        setPendingTaskChanges(new Map())
        // タスク一覧を再取得
        const tasksRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/tasks`)
        const tasksData = await tasksRes.json()
        if (tasksData.success) {
          setTasks(tasksData.data)
        }
      } else {
        alert('一部のタスク更新に失敗しました')
      }
    } catch (error) {
      console.error('Save task changes error:', error)
      alert('タスク保存に失敗しました')
    } finally {
      setSavingTasks(false)
    }
  }

  // ラベル保存
  const handleSaveLabels = async () => {
    setSavingLabels(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/entities/${entityId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabels: editingLabels }),
      })
      const result = await res.json()
      if (result.success) {
        setFieldLabels(editingLabels)
        setShowLabelEditor(false)
      } else {
        alert('ラベルの保存に失敗しました')
      }
    } catch {
      alert('ラベルの保存に失敗しました')
    } finally {
      setSavingLabels(false)
    }
  }

  const handleResetLabels = () => {
    setEditingLabels(DEFAULT_FIELD_LABELS)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft size={16} />
              戻る
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-base text-gray-600">{client?.name}</h1>
              <span className="text-xl font-bold">{entity?.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ReportExportButton clientId={clientId} entityId={entityId} />
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 進行中タスク */}
        {(tasks.filter(t => t.status === 'doing').length > 0 || pendingTaskChanges.size > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-700 font-semibold">
                <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs rounded-full">
                  {tasks.filter(t => t.status === 'doing').length}
                </span>
                進行中のタスク
              </div>
              {pendingTaskChanges.size > 0 && (
                <button
                  onClick={handleSaveTaskChanges}
                  disabled={savingTasks}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingTasks ? '保存中...' : `保存 (${pendingTaskChanges.size}件の変更)`}
                </button>
              )}
            </div>
            {tasks.filter(t => t.status === 'doing').length > 0 ? (
              <div className="space-y-1">
                {tasks
                  .filter(t => t.status === 'doing')
                  .map(task => (
                    <div key={task.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                      <span>{task.title}</span>
                      <button
                        onClick={() => handleTaskStatusChange(task.id, 'done')}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                      >
                        完了
                      </button>
                    </div>
                  ))
                }
              </div>
            ) : (
              <div className="text-sm text-blue-600">
                進行中のタスクはありません
              </div>
            )}
          </div>
        )}

        {/* ミーティングメモセクション */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              setEditingLabels(fieldLabels)
              setShowLabelEditor(true)
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            title="ラベル設定"
          >
            <Settings2 size={14} />
            ラベル設定
          </button>
        </div>

        <PdcaEditor
          onSave={handleSavePdca}
          storageKey={`pdca-draft-${clientId}-${entityId}`}
          fieldLabels={fieldLabels}
        />

        {/* 過去のミーティング履歴 */}
        <MeetingHistory
          cycles={cycles}
          loading={cyclesLoading}
          onUpdateCycle={handleUpdateCycle}
          onDeleteCycle={handleDeleteCycle}
          fieldLabels={fieldLabels}
        />

        {/* タスク管理 */}
        <TaskManager
          tasks={tasks}
          onStatusChange={handleTaskStatusChange}
          loading={tasksLoading}
        />
      </main>

      {/* ラベル編集モーダル */}
      {showLabelEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">ラベル設定</h3>
              <button onClick={() => setShowLabelEditor(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">ミーティングメモの4つのタイトルを変更できます</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-blue-600 mb-1 block">現状ラベル</label>
                <input
                  type="text"
                  value={editingLabels.situation}
                  onChange={(e) => setEditingLabels(prev => ({ ...prev, situation: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder={DEFAULT_FIELD_LABELS.situation}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-orange-600 mb-1 block">課題ラベル</label>
                <input
                  type="text"
                  value={editingLabels.issue}
                  onChange={(e) => setEditingLabels(prev => ({ ...prev, issue: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder={DEFAULT_FIELD_LABELS.issue}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-green-600 mb-1 block">アクションラベル</label>
                <input
                  type="text"
                  value={editingLabels.action}
                  onChange={(e) => setEditingLabels(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder={DEFAULT_FIELD_LABELS.action}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-600 mb-1 block">目標ラベル</label>
                <input
                  type="text"
                  value={editingLabels.target}
                  onChange={(e) => setEditingLabels(prev => ({ ...prev, target: e.target.value }))}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder={DEFAULT_FIELD_LABELS.target}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleResetLabels}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                デフォルトに戻す
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLabelEditor(false)}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveLabels}
                  disabled={savingLabels}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingLabels ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
