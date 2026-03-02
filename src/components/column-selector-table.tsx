'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Settings2, Check, Minus } from 'lucide-react'
import { getSelectedColumns, saveSelectedColumns, SelectedColumn } from '@/lib/column-storage'

interface ColumnInfo {
  name: string
  label?: string
  type: 'number' | 'string' | 'date' | 'unknown'
  unit?: string
  sampleValues: unknown[]
  isSystem?: boolean
  category?: string
}

interface ColumnSelectorTableProps {
  clientId: string
  entityId?: string
  onClose: () => void
  onSave: (columns: SelectedColumn[]) => void
}

// 区分の表示順序（16列）
const KUBUN_ORDER = [
  '実績', '実績平均', '実績累計',
  '前年', '前年平均', '前年累計',
  '計画', '計画平均', '計画累計',
  '前年比', '計画比',
  '売上比', '売上比累計', '前年売上比', '前年売上比累計', '計画売上比'  // PLの利益・費用のみ
]

// カテゴリの表示順序（統合 → PL → POS売上・効率等 → POS曜日別 → POS単品が最後）
const CATEGORY_ORDER_PREFIXES = ['統合_', 'PL_', 'POS_売上', 'POS_効率', 'POS_曜日別', 'POS_単品']

// PLの大項目順序（損益計算書の標準順序）
const PL_CATEGORY_ORDER = [
  'PL_売上高',
  'PL_売上原価',
  'PL_売上総利益',
  'PL_販管費',
  'PL_営業利益',
  'PL_営業外',
  'PL_経常利益',
  'PL_その他'
]

// PLの中項目順序（PDF/CSVの実際の順序に基づく）
const PL_ITEM_ORDER: Record<string, string[]> = {
  'PL_売上高': [
    '現金売上高', 'クレジット売上高', 'ポイント売上高', '電子マネー売上', '商品券売上高',
    '飲食店売上高合計', 'クローバー売上高', 'フランチャイズ料', '純売上高', '売上総合計'
  ],
  'PL_売上原価': [
    '期首棚卸高', '商品仕入高', '備品・厨房資材', '飲食店原価合計', '業務委託費',
    '仕入値引戻し高', '他勘定振替高', '期末棚卸高', '当期売上原価'
  ],
  'PL_売上総利益': [
    '売上総利益'
  ],
  'PL_販管費': [
    // 人件費
    '役員報酬', '給与手当', '残業手当', '店舗応援費', 'アルバイト給与', '従業員賞与',
    '直接人件費合計', '法定福利費', '厚生費', '社宅家賃', '間接人件費合計', '人件費合計',
    // 移動費
    '旅費交通費', '車両費', '燃料費', '移動費合計',
    // 設備費
    'リース料', '賃借料', '店内サービス費', '備品消耗品費', '事務用消耗品費',
    '少額減価償却資産', '水道光熱費', '通信費', '店舗家賃', '修繕費', '店舗開発費',
    '減価償却費', '設備費合計',
    // 交際費
    '接待交際費', '会議費', '諸会費', '寄付金', '交際関連費合計',
    // 経営戦略
    '広告宣伝費', '求人費', '図書研究費', '支払手数料', 'クレジットカード等手数料',
    '損害保険料', '生命保険料', '管理諸費', '調査研究費', '経営戦略経費合計',
    // その他
    '租税公課', '貸倒引当金繰入', '雑費', 'その他合計',
    '販売費及び一般管理費'
  ],
  'PL_営業利益': [
    '営業利益', '営業利益(損失)'
  ],
  'PL_営業外': [
    '受取利息', '貸倒引当金戻入益', '受取配当金', '雑収入', '営業外収益計',
    '支払利息', '手形売却損', '本社配賦固定費', '貸倒償却', '繰延資産償却', '雑損失', '営業外費用計'
  ],
  'PL_経常利益': [
    '経常利益', '経常利益(損失)', '共通原価配賦', '共通固定費配賦', '配賦後経常利益', '配賦後経常利益(損失'
  ],
  'PL_その他': []
}

// カラム名から中項目と区分を分解
function parseColumnName(name: string): { item: string; kubun: string } {
  // 「純売上高（前年）」→ { item: "純売上高", kubun: "前年" }
  // 「純売上高」→ { item: "純売上高", kubun: "実績" }
  const match = name.match(/^(.+?)（(.+?)）$/)
  if (match) {
    return { item: match[1], kubun: match[2] }
  }
  return { item: name, kubun: '実績' }
}

