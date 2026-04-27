'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Save, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react'
import { extractTaskStrings } from '@/lib/task-utils'
import type { FieldLabels } from '@/lib/types'
import { DEFAULT_FIELD_LABELS } from '@/lib/types'

interface PdcaData {
  situation: string
  issue: string
  action: string
  target: string
  customValues?: Record<string, string>
}

interface PdcaEditorProps {
  issueTitle?: string
  initialData?: PdcaData
  onSave?: (data: PdcaData) => void
  storageKey?: string // localStorage用のキー
  fieldLabels?: FieldLabels
}

const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  situation: '目標（またはタスク）に対する進捗と、実施したこと',
  issue: '目標（またはタスク）に対する未実施内容および、今後実施する必要があること',
  action: '具体的な施策を記入...\n【タスク名】と書くとタスク一覧に表示されます',
  target: '数値など具体的な目標および期間',
}

const FIELD_ROWS: Record<string, number> = {
  situation: 2,
  issue: 2,
  action: 4,
  target: 2,
}

const EMPTY_DATA: PdcaData = { situation: '', issue: '', action: '', target: '', customValues: {} }

export function PdcaEditor({ issueTitle, initialData, onSave, storageKey, fieldLabels }: PdcaEditorProps) {
  const localStorageKey = storageKey || 'pdca-draft'

  // localStorageから下書きを読み込む
  const loadDraft = useCallback((): PdcaData => {
    if (typeof window === 'undefined') {
      return initialData || EMPTY_DATA
    }
    try {
      const saved = localStorage.getItem(localStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 保存から24時間以内の下書きのみ復元
        if (parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
          return parsed.data
        }
      }
    } catch {
      // 無視
    }
    return initialData || EMPTY_DATA
  }, [initialData, localStorageKey])

  const [data, setData] = useState<PdcaData>(loadDraft)
  const [expanded, setExpanded] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // 初回マウント時に下書きを読み込む
  useEffect(() => {
    const draft = loadDraft()
    if (draft.situation || draft.issue || draft.action || draft.target ||
      (draft.customValues && Object.values(draft.customValues).some(v => v))) {
      setData(draft)
    }
  }, [loadDraft])

  // 入力変更時に自動で下書き保存（デバウンス）
  useEffect(() => {
    const hasContent = data.situation || data.issue || data.action || data.target ||
      (data.customValues && Object.values(data.customValues).some(v => v))
    if (!hasContent) return

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(localStorageKey, JSON.stringify({
          data,
          savedAt: Date.now(),
        }))
        setLastSaved(new Date())
      } catch {
        // localStorage容量オーバー等は無視
      }
    }, 1000) // 1秒後に保存

    return () => clearTimeout(timer)
  }, [data, localStorageKey])

  // アクション欄からタスクを抽出
  const tasks = useMemo(() => extractTaskStrings(data.action), [data.action])

  const labels = fieldLabels || DEFAULT_FIELD_LABELS
  const customFields = labels.customFields || []

  const baseFields = useMemo(() => [
    { key: 'situation' as const, label: labels.situation, placeholder: DEFAULT_PLACEHOLDERS.situation, rows: FIELD_ROWS.situation },
    { key: 'issue' as const, label: labels.issue, placeholder: DEFAULT_PLACEHOLDERS.issue, rows: FIELD_ROWS.issue },
    { key: 'action' as const, label: labels.action, placeholder: DEFAULT_PLACEHOLDERS.action, rows: FIELD_ROWS.action },
    { key: 'target' as const, label: labels.target, placeholder: DEFAULT_PLACEHOLDERS.target, rows: FIELD_ROWS.target },
  ], [labels])

  const handleChange = (key: string, value: string) => {
    if (['situation', 'issue', 'action', 'target'].includes(key)) {
      setData(prev => ({ ...prev, [key]: value }))
    } else {
      setData(prev => ({
        ...prev,
        customValues: { ...(prev.customValues || {}), [key]: value },
      }))
    }
  }

  // 下書きをクリア
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(localStorageKey)
    } catch {
      // 無視
    }
  }, [localStorageKey])

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(data)
      // 保存成功したら下書きをクリア
      clearDraft()
      // フォームをリセット
      setData({ ...EMPTY_DATA })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-bold">{issueTitle || 'ミーティングメモ'}</div>
          <div className="text-xs text-gray-500">会議中に入力</div>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* 基本4項目 */}
          {baseFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                style={{ minHeight: `${field.rows * 1.5 + 1.5}rem` }}
                placeholder={field.placeholder}
                value={data[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
            </div>
          ))}

          {/* カスタム項目 */}
          {customFields.map((cf) => (
            <div key={cf.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {cf.label}
              </label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                style={{ minHeight: '4.5rem' }}
                placeholder={`${cf.label}を記入...`}
                value={data.customValues?.[cf.key] || ''}
                onChange={(e) => handleChange(cf.key, e.target.value)}
              />
            </div>
          ))}

          {/* タスクサマリー */}
          {tasks.length > 0 && (
            <div className="rounded-xl border bg-blue-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">タスク一覧</span>
                <span className="text-xs text-blue-600">({tasks.length}件)</span>
              </div>
              <ul className="space-y-1">
                {tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Square size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? '保存中...' : '保存'}
            </button>
            {lastSaved && (
              <span className="text-xs text-gray-400 ml-2">
                下書き保存済み ({lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
