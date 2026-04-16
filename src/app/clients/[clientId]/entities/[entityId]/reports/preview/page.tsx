'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, ArrowLeft, Mail, Save } from 'lucide-react'
import type { Client, Entity, Task, PdcaStatus, PdcaCycle, FieldLabels } from '@/lib/types'
import { DEFAULT_FIELD_LABELS } from '@/lib/types'

type PageProps = {
  params: Promise<{ clientId: string; entityId: string }>
}

const STATUS_LABELS: Record<PdcaStatus, string> = {
  open: '未着手',
  doing: '進行中',
  done: '完了',
  paused: '保留',
}

export default function EntityReportPreviewPage({ params }: PageProps) {
  const { clientId, entityId } = use(params)
  const router = useRouter()

  const [client, setClient] = useState<Client | null>(null)
  const [entity, setEntity] = useState<Entity | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [latestCycle, setLatestCycle] = useState<PdcaCycle | null>(null)
  const [fieldLabels, setFieldLabels] = useState<FieldLabels>(DEFAULT_FIELD_LABELS)
  const [loading, setLoading] = useState(true)

  // 保存中状態
  const [saving, setSaving] = useState(false)
  // 自動処理フラグ
  const [autoProcess, setAutoProcess] = useState(false)

  // メール作成
  const openEmailClient = useCallback(() => {
    const subject = encodeURIComponent('ミーティングメモを送ります')
    const body = encodeURIComponent(
      `\nお世話になっております。\n先日のミーティングメモを送ります。\nご査収くださいませ。\n\n（今回導入したツールで作成していますので、稀々ではありますがご容赦ください）\n`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }, [])

  // ドライブ保存
  const saveToDrive = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/clients/${clientId}/entities/${entityId}/reports/save-pdf`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      const data = await res.json()
      return data.success
    } catch (error) {
      console.error('Save error:', error)
      return false
    } finally {
      setSaving(false)
    }
  }, [clientId, entityId])

  // 印刷後の自動処理
  useEffect(() => {
    const handleAfterPrint = async () => {
      if (autoProcess) {
        setAutoProcess(false)
        await saveToDrive()
        openEmailClient()
      }
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [autoProcess, saveToDrive, openEmailClient])

  // PDF保存→Drive保存→メール（印刷ダイアログ経由）
  const handlePdfAndProcess = useCallback(() => {
    setAutoProcess(true)
    window.print()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 認証確認
        const meRes = await fetch('/api/auth/me')
        const meData = await meRes.json()
        if (!meData.success || !meData.data?.isLoggedIn) {
          router.push('/')
          return
        }

        // 企業情報
        const clientsRes = await fetch('/api/clients')
        const clientsData = await clientsRes.json()
        if (clientsData.success) {
          setClient(clientsData.data.find((c: Client) => c.id === clientId) || null)
        }

        // 部署情報
        const entitiesRes = await fetch(`/api/clients/${clientId}/entities`)
        const entitiesData = await entitiesRes.json()
        if (entitiesData.success) {
          setEntity(entitiesData.data.find((e: Entity) => e.id === entityId) || null)
        }

        // ラベル設定
        try {
          const settingsRes = await fetch(`/api/clients/${clientId}/entities/${entityId}/settings`)
          const settingsData = await settingsRes.json()
          if (settingsData.success && settingsData.data?.fieldLabels) {
            setFieldLabels(settingsData.data.fieldLabels)
          }
        } catch {
          // デフォルトを使用
        }

        // まとめJSONから全タスク・全サイクルを一括取得
        const [allTasksRes, allCyclesRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/all-tasks`),
          fetch(`/api/clients/${clientId}/all-cycles`),
        ])

        const allTasksData = await allTasksRes.json()
        const allCyclesData = await allCyclesRes.json()

        if (allTasksData.success) {
          setTasks(allTasksData.data)
        }

        // 該当部署の最新サイクルを抽出
        if (allCyclesData.success) {
          const entityCycles = allCyclesData.data.filter(
            (c: PdcaCycle) => c.entity_id === entityId
          )
          if (entityCycles.length > 0) {
            const sorted = [...entityCycles].sort(
              (a: PdcaCycle, b: PdcaCycle) => {
                const dateDiff = new Date(b.cycle_date).getTime() - new Date(a.cycle_date).getTime()
                if (dateDiff !== 0) return dateDiff
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              }
            )
            setLatestCycle(sorted[0])
          }
        }
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, clientId, entityId])

  const handleBack = () => {
    router.push(`/clients/${clientId}/entities/${entityId}/dashboard`)
  }

  // この部署の完了以外のタスク（doing最上位）
  const entityTasks = tasks
    .filter(t => t.entity_name === entity?.name && t.status !== 'done')
    .sort((a, b) => {
      if (a.status === 'doing' && b.status !== 'doing') return -1
      if (a.status !== 'doing' && b.status === 'doing') return 1
      return 0
    })

  const hasContent = entityTasks.length > 0 || !!latestCycle

  // 日付フォーマット
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      {/* 印刷時に非表示のコントロール */}
      <div className="print:hidden bg-gray-100 p-4 flex items-center justify-between sticky top-0 z-10 border-b">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={20} />
          戻る
        </button>

        <div className="flex items-center gap-2">
          {/* メール作成のみ */}
          <button
            onClick={openEmailClient}
            className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            <Mail size={20} />
            メールのみ
          </button>

          {/* PDF保存→Drive保存→メール（一括処理） */}
          <button
            onClick={handlePdfAndProcess}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileDown size={20} />
            <Save size={16} />
            <Mail size={16} />
            {saving ? '保存中...' : 'PDF → 保存 → メール'}
          </button>
        </div>
      </div>

      {/* レポート本体 */}
      <div className="bg-gray-100 min-h-screen print:bg-white print:min-h-0">
        <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none">
          {/* A4用紙スタイル */}
          <div className="p-[20mm] print:p-[15mm]" style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>

            {/* ヘッダー */}
            <div className="mb-8">
              <div className="text-lg">
                {client?.name} 様
              </div>
              {entity && (
                <div className="text-lg">
                  {entity.name} 御中
                </div>
              )}
              <div className="text-right text-sm text-gray-600 mt-4">
                {formatDate(new Date())}
              </div>
            </div>

            {/* タイトル */}
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold border-b-2 border-t-2 border-gray-800 py-3 inline-block px-8">
                ミーティングメモ
              </h1>
            </div>

            {/* 部署セクション */}
            {hasContent && entity && (
              <section className="mb-8 pb-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-green-600 inline-block"></span>
                  {entity.name}
                </h2>

                {/* 今回の議題（PDCAサイクル）を箇条書きで表示 */}
                {latestCycle && (latestCycle.situation || latestCycle.issue || latestCycle.action || latestCycle.target) && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      ミーティング内容 ({latestCycle.cycle_date})
                    </h3>
                    <ul className="space-y-1 text-sm text-gray-700 ml-4">
                      {latestCycle.situation && (
                        <li className="flex">
                          <span className="font-semibold text-blue-700 w-28 shrink-0">{fieldLabels.situation}:</span>
                          <span className="whitespace-pre-wrap">{latestCycle.situation}</span>
                        </li>
                      )}
                      {latestCycle.issue && (
                        <li className="flex">
                          <span className="font-semibold text-orange-600 w-28 shrink-0">{fieldLabels.issue}:</span>
                          <span className="whitespace-pre-wrap">{latestCycle.issue}</span>
                        </li>
                      )}
                      {latestCycle.action && (
                        <li className="flex">
                          <span className="font-semibold text-green-700 w-28 shrink-0">{fieldLabels.action}:</span>
                          <span className="whitespace-pre-wrap">{latestCycle.action}</span>
                        </li>
                      )}
                      {latestCycle.target && (
                        <li className="flex">
                          <span className="font-semibold text-purple-700 w-28 shrink-0">{fieldLabels.target}:</span>
                          <span className="whitespace-pre-wrap">{latestCycle.target}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* 進行中タスク */}
                {entityTasks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      進行中タスク ({entityTasks.length}件)
                    </h3>
                    <ul className="space-y-1 text-sm text-gray-700 ml-4">
                      {entityTasks.map(task => (
                        <li key={task.id} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            task.status === 'doing' ? 'bg-blue-500' :
                            task.status === 'open' ? 'bg-gray-400' :
                            task.status === 'paused' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></span>
                          <span>{task.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            task.status === 'doing' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'open' ? 'bg-gray-100 text-gray-600' :
                            task.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* データがない場合 */}
            {!hasContent && (
              <div className="text-center text-gray-500 py-10">
                出力するデータがありません
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 印刷用CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  )
}