// カテゴリをソートするための優先度を取得
function getCategoryPriority(category: string): number {
  // 統合カテゴリが最優先
  if (category.startsWith('統合_')) {
    return -1
  }

  // PLカテゴリの完全一致を確認
  const plIndex = PL_CATEGORY_ORDER.indexOf(category)
  if (plIndex !== -1) {
    return plIndex
  }

  // PLカテゴリだが定義にないもの
  if (category.startsWith('PL_')) {
    return PL_CATEGORY_ORDER.length
  }

  // POS系のカテゴリ（POS単品は最後）
  const posOffset = PL_CATEGORY_ORDER.length + 1
  if (category.startsWith('POS_単品')) return posOffset + 100  // 単品は最後
  if (category.startsWith('POS_売上')) return posOffset
  if (category.startsWith('POS_効率')) return posOffset + 1
  if (category.startsWith('POS_')) return posOffset + 2  // その他POS

  return posOffset + 50  // その他カテゴリ
}

// PLの中項目をソートするための優先度を取得
function getPLItemPriority(category: string, itemName: string): number {
  const orderList = PL_ITEM_ORDER[category]
  if (!orderList) return 999

  const index = orderList.indexOf(itemName)
  if (index !== -1) return index

  // 部分一致も試す（「○○合計」など）
  for (let i = 0; i < orderList.length; i++) {
    if (itemName.includes(orderList[i]) || orderList[i].includes(itemName)) {
      return i + 0.5  // 完全一致より後、未定義より前
    }
  }

  return 999
}

