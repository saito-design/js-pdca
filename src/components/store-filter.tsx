'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Entity } from '@/lib/types'

// 店舗コードから業態を判定（BIツールと同じロジック）
function getBrand(storeCode: string): { key: string; name: string } {
  if (storeCode === '9999' || storeCode === '8888') return { key: 'other', name: 'その他' }
  if (storeCode.startsWith('23')) return { key: 'toriyaro', name: '鶏ヤロー' }
  if (storeCode.startsWith('11')) return { key: 'kintaro', name: '均タロー' }
  if (storeCode.startsWith('31')) return { key: 'kintaro_single', name: 'きんたろう' }
  if (storeCode.startsWith('41')) return { key: 'uoemon', name: '魚ゑもん' }
  return { key: 'other', name: 'その他' }
}

export interface StoreMeta {
  store_code: string
  brand: string
  brandName: string
  name: string
}

export interface ManagerMapping {
  manager: string
  storeCodes: string[]
}

interface StoreFilterProps {
  entities: Entity[]
  storeMap: Map<string, StoreMeta> // entity.id → StoreMeta
  managers: ManagerMapping[]
  onFilter: (filteredIds: string[] | null) => void // null=全表示
}

export function StoreFilter({ entities, storeMap, managers, onFilter }: StoreFilterProps) {
  const [brand, setBrand] = useState<string | null>(null)
  const [manager, setManager] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [storeOpen, setStoreOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)

  // 業態一覧を抽出
  const brands = useMemo(() => {
    const seen = new Map<string, string>()
    for (const [, meta] of storeMap) {
      if (!seen.has(meta.brand)) seen.set(meta.brand, meta.brandName)
    }
    return Array.from(seen.entries()).map(([key, name]) => ({ key, name }))
  }, [storeMap])

  // 業態・マネジャーでフィルタされたエンティティ
  const filteredEntities = useMemo(() => {
    return entities.filter(e => {
      const meta = storeMap.get(e.id)
      if (!meta) return !brand && !manager // メタなしはフィルタ無し時のみ表示
      if (brand && meta.brand !== brand) return false
      if (manager) {
        const m = managers.find(m => m.manager === manager)
        if (m && !m.storeCodes.includes(meta.store_code)) return false
      }
      return true
    })
  }, [entities, storeMap, brand, manager, managers])

  // フィルター変更の共通ロジック
  const applyFilters = (newBrand: string | null, newMgr: string | null, singleId?: string | null) => {
    setBrand(newBrand)
    setManager(newMgr)
    setSelectedEntityId(singleId || null)

    if (singleId) {
      onFilter([singleId])
      return
    }

    if (!newBrand && !newMgr) {
      onFilter(null) // 全表示
      return
    }

    const ids = entities.filter(e => {
      const meta = storeMap.get(e.id)
      if (!meta) return false
      if (newBrand && meta.brand !== newBrand) return false
      if (newMgr) {
        const m = managers.find(m => m.manager === newMgr)
        if (m && !m.storeCodes.includes(meta.store_code)) return false
      }
      return true
    }).map(e => e.id)

    onFilter(ids.length > 0 ? ids : [])
  }

  const handleBrandChange = (b: string | null) => {
    applyFilters(b, manager)
  }

  const handleManagerChange = (mgr: string | null) => {
    applyFilters(brand, mgr)
    setManagerOpen(false)
  }

  const handleStoreSelect = (entityId: string | null) => {
    if (entityId === null) {
      applyFilters(brand, manager)
    } else {
      applyFilters(brand, manager, entityId)
    }
    setStoreOpen(false)
  }

  const selectedEntity = selectedEntityId ? entities.find(e => e.id === selectedEntityId) : null

  return (
    <div className="bg-white rounded-xl shadow p-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* 業態チップ */}
        <span className="text-xs text-gray-400 mr-1">業態:</span>
        <button
          onClick={() => handleBrandChange(null)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            !brand
              ? 'bg-teal-50 border-teal-300 text-teal-700 font-medium'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          全て
        </button>
        {brands.map(b => (
          <button
            key={b.key}
            onClick={() => handleBrandChange(b.key)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              brand === b.key
                ? 'bg-teal-50 border-teal-300 text-teal-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {b.name}
          </button>
        ))}

        {/* マネジャーフィルター */}
        {managers.length > 0 && (
          <>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <span className="text-xs text-gray-400 mr-1">MGR:</span>
            <div className="relative">
              <button
                onClick={() => setManagerOpen(!managerOpen)}
                className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors ${
                  manager
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {manager || '全員'}
                <ChevronDown size={12} />
              </button>

              {managerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setManagerOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto min-w-[160px]">
                    <button
                      onClick={() => handleManagerChange(null)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                        !manager ? 'font-medium text-indigo-600' : 'text-gray-700'
                      }`}
                    >
                      全員
                    </button>
                    {managers.map(m => (
                      <button
                        key={m.manager}
                        onClick={() => handleManagerChange(m.manager)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                          manager === m.manager ? 'font-medium text-indigo-600' : 'text-gray-700'
                        }`}
                      >
                        {m.manager}
                        <span className="text-gray-400 ml-1">({m.storeCodes.length}店)</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="h-4 w-px bg-gray-200 mx-1" />

        {/* 店舗ドロップダウン */}
        <span className="text-xs text-gray-400 mr-1">店舗:</span>
        <div className="relative">
          <button
            onClick={() => setStoreOpen(!storeOpen)}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors ${
              selectedEntity
                ? 'bg-teal-50 border-teal-300 text-teal-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {selectedEntity ? selectedEntity.name : '全店舗'}
            <ChevronDown size={12} />
          </button>

          {storeOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStoreOpen(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto min-w-[200px]">
                <button
                  onClick={() => handleStoreSelect(null)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                    !selectedEntity ? 'font-medium text-teal-600' : 'text-gray-700'
                  }`}
                >
                  全店舗
                </button>
                {filteredEntities.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleStoreSelect(e.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                      selectedEntity?.id === e.id ? 'font-medium text-teal-600' : 'text-gray-700'
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// エンティティと店舗マスタのマッチング関数
export function buildStoreMap(
  entities: Entity[],
  stores: { store_code: string; name: string; [key: string]: unknown }[]
): Map<string, StoreMeta> {
  const map = new Map<string, StoreMeta>()

  // 正規化関数（!！スペース差異を吸収）
  const normalize = (s: string) =>
    s.replace(/[!！]/g, '').replace(/\s+/g, '').replace(/店$/, '')

  for (const entity of entities) {
    const normEntity = normalize(entity.name)
    for (const store of stores) {
      const normStore = normalize(store.name)
      if (normEntity === normStore || normEntity.includes(normStore) || normStore.includes(normEntity)) {
        const b = getBrand(store.store_code)
        map.set(entity.id, {
          store_code: store.store_code,
          brand: b.key,
          brandName: b.name,
          name: store.name,
        })
        break
      }
    }
  }

  return map
}
