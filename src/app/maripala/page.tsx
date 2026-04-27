'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://js-portal-kagoshima.vercel.app'
const COMPANY_ID = 'maripala'
const SESSION_KEY = 'auth_maripala'
const CLIENT_ID = 'client-mlqgs0vx-lpyp'

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

function decodeToken(token: string): { role: string; company: string; exp: number } | null {
  try {
    return JSON.parse(atob(normalizeBase64Token(token)))
  } catch {
    return null
  }
}

export default function MaripalaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">認証確認中...</div>
      </div>
    }>
      <MaripalaContent />
    </Suspense>
  )
}

function MaripalaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const urlToken = searchParams.get('auth_token')
    if (urlToken) {
      const decoded = decodeToken(urlToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === COMPANY_ID) {
        sessionStorage.setItem(SESSION_KEY, urlToken)
        window.history.replaceState({}, '', window.location.pathname)
        router.replace(`/clients/${CLIENT_ID}`)
        return
      }
    }

    const sessionToken = sessionStorage.getItem(SESSION_KEY)
    if (sessionToken) {
      const decoded = decodeToken(sessionToken)
      if (decoded && decoded.exp > Date.now() && decoded.company === COMPANY_ID) {
        router.replace(`/clients/${CLIENT_ID}`)
        return
      } else {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }

    setIsAuthorized(false)
  }, [router, searchParams])

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">認証確認中...</div>
      </div>
    )
  }

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
