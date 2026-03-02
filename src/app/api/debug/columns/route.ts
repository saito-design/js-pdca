import { NextRequest, NextResponse } from 'next/server'

// デバッグ用：選択されたカラムの確認（開発環境のみ）
export async function GET(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const entityId = searchParams.get('entityId')

  return NextResponse.json({
    success: true,
    message: 'LocalStorageはサーバーからはアクセスできません。ブラウザのコンソールで以下を実行してください：',
    commands: {
      getSelectedColumns: `localStorage.getItem('pdca_columns_${clientId || '{clientId}'}_${entityId || '{entityId}'}')`,
      getAllKeys: `Object.keys(localStorage).filter(k => k.startsWith('pdca_'))`,
    }
  })
}
