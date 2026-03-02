/**
 * 数値フォーマット用ユーティリティ
 */

// 円単位のまま表示するカラム名パターン
const YEN_UNIT_PATTERNS = [
  '客単価',
  '組単価',
  '坪売上',
  'ADR',
  'RevPAR',
  '単価',
]

// 千円単位で表示するカラム名パターン
const THOUSAND_YEN_PATTERNS = [
  '売上',
  '室料',
  '宿泊料',
  '原価',
  '利益',
  '費',
  '収入',
  '支出',
  '経費',
]

/**
 * 値が千円単位で表示すべきかどうか判定
 */
export function shouldUseThousandYen(columnName?: string, value?: number): boolean {
  if (!columnName) {
    // カラム名がない場合は金額で判断（10万円以上なら千円単位）
    return value !== undefined && Math.abs(value) >= 100000
  }

  // 円単位のままにするパターンに該当するか
  if (YEN_UNIT_PATTERNS.some(pattern => columnName.includes(pattern))) {
    return false
  }

  // 千円単位にするパターンに該当するか
  if (THOUSAND_YEN_PATTERNS.some(pattern => columnName.includes(pattern))) {
    return true
  }

  // どちらにも該当しない場合は金額で判断
  return value !== undefined && Math.abs(value) >= 100000
}

/**
 * 金額をフォーマット
 * @param value 数値
 * @param unit 単位（円、%など）
 * @param columnName カラム名（千円/円の判定に使用）
 * @param compact trueなら単位を省略形に
 */
export function formatCurrency(
  value: number,
  unit?: string,
  columnName?: string,
  compact?: boolean
): string {
  if (unit === '円') {
    if (shouldUseThousandYen(columnName, value)) {
      const inThousands = Math.round(value / 1000)
      return compact
        ? `${inThousands.toLocaleString()}千`
        : `${inThousands.toLocaleString()}千円`
    }
    // 円単位
    return `${Math.round(value).toLocaleString()}${compact ? '' : '円'}`
  }

  if (unit === '%') {
    return `${value.toLocaleString()}%`
  }

  if (unit === '人' || unit === '組' || unit === '室') {
    return `${Math.round(value).toLocaleString()}${compact ? '' : unit}`
  }

  return `${value.toLocaleString()}${compact ? '' : (unit || '')}`
}

/**
 * グラフ軸用のフォーマット（コンパクト表示）
 */
export function formatAxisValue(value: number, unit?: string): string {
  if (unit === '円' || unit === '千円') {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `${Math.round(value / 1000)}k`
    }
    return value.toString()
  }
  return value.toLocaleString()
}

/**
 * ツールチップ用のフォーマット
 */
export function formatTooltipValue(
  value: number,
  unit?: string,
  columnName?: string
): string {
  return formatCurrency(value, unit, columnName, false)
}