export default function ColumnSelectorTable({
  clientId,
  entityId,
  onClose,
  onSave
}: ColumnSelectorTableProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchColumns()
    loadSavedSelection()
  }, [clientId, entityId])

  const fetchColumns = async () => {
    try {
      const url = entityId
        ? `/api/clients/${clientId}/entities/${entityId}/columns`
        : `/api/clients/${clientId}/columns`

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        const cols = data.data.columns.map((col: ColumnInfo) => ({
          ...col,
          isSystem: col.isSystem ?? col.name.startsWith('_')
        }))
        setColumns(cols)
      } else {
        setError(data.error || 'カラム取得に失敗しました')
      }
    } catch {
      setError('カラム取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const loadSavedSelection = () => {
    const saved = getSelectedColumns(clientId, entityId)
    setSelected(new Set(saved.map(col => col.name)))
  }

  // カラムを中項目×区分のマトリックスに変換
  const { items, kubuns, categoryGroups } = useMemo(() => {
    const itemMap = new Map<string, {
      category: string
      unit: string
      kubuns: Map<string, string>  // kubun -> columnName
    }>()
    const kubunSet = new Set<string>()

    for (const col of columns) {
      if (col.isSystem) continue

      const { item, kubun } = parseColumnName(col.name)
      kubunSet.add(kubun)

      if (!itemMap.has(item)) {
        itemMap.set(item, {
          category: col.category || '',
          unit: col.unit || '',
          kubuns: new Map()
        })
      }
      itemMap.get(item)!.kubuns.set(kubun, col.name)
    }

    // 区分は11個固定で表示（データにない区分も「-」で表示）
    const sortedKubuns = [...KUBUN_ORDER]

    // 中項目をカテゴリでグループ化してソート
    const categoryMap = new Map<string, { item: string; data: typeof itemMap extends Map<string, infer V> ? V : never }[]>()

    for (const [item, data] of itemMap) {
      const cat = data.category || 'その他'
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, [])
      }
      categoryMap.get(cat)!.push({ item, data })
    }

    // カテゴリをソート
    const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
      const pa = getCategoryPriority(a)
      const pb = getCategoryPriority(b)
      if (pa !== pb) return pa - pb
      return a.localeCompare(b)
    })

    const groups = sortedCategories.map(cat => {
      const items = categoryMap.get(cat)!

      // PLカテゴリの場合は中項目の順序でソート
      if (cat.startsWith('PL_')) {
        items.sort((a, b) => {
          const priorityA = getPLItemPriority(cat, a.item)
          const priorityB = getPLItemPriority(cat, b.item)
          if (priorityA !== priorityB) return priorityA - priorityB
          return a.item.localeCompare(b.item)
        })
      }

      return {
        category: cat,
        items
      }
    })

    return {
      items: itemMap,
      kubuns: sortedKubuns,
      categoryGroups: groups
    }
  }, [columns])

  // チェック状態を切り替え
  const toggleCell = (columnName: string) => {
    setSelected(prev => {
      const newSet = new Set(prev)
      if (newSet.has(columnName)) {
        newSet.delete(columnName)
      } else {
        newSet.add(columnName)
      }
      return newSet
    })
  }

  // 行全体のチェック状態を切り替え
  const toggleRow = (itemName: string) => {
    const itemData = items.get(itemName)
    if (!itemData) return

    const columnNames = Array.from(itemData.kubuns.values())
    const allSelected = columnNames.every(name => selected.has(name))

    setSelected(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // 全解除
        columnNames.forEach(name => newSet.delete(name))
      } else {
        // 全選択
        columnNames.forEach(name => newSet.add(name))
      }
      return newSet
    })
  }

  // 列全体のチェック状態を切り替え
  const toggleKubunColumn = (kubun: string) => {
    const columnNames: string[] = []
    for (const [, data] of items) {
      const colName = data.kubuns.get(kubun)
      if (colName) columnNames.push(colName)
    }

    const allSelected = columnNames.every(name => selected.has(name))

    setSelected(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        columnNames.forEach(name => newSet.delete(name))
      } else {
        columnNames.forEach(name => newSet.add(name))
      }
      return newSet
    })
  }

  const handleSave = () => {
    const selectedColumns: SelectedColumn[] = columns
      .filter(col => selected.has(col.name))
      .map(col => ({
        name: col.name,
        label: col.label || col.name,
        type: col.type,
        unit: col.unit || ''
      }))

    saveSelectedColumns(clientId, selectedColumns, entityId)
    onSave(selectedColumns)
    onClose()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold">データ項目の設定</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 shrink-0">
              {error}
            </div>
          )}

          {/* 表形式 - 縦横スクロール対応 */}
          <div className="flex-1 overflow-auto relative">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-white border-b-2 border-gray-300">
                  <th className="p-2 text-left font-medium text-gray-700 min-w-[200px] bg-white sticky left-0 z-20">
                    項目名
                  </th>
                  {kubuns.map(kubun => (
                    <th key={kubun} className="p-2 text-center font-medium text-gray-700 min-w-[70px] bg-white">
                      <button
                        onClick={() => toggleKubunColumn(kubun)}
                        className="hover:text-blue-600 hover:underline whitespace-nowrap"
                      >
                        {kubun}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryGroups.map(group => (
                  <React.Fragment key={group.category}>
                    {/* カテゴリヘッダー */}
                    <tr className="bg-gray-100">
                      <td colSpan={kubuns.length + 1} className="p-2 font-semibold text-gray-600 text-xs uppercase tracking-wide sticky left-0 bg-gray-100">
                        {group.category.replace('PL_', 'PL ').replace('POS_', 'POS ')}
                      </td>
                    </tr>
                    {/* 項目行 */}
                    {group.items.map(({ item, data }) => {
                      const allKubuns = Array.from(data.kubuns.values())
                      const allSelected = allKubuns.length > 0 && allKubuns.every(name => selected.has(name))
                      const someSelected = allKubuns.some(name => selected.has(name))

                      return (
                        <tr key={item} className="border-b border-gray-100 hover:bg-gray-50 group">
                          {/* 項目名 + 行チェックボックス */}
                          <td className="p-2 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleRow(item)}
                                className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                                  allSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : someSelected
                                    ? 'bg-blue-200 border-blue-400 text-blue-600'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {allSelected && <Check size={14} />}
                                {someSelected && !allSelected && <Minus size={14} />}
                              </button>
                              <span className="text-gray-800">{item}</span>
                              {data.unit && (
                                <span className="text-xs text-gray-400">({data.unit})</span>
                              )}
                            </div>
                          </td>
                          {/* 区分セル */}
                          {kubuns.map(kubun => {
                            const columnName = data.kubuns.get(kubun)
                            if (!columnName) {
                              // データなし
                              return (
                                <td key={kubun} className="p-2 text-center text-gray-300">
                                  -
                                </td>
                              )
                            }
                            const isChecked = selected.has(columnName)
                            return (
                              <td key={kubun} className="p-2 text-center">
                                <button
                                  onClick={() => toggleCell(columnName)}
                                  className={`w-6 h-6 rounded flex items-center justify-center border mx-auto ${
                                    isChecked
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                  }`}
                                >
                                  {isChecked && <Check size={14} />}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-500">
            {selected.size} 項目を選択中
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
            >
              全解除
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
