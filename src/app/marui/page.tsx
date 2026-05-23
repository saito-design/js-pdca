'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'

function normalizeBase64Token(token: string): string {
  let t = token
  try { t = decodeURIComponent(t) } catch { /* ignore */ }
  t = t.trim()
  t = t.replace(/\s/g, '+')
  t = t.replace(/-/g, '+').replace(/_/g, '/')
  const mod = t.length % 4
  if (mod === 2) t += '=='
  else if (mod === 3) t += '='
  return t
}

// 認証トークンをデコード
function decodeToken(token: string): { role: string; company: string; exp: number } | null {
  try {
    return JSON.parse(atob(normalizeBase64Token(token)))
  } catch {
    return null
  }
}

export default function MaruiPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">認証確認中...</div>
      </div>
    }>
      <MaruiContent />
    </Suspense>
  )
}

function MaruiContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    // URLからトークンを確認
    const urlToken = searchParams.get('auth_token')
    if (urlToken) {
      const decoded = decodeToken(urlToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === 'marui') {
        sessionStorage.setItem('auth_marui', urlToken)
        window.history.replaceState({}, '', window.location.pathname)
        // 認証OK - クライアントページへリダイレクト
        router.replace('/clients/client-mlvqwk7k-3asz')
        return
      }
    }

    // セッションからトークンを確認
    const sessionToken = sessionStorage.getItem('auth_marui')
    if (sessionToken) {
      const decoded = decodeToken(sessionToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === 'marui') {
        router.replace('/clients/client-mlvqwk7k-3asz')
        return
      } else {
        sessionStorage.removeItem('auth_marui')
      }
    }

    // 認証なし
    setIsAuthorized(false)
  }, [router, searchParams])

  // 認証チェック中
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">認証確認中...</div>
      </div>
    )
  }

  // 未認証
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 p-3 rounded-full">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
        <p className="text-sm text-gray-600 mb-6">
          ポータルからログインしてください。
        </p>
        <a
          href={PORTAL_URL}
          className="inline-block w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ポータルへ移動
        </a>
      </div>
    </div>
  )
}
