'use client'

import { useState, useEffect } from 'react'
import { MessageSquarePlus, X } from 'lucide-react'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'

interface Props {
  appId: string
  appName: string
  tokenKey: string
}

function normalizeBase64Token(token: string): string {
  // URLクエリ/フォーム経由で base64 が壊れるケースを吸収する
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

function decodeToken(token: string): { role: string; exp: number } | null {
  try { return JSON.parse(atob(normalizeBase64Token(token))) } catch { return null }
}

export function FeedbackButton({ appId, appName, tokenKey }: Props) {
  const [role, setRole] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const urlToken = new URLSearchParams(window.location.search).get('auth_token')
    if (urlToken) {
      const d = decodeToken(urlToken)
      if (d && d.exp > Date.now()) return d.role
    }
    const stored = sessionStorage.getItem(tokenKey)
    if (!stored) return null
    const d = decodeToken(stored)
    return d && d.exp > Date.now() ? d.role : null
  })
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<'system' | 'config'>('config')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem(tokenKey)
    if (!token) return
    const decoded = decodeToken(token)
    if (decoded && decoded.exp > Date.now()) setRole(decoded.role)
  }, [tokenKey])

  if (role !== 'owner' && role !== 'manager') return null

  const handleSubmit = async () => {
    const token = sessionStorage.getItem(tokenKey)
    if (!token || !content.trim()) return
    setSubmitting(true)
    try {
      await fetch(`${PORTAL_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Portal-Token': token },
        body: JSON.stringify({ appId, appName, category, content }),
      })
      setDone(true)
      setTimeout(() => { setOpen(false); setContent(''); setDone(false) }, 1500)
    } catch {
      // silent fail
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-teal-500 hover:bg-teal-600 text-white rounded-full p-3 shadow-lg transition-colors"
        title="気づきを入力"
      >
        <MessageSquarePlus size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">気づきを入力 — {appName}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="py-8 text-center text-teal-600 font-medium">✓ 送信しました</div>
            ) : (
              <>
                <div className="flex gap-3 mb-4">
                  {(['config', 'system'] as const).map(cat => (
                    <label key={cat} className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                      category === cat ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="fb-category" value={cat} checked={category === cat}
                        onChange={() => setCategory(cat)} className="accent-teal-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {cat === 'config' ? '運用・設定調整' : 'システム改修'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className={`text-xs rounded-lg p-3 mb-4 ${
                  category === 'system' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
                }`}>
                  {category === 'config' ? (
                    <p>例：設定値・マスタの変更、表示店舗の追加削除、基準値の更新 など</p>
                  ) : (
                    <>
                      <p>例：新機能追加・グラフ追加・画面レイアウト変更・計算ロジック変更 など</p>
                      <p className="text-amber-700 font-medium pt-1 border-t border-amber-200 mt-1">
                        ※ システム改修を伴う場合はご要望にお応えし兼ねる場合がございます。あらかじめご了承ください。
                      </p>
                    </>
                  )}
                </div>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="ご要望・気づきをご記入ください"
                  rows={4}
                  maxLength={1000}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none mb-1"
                />
                <p className="text-right text-xs text-gray-400 mb-4">{content.length}/1000</p>

                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                    キャンセル
                  </button>
                  <button onClick={handleSubmit} disabled={submitting || !content.trim()}
                    className="flex-1 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                    {submitting ? '送信中...' : '送信'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
