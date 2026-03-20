'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

type LoadResult = {
  created: number
  errors: number
  wishIds: string[]
  details?: { email: string; error: string }[]
}

type MatchResult = {
  message: string
  started: number
}

export default function TestDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading]         = useState(false)
  const [loadResult, setLoadResult]   = useState<LoadResult | null>(null)
  const [matching, setMatching]       = useState(false)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [error, setError]             = useState<string | null>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('נא לבחור קובץ CSV'); return }

    setLoading(true)
    setError(null)
    setLoadResult(null)
    setMatchResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/load-test-data', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בטעינה')
      setLoadResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRunMatching(wishIds?: string[]) {
    setMatching(true)
    setError(null)
    setMatchResult(null)

    try {
      const res = await fetch('/api/admin/run-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wishIds ? { wishIds } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהפעלת matching')
      setMatchResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand-50" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/" className="text-sm text-well-500 hover:text-well-700 underline">
              ← חזרה לדף הבית
            </Link>
            <Link href="/admin/connections" className="text-sm text-well-600 hover:text-well-800 underline font-medium">
              🔍 תחקור חיבורים
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-well-900 mt-4" style={{ fontFamily: 'var(--font-frank-ruhl)' }}>
            טעינת נתוני בדיקה
          </h1>
          <p className="text-sm text-well-500 mt-1">
            טען CSV של משאלות ולאחר מכן הפעל את מנוע ההתאמה על כולן.
          </p>
        </div>

        {/* Step 1 — Upload CSV */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-well-800 mb-4">שלב 1 — טעינת קובץ CSV</h2>
          <p className="text-xs text-well-500 mb-4">
            פורמט עמודות: שם, עיר, אזור, מספר בית, טלפון, אימייל, משאלה
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="text-sm text-well-700 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-sand-300 file:text-sm file:bg-sand-50 file:text-well-700 hover:file:bg-sand-100"
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'טוען...' : 'העלה וצור משאלות'}
            </button>
          </div>

          {/* Load result */}
          {loadResult && (
            <div className="mt-5 space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-700 font-medium">✓ נוצרו: {loadResult.created} משאלות</span>
                {loadResult.errors > 0 && (
                  <span className="text-red-600 font-medium">✗ שגיאות: {loadResult.errors}</span>
                )}
              </div>
              {loadResult.details && loadResult.details.length > 0 && (
                <details className="text-xs text-red-600">
                  <summary className="cursor-pointer">פרטי שגיאות</summary>
                  <ul className="mt-1 space-y-0.5 pr-3">
                    {loadResult.details.map((d, i) => (
                      <li key={i}>{d.email}: {d.error}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Step 2 — Run Matching */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-well-800 mb-2">שלב 2 — הפעלת מנוע ההתאמה</h2>
          <p className="text-xs text-well-500 mb-4">
            מפעיל את pipeline ה-Matching ברקע על כל המשאלות הציבוריות במערכת (או רק על הטעונות כעת).
            התהליך רץ ברקע — תוצאות יופיעו ב-<code className="bg-sand-100 px-1 rounded">wish_connections</code> בהדרגה.
          </p>

          <div className="flex gap-3 flex-wrap">
            {loadResult && loadResult.wishIds.length > 0 && (
              <button
                onClick={() => handleRunMatching(loadResult.wishIds)}
                disabled={matching}
                className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
              >
                {matching ? 'מפעיל...' : `הפעל matching על ${loadResult.wishIds.length} שנטענו`}
              </button>
            )}
            <button
              onClick={() => handleRunMatching()}
              disabled={matching}
              className="text-sm px-4 py-2 rounded-xl border border-well-300 text-well-700 hover:bg-well-50 disabled:opacity-50"
            >
              {matching ? 'מפעיל...' : 'הפעל על כל המשאלות הציבוריות'}
            </button>
          </div>

          {matchResult && (
            <div className="mt-4 text-sm text-emerald-700 font-medium">
              ✓ {matchResult.message}
            </div>
          )}
        </div>

        {/* Global error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Monitor link */}
        {matchResult && (
          <div className="text-center mt-6">
            <p className="text-xs text-well-400 mb-2">לניטור התוצאות ב-Supabase:</p>
            <pre className="text-xs bg-sand-100 rounded-lg p-3 text-right whitespace-pre-wrap text-well-700">{`select wc.match_score, wc.match_type, wc.explanation,\n       mal.intent_compatibility, mal.freshness_factor\nfrom wish_connections wc\njoin match_attempts_log mal\n  on mal.wish_id = wc.wish_a or mal.wish_id = wc.wish_b\norder by wc.created_at desc\nlimit 20;`}</pre>
          </div>
        )}

      </div>
    </div>
  )
}
