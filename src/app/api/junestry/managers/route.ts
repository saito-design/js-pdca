import { NextResponse } from 'next/server'
import { loadJsonFromFolder } from '@/lib/drive'

export const dynamic = 'force-dynamic'

interface ManagerMapping {
  manager: string
  storeCodes: string[]
}

interface ManagerFile {
  mappings: ManagerMapping[]
}

export async function GET() {
  try {
    const masterFolderId = process.env.MASTER_FOLDER_ID
    if (!masterFolderId) {
      return NextResponse.json({ success: true, data: [] })
    }

    const result = await loadJsonFromFolder<ManagerFile>('manager_mappings.json', masterFolderId)

    return NextResponse.json({
      success: true,
      data: result?.data?.mappings || [],
    })
  } catch (error) {
    console.error('Managers fetch error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: true, data: [] })
  }
}
