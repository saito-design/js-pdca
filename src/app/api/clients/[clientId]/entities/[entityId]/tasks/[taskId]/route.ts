import { NextRequest, NextResponse } from 'next/server'
import { requireClientAccess } from '@/lib/auth'
import { ApiResponse, Task, PdcaStatus } from '@/lib/types'
import { isDriveConfigured } from '@/lib/drive'
import {
  getClientFolderId,
  mutateMasterData,
  loadEntities,
} from '@/lib/entity-helpers'
import type { PdcaIssue } from '@/lib/types'

type RouteParams = {
  params: Promise<{ clientId: string; entityId: string; taskId: string }>
}

// タスク更新（PATCH）
export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<ApiResponse<Task>>> {
  try {
    const { clientId, entityId, taskId } = await context.params
    await requireClientAccess(clientId)
    const body = await request.json()

    if (!clientId || !entityId || !taskId) {
      return NextResponse.json(
        { success: false, error: '無効なパラメータです' },
        { status: 400 }
      )
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
        { success: false, error: '企業が見つかりません' },
        { status: 404 }
      )
    }

    // ステータスのバリデーション
    if (body.status && !['open', 'doing', 'done', 'paused'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'ステータスが無効です' },
        { status: 400 }
      )
    }

    let updated: (PdcaIssue & { entity_name?: string; date?: string }) | null = null
    let notFound = false
    await mutateMasterData(clientFolderId, (data) => {
      const idx = data.issues.findIndex((i) => i.id === taskId && i.entity_id === entityId)
      if (idx === -1) {
        notFound = true
        return
      }
      if (body.title !== undefined) data.issues[idx].title = body.title
      if (body.status !== undefined) data.issues[idx].status = body.status as PdcaStatus
      data.issues[idx].updated_at = new Date().toISOString()
      updated = data.issues[idx]
    })

    if (notFound || !updated) {
      return NextResponse.json(
        { success: false, error: 'タスクが見つかりません' },
        { status: 404 }
      )
    }

    // Task形式で返す
    const entities = await loadEntities(clientFolderId)
    const entity = entities.find(e => e.id === entityId)
    const updatedNonNull: PdcaIssue & { entity_name?: string; date?: string } = updated
    const updatedTask: Task = {
      id: updatedNonNull.id,
      client_id: updatedNonNull.client_id,
      entity_name: updatedNonNull.entity_name || entity?.name || '',
      title: updatedNonNull.title,
      status: updatedNonNull.status,
      date: updatedNonNull.date || updatedNonNull.created_at.split('T')[0],
      created_at: updatedNonNull.created_at,
      updated_at: updatedNonNull.updated_at,
    }

    return NextResponse.json({ success: true, data: updatedTask })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      )
    }
    console.error('Update task error:', error)
    return NextResponse.json(
      { success: false, error: 'タスクの更新に失敗しました' },
      { status: 500 }
    )
  }
}

// タスク削除（DELETE）
export async function DELETE(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { clientId, entityId, taskId } = await context.params
    await requireClientAccess(clientId)

    if (!clientId || !entityId || !taskId) {
      return NextResponse.json(
        { success: false, error: '無効なパラメータです' },
        { status: 400 }
      )
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
        { success: false, error: '企業が見つかりません' },
        { status: 404 }
      )
    }

    let notFound = false
    await mutateMasterData(clientFolderId, (data) => {
      const idx = data.issues.findIndex((i) => i.id === taskId && i.entity_id === entityId)
      if (idx === -1) {
        notFound = true
        return
      }
      data.issues.splice(idx, 1)
    })

    if (notFound) {
      return NextResponse.json(
        { success: false, error: 'タスクが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'アクセス権限がありません' },
        { status: 403 }
      )
    }
    console.error('Delete task error:', error)
    return NextResponse.json(
      { success: false, error: 'タスクの削除に失敗しました' },
      { status: 500 }
    )
  }
}
