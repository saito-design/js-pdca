/**
 * ポータル認証ユーティリティ
 *
 * このファイルを各アプリにコピーして使用します。
 * 各アプリの src/lib/portal-auth.ts に配置してください。
 */

export interface PortalSession {
  role: 'owner' | 'manager' | 'staff'
  company: string
  exp: number
  storeId?: string  // 権限2(店長)/権限3(一般社員)の場合に正式店番が入る
}

/**
 * URLパラメータから認証トークンを取得・検証
 */
export function getPortalAuth(): PortalSession | null {
  if (typeof window === 'undefined') return null

  // URLパラメータからトークン取得
  const params = new URLSearchParams(window.location.search)
  const token = params.get('auth_token')

  if (token) {
    try {
      const payload = JSON.parse(atob(token)) as PortalSession
      if (payload.exp > Date.now()) {
        sessionStorage.setItem('portal_auth', token)
        const url = new URL(window.location.href)
        url.searchParams.delete('auth_token')
        window.history.replaceState({}, '', url.toString())
        return payload
      }
    } catch {
      // 無効なトークン
    }
  }

  // sessionStorage から取得
  const stored = sessionStorage.getItem('portal_auth')
  if (stored) {
    try {
      const payload = JSON.parse(atob(stored)) as PortalSession
      if (payload.exp > Date.now()) {
        return payload
      }
      sessionStorage.removeItem('portal_auth')
    } catch {
      sessionStorage.removeItem('portal_auth')
    }
  }

  return null
}

export function isPortalAuthenticated(): boolean {
  return getPortalAuth() !== null
}

export function clearPortalAuth(): void {
  sessionStorage.removeItem('portal_auth')
}

/** owner権限（マネジャー）かどうか */
export function isOwner(): boolean {
  return getPortalAuth()?.role === 'owner'
}

/** 店長以上（owner or manager）かどうか */
export function isManagerOrAbove(): boolean {
  const role = getPortalAuth()?.role
  return role === 'owner' || role === 'manager'
}

/** 店舗アカウント（manager or staff）かどうか */
export function isStoreAccount(): boolean {
  const role = getPortalAuth()?.role
  return role === 'manager' || role === 'staff'
}
