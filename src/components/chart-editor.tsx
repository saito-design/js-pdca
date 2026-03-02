'use client'

import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import type { ChartConfig, SeriesConfig, LineStyle, ChartType } from '@/lib/types'
import { COLOR_PALETTE } from './chart-renderer'

interface ChartEditorProps {
  chart: ChartConfig
  onSave: (chart: ChartConfig) => void
  onClose: () => void
}

export function ChartEditor({ chart, onSave, onClose }: ChartEditorProps) {
  const [title, setTitle] = useState(chart.title)
  const [seriesConfig, setSeriesConfig] = useState<SeriesConfig[]>(() => {
    // 既存のseriesConfigをマージ
    const existingMap = new Map<string, SeriesConfig>()
    for (const sc of chart.seriesConfig || []) {
      existingMap.set(sc.key, sc)
    }

    // seriesKeysの各キーに対してconfigを作成
    return chart.seriesKeys.map((key, idx) => {
      const existing = existingMap.get(key)
      return {
        key,
        chartType: existing?.chartType || chart.type || 'bar',
        lineStyle: existing?.lineStyle || 'solid',
        opacity: existing?.opacity ?? 1,
        color: existing?.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
        strokeWidth: existing?.strokeWidth || 2,
        yAxisId: existing?.yAxisId || 'left',
        hidden: existing?.hidden || false,
      }
    })
  })

  const updateSeries = (key: string, updates: Partial<SeriesConfig>) => {
    setSeriesConfig(prev =>
      prev.map(sc => sc.key === key ? { ...sc, ...updates } : sc)
    )
  }

  const handleSave = () => {
    onSave({
      ...chart,
      title,
      seriesConfig,
    })
  }

  // 系列名から表示名を取得（区分も表示）
  const getSeriesLabel = (key: string) => {
    // カラム名から指標名と区分を分離して表示
    const match = key.match(/^(.+)（([^）]+)）$/)
    if (match) {
      return (
        <>
          {match[1]}
          <span className="text-xs text-gray-500 ml-1">({match[2]})</span>
        </>
      )
    }
    return key
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">詳細設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              グラフタイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 系列設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              系列ごとの設定
            </label>
            <div className="space-y-2">
              {seriesConfig.map((sc) => {
                const currentColor = sc.color || COLOR_PALETTE[0]
                return (
                  <div
                    key={sc.key}
                    className={`flex flex-wrap items-center gap-2 border rounded-lg p-2 ${sc.hidden ? 'bg-gray-200 opacity-60' : 'bg-gray-50'}`}
                  >
                    {/* 表示/非表示トグル */}
                    <button
                      onClick={() => updateSeries(sc.key, { hidden: !sc.hidden })}
                      className={`p-1 rounded ${sc.hidden ? 'text-gray-400' : 'text-blue-600'}`}
                      title={sc.hidden ? '表示する' : '非表示にする'}
                    >
                      {sc.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>

                    {/* 系列名 */}
                    <span className={`text-sm font-medium min-w-24 ${sc.hidden ? 'line-through' : ''}`} style={{ color: sc.hidden ? '#9ca3af' : currentColor }}>
                      {getSeriesLabel(sc.key)}
                    </span>

                    {/* チャートタイプ */}
                    <select
                      className="border rounded px-1.5 py-0.5 text-xs bg-white"
                      value={sc.chartType}
                      onChange={(e) => updateSeries(sc.key, { chartType: e.target.value as ChartType })}
                    >
                      <option value="bar">棒</option>
                      <option value="line">線</option>
                    </select>

                    {/* 線スタイル（線グラフのみ） */}
                    {sc.chartType === 'line' && (
                      <select
                        className="border rounded px-1.5 py-0.5 text-xs bg-white"
                        value={sc.lineStyle || 'solid'}
                        onChange={(e) => updateSeries(sc.key, { lineStyle: e.target.value as LineStyle })}
                      >
                        <option value="solid">実線</option>
                        <option value="dashed">破線</option>
                        <option value="dotted">点線</option>
                      </select>
                    )}

                    {/* 線の太さ（線グラフのみ） */}
                    {sc.chartType === 'line' && (
                      <select
                        className="border rounded px-1.5 py-0.5 text-xs bg-white"
                        value={sc.strokeWidth || 2}
                        onChange={(e) => updateSeries(sc.key, { strokeWidth: Number(e.target.value) })}
                      >
                        <option value={1}>細い</option>
                        <option value={2}>普通</option>
                        <option value={3}>太め</option>
                        <option value={4}>太い</option>
                      </select>
                    )}

                    {/* 色 */}
                    <input
                      type="color"
                      className="w-6 h-6 border rounded cursor-pointer"
                      value={currentColor}
                      onChange={(e) => updateSeries(sc.key, { color: e.target.value })}
                      title="色を選択"
                    />

                    {/* 透明度 */}
                    <select
                      className="border rounded px-1.5 py-0.5 text-xs bg-white"
                      value={sc.opacity ?? 1}
                      onChange={(e) => updateSeries(sc.key, { opacity: Number(e.target.value) })}
                    >
                      <option value={1}>100%</option>
                      <option value={0.7}>70%</option>
                      <option value={0.5}>50%</option>
                      <option value={0.3}>30%</option>
                    </select>

                    {/* 第2軸 */}
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={sc.yAxisId === 'right'}
                        onChange={(e) => updateSeries(sc.key, { yAxisId: e.target.checked ? 'right' : 'left' })}
                        className="rounded"
                      />
                      第2軸
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
