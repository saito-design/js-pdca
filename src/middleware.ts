import { NextRequest, NextResponse } from 'next/server'

/**
 * ポータルトークン経由でアクセスしてきた staff/consultant ロールに対し、
 * 編集系HTTPメソッド (POST/PUT/PATCH/DELETE) を全API共通で拒否する。
 *
 * トークン形式: Base64( JSON({ role, company, storeId, exp }) )
 * 編集可能ロール: owner / manager / store
 * 閲覧専用ロール: staff / consultant
 *
 * トークン無しのリクエストはスルー（後方互換、直接URL叩きは別レイヤーで扱う）
 */

const EDIT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const EDITOR_ROLES = new Set(['owner', 'manager', 'store'])

export function middleware(req: NextRequest) {
  if (!EDIT_METHODS.has(req.method)) return NextResponse.next()

  const token = req.headers.get('x-portal-token')
  if (!token) return NextResponse.next()

  let role: string | undefined
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'))
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) {
      return NextResponse.next()
    }
    role = payload.role
  } catch {
    return NextResponse.next()
  }

  if (role && !EDITOR_ROLES.has(role)) {
    return NextResponse.json(
      { success: false, error: '閲覧専用ロールでは編集できません' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
