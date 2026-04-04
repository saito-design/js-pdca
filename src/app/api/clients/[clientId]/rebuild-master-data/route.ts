import { NextRequest, NextResponse } from 'next/server'
import { requireClientAccess } from '@/lib/auth'
import { ApiResponse, PdcaIssue, PdcaCycle, Task } from '@/lib/types'
import { isDriveConfigured, loadJsonFromFolder, saveJsonToFolder } from '@/lib/drive'
import { getClientFolderId, loadEntities, getEntityFolderId } from '@/lib/entity-helpers'

const PDCA_ISSUES_FILENAME = 'pdca-issues.json'
const PDCA_CYCLES_FILENAME = 'pdca-cycles.json'
const TASKS_FILENAME = 'tasks.json'
const CYCLES_FILENAME = 'cycles.json'
const MASTER_DATA_FILENAME = 'master-data.json'

type RouteParams = {
  params: Promise<{ clientId: string }>
}

interface MasterData {
  version: string
  updated_at: string
  issues: (PdcaIssue & { entity_name?: string; date?: string })[]
  cycles: PdcaCycle[]
}

interface RebuildResult {
  issuesCount: number
  cyclesCount: number
  message: string
}

export async function POST(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse<ApiResponse<RebuildResult>>> {
  try {
    const { clientId } = await context.params
    await requireClientAccess(clientId)

    if (!clientId) {
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

    // エンティティ一覧を取得
    const entities = await loadEntities(clientFolderId)
    const entityMap = new Map(entities.map(e => [e.id, e.name]))

    const allIssues: (PdcaIssue & { entity_name?: string; date?: string })[] = []
    const allCycles: PdcaCycle[] = []

    // === 1. 旧形式フラットファイルからの読み込み ===
    try {
      const issuesResult = await loadJsonFromFolder<PdcaIssue[]>(PDCA_ISSUES_FILENAME, clientFolderId)
      if (issuesResult?.data) {
        for (const issue of issuesResult.data) {
          allIssues.push({
            ...issue,
            entity_name: entityMap.get(issue.entity_id) || '',
          })
        }
      }
    } catch { /* skip */ }

    try {
      const cyclesResult = await loadJsonFromFolder<PdcaCycle[]>(PDCA_CYCLES_FILENAME, clientFolderId)
      if (cyclesResult?.data) {
        allCycles.push(...cyclesResult.data)
      }
    } catch { /* skip */ }

    // 旧tasksからentity_name/dateを補完
    let legacyTasks: Task[] = []
    try {
      const tasksResult = await loadJsonFromFolder<Task[]>(TASKS_FILENAME, clientFolderId)
      legacyTasks = tasksResult?.data || []
    } catch { /* skip */ }

    const taskMap = new Map(legacyTasks.map(t => [t.id, { entity_name: t.entity_name, date: t.date }]))
    for (const issue of allIssues) {
      const taskInfo = taskMap.get(issue.id)
      if (taskInfo) {
        if (!issue.entity_name) issue.entity_name = taskInfo.entity_name
        if (!issue.date) issue.date = taskInfo.date
      }
      if (!issue.date) issue.date = issue.created_at?.split('T')[0] || ''
    }

    // === 2. 部門サブフォルダからの読み込み ===
    for (const entity of entities) {
      try {
        const entityFolderId = await getEntityFolderId(clientFolderId, entity.id)
        if (!entityFolderId) continue

        // tasks.json
        try {
          const tasksResult = await loadJsonFromFolder<(PdcaIssue & { entity_name?: string; date?: string })[]>(
            TASKS_FILENAME, entityFolderId
          )
          if (tasksResult?.data) {
            for (const task of tasksResult.data) {
              allIssues.push({
                ...task,
                entity_id: task.entity_id || entity.id,
                entity_name: task.entity_name || entity.name,
                date: task.date || task.created_at?.split('T')[0] || '',
              })
            }
          }
        } catch { /* skip */ }

        // cycles.json
        try {
          const cyclesResult = await loadJsonFromFolder<PdcaCycle[]>(CYCLES_FILENAME, entityFolderId)
          if (cyclesResult?.data) {
            for (const cycle of cyclesResult.data) {
              allCycles.push({
                ...cycle,
                entity_id: cycle.entity_id || entity.id,
              })
            }
          }
        } catch { /* skip */ }
      } catch (e) {
        console.warn(`部門 ${entity.name} の読み込みスキップ:`, e)
      }
    }

    // === 3. 重複除去 ===
    // Issues: entity_id + title で重複除去（新しいものを優先）
    const issueSeen = new Map<string, typeof allIssues[0]>()
    const issuesSorted = [...allIssues].sort(
      (a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
    )
    for (const issue of issuesSorted) {
      const key = `${issue.entity_id || ''}_${issue.title}`
      issueSeen.set(key, issue)
    }
    const deduplicatedIssues = Array.from(issueSeen.values())

    // Cycles: id で重複除去
    const cycleSeen = new Map<string, PdcaCycle>()
    for (const cycle of allCycles) {
      cycleSeen.set(cycle.id, cycle)
    }
    const deduplicatedCycles = Array.from(cycleSeen.values())

    // === 4. master-data.json を生成・保存 ===
    const masterData: MasterData = {
      version: '1.0',
      updated_at: new Date().toISOString(),
      issues: deduplicatedIssues,
      cycles: deduplicatedCycles,
    }

    await saveJsonToFolder(masterData, MASTER_DATA_FILENAME, clientFolderId)

    return NextResponse.json({
      success: true,
      data: {
        issuesCount: deduplicatedIssues.length,
        cyclesCount: deduplicatedCycles.length,
        message: `master-data.json を再構築しました（issues: ${deduplicatedIssues.length}件, cycles: ${deduplicatedCycles.length}件, 部門: ${entities.length}）`,
      },
    })
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
    console.error('Rebuild master-data error:', error)
    return NextResponse.json(
      { success: false, error: 'master-dataの再構築に失敗しました' },
      { status: 500 }
    )
  }
}
