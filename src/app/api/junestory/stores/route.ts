import { NextResponse } from 'next/server'
import { loadJsonFromFolder } from '@/lib/drive'

// 企業マスタのstores.json形式
interface MasterStoreData {
  company_name?: string
  generated_at?: string
  stores: Array<{
    store_code: string
    name: string
    [key: string]: unknown
  }>
  pos_code_mapping?: Record<string, string>
}

export async function GET() {
  try {
    const masterFolderId = process.env.MASTER_FOLDER_ID
    if (!masterFolderId) {
      return NextResponse.json({
        success: false,
        error: 'MASTER_FOLDER_ID is not configured'
      }, { status: 500 })
    }

    const result = await loadJsonFromFolder<MasterStoreData>('stores.json', masterFolderId)

    if (!result) {
      return NextResponse.json({
        success: false,
        error: '店舗マスタファイルが見つかりません'
      }, { status: 404 })
    }

    return new NextResponse(JSON.stringify({
      success: true,
      data: result.data.stores,
      meta: {
        company_name: result.data.company_name,
        total_stores: result.data.stores.length,
        pos_code_mapping: result.data.pos_code_mapping,
      }
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  } catch (error) {
    console.error('Stores fetch error:', error)
    return NextResponse.json({
      success: false,
      error: 'データ取得に失敗しました'
    }, { status: 500 })
  }
}
