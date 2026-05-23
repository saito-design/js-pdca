import { NextRequest, NextResponse } from 'next/server'
import { requireClientAccess } from '@/lib/auth'
import { ApiResponse, FieldLabels, DEFAULT_FIELD_LABELS } from '@/lib/types'
import { isDriveConfigured } from '@/lib/drive'
import {
  getClientFolderId,
  loadMasterData,
  mutateMasterData,
} from '@/lib/entity-helpers'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ clientId: string; entityId: string }>
}

// ラベル設定を取得
export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse<ApiResponse<{ fieldLabels: FieldLabels }>>> {
  try {
    const { clientId, entityId } = await context.params
    await requireClientAccess(clientId)

    if (!clientId || !entityId) {
      return NextResponse.json(
        { success: false, error: '無効なパラメータです' },
        { status: 400 }
      )
    }

    if (!isDriveConfigured()) {
      return NextResponse.json({
        success: true,
        data: { fieldLabels: DEFAULT_FIELD_LABELS },
      })
    }

    const clientFolderId = await getClientFolderId(clientId)
    if (!clientFolderId) {
      return NextResponse.json({
        success: true,
        data: { fieldLabels: DEFAULT_FIELD_LABELS },
      })
    }

    const masterData = await loadMasterData(clientFolderId)
    const fieldLabels = masterData?.fieldLabels?.[entityId] || DEFAULT_FIELD_LABELS

    return NextResponse.json({
      success: true,
      data: { fieldLabels },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { success: false, error: '設定の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// ラベル設定を保存
export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<ApiResponse<{ fieldLabels: FieldLabels }>>> {
  try {
    const { clientId, entityId } = await context.params
    await requireClientAccess(clientId)

    if (!clientId || !entityId) {
      return NextResponse.json(
        { success: false, error: '無効なパラメータです' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { fieldLabels } = body as { fieldLabels?: FieldLabels }

    if (!fieldLabels) {
      return NextResponse.json(
        { success: false, error: 'fieldLabelsが必要です' },
        { status: 400 }
      )
    }

    // バリデーション
    if (!fieldLabels.situation || !fieldLabels.issue || !fieldLabels.action || !fieldLabels.target) {
      return NextResponse.json(
        { success: false, error: 'すべてのラベルを入力してください' },
        { status: 400 }
      )
    }

    // 長さチェック（基本4項目）
    const maxLen = 50
    for (const key of ['situation', 'issue', 'action', 'target'] as const) {
      const val = fieldLabels[key]
      if (typeof val !== 'string' || val.length > maxLen) {
        return NextResponse.json(
          { success: false, error: `${key}は${maxLen}文字以内で入力してください` },
          { status: 400 }
        )
      }
    }

    // カスタム項目のバリデーション
    if (fieldLabels.customFields && Array.isArray(fieldLabels.customFields)) {
      for (const cf of fieldLabels.customFields) {
        if (!cf.key || !cf.label || cf.label.length > maxLen) {
          return NextResponse.json(
            { success: false, error: 'カスタム項目のラベルを入力してください（50文字以内）' },
            { status: 400 }
          )
        }
      }
      // 空ラベルのカスタム項目を除外
      fieldLabels.customFields = fieldLabels.customFields.filter(cf => cf.label.trim())
    }

    if (!isDriveConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Google Driveが設定されていません' },
        { status: 500 }
      )
    }

    const clientFolderId = await getClientFolderId(clientId)
    if (!clientFolderId) {
      return NextResponse.json(
        { success: false, error: '企業フォルダが見つかりません' },
        { status: 404 }
      )
    }

    // master-data.jsonに保存（読込→変更→保存をトランザクション化）
    await mutateMasterData(clientFolderId, (data) => {
      if (!data.fieldLabels) data.fieldLabels = {}
      data.fieldLabels[entityId] = fieldLabels
    })

    return NextResponse.json({
      success: true,
      data: { fieldLabels },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }
    console.error('Settings PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '設定の保存に失敗しました' },
      { status: 500 }
    )
  }
}
