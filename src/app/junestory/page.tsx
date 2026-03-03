'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'

// 認証トークンをデコード
function decodeToken(token: string): { role: string; company: string; exp: number } | null {
  try {
    return JSON.parse(atob(token))
  } catch {
    return null
  }
}

export default function JunestoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">認証確認中...</div>
      </div>
    }>
      <JunestoryContent />
    </Suspense>
  )
}

function JunestoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    // URLからトークンを確認
    const urlToken = searchParams.get('auth_token')
    if (urlToken) {
      const decoded = decodeToken(urlToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === 'junestory') {
        sessionStorage.setItem('auth_junestory', urlToken)
        window.history.replaceState({}, '', window.location.pathname)
        // 認証OK - クライアントページへリダイレクト
        router.replace('/clients/client-junestory')
        return
      }
    }

    // セッションからトークンを確認
    const sessionToken = sessionStorage.getItem('auth_junestory')
    if (sessionToken) {
      const decoded = decodeToken(sessionToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === 'junestory') {
        router.replace('/clients/client-junestory')
        return
      } else {
        sessionStorage.removeItem('auth_junestory')
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
