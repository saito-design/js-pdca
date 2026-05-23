/**
 * ポータルトークン（X-Portal-Token ヘッダー）をサーバー側でデコードし、
 * 編集権限を判定するユーティリティ。
 *
 * トークン形式（portal-junestry と共通）:
 *   Buffer.from(JSON.stringify({ role, company, storeId, exp })).toString('base64')
 *
 * 編集可能ロール: owner / manager / store
 * 閲覧専用ロール: staff / consultant
 */
import { NextRequest } from 'next/server'

export type PortalRole = 'owner' | 'manager' | 'store' | 'staff' | 'consultant'

export interface PortalTokenPayload {
  role: PortalRole
  company?: string
  storeId?: string
  exp: number
}

const EDITOR_ROLES: ReadonlySet<PortalRole> = new Set(['owner', 'manager', 'store'])

export function decodePortalToken(req: NextRequest): PortalTokenPayload | null {
  const token = req.headers.get('X-Portal-Token') || req.headers.get('x-portal-token')
  if (!token) return null
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8')
    const payload = JSON.parse(json) as PortalTokenPayload
    if (typeof payload.role !== 'string') return null
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/**
 * 編集API冒頭で呼ぶ。staff/consultant の場合は Error('PortalReadOnly') を throw する。
 * トークンが付いていない場合は（後方互換のため）スルーする。
 *   → ポータル経由のアクセスのみガード。直接 URL 叩きは別レイヤで対応。
 */
export function assertPortalEditAllowed(req: NextRequest): void {
  const payload = decodePortalToken(req)
  if (!payload) return
  if (!EDITOR_ROLES.has(payload.role)) {
    throw new Error('PortalReadOnly')
  }
}

export function isPortalEditor(req: NextRequest): boolean {
  const payload = decodePortalToken(req)
  if (!payload) return true // no token → assume legacy access
  return EDITOR_ROLES.has(payload.role)
}
